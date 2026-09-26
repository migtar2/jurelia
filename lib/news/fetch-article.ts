// SSRF-safe article fetcher with enhanced redirect handling, retry, and robots.txt

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

const BLOCKED_PROTOCOLS = new Set(["file:", "ftp:", "data:", "javascript:"]);

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^fc00:/,
  /^fe80:/,
  /^::ffff:10\./,
  /^::ffff:172\./,
  /^::ffff:192\.168\./,
];

const MAX_REDIRECTS = 5;
const MAX_HTML_SIZE = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT = 15_000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

// Cookie/consent banner patterns to strip from HTML
const COOKIE_BANNER_PATTERNS = [
  /<div[^>]*(?:id|class)=["'][^"']*(?:cookie|consent|gdpr|rgpd|privacy-banner|cookie-notice|onetrust|didomi|tarteaucitron|cc-banner|cookie-law)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
  /<div[^>]*(?:id|class)=["'][^"']*(?:cookie|consent|gdpr|rgpd|privacy-banner|cookie-notice|onetrust|didomi|tarteaucitron|cc-banner|cookie-law)[^"']*["'][^>]\/>/gi,
  /<section[^>]*(?:id|class)=["'][^"']*(?:cookie|consent|gdpr|rgpd)[^"']*["'][^>]*>[\s\S]*?<\/section>/gi,
  /<aside[^>]*(?:id|class)=["'][^"']*(?:cookie|consent|gdpr|rgpd)[^"']*["'][^>]*>[\s\S]*?<\/aside>/gi,
];

// robots.txt cache: Map<origin, { rules, fetchedAt }>
const robotsCache = new Map<string, { rules: RobotsRules; fetchedAt: number }>();
const ROBOTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface RobotsRules {
  disallowed: string[];
  allowed: string[];
}

export function validateUrl(urlStr: string): { valid: boolean; error?: string } {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { valid: false, error: "URL inválida" };
  }

  if (BLOCKED_PROTOCOLS.has(url.protocol)) {
    return { valid: false, error: `Protocolo no permitido: ${url.protocol}` };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valid: false, error: "Solo se permiten URLs http/https" };
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname)) {
    return { valid: false, error: "Acceso a localhost/loopback bloqueado" };
  }

  for (const range of PRIVATE_RANGES) {
    if (range.test(hostname)) {
      return { valid: false, error: "Acceso a red privada bloqueado" };
    }
  }

  if (urlStr.length > 2048) {
    return { valid: false, error: "URL demasiado larga (máx 2048 caracteres)" };
  }

  return { valid: true };
}

export interface FetchResult {
  html: string;
  final_url: string;
  status: number;
  content_type: string | null;
  redirects: number;
  redirect_chain: string[];
  cookie_banners_removed: boolean;
  meta_refresh_followed: boolean;
}

/**
 * Parse robots.txt and extract Disallow/Allow rules for our user-agent.
 */
function parseRobotsTxt(text: string): RobotsRules {
  const disallowed: string[] = [];
  const allowed: string[] = [];
  let applies = false;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...rest] = trimmed.split(":");
    const value = rest.join(":").trim();

    if (key.toLowerCase() === "user-agent") {
      // Apply to all agents (*), or specifically to our bot
      applies =
        value === "*" ||
        value.toLowerCase().includes("cendojbot") ||
        value.toLowerCase().includes("cendoj");
    } else if (applies) {
      if (key.toLowerCase() === "disallow" && value) {
        disallowed.push(value);
      } else if (key.toLowerCase() === "allow" && value) {
        allowed.push(value);
      }
    }
  }

  return { disallowed, allowed };
}

/**
 * Check robots.txt for the given URL's origin. Cached for the session.
 */
