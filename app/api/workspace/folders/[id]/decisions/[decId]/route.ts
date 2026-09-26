import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders, folderDecisions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; decId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: folderId, decId } = await params;

  // Verify folder ownership
  const [folder] = await db
    .select({ id: folders.id, userId: folders.userId })
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);

  if (!folder || folder.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  await db
    .delete(folderDecisions)
    .where(
      and(
        eq(folderDecisions.folderId, folderId),
        eq(folderDecisions.decisionId, decId)
      )
    );

  return NextResponse.json({ ok: true });
}