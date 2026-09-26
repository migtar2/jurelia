import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { alerts, savedSearches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { runBaselineSnapshot } from "@/lib/alerts/executor";

/** Calculate next_run_at based on frequency */
function calcNextRun(frequency: string): Date {
  const now = new Date();
  if (frequency === "daily") {
    // Tomorrow between 8:00-10:00 CET
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0);
    return next;
  } else {
    // Weekly: same day next week
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    next.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0);
    return next;
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const rows = await db
    .select({
      id: alerts.id,
      name: alerts.name,
      frequency: alerts.frequency,
      enabled: alerts.enabled,
      notifyOnlyNew: alerts.notifyOnlyNew,
      lastRunAt: alerts.lastRunAt,
      lastSuccessAt: alerts.lastSuccessAt,
      nextRunAt: alerts.nextRunAt,
      createdAt: alerts.createdAt,
      savedSearchId: alerts.savedSearchId,
      searchName: savedSearches.name,
      searchParams: savedSearches.searchParams,
    })
    .from(alerts)
    .leftJoin(savedSearches, eq(alerts.savedSearchId, savedSearches.id))
    .where(eq(alerts.userId, auth.user.userId))
    .orderBy(alerts.createdAt);

  return NextResponse.json({ alerts: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const { saved_search_id, name, frequency } = await req.json();

    if (!saved_search_id) {
      return NextResponse.json({ error: "saved_search_id obligatorio" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });
    }
    if (!frequency || !["daily", "weekly"].includes(frequency)) {
      return NextResponse.json({ error: "Frecuencia inválida (daily o weekly)" }, { status: 400 });
    }

    // Verify saved search exists and belongs to user
    const [search] = await db
      .select({ id: savedSearches.id, userId: savedSearches.userId })
      .from(savedSearches)
      .where(eq(savedSearches.id, saved_search_id))
      .limit(1);

    if (!search) {
      return NextResponse.json({ error: "Búsqueda guardada no encontrada" }, { status: 404 });
    }
    if (search.userId !== auth.user.userId) {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const nextRunAt = calcNextRun(frequency);

    const [alert] = await db
      .insert(alerts)
      .values({
        userId: auth.user.userId,
        savedSearchId: saved_search_id,
        name: name.trim(),
        frequency,
        nextRunAt,
      })
      .returning();

    // First-run baseline: execute search and record current results as "seen"
    // Do NOT email existing results — only future unseen decisions trigger notifications
    let baselineCount = 0;
    try {
      baselineCount = await runBaselineSnapshot(alert.id);
    } catch (err) {
      // Baseline failure is non-fatal — alert is still created
      console.error("[ALERT_CREATE] Baseline snapshot failed:", err);
    }

    return NextResponse.json({
      ok: true,
      alert,
      baseline: {
        recorded: baselineCount,
        message:
          baselineCount > 0
            ? `Al crear la alerta hemos registrado ${baselineCount} resoluciones actuales. Te avisaremos de nuevas incorporaciones.`
            : "Al crear la alerta hemos registrado las resoluciones actuales. Te avisaremos de nuevas incorporaciones.",
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique")) {
      return NextResponse.json({ error: "Ya existe una alerta para esta búsqueda guardada" }, { status: 409 });
    }
    console.error("Create alert error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}