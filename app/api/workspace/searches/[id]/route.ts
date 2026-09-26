import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;

  const [existing] = await db
    .select({ id: savedSearches.id, userId: savedSearches.userId })
    .from(savedSearches)
    .where(eq(savedSearches.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (existing.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  await db.delete(savedSearches).where(eq(savedSearches.id, id));

  return NextResponse.json({ ok: true });
}