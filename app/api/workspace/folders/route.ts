import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const results = await db
    .select({ id: folders.id, name: folders.name, createdAt: folders.createdAt })
    .from(folders)
    .where(eq(folders.userId, auth.user.userId))
    .orderBy(folders.name);

  return NextResponse.json({ folders: results });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });
    }

    const [folder] = await db
      .insert(folders)
      .values({ userId: auth.user.userId, name: name.trim() })
      .returning({ id: folders.id, name: folders.name });

    return NextResponse.json({ ok: true, folder }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique")) {
      return NextResponse.json({ error: "Ya existe una carpeta con ese nombre" }, { status: 409 });
    }
    console.error("Create folder error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}