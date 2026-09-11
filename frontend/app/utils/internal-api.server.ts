/**
 * Internal API URL utility for server-side React Router loaders/actions.
 *
 * The SSR bundle runs INSIDE the NestJS process (`backend/src/remix/remix.controller.ts`
 * façade, `app.listen(process.env.PORT || 3000)`), so a loader calling the API is
 * calling its own process. These URLs MUST therefore stay on the loopback interface.
 *
 * ⚠️ NEVER derive the API host from the incoming request's public origin. In PROD the
 * request origin is `https://www.automecanik.com`, so the server would egress to
 * Cloudflare and route back into itself for every loader call: one extra CDN round trip
 * per call, and the loopback traffic becomes subject to the app's own global rate limiter
 * with `Cf-Connecting-Ip` set to the ORIGIN's public IP
 * (`backend/src/common/guards/cloudflare-throttler.guard.ts`), so bursts self-throttle
 * into 429s.
 *
 * Measurement note — do not reuse the earlier attribution. A PROD sample on 2026-08-15
 * for `/blog-pieces-auto/conseils/*`, then using the request origin (TTFB 1.78-2.27 s,
 * against 0.29 s for `/` and 227 ms for `/api/r3-guide/capteur-abs` alone), was read as a
 * ~1.5 s pure CDN round trip that capped mobile LCP at 4.6 s. The 2026-09-11 measurement
 * refutes that reading: moving these loaders to loopback gained at most 0.1-0.2 s, and the
 * conseils TTFB grows with process uptime (field p50 ~1.1 s in the first 12 h, ~3.2 s at
 * 24-36 h, while `/` stays flat). That uptime-dependent part matches the SSR HTML
 * sanitizer, whose per-call cost grew with the number of calls served since process start
 * (isomorphic-dompurify 2.36 on jsdom 28, now guarded by
 * `frontend/tests/unit/sanitize-editorial-html.server.test.ts`). A TTFB sample cannot be
 * interpreted without the process uptime it was taken at.
 */

/** Port the NestJS process listens on — mirrors `backend/src/main.ts`. */
const DEFAULT_INTERNAL_PORT = "3000";

/** Hosts that are already internal: reuse them verbatim (DEV, tests, probes). */
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Resolve the internal base URL, without any request-derived host.
 * `INTERNAL_API_BASE_URL` wins when provisioned (container topologies where the API
 * is not on loopback); otherwise the process's own port on 127.0.0.1.
 */
function getInternalBaseUrl(): string {
  const configured = process.env.INTERNAL_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `http://127.0.0.1:${process.env.PORT || DEFAULT_INTERNAL_PORT}`;
}

/**
 * Construct an API URL for use inside a loader/action.
 *
 * The `request` is used ONLY to detect a request that already arrived over an
 * internal address (DEV `npm run dev`, integration tests, container health probes),
 * in which case its origin is reused so those environments behave exactly as before.
 * Any public origin is deliberately ignored — see the file header.
 *
 * @param path - API path (e.g. "/api/catalog/homepage-rpc")
 * @param request - The incoming Request object
 * @returns Full URL on the internal interface
 *
 * @example
 * ```ts
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const url = getInternalApiUrlFromRequest("/api/catalog/data", request);
 *   const response = await fetch(url);
 *   return await response.json();
 * }
 * ```
 */
export function getInternalApiUrlFromRequest(
  path: string,
  request: Request,
): string {
  const origin = getInternalRequestOrigin(request);
  return `${origin ?? getInternalBaseUrl()}${path}`;
}

/**
 * Origin of the incoming request when it is already internal, else `null`.
 * Malformed URLs fall back to `null` (→ the resolved internal base), never throw.
 */
function getInternalRequestOrigin(request: Request): string | null {
  try {
    const url = new URL(request.url);
    return LOOPBACK_HOSTNAMES.has(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Construct an API URL when no request object is available (background jobs,
 * deferred work). Same resolution as `getInternalApiUrlFromRequest`.
 *
 * @param path - API path (e.g. "/api/catalog/homepage-rpc")
 * @returns Full URL using INTERNAL_API_BASE_URL or the loopback fallback
 */
export function getInternalApiUrl(path: string): string {
  return `${getInternalBaseUrl()}${path}`;
}