async function checkRobotsTxt(
  urlStr: string
): Promise<{ allowed: boolean; reason?: string }> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { allowed: true };
  }

  const origin = `${url.protocol}//${url.host}`;
  const pathname = url.pathname;

  let rules: RobotsRules;
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL) {
    rules = cached.rules;
  } else {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${origin}/robots.txt`, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CendojBot/1.0)" },
        redirect: "manual",
      });
      clearTimeout(timeout);

      if (res.ok) {
        const text = await res.text();
        rules = parseRobotsTxt(text);
      } else {
        // No robots.txt means everything is allowed
        rules = { disallowed: [], allowed: [] };
      }
    } catch {
      // Can't fetch robots.txt — be permissive
      rules = { disallowed: [], allowed: [] };
    }
    robotsCache.set(origin, { rules, fetchedAt: Date.now() });
  }

  // Check if path is disallowed (with Allow overrides)
  for (const pattern of rules.disallowed) {
    if (pathname.startsWith(pattern)) {
      // Check if a more specific Allow overrides it
      const overridden = rules.allowed.some(
        (a) => pathname.startsWith(a) && a.length >= pattern.length
      );
      if (!overridden) {
        return {
          allowed: false,
          reason: `Bloqueado por robots.txt: Disallow: ${pattern}`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Detect and follow meta-refresh redirects in HTML.
 * Returns the redirect URL if found, null otherwise.
 */
function extractMetaRefreshUrl(html: string): string | null {
  const match = html.match(
    /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'\s;>]+)/i
  );
  if (match) return match[1];
  // Also try reversed attribute order
  const match2 = html.match(
    /<meta[^>]+content=["'][^"']*url=([^"'\s;>]+)[^"']+["'][^>]+http-equiv=["']refresh["']/i
  );
  if (match2) return match2[1];
  return null;
}

/**
 * Detect <noscript> fallback content for JS-heavy pages.
 * Returns the noscript inner HTML if the page looks JS-reliant.
 */
function extractNoscriptFallback(html: string): string | null {
  // Check if the page relies heavily on JavaScript (has minimal body content outside scripts)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return null;

  const bodyContent = bodyMatch[1];
  // Strip scripts to see how much content remains
  const withoutScripts = bodyContent
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();

  // If very little text content outside scripts, page is JS-heavy
  if (withoutScripts.length > 50) return null; // Not JS-heavy

  // Extract noscript content
  const noscriptMatch = html.match(/<noscript[^>]*>([\s\S]*?)<\/noscript>/gi);
  if (noscriptMatch && noscriptMatch.length > 0) {
    // Return the largest noscript block (likely the main content)
    return noscriptMatch
      .map((block) => {
        const inner = block.replace(/<\/?noscript[^>]*>/gi, "");
        return { html: inner, len: inner.length };
      })
      .sort((a, b) => b.len - a.len)[0].html;
  }

  return null;
}

/**
 * Remove cookie/consent banners from HTML.
 */
export function stripCookieBanners(html: string): {
  html: string;
  removed: boolean;
} {
  let result = html;
  let removed = false;
  for (const pattern of COOKIE_BANNER_PATTERNS) {
    const before = result.length;
    result = result.replace(pattern, "");
    if (result.length < before) removed = true;
  }
  return { html: result, removed };
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make a fetch with retry for 429 and 503 status codes.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const mergedInit: RequestInit = {
        ...init,
        signal: controller.signal,
      };
      const res = await fetch(url, mergedInit);
      clearTimeout(timeout);

      // Retry on 429 (rate limit) and 503 (service unavailable)
      if ((res.status === 429 || res.status === 503) && attempt < retries) {
        const delay =
          INITIAL_RETRY_DELAY * Math.pow(2, attempt) +
          Math.random() * 500; // jitter
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : delay;
        console.log(
          `[FETCH] ${res.status} for ${url}, retry in ${waitMs}ms (attempt ${attempt + 1}/${retries + 1})`
        );
        await sleep(waitMs);
        continue;
      }

      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on network errors, not abort/timeout
      if (attempt < retries) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.log(
          `[FETCH] Error for ${url}: ${lastError.message}, retry in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new Error("Fetch failed after retries");
}

export async function fetchArticle(urlStr: string): Promise<FetchResult> {
  const validation = validateUrl(urlStr);
  if (!validation.valid) {
    throw new Error(`URL no válida: ${validation.error}`);
  }

  // Check robots.txt before fetching
  const robotsCheck = await checkRobotsTxt(urlStr);
  if (!robotsCheck.allowed) {
    throw new Error(robotsCheck.reason || "Bloqueado por robots.txt");
  }

  let currentUrl = urlStr;
  let redirects = 0;
  const redirectChain: string[] = [currentUrl];

  while (redirects <= MAX_REDIRECTS) {
    const res = await fetchWithRetry(currentUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CendojBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
    });

    // Handle HTTP 3xx redirects
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;

      const nextUrl = new URL(location, currentUrl).toString();
      const nextValidation = validateUrl(nextUrl);
      if (!nextValidation.valid) {
        throw new Error(`Redirect a URL no válida: ${nextValidation.error}`);
      }
      currentUrl = nextUrl;
      redirectChain.push(currentUrl);
      redirects++;
      continue;
    }

    const contentType = res.headers.get("content-type");
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      throw new Error(`Content-Type no soportado: ${contentType}`);
    }

    let html = await res.text();
    if (html.length > MAX_HTML_SIZE) {
      throw new Error(
        `HTML demasiado grande (${(html.length / 1024 / 1024).toFixed(1)}MB, máx 5MB)`
      );
    }

    // Check for meta-refresh redirect
    const metaRefreshUrl = extractMetaRefreshUrl(html);
    let metaRefreshFollowed = false;
    if (metaRefreshUrl && redirects < MAX_REDIRECTS) {
      try {
        const resolved = new URL(metaRefreshUrl, currentUrl).toString();
        const mrv = validateUrl(resolved);
        if (mrv.valid) {
          // Check robots.txt for meta-refresh target too
          const mrRobots = await checkRobotsTxt(resolved);
          if (mrRobots.allowed) {
            currentUrl = resolved;
            redirectChain.push(currentUrl);
            redirects++;
            metaRefreshFollowed = true;
            continue; // Re-fetch at new URL
          }
        }
      } catch {
        // Invalid meta-refresh URL, ignore
      }
    }

    // Check for JS-heavy pages with noscript fallback
    const noscriptFallback = extractNoscriptFallback(html);
    if (noscriptFallback) {
      // Wrap noscript content in a minimal HTML structure for extraction
      html = `<html><head><title>${extractTitle(html)}</title>${extractMetaTags(html)}</head><body>${noscriptFallback}</body></html>`;
    }

    // Strip cookie/consent banners
    const { html: cleanHtml, removed: cookieBannersRemoved } =
      stripCookieBanners(html);

    // Log redirect chain for diagnostics
    if (redirectChain.length > 1) {
      console.log(
        `[FETCH] Redirect chain (${redirects} hops): ${redirectChain.join(" → ")}`
      );
    }

    return {
      html: cleanHtml,
      final_url: currentUrl,
      status: res.status,
      content_type: contentType,
      redirects,
      redirect_chain: redirectChain,
      cookie_banners_removed: cookieBannersRemoved,
      meta_refresh_followed: metaRefreshFollowed,
    };
  }

  throw new Error(`Demasiados redirects (máx ${MAX_REDIRECTS})`);
}

/**
 * Extract <title> content from HTML for noscript wrapping.
 */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

/**
 * Extract meta tags from <head> for noscript wrapping.
 */
function extractMetaTags(html: string): string {
  const metas = html.match(/<meta[^>]+>/gi) || [];
  return metas.join("\n");
}