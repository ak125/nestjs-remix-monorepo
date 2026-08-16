/**
 * Internal API URL utility for server-side React Router loaders/actions.
 *
 * The SSR bundle runs INSIDE the NestJS process (`backend/src/remix/remix.controller.ts`
 * façade, `app.listen(process.env.PORT || 3000)`), so a loader calling the API is
 * calling its own process. These URLs MUST therefore stay on the loopback interface.
 *
 * ⚠️ NEVER derive the API host from the incoming request's public origin. In PROD the
 * request origin is `https://www.automecanik.com`, so the server would egress to
 * Cloudflare and route back into itself for every loader call. Measured on PROD
 * (2026-08-15) for `/blog-pieces-auto/conseils/*`, which used the request origin:
 *   - TTFB 1.78-2.27 s for a 221 KB document
 *   - `/` (same process, same renderer, 279 KB — bigger) served in 0.29 s, because it
 *     already resolved the API internally via `getInternalApiUrl`
 *   - `/api/r3-guide/capteur-abs` answered in 227 ms on its own
 * The ~1.5 s delta was pure CDN round-trip, and it capped mobile LCP at 4.6 s (CrUX,
 * GSC "LCP > 4 s" group of 46 URLs). Egressing also made the loopback traffic subject
 * to the app's own global rate limiter with `Cf-Connecting-Ip` set to the ORIGIN's
 * public IP (`backend/src/common/guards/cloudflare-throttler.guard.ts`), so bursts
 * self-throttled into 429s.
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
