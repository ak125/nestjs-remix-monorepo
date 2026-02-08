import { logger } from "~/utils/logger";

/**
 * 🔧 UTILITAIRES FETCH POUR SITEMAPS
 *
 * Fonctionnalités:
 * - Timeout configurable
 * - Retry avec backoff exponentiel
 * - Validation XML
 * - Gestion d'erreurs robuste
 */

// Configuration par défaut
export const SITEMAP_CONFIG = {
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:3000",
  BASE_URL: process.env.BASE_URL || "https://www.automecanik.com",
  TIMEOUT_MS: 5000,
  MAX_RETRIES: 2,
  CACHE_BROWSER: 3600, // 1h browser
  CACHE_CDN: 7200, // 2h CDN
  CACHE_STALE: 86400, // 24h stale-while-revalidate
  // Cache plus long pour sitemaps stables
  CACHE_BROWSER_STABLE: 86400, // 24h browser
  CACHE_CDN_STABLE: 172800, // 48h CDN
};

/**
 * Fetch avec timeout
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = SITEMAP_CONFIG.TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch avec retry et backoff exponentiel
 */
export async function fetchWithRetry(
  url: string,
  options: {
    retries?: number;
    timeoutMs?: number;
    backoffMs?: number;
  } = {},
): Promise<Response> {
  const {
    retries = SITEMAP_CONFIG.MAX_RETRIES,
    timeoutMs = SITEMAP_CONFIG.TIMEOUT_MS,
    backoffMs = 100,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);
      if (response.ok) return response;
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;

      // Ne pas retry sur abort (timeout)
      if ((error as Error).name === "AbortError") {
        throw new Error(`Timeout after ${timeoutMs}ms: ${url}`);
      }

      if (attempt < retries) {
        // Backoff exponentiel: 100ms, 200ms, 400ms...
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw (
    lastError || new Error(`Fetch failed after ${retries + 1} attempts: ${url}`)
  );
}

/**
 * Validation XML basique
 */
export function isValidSitemapXml(content: string): boolean {
  if (!content || typeof content !== "string") return false;
  const trimmed = content.trim();
  return (
    trimmed.startsWith("<?xml") &&
    (trimmed.includes("<urlset") || trimmed.includes("<sitemapindex"))
  );
}

/**
 * Headers standard pour sitemaps
 */
export function getSitemapHeaders(
  options: {
    responseTime?: number;
    isStable?: boolean;
    isError?: boolean;
    errorMessage?: string;
  } = {},
): Record<string, string> {
  const {
    responseTime,
    isStable = false,
    isError = false,
    errorMessage,
  } = options;

  const cacheBrowser = isStable
    ? SITEMAP_CONFIG.CACHE_BROWSER_STABLE
    : SITEMAP_CONFIG.CACHE_BROWSER;
  const cacheCdn = isStable
    ? SITEMAP_CONFIG.CACHE_CDN_STABLE
    : SITEMAP_CONFIG.CACHE_CDN;

  const headers: Record<string, string> = {
    "Content-Type": "application/xml; charset=utf-8",
    Vary: "Accept-Encoding",
  };

  if (isError) {
    headers["Cache-Control"] = "public, max-age=300"; // 5min en cas d'erreur
    if (errorMessage) {
      headers["X-Error"] = errorMessage;
    }
  } else {
    headers["Cache-Control"] =
      `public, max-age=${cacheBrowser}, s-maxage=${cacheCdn}, stale-while-revalidate=${SITEMAP_CONFIG.CACHE_STALE}`;
  }

  if (responseTime !== undefined) {
    headers["X-Response-Time"] = `${responseTime}ms`;
  }

  return headers;
}

/**
 * Générer un fallback sitemap vide valide
 */
export function generateEmptyFallbackSitemap(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
}

/**
 * Générer un fallback sitemap avec une seule URL
 */
export function generateSingleUrlFallback(
  url: string,
  priority: number = 0.8,
): string {
  const today = new Date().toISOString().split("T")[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
</urlset>`;
}

/**
 * Générer un fallback sitemap index
 */
export function generateFallbackSitemapIndex(
  sitemaps: Array<{ loc: string; lastmod?: string }>,
): string {
  const today = new Date().toISOString().split("T")[0];
  const entries = sitemaps
    .map(
      (s) => `  <sitemap>
    <loc>${s.loc}</loc>
    <lastmod>${s.lastmod || today}</lastmod>
  </sitemap>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

/**
 * Logger pour sitemaps avec contexte
 */
export function logSitemapError(
  name: string,
  error: unknown,
  duration?: number,
): void {
  const durationStr = duration !== undefined ? ` après ${duration}ms` : "";
  logger.error(`[Sitemap ${name}] Erreur${durationStr}:`, error);
}

export function logSitemapSuccess(
  name: string,
  urlCount: number,
  duration: number,
): void {
  logger.log(`[Sitemap ${name}] ✅ ${urlCount} URLs en ${duration}ms`);
}
