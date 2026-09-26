import { NextRequest, NextResponse } from "next/server";

const CENDOJ_API = process.env.CENDOJ_API_URL || "http://127.0.0.1:8000";
const CENDOJ_TOKEN = process.env.CENDOJ_SERVICE_TOKEN || "";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (CENDOJ_TOKEN) h["Authorization"] = `Bearer ${CENDOJ_TOKEN}`;
  return h;
}

export async function GET(req: NextRequest) {
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

  const url = new URL(`${CENDOJ_API}/api/search`);
  searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  try {
    const start = Date.now();
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: authHeaders(),
      signal: AbortSignal.timeout(120_000),
    });
    const elapsed = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `CENDOJ API respondió con HTTP ${res.status}`, detail: text, elapsed_ms: elapsed },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ...data, _elapsed_ms: elapsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("Timeout")) {
      return NextResponse.json(
        { error: "Timeout: CENDOJ tardó más de 2 minutos en responder.", total: 0, results: [] },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: `Error conectando con CENDOJ: ${msg}`, total: 0, results: [] },
      { status: 502 }
    );
  }
}
