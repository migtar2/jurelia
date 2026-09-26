// lib/quota/reconcile.ts — Zombie reservation cleanup (crash recovery)
// RESERVED entries older than TTL are auto-released.

import { db } from "@/lib/db";
import { usageReservations } from "@/lib/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";

/**
 * TTL for reserved (in-flight) reservations.
 * After this period, a RESERVED entry is considered zombie (server crash / timeout).
 * Default: 5 minutes — generous for slow AI providers.
 */
const RESERVATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Release zombie reservations that have been RESERVED for longer than TTL.
 * Call this:
 * - Before a new reservation (inline cleanup)
 * - Periodically via cron if available
 *
 * Returns the number of zombie reservations released.
 */
export async function reconcileZombieReservations(): Promise<number> {
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MS);

  const result = await db
    .update(usageReservations)
    .set({ state: "released" })
    .where(
      and(
        eq(usageReservations.state, "reserved"),
        lt(usageReservations.createdAt, cutoff)
      )
    )
    .returning({ id: usageReservations.id });

  return result.length;
}

/**
 * Get count of currently zombie reservations (for monitoring).
 */
export async function countZombieReservations(): Promise<number> {
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MS);

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.state, "reserved"),
        lt(usageReservations.createdAt, cutoff)
      )
    );

  return row?.count ?? 0;
}