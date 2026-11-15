// Build an ArticleData from news text pasted directly by the user.
// Used by POST /api/news/analyze when the client sends `text` instead of `url`.

import type { ArticleData } from "./types";

export const PASTED_TEXT_MIN_LENGTH = 20;

/**
 * Returns the trimmed text if it is long enough to analyze, or null.
 */
export function normalizePastedText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (text.length < PASTED_TEXT_MIN_LENGTH) return null;
  return text;
}

export function buildPastedArticle(text: string): ArticleData {
  return {
    url: "",
    title: null,
    publication: null,
    author: null,
    publication_date: null,
    canonical_url: null,
    headline: null,
    article_text: text,
    html_length: text.length,
    extraction_method: "pasted",
    structured_data: null,
    extraction_confidence: 1,
    warnings: [],
    has_continuation: false,
    modified_date: null,
  };
}
