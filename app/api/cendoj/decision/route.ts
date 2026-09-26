import { NextRequest, NextResponse } from "next/server";

const CENDOJ_API = process.env.CENDOJ_API_URL || "http://127.0.0.1:8000";
const CENDOJ_TOKEN = process.env.CENDOJ_SERVICE_TOKEN || "";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (CENDOJ_TOKEN) h["Authorization"] = `Bearer ${CENDOJ_TOKEN}`;
  return h;
}

export async function GET(req: NextRequest) {
  const pdfUrl = req.nextUrl.searchParams.get("pdf_url");

  if (!pdfUrl) {
    return NextResponse.json(
      { error: "Parámetro pdf_url es obligatorio" },
      { status: 400 }
    );
  }

  // SSRF protection: only allow poderjudicial.es URLs
  try {
    const parsed = new URL(pdfUrl);
    if (!parsed.hostname.endsWith("poderjudicial.es")) {
      return NextResponse.json(
        { error: "Solo se permiten URLs de poderjudicial.es" },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const url = new URL(`${CENDOJ_API}/api/decision`);
  url.searchParams.set("pdf_url", pdfUrl);

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
    return NextResponse.json(
      { error: `Error obteniendo resolución: ${msg}` },
      { status: 502 }
    );
  }
}
