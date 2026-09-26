import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { aiUsageLog } from "@/lib/db/schema";
import { sql, eq, and, gte, desc } from "drizzle-orm";

/**
 * GET /api/admin/ai-costs — Dashboard interno de costes AI
 *
 * Protección temporal: solo usuarios con email en ADMIN_EMAILS env var.
 * El diseño definitivo de admin se implementará en Phase 11.
 */
export async function GET() {
  // Auth
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // Admin check temporal: email en ADMIN_EMAILS (comma-separated)
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
  if (adminEmails.length === 0 || !adminEmails.includes(auth.user.email.toLowerCase())) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
  }

  try {
    // ── Coste hoy ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats] = await db
      .select({
        calls: sql<number>`count(*)::int`,
        totalCost: sql<string>`coalesce(sum(${aiUsageLog.costUsd}::numeric), 0)::text`,
        totalTokens: sql<number>`coalesce(sum(${aiUsageLog.totalTokens}), 0)::int`,
        errors: sql<number>`count(*) filter (where not ${aiUsageLog.success})::int`,
      })
      .from(aiUsageLog)
      .where(gte(aiUsageLog.createdAt, today));

    // ── Coste mes ──
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [monthStats] = await db
      .select({
        calls: sql<number>`count(*)::int`,
        totalCost: sql<string>`coalesce(sum(${aiUsageLog.costUsd}::numeric), 0)::text`,
        totalTokens: sql<number>`coalesce(sum(${aiUsageLog.totalTokens}), 0)::int`,
        errors: sql<number>`count(*) filter (where not ${aiUsageLog.success})::int`,
      })
      .from(aiUsageLog)
      .where(gte(aiUsageLog.createdAt, monthStart));

    // ── Coste por operation_type ──
    const byOperation = await db
      .select({
        operationType: aiUsageLog.operationType,
        calls: sql<number>`count(*)::int`,
        totalCost: sql<string>`coalesce(sum(${aiUsageLog.costUsd}::numeric), 0)::text`,
        avgCost: sql<string>`coalesce(avg(${aiUsageLog.costUsd}::numeric), 0)::text`,
      })
      .from(aiUsageLog)
      .where(gte(aiUsageLog.createdAt, monthStart))
      .groupBy(aiUsageLog.operationType)
      .orderBy(desc(sql`sum(${aiUsageLog.costUsd}::numeric)`));

    // ── Coste por modelo ──
    const byModel = await db
      .select({
        provider: aiUsageLog.provider,
        model: aiUsageLog.model,
        calls: sql<number>`count(*)::int`,
        totalCost: sql<string>`coalesce(sum(${aiUsageLog.costUsd}::numeric), 0)::text`,
      })
      .from(aiUsageLog)
      .where(gte(aiUsageLog.createdAt, monthStart))
      .groupBy(aiUsageLog.provider, aiUsageLog.model)
      .orderBy(desc(sql`sum(${aiUsageLog.costUsd}::numeric)`));

    // ── Coste por usuario (top 20) ──
    const byUser = await db
      .select({
        userId: aiUsageLog.userId,
        calls: sql<number>`count(*)::int`,
        totalCost: sql<string>`coalesce(sum(${aiUsageLog.costUsd}::numeric), 0)::text`,
      })
      .from(aiUsageLog)
      .where(gte(aiUsageLog.createdAt, monthStart))
      .groupBy(aiUsageLog.userId)
      .orderBy(desc(sql`sum(${aiUsageLog.costUsd}::numeric)`))
      .limit(20);

    // ── Percentiles de coste (P50, P90, P99) ──
    const [percentiles] = await db
      .select({
        p50: sql<string>`coalesce(percentile_cont(0.5) within group (order by ${aiUsageLog.costUsd}::numeric), 0)::text`,
        p90: sql<string>`coalesce(percentile_cont(0.9) within group (order by ${aiUsageLog.costUsd}::numeric), 0)::text`,
        p99: sql<string>`coalesce(percentile_cont(0.99) within group (order by ${aiUsageLog.costUsd}::numeric), 0)::text`,
      })
      .from(aiUsageLog)
      .where(gte(aiUsageLog.createdAt, monthStart));

    return NextResponse.json({
      today: {
        calls: todayStats.calls,
        total_cost_usd: todayStats.totalCost,
        total_tokens: todayStats.totalTokens,
        errors: todayStats.errors,
      },
      month: {
        calls: monthStats.calls,
        total_cost_usd: monthStats.totalCost,
        total_tokens: monthStats.totalTokens,
        errors: monthStats.errors,
      },
      by_operation: byOperation.map(o => ({
        operation_type: o.operationType,
        calls: o.calls,
        total_cost_usd: o.totalCost,
        avg_cost_usd: o.avgCost,
      })),
      by_model: byModel.map(m => ({
        provider: m.provider,
        model: m.model,
        calls: m.calls,
        total_cost_usd: m.totalCost,
      })),
      by_user: byUser.map(u => ({
        user_id: u.userId,
        calls: u.calls,
        total_cost_usd: u.totalCost,
      })),
      percentiles: {
        p50_usd: percentiles.p50,
        p90_usd: percentiles.p90,
        p99_usd: percentiles.p99,
      },
      _meta: {
        period: "current_month",
        admin_email: auth.user.email,
        note: "Dashboard temporal. Diseño definitivo en Phase 11.",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ADMIN AI COSTS] Error:", msg);
    return NextResponse.json(
      { error: `Error obteniendo datos: ${msg}` },
      { status: 500 }
    );
  }
}