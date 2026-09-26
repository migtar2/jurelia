import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders, folderDecisions, savedDecisions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: folderId } = await params;
  const { decisionId } = await req.json();

  if (!decisionId) {
    return NextResponse.json({ error: "decisionId obligatorio" }, { status: 400 });
  }

  // Verify folder ownership
  const [folder] = await db
    .select({ id: folders.id, userId: folders.userId })
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);

  if (!folder || folder.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  // Verify decision ownership
  const [decision] = await db
    .select({ id: savedDecisions.id, userId: savedDecisions.userId })
    .from(savedDecisions)
    .where(eq(savedDecisions.id, decisionId))
    .limit(1);

  if (!decision || decision.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  try {
    await db
      .insert(folderDecisions)
      .values({ folderId, decisionId })
      .onConflictDoNothing();
  } catch {
    // already linked
  }

  return NextResponse.json({ ok: true });
}