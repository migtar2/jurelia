// tests/quota/concurrency-real.test.ts — Real DB concurrency tests against Neon
// Uses PL/pgSQL function for atomicity since neon-http doesn't support transactions.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("05.0 — Real DB Concurrency (Neon)", () => {
  let sql: ReturnType<typeof neon>;

  const TEST_USER_ID = "78080c6c-5ebd-4b99-8403-b8bbc802854d";
  const TEST_CATEGORY = "judgment_summary";
  const CURRENT_PERIOD = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const NEXT_PERIOD = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));

  beforeAll(async () => {
    sql = neon(process.env.DATABASE_URL!);
    await sql`DELETE FROM usage_reservations WHERE user_id = ${TEST_USER_ID} AND category = ${TEST_CATEGORY}`;
  });

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM usage_reservations WHERE user_id = ${TEST_USER_ID} AND category = ${TEST_CATEGORY}`;
    }
  });

  async function reserveQuotaRaw(limit: number): Promise<{ allowed: boolean; id?: string }> {
    const result = await sql`SELECT reserve_quota_atomic(${TEST_USER_ID}, ${TEST_CATEGORY}, ${CURRENT_PERIOD.toISOString()}, ${limit}) as id` as Record<string, unknown>[];
    const id = result[0]?.id as string | null;
    return { allowed: !!id, id: id || undefined };
  }

  async function countUsage(): Promise<number> {
    const result = await sql`
      SELECT count(*)::int as cnt FROM usage_reservations
      WHERE user_id = ${TEST_USER_ID} AND category = ${TEST_CATEGORY}
      AND created_at >= ${CURRENT_PERIOD.toISOString()} AND created_at < ${NEXT_PERIOD.toISOString()}
      AND state IN ('reserved', 'committed')
    ` as Record<string, unknown>[];
    return (result[0]?.cnt as number) ?? 0;
  }

  it("FREE 4/5 — 20 concurrentes: exactamente 1 autorizada, 19 rechazadas", async () => {
    for (let i = 0; i < 4; i++) {
      await sql`INSERT INTO usage_reservations (user_id, category, period_start, state) VALUES (${TEST_USER_ID}, ${TEST_CATEGORY}, ${CURRENT_PERIOD.toISOString()}, 'committed')`;
    }
    expect(await countUsage()).toBe(4);
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveQuotaRaw(5)));
    expect(results.filter(r => r.allowed).length).toBe(1);
    expect(results.filter(r => !r.allowed).length).toBe(19);
    expect(await countUsage()).toBe(5);
  });

  it("FREE 0/5 — 20 concurrentes: exactamente 5 autorizadas, 15 rechazadas", async () => {
    await sql`DELETE FROM usage_reservations WHERE user_id = ${TEST_USER_ID} AND category = ${TEST_CATEGORY}`;
    expect(await countUsage()).toBe(0);
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveQuotaRaw(5)));
    expect(results.filter(r => r.allowed).length).toBe(5);
    expect(results.filter(r => !r.allowed).length).toBe(15);
    expect(await countUsage()).toBe(5);
  });

  it("PRO 199/200 — 20 concurrentes: exactamente 1 autorizada, 19 rechazadas", async () => {
    await sql`DELETE FROM usage_reservations WHERE user_id = ${TEST_USER_ID} AND category = ${TEST_CATEGORY}`;
    for (let i = 0; i < 199; i++) {
      await sql`INSERT INTO usage_reservations (user_id, category, period_start, state) VALUES (${TEST_USER_ID}, ${TEST_CATEGORY}, ${CURRENT_PERIOD.toISOString()}, 'committed')`;
    }
    expect(await countUsage()).toBe(199);
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveQuotaRaw(200)));
    expect(results.filter(r => r.allowed).length).toBe(1);
    expect(results.filter(r => !r.allowed).length).toBe(19);
    expect(await countUsage()).toBe(200);
  });
});