import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { name } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: folders.id, userId: folders.userId })
    .from(folders)
    .where(eq(folders.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (existing.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  await db
    .update(folders)
    .set({ name: name.trim() })
    .where(eq(folders.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;

  const [existing] = await db
    .select({ id: folders.id, userId: folders.userId })
    .from(folders)
    .where(eq(folders.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (existing.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  await db.delete(folders).where(eq(folders.id, id));

  return NextResponse.json({ ok: true });
}