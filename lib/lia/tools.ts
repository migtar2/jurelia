// lib/lia/tools.ts — Read-only tools para LIA
// Solo operaciones de lectura. Sin escritura, sin mutación.

const CENDOJ_API = process.env.CENDOJ_API_URL || "http://127.0.0.1:8000";
const CENDOJ_TOKEN = process.env.CENDOJ_SERVICE_TOKEN || "";

function cendojHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (CENDOJ_TOKEN) h["Authorization"] = `Bearer ${CENDOJ_TOKEN}`;
  return h;
}

/* ─── Types ─── */

export interface SearchResult {
  roj: string;
  ecli: string | null;
  court: string;
  date: string;
  snippet: string;
  source: "cendoj";
}

export interface DecisionMetadata {
  roj: string;
  ecli: string | null;
  court: string;
  date: string;
  type: string | null;
  available: boolean;
  has_full_text: boolean;
}

export interface SystemStatus {
  cendoj_online: boolean;
  service: string;
  error: string | null;
}

/* ─── Tools ─── */

/**
 * search_jurisprudence — Buscar resoluciones en CENDOJ.
 * Reutiliza la lógica existente del endpoint /api/cendoj/search.
 * NO hace fetch interno inseguro — consulta directamente al VPS.
 */
export async function searchJurisprudence(
  query: string,
  filters?: { court?: string; date_from?: string; date_to?: string }
): Promise<SearchResult[]> {
  const url = new URL(`${CENDOJ_API}/api/search`);
  url.searchParams.set("query", query.slice(0, 500));
  if (filters?.court) url.searchParams.set("tribunal", filters.court);
  if (filters?.date_from) url.searchParams.set("fecha_desde", filters.date_from);
  if (filters?.date_to) url.searchParams.set("fecha_hasta", filters.date_to);

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: cendojHeaders(),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error(`[LIA TOOL] CENDOJ search error: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = data.results || data.resoluciones || [];

    return results.slice(0, 5).map((r: Record<string, unknown>) => ({
      roj: String(r.roj || r.numero || "Sin ROJ"),
      ecli: r.ecli ? String(r.ecli) : null,
      court: String(r.organo || r.tribunal || "Desconocido"),
      date: String(r.fecha || r.fechaResolucion || "Sin fecha"),
      snippet: String(r.resumen || r.extracto || "").slice(0, 300),
      source: "cendoj" as const,
    }));
  } catch (err) {
    console.error("[LIA TOOL] CENDOJ search failed:", err);
    return [];
  }
}

/**
 * get_decision — Consultar metadatos de una resolución.
 * Si no existe, devuelve null.
 */
export async function getDecision(
  roj: string
): Promise<DecisionMetadata | null> {
  const url = new URL(`${CENDOJ_API}/api/search`);
  url.searchParams.set("roj", roj);

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: cendojHeaders(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const results = data.results || data.resoluciones || [];

    if (results.length === 0) return null;

    const r = results[0] as Record<string, unknown>;
    return {
      roj: String(r.roj || r.numero || roj),
      ecli: r.ecli ? String(r.ecli) : null,
      court: String(r.organo || r.tribunal || "Desconocido"),
      date: String(r.fecha || r.fechaResolucion || "Sin fecha"),
      type: r.tipoResolucion ? String(r.tipoResolucion) : null,
      available: true,
      has_full_text: !!(r.texto || r.resumen),
    };
  } catch {
    return null;
  }
}

/**
 * get_system_status — Health check de CENDOJ.
 * NO usa LLM.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  try {
    const res = await fetch(`${CENDOJ_API}/api/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        cendoj_online: false,
        service: "CENDOJ API",
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      cendoj_online: data.status !== "offline",
      service: data.service || "CENDOJ API",
      error: data.status === "offline" ? data.error : null,
    };
  } catch (err) {
    return {
      cendoj_online: false,
      service: "CENDOJ API",
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}