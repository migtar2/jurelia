import { describe, it, expect } from "vitest";
import {
  normalizePastedText,
  buildPastedArticle,
  PASTED_TEXT_MIN_LENGTH,
} from "@/lib/news/pasted";

describe("normalizePastedText", () => {
  it("accepts text at the minimum length and trims it", () => {
    const raw = " ".repeat(3) + "a".repeat(PASTED_TEXT_MIN_LENGTH) + "\n";
    const out = normalizePastedText(raw);
    expect(out).toBe("a".repeat(PASTED_TEXT_MIN_LENGTH));
  });

  it("normalizes CRLF to LF", () => {
    const out = normalizePastedText("line one is long enough\r\nline two");
    expect(out).toBe("line one is long enough\nline two");
  });

  it("rejects text shorter than the minimum", () => {
    expect(normalizePastedText("too short")).toBeNull();
  });

  it("rejects non-string values", () => {
    expect(normalizePastedText(undefined)).toBeNull();
    expect(normalizePastedText(null)).toBeNull();
    expect(normalizePastedText(42)).toBeNull();
    expect(normalizePastedText({ text: "x".repeat(100) })).toBeNull();
  });

  it("rejects whitespace-only text", () => {
    expect(normalizePastedText(" ".repeat(100))).toBeNull();
  });
});

describe("buildPastedArticle", () => {
  it("builds an ArticleData marked as pasted", () => {
    const text = "El Tribunal Supremo ha estimado el recurso de casación.";
    const article = buildPastedArticle(text);
    expect(article.article_text).toBe(text);
    expect(article.extraction_method).toBe("pasted");
    expect(article.url).toBe("");
    expect(article.html_length).toBe(text.length);
    expect(article.extraction_confidence).toBe(1);
    expect(article.structured_data).toBeNull();
    expect(article.warnings).toEqual([]);
    expect(article.has_continuation).toBe(false);
  });
});
