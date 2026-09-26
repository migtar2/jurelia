/**
 * In-memory sliding-window rate limiter for API routes.
 * Resets per-process — suitable for single-instance Vercel/serverless deploys.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > 60_000) store.delete(key);
  }
}, 5 * 60_000).unref();

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number;
  /** Window duration in milliseconds (default 60 000 = 1 minute) */
  windowMs?: number;
}

/**
 * Check whether a request identified by `key` exceeds the rate limit.
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: true; remaining: number } | { allowed: false; retryAfterMs: number } {
  const windowMs = config.windowMs ?? 60_000;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.max - 1 };
  }

  entry.count++;
  if (entry.count > config.max) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, remaining: config.max - entry.count };
}
