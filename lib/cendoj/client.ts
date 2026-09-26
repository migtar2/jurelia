// CENDOJ API client

const CENDOJ_API = process.env.CENDOJ_API_URL || "http://127.0.0.1:8000";
const CENDOJ_TOKEN = process.env.CENDOJ_SERVICE_TOKEN || "";

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (CENDOJ_TOKEN) {
    headers["Authorization"] = `Bearer ${CENDOJ_TOKEN}`;
  }
  return headers;
}

export interface CendojSearchResult {
  id: string;
  titulo: string;
  fecha?: string;
  organo?: string;
  sede?: string;
  ponente?: string;
  n_recurso?: string;
  n_resolucion?: string;
  roj?: string;
  ecli?: string;
  url_pdf: string;
  resumen?: string;
}

export interface CendojSearchResponse {
  total: number;
  results: CendojSearchResult[];
  _elapsed_ms?: number;
}

export interface CendojDecisionResponse {
  url: string;
  text: string;
  _elapsed_ms?: number;
}

export async function cendojStatus(): Promise<{ status: string }> {
  const res = await fetch(`${CENDOJ_API}/api/status`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  return res.json();
}

export async function cendojSearch(params: Record<string, string | string[]>): Promise<CendojSearchResponse> {
  const url = new URL(`${CENDOJ_API}/api/search`);

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, v);
    } else if (value) {
      url.searchParams.set(key, value);
    }
  }

  const start = Date.now();
  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`CENDOJ API error: HTTP ${res.status}`);
  }

  const data = await res.json();
  return { ...data, _elapsed_ms: Date.now() - start };
}

export async function cendojDecision(pdfUrl: string): Promise<CendojDecisionResponse> {
  const url = new URL(`${CENDOJ_API}/api/decision`);
  url.searchParams.set("pdf_url", pdfUrl);

  const start = Date.now();
  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`CENDOJ decision error: HTTP ${res.status}`);
  }

  const data = await res.json();
  return { ...data, _elapsed_ms: Date.now() - start };
}
