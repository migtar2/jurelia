// lib/quota/engine.ts — Motor de quotas con reservación atómica

import { db } from "@/lib/db";
import { usageReservations } from "@/lib/db/schema";
import { eq, and, sql, gte, lt } from "drizzle-orm";
import { getUserPlan, getCategoryLimit } from "@/lib/plans";
import { getCurrentPeriod } from "./period";
import { reconcileZombieReservations } from "./reconcile";
import type { CommercialCategory, PlanId } from "@/lib/plans/types";
import type { QuotaCheckResult, QuotaStatus, ReservationState } from "./types";

/**
 * Verificar si la quota enforcement está activa.
 * Feature flag: QUOTA_ENFORCEMENT_ENABLED=true
 */
export function isQuotaEnforcementEnabled(): boolean {
  return process.env.QUOTA_ENFORCEMENT_ENABLED === "true";
}

/**
 * Obtener el estado de quota de un usuario para una categoría.
 */
export async function getQuotaStatus(
  userId: string,
  category: CommercialCategory,
  planId?: PlanId
): Promise<QuotaStatus> {
  const plan = planId ?? (await getUserPlan(userId));
  const limit = getCategoryLimit(plan, category);
  const period = getCurrentPeriod();

  if (limit === -1) {
    // UNLIMITED: still count for telemetry
    const used = await countUsage(userId, category, period.period_start, period.period_end);
    return {
      category,
      limit: -1,
      used,
      reserved: 0,
      remaining: -1,
      unlimited: true,
      period_start: period.period_start.toISOString(),
      period_end: period.period_end.toISOString(),
    };
  }

  // Count committed and reserved entries
  const committed = await countByState(userId, category, period.period_start, period.period_end, "committed");
  const reserved = await countByState(userId, category, period.period_start, period.period_end, "reserved");

  return {
    category,
    limit,
    used: committed,
    reserved,
    remaining: Math.max(0, limit - committed - reserved),
    unlimited: false,
    period_start: period.period_start.toISOString(),
    period_end: period.period_end.toISOString(),
  };
}

/**
 * Reservar una unidad de quota de forma atómica.
 *
 * Flujo: AUTHORIZE → RESERVE → (caller executes) → COMMIT or RELEASE
 *
 * Usa transacción SQL con SELECT ... FOR UPDATE para garantizar atomicidad.
 * No es posible que dos requests concurrentes reserven la misma unidad.
 */
export async function reserveQuota(
  userId: string,
  category: CommercialCategory,
  planId?: PlanId
): Promise<QuotaCheckResult> {
  const plan = planId ?? (await getUserPlan(userId));
  const limit = getCategoryLimit(plan, category);
  const period = getCurrentPeriod();

  // UNLIMITED: always allow, still track
  if (limit === -1) {
    const [reservation] = await db
      .insert(usageReservations)
      .values({
        userId,
        category,
        periodStart: period.period_start,
        state: "committed", // UNLIMITED auto-commits
      })
      .returning({ id: usageReservations.id });

    return {
      allowed: true,
      reservation_id: reservation.id,
      quota_status: await getQuotaStatus(userId, category, plan),
    };
  }

  // Atomic check + reserve via PL/pgSQL function
  // First: reconcile any zombie reservations (inline cleanup)
  try {
    await reconcileZombieReservations();
  } catch {
    // Non-fatal: log but don't block the reservation
  }

  // Use the PL/pgSQL function which handles advisory lock + count + insert atomically
  const result = await db.execute(
    sql`SELECT reserve_quota_atomic(${userId}::uuid, ${category}, ${period.period_start.toISOString()}::timestamptz, ${limit}) as id`
  );
  const reservationId = result.rows[0]?.id as string | null;

  if (!reservationId) {
    return {
      allowed: false,
      reservation_id: undefined,
      quota_status: await getQuotaStatus(userId, category, plan),
      reason: "QUOTA_EXCEEDED",
    };
  }

  return {
    allowed: true,
    reservation_id: reservationId,
    quota_status: await getQuotaStatus(userId, category, plan),
  };
}

/**
 * Confirmar una reserva (la operación fue exitosa).
 */
export async function commitReservation(reservationId: string): Promise<boolean> {
  try {
    const [updated] = await db
      .update(usageReservations)
      .set({ state: "committed" as ReservationState })
      .where(
        and(
          eq(usageReservations.id, reservationId),
          eq(usageReservations.state, "reserved")
        )
      )
      .returning({ id: usageReservations.id });

    return !!updated;
  } catch {
    return false;
  }
}

/**
 * Liberar una reserva (la operación falló, no consumir cuota).
 */
export async function releaseReservation(reservationId: string): Promise<boolean> {
  try {
    const [updated] = await db
      .update(usageReservations)
      .set({ state: "released" as ReservationState })
      .where(
        and(
          eq(usageReservations.id, reservationId),
          eq(usageReservations.state, "reserved")
        )
      )
      .returning({ id: usageReservations.id });

    return !!updated;
  } catch {
    return false;
  }
}

/**
 * Helper: wrapper para operaciones con quota enforcement.
 * Flujo completo: reserve → execute → commit/release
 */
export async function withQuota<T>(
  userId: string,
  category: CommercialCategory,
  operation: () => Promise<T>,
  planId?: PlanId
): Promise<{ result: T; quota: QuotaStatus } | { error: "QUOTA_EXCEEDED"; quota: QuotaStatus }> {
  // Si enforcement no está activo, ejecutar directamente
  if (!isQuotaEnforcementEnabled()) {
    const result = await operation();
    const quota = await getQuotaStatus(userId, category, planId);
    return { result, quota };
  }

  // Reservar
  const reservation = await reserveQuota(userId, category, planId);

  if (!reservation.allowed) {
    return { error: "QUOTA_EXCEEDED", quota: reservation.quota_status };
  }

  try {
    const result = await operation();
    await commitReservation(reservation.reservation_id!);
    const quota = await getQuotaStatus(userId, category, planId);
    return { result, quota };
  } catch (err) {
    await releaseReservation(reservation.reservation_id!);
    throw err; // Re-lanzar para que el caller maneje el error
  }
}

// ── Helpers ──

async function countUsage(userId: string, category: CommercialCategory, start: Date, end: Date): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.userId, userId),
        eq(usageReservations.category, category),
        gte(usageReservations.createdAt, start),
        lt(usageReservations.createdAt, end),
        eq(usageReservations.state, "committed")
      )
    );
  return result?.count ?? 0;
}

async function countByState(userId: string, category: CommercialCategory, start: Date, end: Date, state: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.userId, userId),
        eq(usageReservations.category, category),
        gte(usageReservations.createdAt, start),
        lt(usageReservations.createdAt, end),
        eq(usageReservations.state, state)
      )
    );
  return result?.count ?? 0;
}