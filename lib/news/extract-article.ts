// Article content extraction using JSON-LD, Open Graph, Readability, and static fallback
// Priority: JSON-LD > OG > Readability > Static

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { ArticleData, StructuredData } from "./types";

// Patterns for elements to remove before extraction (cookie banners already handled in fetch)
const NOISE_SELECTORS = [
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "iframe",
  "noscript",
];

const NEWSLETTER_PATTERNS = [
  /newsletter/gi,
  /suscripci[oó]n/gi,
  /subscribe/gi,
  /recibe.*noticias/gi,
  /mantente.*informado/gi,
  /bolet[ií]n/gi,
];

const RELATED_ARTICLES_PATTERNS = [
  /art[ií]culos?\s+relacionados?/gi,
  /related\s+(?:articles?|stories|posts)/gi,
  /noticias?\s+relacionadas?/gi,
  /tambi[eé]n\s+te\s+puede\s+interesar/gi,
  /puede\s+interesarte/gi,
  /m[aá]s\s+noticias/gi,
  /lee\s+tambi[eé]n/gi,
  /read\s+more/gi,
  /see\s+also/gi,
];

const CONTINUATION_PATTERNS = [
  /siguiente\s+p[aá]gina/gi,
  /next\s+page/gi,
  /p[aá]gina\s+\d+\s+de\s+\d+/gi,
  /page\s+\d+\s+of\s+\d+/gi,
  /contin[uú]a\s+en/gi,
  /read\s+more\s+on/gi,
];

// Tracking parameters to strip from URLs
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_source_platform",
  "utm_creative_format",
  "utm_marketing_tactic",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "twclid",
  "ttclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
  "share",
]);

export function extractArticle(html: string, url: string): ArticleData {
  const warnings: string[] = [];
  const structuredData = extractStructuredData(html);

  // Priority 1: JSON-LD structured data (richest, most reliable)
  if (structuredData?.json_ld_type && structuredData.headline) {
    const article = buildFromStructuredData(html, url, structuredData, warnings);
    if (article.article_text.length > 200) {
      return article;
    }
    warnings.push("JSON-LD found but body text too short, falling back");
  }

  // Priority 2: Try Readability (good for well-structured pages)
  try {
    const { document } = parseHTML(html);
    // Remove noise elements before Readability
    for (const selector of NOISE_SELECTORS) {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    }
    // Remove cookie/GDPR elements
    removeCookieElements(document);
    // Remove newsletter signup forms
    removeNewsletterElements(document);
    // Remove related articles sections
    removeRelatedArticles(document);

    const reader = new Readability(document);
    const parsed = reader.parse();

    if (parsed && parsed.textContent && parsed.textContent.length > 200) {
      const confidence = calculateConfidence(structuredData, parsed.title, parsed.byline, html);
      return {
        url,
        title: structuredData?.headline || parsed.title || extractMeta(html, "og:title") || null,
        publication: structuredData?.publisher || structuredData?.og?.site_name || extractPublication(html, url),
        author: normalizeAuthor(structuredData?.author || parsed.byline || extractMeta(html, "author")),
        publication_date: normalizeDate(structuredData?.datePublished || extractDate(html)),
        canonical_url: normalizeCanonicalUrl(structuredData?.og?.url || extractCanonical(html, url), url),
        headline: structuredData?.headline || parsed.title || null,
        article_text: cleanText(parsed.textContent),
        html_length: html.length,
        extraction_method: structuredData ? "json-ld" : "readability",
        structured_data: structuredData,
        extraction_confidence: confidence,
        warnings,
        has_continuation: detectContinuation(html),
        modified_date: normalizeDate(structuredData?.dateModified || extractMeta(html, "article:modified_time") || null),
      };
    }
  } catch {
    warnings.push("Readability extraction failed");
  }

  // Priority 3: OG fallback if we have structured data but no body text
  if (structuredData?.og?.title) {
    warnings.push("Using OG fallback extraction");
    return buildFromOG(html, url, structuredData, warnings);
  }

  // Priority 4: Static regex-based extraction (last resort)
  warnings.push("Using static regex extraction (lowest confidence)");
  return extractStatic(html, url, structuredData, warnings);
}

/**
 * Extract structured data: JSON-LD, Open Graph, Twitter Cards.
 */
