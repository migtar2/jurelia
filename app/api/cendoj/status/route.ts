import { NextResponse } from "next/server";

const CENDOJ_API = process.env.CENDOJ_API_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${CENDOJ_API}/api/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: "offline", service: "CENDOJ API", error: msg },
      { status: 503 }
    );
  }
}
