import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedDocuments } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;

  const [existing] = await db
    .select({ id: savedDocuments.id })
    .from(savedDocuments)
    .where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, auth.user.userId)));

  if (!existing) {
    return NextResponse.json({ error: "Documento guardado no encontrado" }, { status: 404 });
  }

  await db.delete(savedDocuments).where(eq(savedDocuments.id, id));

  return NextResponse.json({ success: true });
}