import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { alerts, alertExecutions, emailDeliveries, savedSearches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;

  const [alert] = await db
    .select({
      id: alerts.id,
      userId: alerts.userId,
      name: alerts.name,
      frequency: alerts.frequency,
      enabled: alerts.enabled,
      notifyOnlyNew: alerts.notifyOnlyNew,
      lastRunAt: alerts.lastRunAt,
      lastSuccessAt: alerts.lastSuccessAt,
      nextRunAt: alerts.nextRunAt,
      createdAt: alerts.createdAt,
      updatedAt: alerts.updatedAt,
      savedSearchId: alerts.savedSearchId,
      searchName: savedSearches.name,
      searchParams: savedSearches.searchParams,
    })
    .from(alerts)
    .leftJoin(savedSearches, eq(alerts.savedSearchId, savedSearches.id))
    .where(eq(alerts.id, id))
    .limit(1);

  if (!alert) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (alert.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  // Get recent executions
  const executions = await db
    .select()
    .from(alertExecutions)
    .where(eq(alertExecutions.alertId, id))
    .orderBy(alertExecutions.startedAt)
    .limit(50);

  return NextResponse.json({ alert, executions });
}

export async function PUT(
  req: NextRequest,
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

  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) updates.name = body.name;
  if (body.frequency !== undefined) {
    if (!["daily", "weekly"].includes(body.frequency)) {
      return NextResponse.json({ error: "Frecuencia inválida" }, { status: 400 });
    }
    updates.frequency = body.frequency;
  }
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.notify_only_new !== undefined) updates.notifyOnlyNew = body.notify_only_new;

  const [updated] = await db
    .update(alerts)
    .set(updates)
    .where(eq(alerts.id, id))
    .returning();

  return NextResponse.json({ ok: true, alert: updated });
}

export async function DELETE(
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

  // Explicit cascade: emailDeliveries.executionId uses onDelete: 'set null',
  // so delete deliveries and executions first to avoid orphaned rows.
  await db.delete(emailDeliveries).where(eq(emailDeliveries.alertId, id));
  await db.delete(alertExecutions).where(eq(alertExecutions.alertId, id));
  await db.delete(alerts).where(eq(alerts.id, id));

  return NextResponse.json({ ok: true });
}