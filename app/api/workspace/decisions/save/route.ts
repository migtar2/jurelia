import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedDecisions, folders, folderDecisions, tags, decisionTags, notes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const {
      roj, ecli, organo, fecha, titulo, ponente, nRecurso,
      url_pdf, resumen, aiSummary,
      type, comparisonData, propositionData,
      folders: folderNames, tagNames, noteContent,
    } = body;

    if (!roj || !organo) {
      return NextResponse.json(
        { error: "ROJ y órgano son obligatorios" },
        { status: 400 }
      );
    }

    // Upsert: if same user+ROJ exists, update it
    const [existing] = await db
      .select({ id: savedDecisions.id })
      .from(savedDecisions)
      .where(
        and(
          eq(savedDecisions.userId, auth.user.userId),
          eq(savedDecisions.roj, roj)
        )
      )
      .limit(1);

    let decisionId: string;

    if (existing) {
      // Update existing
      await db
        .update(savedDecisions)
        .set({
          ecli: ecli ?? null,
          organo,
          fecha: fecha ?? null,
          titulo: titulo ?? null,
          ponente: ponente ?? null,
          nRecurso: nRecurso ?? null,
          urlPdf: url_pdf ?? null,
          resumen: resumen ?? null,
          aiSummary: aiSummary ?? null,
          type: type ?? "decision",
          comparisonData: comparisonData ?? null,
          propositionData: propositionData ?? null,
        })
        .where(eq(savedDecisions.id, existing.id));
      decisionId = existing.id;
    } else {
      const [inserted] = await db
        .insert(savedDecisions)
        .values({
          userId: auth.user.userId,
          roj,
          ecli: ecli ?? null,
          organo,
          fecha: fecha ?? null,
          titulo: titulo ?? null,
          ponente: ponente ?? null,
          nRecurso: nRecurso ?? null,
          urlPdf: url_pdf ?? null,
          resumen: resumen ?? null,
          aiSummary: aiSummary ?? null,
          type: type ?? "decision",
          comparisonData: comparisonData ?? null,
          propositionData: propositionData ?? null,
        })
        .returning({ id: savedDecisions.id });
      decisionId = inserted.id;
    }

    // Handle folders
    if (Array.isArray(folderNames) && folderNames.length > 0) {
      for (const folderName of folderNames) {
        let [folder] = await db
          .select({ id: folders.id })
          .from(folders)
          .where(and(eq(folders.userId, auth.user.userId), eq(folders.name, folderName)))
          .limit(1);

        if (!folder) {
          const [newFolder] = await db
            .insert(folders)
            .values({ userId: auth.user.userId, name: folderName })
            .returning({ id: folders.id });
          folder = newFolder;
        }

        // Link (ignore if already exists)
        try {
          await db
            .insert(folderDecisions)
            .values({ folderId: folder.id, decisionId })
            .onConflictDoNothing();
        } catch {
          // already linked
        }
      }
    }

    // Handle tags
    if (Array.isArray(tagNames) && tagNames.length > 0) {
      for (const tagName of tagNames) {
        let [tag] = await db
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.userId, auth.user.userId), eq(tags.name, tagName)))
          .limit(1);

        if (!tag) {
          const [newTag] = await db
            .insert(tags)
            .values({ userId: auth.user.userId, name: tagName })
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
      }
    }

    // Handle note
    if (noteContent) {
      const [existingNote] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.decisionId, decisionId), eq(notes.userId, auth.user.userId)))
        .limit(1);

      if (existingNote) {
        await db
          .update(notes)
          .set({ content: noteContent, updatedAt: new Date() })
          .where(eq(notes.id, existingNote.id));
      } else {
        await db.insert(notes).values({
          decisionId,
          userId: auth.user.userId,
          content: noteContent,
        });
      }
    }

    return NextResponse.json({ ok: true, id: decisionId, updated: !!existing });
  } catch (err) {
    console.error("Save decision error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}