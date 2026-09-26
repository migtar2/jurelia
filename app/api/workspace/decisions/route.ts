import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedDecisions, folderDecisions, folders, tags, decisionTags, notes } from "@/lib/db/schema";
import { eq, and, desc, asc, ilike, sql, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "";
  const folder = searchParams.get("folder") || "";
  const tag = searchParams.get("tag") || "";
  const type = searchParams.get("type") || "";
  const sort = searchParams.get("sort") || "saved_desc";

  let query = db
    .select()
    .from(savedDecisions)
    .where(eq(savedDecisions.userId, auth.user.userId));

  // Apply filters — build conditions array
  const conditions = [eq(savedDecisions.userId, auth.user.userId)];

  if (text) {
    conditions.push(
      sql`(${savedDecisions.titulo} ILIKE ${"%" + text + "%"} OR ${savedDecisions.roj} ILIKE ${"%" + text + "%"} OR ${savedDecisions.organo} ILIKE ${"%" + text + "%"} OR ${savedDecisions.ponente} ILIKE ${"%" + text + "%"})`
    );
  }

  if (type) {
    conditions.push(eq(savedDecisions.type, type));
  }

  // For folder/tag filtering, we need subqueries
  let decisionIds: string[] | null = null;

  if (folder) {
    const folderRows = await db
      .select({ decisionId: folderDecisions.decisionId })
      .from(folderDecisions)
      .innerJoin(folders, eq(folderDecisions.folderId, folders.id))
      .where(and(eq(folders.userId, auth.user.userId), eq(folders.name, folder)));
    decisionIds = folderRows.map((r) => r.decisionId);
    if (decisionIds.length === 0) {
      return NextResponse.json({ decisions: [], total: 0 });
    }
  }

  if (tag) {
    const tagRows = await db
      .select({ decisionId: decisionTags.decisionId })
      .from(decisionTags)
      .innerJoin(tags, eq(decisionTags.tagId, tags.id))
      .where(and(eq(tags.userId, auth.user.userId), eq(tags.name, tag)));
    const tagDecisionIds = tagRows.map((r) => r.decisionId);
    if (tagDecisionIds.length === 0) {
      return NextResponse.json({ decisions: [], total: 0 });
    }
    if (decisionIds) {
      decisionIds = decisionIds.filter((id) => tagDecisionIds.includes(id));
    } else {
      decisionIds = tagDecisionIds;
    }
  }

  if (decisionIds) {
    conditions.push(inArray(savedDecisions.id, decisionIds));
  }

  // Sort
  let orderBy;
  switch (sort) {
    case "saved_asc":
      orderBy = asc(savedDecisions.savedAt);
      break;
    case "court":
      orderBy = asc(savedDecisions.organo);
      break;
    case "fecha_desc":
      orderBy = desc(savedDecisions.fecha);
      break;
    case "fecha_asc":
      orderBy = asc(savedDecisions.fecha);
      break;
    default:
      orderBy = desc(savedDecisions.savedAt);
  }

  const results = await db
    .select()
    .from(savedDecisions)
    .where(and(...conditions))
    .orderBy(orderBy);

  // Fetch related data for each decision
  const decisionIdsArr = results.map((r) => r.id);

  // Get folders for these decisions
  const folderLinks = decisionIdsArr.length > 0
    ? await db
        .select({
          decisionId: folderDecisions.decisionId,
          folderName: folders.name,
        })
        .from(folderDecisions)
        .innerJoin(folders, eq(folderDecisions.folderId, folders.id))
        .where(
          and(
            eq(folders.userId, auth.user.userId),
            inArray(folderDecisions.decisionId, decisionIdsArr)
          )
        )
    : [];

  // Get tags for these decisions
  const tagLinks = decisionIdsArr.length > 0
    ? await db
        .select({
          decisionId: decisionTags.decisionId,
          tagName: tags.name,
        })
        .from(decisionTags)
        .innerJoin(tags, eq(decisionTags.tagId, tags.id))
        .where(
          and(
            eq(tags.userId, auth.user.userId),
            inArray(decisionTags.decisionId, decisionIdsArr)
          )
        )
    : [];

  // Get notes for these decisions
  const noteRows = decisionIdsArr.length > 0
    ? await db
        .select({
          decisionId: notes.decisionId,
          content: notes.content,
        })
        .from(notes)
        .where(
          and(
            eq(notes.userId, auth.user.userId),
            inArray(notes.decisionId, decisionIdsArr)
          )
        )
    : [];

  // Build maps
  const folderMap = new Map<string, string[]>();
  for (const link of folderLinks) {
    if (!folderMap.has(link.decisionId)) folderMap.set(link.decisionId, []);
    folderMap.get(link.decisionId)!.push(link.folderName);
  }

  const tagMap = new Map<string, string[]>();
  for (const link of tagLinks) {
    if (!tagMap.has(link.decisionId)) tagMap.set(link.decisionId, []);
    tagMap.get(link.decisionId)!.push(link.tagName);
  }

  const noteMap = new Map<string, string>();
  for (const n of noteRows) {
    // Just take the latest note per decision
    noteMap.set(n.decisionId, n.content);
  }

  // Transform to WorkspaceItem format
  const decisions = results.map((r) => ({
    id: r.id,
    type: r.type,
    roj: r.roj,
    ecli: r.ecli,
    organo: r.organo,
    fecha: r.fecha,
    titulo: r.titulo,
    ponente: r.ponente,
    url_pdf: r.urlPdf,
    resumen: r.resumen,
    aiSummary: r.aiSummary,
    comparisonData: r.comparisonData,
    propositionData: r.propositionData,
    savedAt: r.savedAt?.toISOString?.() ?? String(r.savedAt),
    folders: folderMap.get(r.id) ?? [],
    tags: tagMap.get(r.id) ?? [],
    notes: noteMap.get(r.id) ?? "",
  }));

  return NextResponse.json({ decisions, total: decisions.length });
}