function extractStructuredData(html: string): StructuredData | null {
  const sd: StructuredData = {};

  // --- JSON-LD ---
  const jsonLdBlocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      const jsonStr = block.replace(/<\/?script[^>]*>/gi, "").trim();
      try {
        const data = JSON.parse(jsonStr);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (
            item["@type"] === "NewsArticle" ||
            item["@type"] === "Article" ||
            item["@type"] === "ReportageNewsArticle" ||
            item["@type"] === "ScholarlyArticle" ||
            item["@type"] === "WebPage"
          ) {
            sd.json_ld_type = item["@type"];
            sd.headline = item.headline || sd.headline;
            sd.description = item.description || sd.description;
            sd.datePublished = item.datePublished || sd.datePublished;
            sd.dateModified = item.dateModified || sd.dateModified;
            sd.mainEntityOfPage =
              typeof item.mainEntityOfPage === "string"
                ? item.mainEntityOfPage
                : item.mainEntityOfPage?.["@id"] || sd.mainEntityOfPage;

            // Author
            if (item.author) {
              if (Array.isArray(item.author)) {
                sd.author = item.author.map((a: { name?: string }) =>
                  typeof a === "string" ? a : a.name || ""
                ).filter(Boolean);
              } else if (typeof item.author === "string") {
                sd.author = item.author;
              } else if (item.author.name) {
                sd.author = item.author.name;
              }
            }

            // Publisher
            if (item.publisher) {
              sd.publisher =
                typeof item.publisher === "string"
                  ? item.publisher
                  : item.publisher.name || sd.publisher;
            }

            // Image
            if (item.image) {
              sd.image =
                typeof item.image === "string"
                  ? item.image
                  : Array.isArray(item.image)
                    ? typeof item.image[0] === "string"
                      ? item.image[0]
                      : item.image[0]?.url
                    : item.image.url || sd.image;
            }
          }
        }
      } catch {
        // Invalid JSON-LD, skip
      }
    }
  }

  // --- Open Graph ---
  sd.og = {
    title: extractMeta(html, "og:title") || undefined,
    description: extractMeta(html, "og:description") || undefined,
    image: extractMeta(html, "og:image") || undefined,
    url: extractMeta(html, "og:url") || undefined,
    site_name: extractMeta(html, "og:site_name") || undefined,
    type: extractMeta(html, "og:type") || undefined,
    author: extractMeta(html, "article:author") || undefined,
    published_time: extractMeta(html, "article:published_time") || undefined,
    modified_time: extractMeta(html, "article:modified_time") || undefined,
  };

  // --- Twitter Cards ---
  sd.twitter = {
    card: extractMeta(html, "twitter:card") || undefined,
    title: extractMeta(html, "twitter:title") || undefined,
    description: extractMeta(html, "twitter:description") || undefined,
    image: extractMeta(html, "twitter:image") || extractMeta(html, "twitter:image:src") || undefined,
    site: extractMeta(html, "twitter:site") || undefined,
    creator: extractMeta(html, "twitter:creator") || undefined,
  };

  // Return null if nothing useful was found
  const hasJsonLd = !!sd.json_ld_type;
  const hasOg = !!(sd.og?.title || sd.og?.url);
  const hasTwitter = !!(sd.twitter?.title || sd.twitter?.card);
  if (!hasJsonLd && !hasOg && !hasTwitter) return null;

  return sd;
}

/**
 * Build ArticleData primarily from structured data.
 */
function buildFromStructuredData(
  html: string,
  url: string,
  sd: StructuredData,
  warnings: string[]
): ArticleData {
  // Try Readability for body text even when we have structured metadata
  let bodyText = "";
  let extractionMethod: ArticleData["extraction_method"] = "json-ld";

  try {
    const { document } = parseHTML(html);
    for (const selector of NOISE_SELECTORS) {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    }
    removeCookieElements(document);
    removeNewsletterElements(document);
    removeRelatedArticles(document);

    const reader = new Readability(document);
    const parsed = reader.parse();
    if (parsed && parsed.textContent && parsed.textContent.length > 100) {
      bodyText = cleanText(parsed.textContent);
    }
  } catch {
    // Fall through to static
  }

  if (!bodyText || bodyText.length < 200) {
    // Static fallback for body text
    bodyText = extractBodyText(html);
    extractionMethod = "og-fallback";
    warnings.push("Used static body text extraction alongside JSON-LD metadata");
  }

  return {
    url,
    title: sd.headline || sd.og?.title || sd.twitter?.title || null,
    publication: sd.publisher || sd.og?.site_name || extractPublication(html, url),
    author: normalizeAuthor(sd.author),
    publication_date: normalizeDate(sd.datePublished || sd.og?.published_time || null),
    canonical_url: normalizeCanonicalUrl(sd.og?.url || sd.mainEntityOfPage || extractCanonical(html, url), url),
    headline: sd.headline || null,
    article_text: bodyText,
    html_length: html.length,
    extraction_method: extractionMethod,
    structured_data: sd,
    extraction_confidence: 0.9,
    warnings,
    has_continuation: detectContinuation(html),
    modified_date: normalizeDate(sd.dateModified || sd.og?.modified_time || null),
  };
}

/**
 * Build ArticleData from OG data when no body text is available.
 */
function buildFromOG(
  html: string,
  url: string,
  sd: StructuredData,
  warnings: string[]
): ArticleData {
  const bodyText = extractBodyText(html);

  return {
    url,
    title: sd.og?.title || null,
    publication: sd.og?.site_name || extractPublication(html, url),
    author: normalizeAuthor(sd.og?.author || extractMeta(html, "author")),
    publication_date: normalizeDate(sd.og?.published_time || extractDate(html)),
    canonical_url: normalizeCanonicalUrl(sd.og?.url || extractCanonical(html, url), url),
    headline: sd.og?.title || null,
    article_text: cleanText(bodyText),
    html_length: html.length,
    extraction_method: "og-fallback",
    structured_data: sd,
    extraction_confidence: 0.5,
    warnings,
    has_continuation: detectContinuation(html),
    modified_date: normalizeDate(sd.og?.modified_time || null),
  };
}

