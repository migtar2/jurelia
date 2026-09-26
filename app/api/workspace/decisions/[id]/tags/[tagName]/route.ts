import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags, decisionTags, savedDecisions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tagName: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: decisionId, tagName } = await params;

  // Verify decision ownership
  const [decision] = await db
    .select({ id: savedDecisions.id, userId: savedDecisions.userId })
    .from(savedDecisions)
    .where(eq(savedDecisions.id, decisionId))
    .limit(1);

  if (!decision || decision.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  // Find tag
  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, auth.user.userId), eq(tags.name, tagName)))
    .limit(1);

  if (tag) {
    await db
      .delete(decisionTags)
      .where(and(eq(decisionTags.decisionId, decisionId), eq(decisionTags.tagId, tag.id)));
  }

  return NextResponse.json({ ok: true });
}
