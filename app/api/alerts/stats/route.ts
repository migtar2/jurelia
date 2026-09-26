import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { alerts, alertExecutions, emailDeliveries } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * GET /api/alerts/stats
 *
 * Returns alert execution statistics for the authenticated user.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const userId = auth.user.userId;

  // ── Alert counts ──
  const [alertStats] = await db
    .select({
      alerts_total: sql<number>`count(*)::int`,
      alerts_enabled: sql<number>`count(*) filter (where ${alerts.enabled} = true)::int`,
    })
    .from(alerts)
    .where(eq(alerts.userId, userId));

  // ── Execution counts (join through alerts to scope to user) ──
  const [execStats] = await db
    .select({
      executions_total: sql<number>`count(*)::int`,
      executions_success: sql<number>`count(*) filter (where ${alertExecutions.status} = 'SUCCESS')::int`,
      executions_failed: sql<number>`count(*) filter (where ${alertExecutions.status} in ('CENDOJ_ERROR','EMAIL_ERROR','TIMEOUT','UNKNOWN_ERROR'))::int`,
      new_decisions_detected: sql<number>`coalesce(sum(${alertExecutions.newResultsCount}) filter (where ${alertExecutions.status} = 'SUCCESS'), 0)::int`,
    })
    .from(alertExecutions)
    .innerJoin(alerts, eq(alertExecutions.alertId, alerts.id))
    .where(eq(alerts.userId, userId));

  // ── Email delivery counts (join through alerts to scope to user) ──
  const [emailStats] = await db
    .select({
      emails_sent: sql<number>`count(*) filter (where ${emailDeliveries.status} in ('SENT','SIMULATED'))::int`,
      emails_failed: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'FAILED')::int`,
    })
    .from(emailDeliveries)
    .innerJoin(alerts, eq(emailDeliveries.alertId, alerts.id))
    .where(eq(alerts.userId, userId));

  return NextResponse.json({
    alerts_total: alertStats.alerts_total,
    alerts_enabled: alertStats.alerts_enabled,
    executions_total: execStats.executions_total,
    executions_success: execStats.executions_success,
    executions_failed: execStats.executions_failed,
    new_decisions_detected: execStats.new_decisions_detected,
    emails_sent: emailStats.emails_sent,
    emails_failed: emailStats.emails_failed,
  });
}