import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;

  const [existing] = await db
    .select({ id: alerts.id, userId: alerts.userId })
    .from(alerts)
    .where(eq(alerts.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (existing.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  const [updated] = await db
    .update(alerts)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(alerts.id, id))
    .returning();

  return NextResponse.json({ ok: true, alert: updated });
}