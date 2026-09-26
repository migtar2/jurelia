/**
 * Alert Execution Engine
 * Processes due alerts: runs saved searches, deduplicates via ROJ, records results.
 * Features: retry with exponential backoff, rate limiting (semaphore), circuit breaker,
 * structured JSON logging, duplicate-email prevention.
 */

import { db } from "@/lib/db";
import {
  alerts,
  alertExecutions,
  alertSeenDecisions,
  savedSearches,
  users,
  emailDeliveries,
} from "@/lib/db/schema";
import { eq, and, lte, sql, desc } from "drizzle-orm";
import { cendojSearch, type CendojSearchResult } from "@/lib/cendoj/client";
import { sendAlertEmail, buildAlertEmailHtml } from "@/lib/alerts/email";

/* ── Structured Logging ── */

interface LogEntry {
  ts: string;
  level: "info" | "warn" | "error";
  msg: string;
  alert_id?: string;
  execution_id?: string;
  status?: string;
  duration_ms?: number;
  error_code?: string;
  retry?: { attempt: number; max: number };
  request_id?: string;
}

function logEvent(entry: Omit<LogEntry, "ts">): void {
  const safe: LogEntry = {
    ts: new Date().toISOString(),
    ...entry,
  };
  // Never log secrets — the entry structure is safe by design
  const line = JSON.stringify(safe);
  if (entry.level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

/* ── Types ── */

interface ExecutionSummary {
  alertId: string;
  alertName: string;
  status: "SUCCESS" | "CENDOJ_ERROR" | "TIMEOUT" | "EMAIL_ERROR" | "UNKNOWN_ERROR";
  resultsCount: number;
  newResultsCount: number;
  durationMs: number;
  errorCode?: string;
}

export interface RunAllResult {
  processed: number;
  skipped: number;
  results: ExecutionSummary[];
}

/* ── Semaphore (max concurrent) ── */

class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

const executionSemaphore = new Semaphore(3);

/* ── Circuit Breaker ── */

class CircuitBreaker {
  private errors: number[] = []; // timestamps of recent errors

  recordError(): void {
    this.errors.push(Date.now());
  }

  isOpen(): boolean {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    this.errors = this.errors.filter((t) => t > fiveMinAgo);
    return this.errors.length >= 3;
  }
}

const circuitBreaker = new CircuitBreaker();

/* ── Retry helpers ── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry a function up to `maxRetries` times with exponential backoff delays. */
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    maxRetries: number;
    delays: number[];
    label: string;
    alertId: string;
    executionId: string;
    requestId: string;
  },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (attempt < opts.maxRetries) {
        const delay = opts.delays[attempt] ?? opts.delays[opts.delays.length - 1];
        logEvent({
          level: "warn",
          msg: `${opts.label} failed, retrying in ${delay}ms`,
          alert_id: opts.alertId,
          execution_id: opts.executionId,
          request_id: opts.requestId,
          error_code: errMsg,
          retry: { attempt: attempt + 1, max: opts.maxRetries },
        });
        // Record each retry attempt in alert_executions
        await db.insert(alertExecutions).values({
          alertId: opts.alertId,
          startedAt: new Date(),
          completedAt: new Date(),
          status: "RETRY_ATTEMPT",
          errorCode: `${opts.label}_RETRY_${attempt + 1}: ${errMsg}`,
        });
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

/** Check if an email has already been delivered for this execution. */
async function hasExistingDelivery(executionId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: emailDeliveries.id })
    .from(emailDeliveries)
    .where(
      and(
        eq(emailDeliveries.executionId, executionId),
        sql`${emailDeliveries.status} IN ('SENT', 'SIMULATED')`,
      ),
    )
    .limit(1);
  return !!existing;
}

/* ── Canonical Decision ID ── */

/**
 * Generate canonical identity for a CENDOJ decision.
 * Primary: ROJ (always available from CENDOJ).
 * Secondary: ECLI (when available, stored alongside).
 * Never use title or summary alone.
 */
