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
    .select({ id: alerts.id, userId: alerts.userId, frequency: alerts.frequency })
    .from(alerts)
    .where(eq(alerts.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (existing.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  // Recalculate next_run_at on resume
  const now = new Date();
  const nextRun = new Date(now);
  if (existing.frequency === "daily") {
    nextRun.setDate(nextRun.getDate() + 1);
  } else {
    nextRun.setDate(nextRun.getDate() + 7);
  }
  nextRun.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0);

  const [updated] = await db
    .update(alerts)
    .set({ enabled: true, nextRunAt: nextRun, updatedAt: new Date() })
    .where(eq(alerts.id, id))
    .returning();

  return NextResponse.json({ ok: true, alert: updated });
}