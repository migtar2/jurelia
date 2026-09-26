// News analysis API route
// POST /api/news/analyze — Analyze a news URL and find the referenced CENDOJ resolution

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { validateUrl, fetchArticle } from "@/lib/news/fetch-article";
import { extractArticle } from "@/lib/news/extract-article";
import { extractLegalMetadata } from "@/lib/news/extract-legal-metadata";
import { executeSearchStrategy } from "@/lib/cendoj/search-strategy";
import { verifyMatches } from "@/lib/matching/score-match";
import type { NewsAnalysisResult } from "@/lib/news/types";

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const totalStart = Date.now();
  const errors: string[] = [];

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "URL es obligatoria" }, { status: 400 });
  }

  // Phase 1: URL Validation
  const validation = validateUrl(url);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Phase 2: Article Extraction
  const extractionStart = Date.now();
  let article;
  try {
    const fetchResult = await fetchArticle(url);
    if (fetchResult.status >= 400) {
      return NextResponse.json(
        { error: `La URL devolvió HTTP ${fetchResult.status}` },
        { status: 422 }
      );
    }
    article = extractArticle(fetchResult.html, fetchResult.final_url);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Error obteniendo artículo: ${msg}` },
      { status: 422 }
    );
  }
  const extractionMs = Date.now() - extractionStart;

  // Phase 3: Legal Metadata Extraction
  const legalMetadata = extractLegalMetadata(article.article_text);

  // Phase 4+5: Search Strategy + CENDOJ Search
  const searchStart = Date.now();
  let searchResult;
  try {
    searchResult = await executeSearchStrategy(legalMetadata);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If CENDOJ is down, return a clear error — NOT NOT_FOUND
    return NextResponse.json(
      {
        error: `CENDOJ no disponible: ${msg}`,
        match: {
          status: "ERROR",
          confidence: 0,
          explanation: "No se pudo conectar con CENDOJ. Intenta de nuevo más tarde.",
          candidate: null,
          candidates: [],
          attempts: [],
        },
      },
      { status: 503 }
    );
  }
  const searchMs = Date.now() - searchStart;

  // Phase 6+7: Candidate Verification
  const verifyStart = Date.now();
  const match = verifyMatches(legalMetadata, searchResult.candidates, searchResult.attempts);
  const verifyMs = Date.now() - verifyStart;

  // Save structured log
  const result: NewsAnalysisResult = {
    request_id: requestId,
    article,
    legal_metadata: legalMetadata,
    match,
    diagnostics: {
      url,
      http_status: 200,
      extractor: article.extraction_method,
      extraction_ms: extractionMs,
      search_ms: searchMs,
      verification_ms: verifyMs,
      total_ms: Date.now() - totalStart,
      errors,
    },
  };

  // Log for observability
  console.log("[NEWS_ANALYSIS]", JSON.stringify({
    request_id: requestId,
    url,
    publication: article.publication,
    ecli: legalMetadata.ecli?.value,
    roj: legalMetadata.roj?.value,
    match_status: match.status,
    confidence: match.confidence,
    candidates: match.candidates.length,
    total_ms: result.diagnostics.total_ms,
  }));

  return NextResponse.json(result);
}