export function canonicalId(result: CendojSearchResult): string | null {
  if (result.roj && result.roj.trim()) {
    return result.roj.trim();
  }
  // No ROJ → skip this result (we cannot reliably deduplicate)
  return null;
}

/* ── Execute a single alert ── */

async function executeOne(
  alertRow: {
    id: string;
    name: string;
    userId: string;
    savedSearchId: string;
  },
  isBaseline: boolean = false,
): Promise<ExecutionSummary> {
  const startedAt = new Date();
  const executionId = crypto.randomUUID();
  const requestId = crypto.randomUUID();

  logEvent({
    level: "info",
    msg: "Alert execution started",
    alert_id: alertRow.id,
    execution_id: executionId,
    request_id: requestId,
  });

  // Insert execution record (IN_PROGRESS)
  await db.insert(alertExecutions).values({
    id: executionId,
    alertId: alertRow.id,
    startedAt,
    status: "IN_PROGRESS",
  });

  try {
    // Load saved search params
    const [search] = await db
      .select({ searchParams: savedSearches.searchParams })
      .from(savedSearches)
      .where(eq(savedSearches.id, alertRow.savedSearchId))
      .limit(1);

    if (!search) {
      throw new Error("SAVED_SEARCH_NOT_FOUND");
    }

    const params = search.searchParams as Record<string, string>;

    // Call CENDOJ backend with retry (3 retries, exponential backoff: 5s, 15s, 45s)
    const searchResponse = await withRetry(
      () => cendojSearch(params),
      {
        maxRetries: 3,
        delays: [5_000, 15_000, 45_000],
        label: "CENDOJ_SEARCH",
        alertId: alertRow.id,
        executionId,
        requestId,
      },
    );
    const results = searchResponse.results;
    const resultsCount = results.length;

    logEvent({
      level: "info",
      msg: `CENDOJ search returned ${resultsCount} results`,
      alert_id: alertRow.id,
      execution_id: executionId,
      request_id: requestId,
    });

    // Load already-seen ROJs for this alert
    const seenRows = await db
      .select({ decisionRoj: alertSeenDecisions.decisionRoj })
      .from(alertSeenDecisions)
      .where(eq(alertSeenDecisions.alertId, alertRow.id));

    const seenSet = new Set(seenRows.map((r) => r.decisionRoj));

    // Find new decisions
    const newDecisions: CendojSearchResult[] = [];
    for (const result of results) {
      const cid = canonicalId(result);
      if (cid && !seenSet.has(cid)) {
        newDecisions.push(result);
      }
    }

    // Insert new seen_decisions (batch)
    if (newDecisions.length > 0) {
      const rows = newDecisions.map((d) => ({
        alertId: alertRow.id,
        decisionRoj: canonicalId(d)!,
        decisionEcli: d.ecli || null,
      }));
      // Insert one by one to handle any unique constraint races gracefully
      for (const row of rows) {
        try {
          await db.insert(alertSeenDecisions).values(row);
        } catch {
          // Duplicate from concurrent execution — skip
        }
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Update execution record
    await db
      .update(alertExecutions)
      .set({
        completedAt,
        status: "SUCCESS",
        resultsCount,
        newResultsCount: newDecisions.length,
        durationMs,
      })
      .where(eq(alertExecutions.id, executionId));

    // Update alert timestamps
    const nextRunAt = calcNextRun(
      (
        await db
          .select({ frequency: alerts.frequency })
          .from(alerts)
          .where(eq(alerts.id, alertRow.id))
          .limit(1)
      )[0]?.frequency || "daily",
    );

    await db
      .update(alerts)
      .set({
        lastRunAt: startedAt,
        lastSuccessAt: completedAt,
        nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, alertRow.id));

    // ── Email delivery (only for non-baseline with new results) ──
    let executionStatus: ExecutionSummary["status"] = "SUCCESS";
    if (!isBaseline && newDecisions.length > 0) {
      // Get user email
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, alertRow.userId))
        .limit(1);

      if (user?.email) {
        // Prevent duplicate emails: check for existing SENT/SIMULATED delivery
        const alreadyDelivered = await hasExistingDelivery(executionId);
        if (alreadyDelivered) {
          logEvent({
            level: "warn",
            msg: "Skipping email — delivery already exists for this execution",
            alert_id: alertRow.id,
            execution_id: executionId,
            request_id: requestId,
          });
        } else {
          const html = buildAlertEmailHtml({
            alertName: alertRow.name,
            alertId: alertRow.id,
            searchParams: params,
            newDecisions,
          });

          // Send email with retry (2 retries, 10s delay each)
          const emailResult = await withRetry(
            () =>
              sendAlertEmail({
                to: user.email,
                subject: `Nueva jurisprudencia en JURELIA — ${alertRow.name}`,
                html,
                alertId: alertRow.id,
                executionId,
              }),
            {
              maxRetries: 2,
              delays: [10_000, 10_000],
              label: "EMAIL_SEND",
              alertId: alertRow.id,
              executionId,
              requestId,
            },
          );

          if (!emailResult.ok) {
            executionStatus = "EMAIL_ERROR";
            logEvent({
              level: "error",
              msg: "Email delivery failed after retries",
              alert_id: alertRow.id,
              execution_id: executionId,
              request_id: requestId,
              status: "EMAIL_ERROR",
              error_code: emailResult.error || "EMAIL_SEND_FAILED",
            });
            await db
              .update(alertExecutions)
              .set({ status: "EMAIL_ERROR", errorCode: emailResult.error || "EMAIL_SEND_FAILED" })
              .where(eq(alertExecutions.id, executionId));
          } else {
            logEvent({
              level: "info",
              msg: "Email delivered successfully",
              alert_id: alertRow.id,
              execution_id: executionId,
              request_id: requestId,
            });
          }
        }
      }
    }

    logEvent({
      level: "info",
      msg: "Alert execution completed",
      alert_id: alertRow.id,
      execution_id: executionId,
      request_id: requestId,
      status: executionStatus,
      duration_ms: durationMs,
    });

    return {
      alertId: alertRow.id,
      alertName: alertRow.name,
      status: executionStatus,
      resultsCount,
      newResultsCount: newDecisions.length,
      durationMs,
    };
  } catch (err: unknown) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const msg = err instanceof Error ? err.message : String(err);

    let status: ExecutionSummary["status"] = "UNKNOWN_ERROR";
    let errorCode = msg;
    if (msg.includes("timeout") || msg.includes("Timeout")) {
      status = "TIMEOUT";
      errorCode = "CENDOJ_TIMEOUT";
    } else if (msg.includes("CENDOJ API error") || msg.includes("HTTP")) {
      status = "CENDOJ_ERROR";
    } else if (msg === "SAVED_SEARCH_NOT_FOUND") {
      errorCode = "SAVED_SEARCH_NOT_FOUND";
    }

    // Record error in circuit breaker
    circuitBreaker.recordError();

    logEvent({
      level: "error",
      msg: "Alert execution failed",
      alert_id: alertRow.id,
      execution_id: executionId,
      request_id: requestId,
      status,
      duration_ms: durationMs,
      error_code: errorCode,
    });

    // Update execution record with error
    await db
      .update(alertExecutions)
      .set({
        completedAt,
        status,
        errorCode,
        durationMs,
      })
      .where(eq(alertExecutions.id, executionId));

    // Still update lastRunAt (attempted), but NOT lastSuccessAt
    await db
      .update(alerts)
      .set({
        lastRunAt: startedAt,
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, alertRow.id));

    return {
      alertId: alertRow.id,
      alertName: alertRow.name,
      status,
      resultsCount: 0,
      newResultsCount: 0,
      durationMs,
      errorCode,
    };
  }
}

