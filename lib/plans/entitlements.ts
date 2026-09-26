// lib/plans/entitlements.ts — Resolver de entitlements (SERVER-SIDE ONLY)

import { db } from "@/lib/db";
import { userSubscriptions } from "@/lib/db/schema";
import { eq, and, or, isNull, gte } from "drizzle-orm";
import { getPlanDefinition, getDefaultPlan, isValidPlanId } from "./config";
import type { PlanId, PlanDefinition, CommercialCategory, EntitlementCheck } from "./types";

/**
 * Obtener el plan actual de un usuario.
 *
 * Lógica de resolución:
 * 1. Buscar suscripción activa en user_subscriptions
 * 2. Si no existe o está inválida → FREE (fail closed)
 * 3. Si el plan guardado no es válido → FREE (fail closed)
 *
 * NUNCA confiar en plan enviado por el cliente.
 */
export async function getUserPlan(userId: string): Promise<PlanId> {
  try {
    const now = new Date();

    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, "active"),
          or(
            isNull(userSubscriptions.effectiveUntil),
            gte(userSubscriptions.effectiveUntil, now)
          )
        )
      )
      .limit(1);

    if (!subscription) {
      return getDefaultPlan(); // Fail closed → FREE
    }

    // Validar que el plan guardado es un planId válido
    if (!isValidPlanId(subscription.plan)) {
      return getDefaultPlan(); // Fail closed → FREE
    }

    return subscription.plan as PlanId;
  } catch {
    // Error de DB → fail closed
    return getDefaultPlan();
  }
}

/**
 * Obtener la definición completa del plan de un usuario.
 */
export async function getUserPlanDefinition(userId: string): Promise<PlanDefinition> {
  const planId = await getUserPlan(userId);
  return getPlanDefinition(planId);
}

/**
 * Obtener los entitlements de un usuario.
 */
export async function getEntitlements(userId: string): Promise<{
  plan: PlanId;
  planDefinition: PlanDefinition;
}> {
  const plan = await getUserPlan(userId);
  const planDefinition = getPlanDefinition(plan);
  return { plan, planDefinition };
}

/**
 * Verificar si un usuario puede usar una categoría comercial.
 *
 * En Phase 03: solo verifica el plan, NO descuenta quota.
 * Phase 04 añadirá el conteo de uso real.
 */
export async function canUseFeature(
  userId: string,
  category: CommercialCategory
): Promise<EntitlementCheck> {
  const plan = await getUserPlan(userId);
  const planDef = getPlanDefinition(plan);
  const limit = planDef.entitlements.limits[category];

  // Phase 03: sin enforcement de quota, solo verificamos el plan
  // Phase 04 añadirá: const used = await getUsageCount(userId, category);
  return {
    allowed: true, // Phase 03: no bloquea. Phase 04: bloqueará si used >= limit.
    plan,
    category,
    limit,
    used: 0, // placeholder para Phase 04
    remaining: limit === -1 ? -1 : limit, // -1 = unlimited
  };
}

/**
 * Asignar un plan a un usuario (admin only).
 * Crea o actualiza la suscripción.
 *
 * Registra auditoría: quién hizo el cambio, cuándo, de qué a qué.
 */
export async function assignPlan(
  userId: string,
  newPlan: PlanId,
  adminUserId: string,
  reason?: string
): Promise<{ success: boolean; previousPlan: PlanId; error?: string }> {
  // No permitir self-upgrade
  if (userId === adminUserId) {
    return { success: false, previousPlan: "free", error: "No se puede modificar el propio plan" };
  }

  // Validar plan destino
  if (!isValidPlanId(newPlan)) {
    return { success: false, previousPlan: "free", error: `Plan inválido: ${newPlan}` };
  }

  const previousPlan = await getUserPlan(userId);
  const now = new Date();

  try {
    // Buscar suscripción existente
    const [existing] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (existing) {
      // Actualizar existente
      await db
        .update(userSubscriptions)
        .set({
          plan: newPlan,
          status: "active",
          effectiveFrom: now,
          effectiveUntil: null,
          source: "admin",
          updatedAt: now,
        })
        .where(eq(userSubscriptions.id, existing.id));
    } else {
      // Crear nueva
      await db.insert(userSubscriptions).values({
        userId,
        plan: newPlan,
        status: "active",
        effectiveFrom: now,
        effectiveUntil: null,
        source: "admin",
      });
    }

    // Log de auditoría
    console.log(
      `[ADMIN] Plan change: user=${userId} from=${previousPlan} to=${newPlan} by=${adminUserId}${reason ? ` reason="${reason}"` : ""}`
    );

    return { success: true, previousPlan };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ADMIN] Error assigning plan:", msg);
    return { success: false, previousPlan, error: msg };
  }
}