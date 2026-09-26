import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { assignPlan, getUserPlan } from "@/lib/plans";
import { isValidPlanId } from "@/lib/plans/config";

/**
 * POST /api/admin/plans — Asignar plan a un usuario (admin only)
 *
 * Body: { user_id: string, plan: "free"|"pro"|"unlimited", reason?: string }
 *
 * Protección: requireAuth + ADMIN_EMAILS
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // Admin check
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
  if (adminEmails.length === 0 || !adminEmails.includes(auth.user.email.toLowerCase())) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
  }

  let body: { user_id?: string; plan?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { user_id, plan, reason } = body;

  if (!user_id) {
    return NextResponse.json({ error: "Campo 'user_id' requerido" }, { status: 400 });
  }

  if (!plan || !isValidPlanId(plan)) {
    return NextResponse.json(
      { error: `Plan inválido. Válidos: free, pro, unlimited` },
      { status: 400 }
    );
  }

  const result = await assignPlan(user_id, plan, auth.user.userId, reason);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    user_id,
    previous_plan: result.previousPlan,
    new_plan: plan,
    assigned_by: auth.user.userId,
    reason: reason || null,
  });
}

/**
 * GET /api/admin/plans?user_id=xxx — Consultar plan de un usuario
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
  if (adminEmails.length === 0 || !adminEmails.includes(auth.user.email.toLowerCase())) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "Parámetro 'user_id' requerido" }, { status: 400 });
  }

  const plan = await getUserPlan(userId);
  return NextResponse.json({ user_id: userId, plan });
}