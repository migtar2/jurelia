import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notes, savedDecisions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: decisionId } = await params;

  // Verify decision ownership
  const [decision] = await db
    .select({ id: savedDecisions.id, userId: savedDecisions.userId })
    .from(savedDecisions)
    .where(eq(savedDecisions.id, decisionId))
    .limit(1);

  if (!decision || decision.userId !== auth.user.userId) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  const results = await db
    .select({
      id: notes.id,
      content: notes.content,
      isPrivate: notes.isPrivate,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(and(eq(notes.decisionId, decisionId), eq(notes.userId, auth.user.userId)))
    .orderBy(notes.createdAt);

  return NextResponse.json({ notes: results });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: decisionId } = await params;
  const { content, isPrivate } = await req.json();

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Contenido obligatorio" }, { status: 400 });
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

  // Upsert note: if one exists for this user+decision, update it
  const [existingNote] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.decisionId, decisionId), eq(notes.userId, auth.user.userId)))
    .limit(1);

  if (existingNote) {
    await db
      .update(notes)
      .set({ content: content.trim(), isPrivate: isPrivate ?? true, updatedAt: new Date() })
      .where(eq(notes.id, existingNote.id));

    return NextResponse.json({ ok: true, id: existingNote.id, updated: true });
  }

  const [note] = await db
    .insert(notes)
    .values({
      decisionId,
      userId: auth.user.userId,
      content: content.trim(),
      isPrivate: isPrivate ?? true,
    })
    .returning({ id: notes.id });

  return NextResponse.json({ ok: true, id: note.id, updated: false });
}