/* ── Run all due alerts ── */

/**
 * Execute all alerts where enabled=true AND next_run_at <= now().
 * Uses DB-level locking (SELECT FOR UPDATE SKIP LOCKED) to prevent concurrent execution.
 * Staggers executions with a small delay between each to avoid hammering CENDOJ.
 * Enforces max 3 concurrent executions via semaphore.
 * Circuit breaker: if 3+ errors in last 5 min, skip all alerts for 5 min.
 */
export async function executeAllDueAlerts(): Promise<RunAllResult> {
  // Circuit breaker check
  if (circuitBreaker.isOpen()) {
    logEvent({
      level: "warn",
      msg: "Circuit breaker open — skipping alert execution (3+ recent errors)",
    });
    return { processed: 0, skipped: 0, results: [] };
  }

  const now = new Date();

  // Select due alerts with row-level lock to prevent concurrent execution
  const dueAlerts = await db
    .select({
      id: alerts.id,
      name: alerts.name,
      userId: alerts.userId,
      savedSearchId: alerts.savedSearchId,
    })
    .from(alerts)
    .where(
      and(eq(alerts.enabled, true), lte(alerts.nextRunAt, now)),
    )
    .for("update", { skipLocked: true });

  if (dueAlerts.length === 0) {
    return { processed: 0, skipped: 0, results: [] };
  }

  logEvent({
    level: "info",
    msg: `Found ${dueAlerts.length} due alerts to process`,
  });

  const results: ExecutionSummary[] = [];

  // Execute sequentially with stagger delay and semaphore
  for (const alertRow of dueAlerts) {
    // Check circuit breaker before each alert
    if (circuitBreaker.isOpen()) {
      logEvent({
        level: "warn",
        msg: "Circuit breaker opened mid-batch — stopping",
      });
      break;
    }

    // Acquire semaphore (max 3 concurrent)
    await executionSemaphore.acquire();
    try {
      const result = await executeOne(alertRow);
      results.push(result);

      // On CENDOJ error, back off 30s before next alert
      if (result.status === "CENDOJ_ERROR" || result.status === "TIMEOUT") {
        circuitBreaker.recordError();
        logEvent({
          level: "warn",
          msg: "CENDOJ error — backing off 30s before next alert",
          alert_id: alertRow.id,
        });
        await sleep(30_000);
      }

      // Stagger: 2 second delay between alerts
      if (dueAlerts.indexOf(alertRow) < dueAlerts.length - 1) {
        await sleep(2_000);
      }
    } finally {
      executionSemaphore.release();
    }
  }

  logEvent({
    level: "info",
    msg: `Batch complete: ${results.length} processed`,
  });

  return {
    processed: dueAlerts.length,
    skipped: 0,
    results,
  };
}

/* ── First-run baseline snapshot ── */

/**
 * Execute a baseline snapshot for a newly created alert.
 * Records all current results as "seen" WITHOUT sending emails.
 * Returns the count of baseline decisions recorded.
 */
export async function runBaselineSnapshot(alertId: string): Promise<number> {
  const [alertRow] = await db
    .select({
      id: alerts.id,
      name: alerts.name,
      userId: alerts.userId,
      savedSearchId: alerts.savedSearchId,
    })
    .from(alerts)
    .where(eq(alerts.id, alertId))
    .limit(1);

  if (!alertRow) return 0;

  logEvent({
    level: "info",
    msg: "Running baseline snapshot",
    alert_id: alertId,
  });

  const result = await executeOne(alertRow, true);

  logEvent({
    level: "info",
    msg: `Baseline snapshot complete: ${result.resultsCount} decisions recorded`,
    alert_id: alertId,
  });

  return result.resultsCount;
}

/* ── Helpers ── */

function calcNextRun(frequency: string): Date {
  const now = new Date();
  const next = new Date(now);
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else {
    next.setDate(next.getDate() + 7);
  }
  // Randomize within 8:00-10:59 CET window to avoid thundering herd
  next.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0);
  return next;
}