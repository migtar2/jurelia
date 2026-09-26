import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags, decisionTags, savedDecisions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: decisionId } = await params;
  const { tagName } = await req.json();

  if (!tagName || typeof tagName !== "string" || !tagName.trim()) {
    return NextResponse.json({ error: "Nombre de etiqueta obligatorio" }, { status: 400 });
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

  // Upsert tag
  let [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, auth.user.userId), eq(tags.name, tagName.trim())))
    .limit(1);

  if (!tag) {
    const [newTag] = await db
      .insert(tags)
      .values({ userId: auth.user.userId, name: tagName.trim() })
      .returning({ id: tags.id });
    tag = newTag;
  }

  try {
    await db
      .insert(decisionTags)
      .values({ decisionId, tagId: tag.id })
      .onConflictDoNothing();
  } catch {
    // already linked
  }

  return NextResponse.json({ ok: true });
}

// DELETE handler moved to [tagName]/route.ts