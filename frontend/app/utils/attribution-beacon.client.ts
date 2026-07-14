/**
 * First-party landing attribution — client beacon (cutover cache HTML, PR A).
 *
 * Fired AFTER hydration, off the critical path, via `postJsonBeacon`
 * (`navigator.sendBeacon` + `fetch keepalive` fallback). Replaces the old
 * server middleware that wrote `req.session.landing` on every HTML GET —
 * which set `connect.sid` and made Cloudflare BYPASS the HTML. Now the HTML
 * GET stays strictly side-effect-free (cookie-free → edge-cacheable) and the
 * session is only materialised by THIS POST (POST responses are never
 * CF-cached, so their Set-Cookie is safe).
 *
 * first-touch is enforced authoritatively server-side (the endpoint never
 * overwrites an existing `session.landing`); the once-per-session guard here
 * just avoids a redundant beacon on same-tab client navigations.
 */
import { postJsonBeacon } from "~/utils/beacon";
import { safeSessionStorage } from "~/utils/safe-storage";

const ENDPOINT = "/api/attribution/landing";
const ONCE_KEY = "amk_attr_pinged";

// Query params consulted by the server-side classifier. Allowlist keeps the
// payload minimal and never forwards arbitrary query strings (PII discipline).
const ATTR_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
] as const;

export function pingLandingAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (safeSessionStorage.getItem(ONCE_KEY)) return;

    const search = new URLSearchParams(window.location.search);
    const query: Record<string, string> = {};
    for (const key of ATTR_QUERY_KEYS) {
      const v = search.get(key);
      if (v) query[key] = v;
    }

    const payload: {
      path: string;
      referer?: string;
      query?: Record<string, string>;
    } = { path: window.location.pathname };
    if (document.referrer) payload.referer = document.referrer;
    if (Object.keys(query).length > 0) payload.query = query;

    // Mark BEFORE sending so a fire-and-forget failure never triggers a retry
    // storm; the server first-touch guard is the real idempotency.
    safeSessionStorage.setItem(ONCE_KEY, "1");
    postJsonBeacon(ENDPOINT, payload);
  } catch {
    // Attribution must never break the page.
  }
}
