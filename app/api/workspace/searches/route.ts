import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const results = await db
    .select({
      id: savedSearches.id,
      name: savedSearches.name,
      searchParams: savedSearches.searchParams,
      createdAt: savedSearches.createdAt,
      lastRunAt: savedSearches.lastRunAt,
    })
    .from(savedSearches)
    .where(eq(savedSearches.userId, auth.user.userId))
    .orderBy(savedSearches.createdAt);

  return NextResponse.json({ searches: results });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const { name, searchParams } = await req.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });
    }

    if (!searchParams || typeof searchParams !== "object") {
      return NextResponse.json({ error: "searchParams obligatorio" }, { status: 400 });
    }

    const [search] = await db
      .insert(savedSearches)
      .values({
        userId: auth.user.userId,
        name: name.trim(),
        searchParams,
      })
      .returning({
        id: savedSearches.id,
        name: savedSearches.name,
      });

    return NextResponse.json({ ok: true, search }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique")) {
      return NextResponse.json({ error: "Ya existe una búsqueda guardada con ese nombre" }, { status: 409 });
    }
    console.error("Save search error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}