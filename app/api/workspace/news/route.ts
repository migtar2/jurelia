import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsAnalyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import type { NewsComparisonResult } from "@/lib/news/compare-types";

/* ── GET — List saved news analyses ── */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const rows = await db
    .select()
    .from(newsAnalyses)
    .where(eq(newsAnalyses.userId, auth.user.userId))
    .orderBy(desc(newsAnalyses.createdAt));

  const analyses = rows.map((r) => ({
    id: r.id,
    article_url: r.articleUrl,
    article_title: r.articleTitle,
    publication: r.publication,
    published_at: r.publishedAt,
    decision_roj: r.decisionRoj,
    decision_ecli: r.decisionEcli,
    match_status: r.matchStatus,
    match_confidence: r.matchConfidence,
    analysis_basis: r.analysisBasis,
    comparison_result: r.comparisonResult as NewsComparisonResult,
    created_at: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    folder_id: r.folderId,
  }));

  return NextResponse.json({ analyses });
}

/* ── POST — Save a news analysis ── */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const {
      article_url,
      article_title,
      publication,
      published_at,
      decision_roj,
      decision_ecli,
      match_status,
      match_confidence,
      analysis_basis,
      comparison_result,
      folder_id,
    } = body;

    if (!article_url || !comparison_result) {
      return NextResponse.json(
        { error: "article_url y comparison_result son obligatorios" },
        { status: 400 }
      );
    }

    if (!match_status) {
      return NextResponse.json(
        { error: "match_status es obligatorio" },
        { status: 400 }
      );
    }

    // Prevent duplicates: same user + same article_url + same decision_roj
    if (decision_roj) {
      const allUser = await db
        .select({ id: newsAnalyses.id, articleUrl: newsAnalyses.articleUrl, decisionRoj: newsAnalyses.decisionRoj })
        .from(newsAnalyses)
        .where(eq(newsAnalyses.userId, auth.user.userId));

      const duplicate = allUser.find(
        (r) => r.decisionRoj === decision_roj && r.articleUrl === article_url
      );
      if (duplicate) {
        return NextResponse.json(
          { error: "Este análisis ya está guardado", id: duplicate.id },
          { status: 409 }
        );
      }
    }

    const [inserted] = await db
      .insert(newsAnalyses)
      .values({
        userId: auth.user.userId,
        articleUrl: article_url,
        articleTitle: article_title ?? null,
        publication: publication ?? null,
        publishedAt: published_at ?? null,
        decisionRoj: decision_roj ?? null,
        decisionEcli: decision_ecli ?? null,
        matchStatus: match_status,
        matchConfidence: match_confidence ?? null,
        analysisBasis: analysis_basis ?? null,
        comparisonResult: comparison_result,
        folderId: folder_id ?? null,
      })
      .returning({ id: newsAnalyses.id });

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error("Save news analysis error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}