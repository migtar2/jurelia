import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getUserPlan, getCategoryLimit } from "@/lib/plans";
import { getQuotaStatus } from "@/lib/quota";
import { COMMERCIAL_CATEGORIES } from "@/lib/plans/types";

/**
 * GET /api/usage — Consultar consumo del usuario autenticado
 *
 * Devuelve por cada categoría comercial:
 * - used, limit, remaining, unlimited, period_start, period_end
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const plan = await getUserPlan(auth.user.userId);

  const categories = await Promise.all(
    COMMERCIAL_CATEGORIES.map((cat) => getQuotaStatus(auth.user.userId, cat, plan))
  );

  return NextResponse.json({
    plan,
    categories: categories.map((c) => ({
      category: c.category,
      used: c.used,
      limit: c.unlimited ? "unlimited" : c.limit,
      remaining: c.unlimited ? "unlimited" : c.remaining,
      unlimited: c.unlimited,
      period_start: c.period_start,
      period_end: c.period_end,
    })),
  });
}