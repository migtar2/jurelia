/**
 * POST /api/alerts/execute
 *
 * Server-side execution endpoint for the alert scheduler.
 * Protected by CRON_SECRET — not accessible via user auth.
 *
 * Called by VPS cron (or Vercel cron) to process all due alerts.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { executeAllDueAlerts } from "@/lib/alerts/executor";

/* ── In-memory rate limiter: 100 executions per hour ── */
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

let rateLimitWindowStart = Date.now();
let rateLimitCount = 0;

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - rateLimitWindowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitWindowStart = now;
    rateLimitCount = 0;
  }
  if (rateLimitCount >= RATE_LIMIT_MAX) return false;
  rateLimitCount++;
  return true;
}

/* ── Helpers ── */

function logStructured(level: "info" | "warn" | "error", requestId: string, message: string, extra?: Record<string, unknown>) {
  const entry = { timestamp: new Date().toISOString(), level, requestId, message, ...extra };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

/** Timing-safe string comparison to prevent timing side-channels. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* ── Handler ── */

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  // Rate limit check
  if (!checkRateLimit()) {
    logStructured("warn", requestId, "Rate limit exceeded", { limit: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS });
    return NextResponse.json(
      { error: "Rate limit exceeded", requestId },
      { status: 429 },
    );
  }

  // Verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logStructured("error", requestId, "CRON_SECRET not configured");
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server", requestId },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization");
  const provided =
    authHeader?.replace(/^Bearer\s+/i, "") ||
    req.headers.get("x-cron-secret");

  if (!provided || !safeCompare(provided, cronSecret)) {
    logStructured("warn", requestId, "Unauthorized request", { hasToken: !!provided });
    return NextResponse.json(
      { error: "Unauthorized — invalid or missing CRON_SECRET", requestId },
      { status: 401 },
    );
  }

  logStructured("info", requestId, "Execution started");

  try {
    const result = await executeAllDueAlerts();
    logStructured("info", requestId, "Execution completed", {
      processed: result.processed,
      skipped: result.skipped,
      resultCount: result.results.length,
    });

    return NextResponse.json({
      ok: true,
      requestId,
      timestamp: new Date().toISOString(),
      processed: result.processed,
      skipped: result.skipped,
      results: result.results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logStructured("error", requestId, "Execution failed", { error: msg, stack });

    return NextResponse.json(
      { error: "Execution failed", detail: msg, requestId },
      { status: 500 },
    );
  }
}

/**
 * GET — health check for the executor endpoint (no auth required).
 * Returns whether CRON_SECRET is configured and current rate limit state.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/alerts/execute",
    cronConfigured: !!process.env.CRON_SECRET,
    rateLimit: { max: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, currentCount: rateLimitCount },
    timestamp: new Date().toISOString(),
  });
}