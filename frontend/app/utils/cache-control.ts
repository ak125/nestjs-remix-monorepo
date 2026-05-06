import type { HeadersFunction } from "@remix-run/node";

const NO_STORE = "no-cache, no-store, must-revalidate";

/**
 * Build a Remix `HeadersFunction` that forces `no-store` whenever the loader
 * threw a Response (4xx/5xx) and applies the success policy otherwise.
 *
 * Why: Remix invokes `headers()` for both successful loaders AND thrown
 * Responses. A naive arrow `() => ({ "Cache-Control": "public, s-maxage=86400" })`
 * leaks the success policy onto error responses, letting Cloudflare cache the
 * 5xx for `s-maxage` seconds. See ADR on cache-control discipline.
 *
 * Precedence (matches `pieces.$slug.tsx` historical pattern, generalised):
 *   1. errorHeaders → loader threw a Response, honour its Cache-Control
 *      (or default to `no-store` to refuse CDN caching of failures)
 *   2. loaderHeaders → success path, honour the value the loader set on
 *      `json()` / `defer()` (e.g. shorter TTL for low-confidence content)
 *   3. `successPolicy` → fallback when neither set anything explicit
 *
 * X-Robots-Tag is propagated unchanged from whichever source carried it
 * (loader on success, error response on failure).
 */
export function buildCacheHeaders(successPolicy: string): HeadersFunction {
  return ({ loaderHeaders, errorHeaders }) => {
    const out: Record<string, string> = {};

    if (errorHeaders) {
      out["Cache-Control"] = errorHeaders.get("Cache-Control") ?? NO_STORE;
      const xRobots = errorHeaders.get("X-Robots-Tag");
      if (xRobots) out["X-Robots-Tag"] = xRobots;
      return out;
    }

    out["Cache-Control"] =
      loaderHeaders?.get("Cache-Control") ?? successPolicy;
    const xRobots = loaderHeaders?.get("X-Robots-Tag");
    if (xRobots) out["X-Robots-Tag"] = xRobots;
    return out;
  };
}

/**
 * Header value used when the response MUST NOT be cached by any tier
 * (browser, CDN). Use on loader-thrown error Responses to prevent CDN
 * cache poisoning across the route's `headers()` function.
 */
export const NO_STORE_CACHE_CONTROL = NO_STORE;
