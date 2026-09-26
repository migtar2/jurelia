// News analysis API route
// POST /api/news/analyze — Analyze a news URL and find the referenced CENDOJ resolution

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/guard";
import { withQuota, getCommercialCategory } from "@/lib/quota";
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

  // Auth required for quota tracking
  const auth = await requireAuth();
  if (auth.error) return auth.error;

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

  // Quota-enforced operation
  const category = getCommercialCategory("news_claim_extraction");
  const quotaResult = await withQuota(auth.user.userId, category, async () => {
    // Phase 2: Article Extraction
    const extractionStart = Date.now();
    let article;
    try {
      const fetchResult = await fetchArticle(url);
      if (fetchResult.status >= 400) {
        throw new Error(`La URL devolvió HTTP ${fetchResult.status}`);
      }
      article = extractArticle(fetchResult.html, fetchResult.final_url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Error obteniendo artículo: ${msg}`);
    }
    const extractionMs = Date.now() - extractionStart;

    // Phase 3: Legal Metadata Extraction
    const legalMetadata = extractLegalMetadata(article.article_text);

    // Phase 4+5: Search Strategy + CENDOJ Search
    const searchStart = Date.now();
    const searchResult = await executeSearchStrategy(legalMetadata);
    const searchMs = Date.now() - searchStart;

    // Phase 6+7: Candidate Verification
    const verifyStart = Date.now();
    const match = verifyMatches(legalMetadata, searchResult.candidates, searchResult.attempts);
    const verifyMs = Date.now() - verifyStart;

    return {
      article,
      legalMetadata,
      match,
      extractionMs,
      searchMs,
      verifyMs,
    };
  });

  if ("error" in quotaResult) {
    return NextResponse.json(
      { error: "QUOTA_EXCEEDED", category: quotaResult.quota.category, used: quotaResult.quota.used, limit: quotaResult.quota.limit, remaining: quotaResult.quota.remaining, period_end: quotaResult.quota.period_end },
      { status: 429 }
    );
  }

  const { result: opResult, quota } = quotaResult;

  // Save structured log
  const result: NewsAnalysisResult = {
    request_id: requestId,
    article: opResult.article,
    legal_metadata: opResult.legalMetadata,
    match: opResult.match,
    diagnostics: {
      url,
      http_status: 200,
      extractor: opResult.article.extraction_method,
      extraction_ms: opResult.extractionMs,
      search_ms: opResult.searchMs,
      verification_ms: opResult.verifyMs,
      total_ms: Date.now() - totalStart,
      errors,
    },
  };

  // Log for observability
  console.log("[NEWS_ANALYSIS]", JSON.stringify({
    request_id: requestId,
    url,
    publication: opResult.article.publication,
    ecli: opResult.legalMetadata.ecli?.value,
    roj: opResult.legalMetadata.roj?.value,
    match_status: opResult.match.status,
    confidence: opResult.match.confidence,
    candidates: opResult.match.candidates.length,
    total_ms: result.diagnostics.total_ms,
  }));

  return NextResponse.json({
    ...result,
    _quota: { category: quota.category, used: quota.used, limit: quota.limit, remaining: quota.remaining, period_end: quota.period_end },
  });
}
