import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedDocuments, documents, documentAnalyses, documentResearchResults } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const rows = await db
    .select()
    .from(savedDocuments)
    .where(eq(savedDocuments.userId, auth.user.userId))
    .orderBy(desc(savedDocuments.savedAt));

  return NextResponse.json({ documents: rows });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { document_id, analysis_id } = body as {
    document_id: string;
    analysis_id?: string;
  };

  if (!document_id) {
    return NextResponse.json({ error: "document_id is required" }, { status: 400 });
  }

  // Fetch document with ownership check
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, document_id), eq(documents.userId, auth.user.userId)));

  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  // Fetch analysis if provided or find the latest one
  let analysis: typeof documentAnalyses.$inferSelect | undefined;
  if (analysis_id) {
    const [a] = await db
      .select()
      .from(documentAnalyses)
      .where(and(eq(documentAnalyses.id, analysis_id), eq(documentAnalyses.userId, auth.user.userId)));
    analysis = a;
  } else {
    const [a] = await db
      .select()
      .from(documentAnalyses)
      .where(and(eq(documentAnalyses.documentId, document_id), eq(documentAnalyses.userId, auth.user.userId)))
      .orderBy(desc(documentAnalyses.createdAt))
      .limit(1);
    analysis = a;
  }

  // Build analysis snapshot
  const analysisSnapshot = analysis
    ? { docType: analysis.docType, issues: analysis.issues, arguments: analysis.arguments, citations: analysis.citations }
    : null;

  // Fetch research results for this document
  const researchRows = analysis
    ? await db
        .select()
        .from(documentResearchResults)
        .where(and(eq(documentResearchResults.documentId, document_id), eq(documentResearchResults.userId, auth.user.userId)))
    : [];

  // Count items
  const issueCount = analysis ? (analysis.issues as unknown[]).length : 0;
  const argumentCount = analysis ? (analysis.arguments as unknown[]).length : 0;
  const citationCount = analysis ? (analysis.citations as unknown[]).length : 0;

  const [saved] = await db
    .insert(savedDocuments)
    .values({
      userId: auth.user.userId,
      documentId: doc.id,
      analysisId: analysis?.id ?? null,
      filename: doc.filename,
      originalType: doc.originalType,
      docType: analysis?.docType ?? doc.docType,
      issueCount,
      argumentCount,
      citationCount,
      analysisSnapshot,
      researchSnapshot: researchRows.length > 0 ? researchRows : null,
    })
    .returning();

  return NextResponse.json({ id: saved.id }, { status: 201 });
}