import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { withQuota } from "@/lib/quota";

const CENDOJ_API = process.env.CENDOJ_API_URL || "http://127.0.0.1:8000";
const CENDOJ_TOKEN = process.env.CENDOJ_SERVICE_TOKEN || "";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (CENDOJ_TOKEN) h["Authorization"] = `Bearer ${CENDOJ_TOKEN}`;
  return h;
}

export async function GET(req: NextRequest) {
  // Auth
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = req.nextUrl;

  const query = searchParams.get("query") || "";
  if (query.length > 500) {
    return NextResponse.json(
      { error: "La consulta no puede superar 500 caracteres" },
      { status: 400 }
    );
  }

  const roj = searchParams.get("roj");
  const ecli = searchParams.get("ecli");
  const nRes = searchParams.get("n_resolucion");
  const nRec = searchParams.get("n_recurso");
  const hasParams = query.trim() || roj || ecli || nRes || nRec;
  if (!hasParams) {
    return NextResponse.json(
      { error: "Se requiere al menos un parámetro de búsqueda: query, roj, ecli, n_resolucion o n_recurso", total: 0, results: [] },
      { status: 400 }
    );
  }

  // Quota enforcement for search
  const quotaResult = await withQuota(
    auth.user.userId,
    "jurisprudence_search",
    async () => {
      const url = new URL(`${CENDOJ_API}/api/search`);
      searchParams.forEach((value, key) => {
        url.searchParams.append(key, value);
      });

      const start = Date.now();
      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: authHeaders(),
        signal: AbortSignal.timeout(120_000),
      });
      const elapsed = Date.now() - start;

      if (!res.ok) {
        const text = await res.text();
        return { error: true, status: res.status, text, elapsed };
      }

      const data = await res.json();
      return { error: false, data, elapsed };
    }
  );

  if ("error" in quotaResult) {
    const q = quotaResult.quota;
    return NextResponse.json(
      {
        error: "QUOTA_EXCEEDED",
        category: q.category,
        limit: q.limit,
        used: q.used,
        remaining: q.remaining,
        period_end: q.period_end,
      },
      { status: 429 }
    );
  }

  const { quota } = quotaResult;
  const result = quotaResult.result as
    | { error: true; status: number; text: string; elapsed: number }
    | { error: false; data: Record<string, unknown>; elapsed: number };

  if (result.error) {
    return NextResponse.json(
      { error: `CENDOJ API respondió con HTTP ${result.status}`, detail: result.text, total: 0, results: [] },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ...result.data,
    _elapsed_ms: result.elapsed,
    _quota: {
      category: quota.category,
      used: quota.used,
      limit: quota.unlimited ? "unlimited" : quota.limit,
      remaining: quota.unlimited ? "unlimited" : quota.remaining,
      period_end: quota.period_end,
    },
  });
}
