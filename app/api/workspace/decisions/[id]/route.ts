import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedDecisions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;

  const [existing] = await db
    .select({ id: savedDecisions.id, userId: savedDecisions.userId })
    .from(savedDecisions)
    .where(eq(savedDecisions.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (existing.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  await db.delete(savedDecisions).where(eq(savedDecisions.id, id));

  return NextResponse.json({ ok: true });
}