/**
 * Static fallback extraction.
 */
function extractStatic(
  html: string,
  url: string,
  sd: StructuredData | null,
  warnings: string[]
): ArticleData {
  const title =
    extractTag(html, "title") || extractMeta(html, "og:title") || null;
  const bodyText = extractBodyText(html);

  return {
    url,
    title,
    publication: sd?.og?.site_name || extractPublication(html, url),
    author: normalizeAuthor(sd?.author || extractMeta(html, "author")),
    publication_date: normalizeDate(extractDate(html)),
    canonical_url: normalizeCanonicalUrl(extractCanonical(html, url), url),
    headline: title,
    article_text: cleanText(bodyText),
    html_length: html.length,
    extraction_method: "static",
    structured_data: sd,
    extraction_confidence: 0.3,
    warnings,
    has_continuation: detectContinuation(html),
    modified_date: normalizeDate(extractMeta(html, "article:modified_time")),
  };
}

/**
 * Extract body text by removing noise elements and tags.
 */
function extractBodyText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 50000);
}

/**
 * Calculate extraction confidence based on available data.
 */
function calculateConfidence(
  sd: StructuredData | null,
  readabilityTitle: string | null | undefined,
  readabilityByline: string | null | undefined,
  html: string
): number {
  let score = 0.4; // base for Readability success

  if (sd?.json_ld_type) score += 0.25;
  if (sd?.headline) score += 0.1;
  if (sd?.datePublished) score += 0.1;
  if (sd?.author) score += 0.05;
  if (sd?.publisher) score += 0.05;
  if (readabilityTitle) score += 0.025;
  if (readabilityByline) score += 0.025;

  return Math.min(score, 1);
}

/**
 * Remove cookie/GDPR consent elements from DOM.
 */
function removeCookieElements(document: Document): void {
  const patterns = /cookie|consent|gdpr|rgpd|privacy-banner|onetrust|didomi|tarteaucitron/i;
  document.querySelectorAll("[id],[class]").forEach((el) => {
    const id = el.getAttribute("id") || "";
    const cls = el.getAttribute("class") || "";
    if (patterns.test(id) || patterns.test(cls)) {
      el.remove();
    }
  });
}

/**
 * Remove newsletter signup forms from DOM.
 */
function removeNewsletterElements(document: Document): void {
  document.querySelectorAll("form").forEach((el) => {
    const text = el.textContent || "";
    if (NEWSLETTER_PATTERNS.some((p) => p.test(text))) {
      el.remove();
    }
  });
}

/**
 * Remove related articles / "read more" sections from DOM.
 */
function removeRelatedArticles(document: Document): void {
  const allElements = document.querySelectorAll("section, div, aside");
  allElements.forEach((el) => {
    const text = el.textContent || "";
    const firstLine = text.split("\n")[0].substring(0, 100);
    if (RELATED_ARTICLES_PATTERNS.some((p) => p.test(firstLine))) {
      el.remove();
    }
  });
}

/**
 * Detect multi-page / continuation patterns.
 */
function detectContinuation(html: string): boolean {
  return CONTINUATION_PATTERNS.some((p) => p.test(html));
}

// --- Utility functions ---

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${escapeRegex(name)}["']`,
      "i"
    ),
  ];
  for (const p of patterns) {
    const match = html.match(p);
    if (match) return match[1].trim();
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractDate(html: string): string | null {
  const dateFields = [
    "article:published_time",
    "datePublished",
    "date",
    "DC.date",
    "sailthru.date",
    "publish-date",
    "article:modified_time",
  ];
  for (const field of dateFields) {
    const val = extractMeta(html, field);
    if (val) return val;
  }
  const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if (timeMatch) return timeMatch[1];
  return null;
}

function extractCanonical(html: string, fallback: string): string | null {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return match ? match[1] : fallback;
}

function extractPublication(html: string, url: string): string | null {
  const ogSite = extractMeta(html, "og:site_name");
  if (ogSite) return ogSite;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Normalize a date string to ISO 8601 format.
 */
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // Return original if unparseable
    return d.toISOString();
  } catch {
    return dateStr;
  }
}

/**
 * Normalize author: handle arrays, trim, normalize whitespace.
 */
function normalizeAuthor(
  author: string | string[] | null | undefined
): string | null {
  if (!author) return null;
  if (Array.isArray(author)) {
    return author.filter(Boolean).map((a) => a.trim()).join(", ") || null;
  }
  return author.replace(/\s+/g, " ").trim() || null;
}

/**
 * Normalize canonical URL: strip tracking parameters.
 */
function normalizeCanonicalUrl(
  canonical: string | null | undefined,
  fallback: string
): string | null {
  const urlStr = canonical || fallback;
  if (!urlStr) return null;
  try {
    const url = new URL(urlStr);
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }
    return url.toString();
  } catch {
    return urlStr;
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}