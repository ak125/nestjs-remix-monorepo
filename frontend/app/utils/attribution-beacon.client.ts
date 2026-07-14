/**
 * First-party landing attribution — client capture + deferred send (PR A).
 *
 * TWO-STEP by design (first-touch correctness). The landing signals — pathname,
 * UTM / click-ids from the search string, and `document.referrer` — are
 * captured **synchronously at bootstrap**, BEFORE any Remix client navigation
 * can change `window.location` or drop the UTM params. Delivery is then
 * **deferred to idle** so the beacon POST never competes with hydration / LCP /
 * INP. Sending a *snapshot* (never re-reading `location` at send time)
 * guarantees we record the true first-touch landing, not whatever page the user
 * has navigated to by the time the idle callback runs.
 *
 * Replaces the old server middleware that wrote `req.session.landing` on every
 * HTML GET (→ `connect.sid` → Cloudflare BYPASS). The HTML GET now stays
 * cookie-free; the session is materialised only by this POST (never CF-cached).
 *
 * first-touch is enforced authoritatively server-side (the endpoint never
 * overwrites an existing `session.landing`); the once-per-session guard here
 * just avoids a redundant beacon across same-session full page loads.
 */
import { postJsonBeacon } from "~/utils/beacon";
import { safeSessionStorage } from "~/utils/safe-storage";

const ENDPOINT = "/api/attribution/landing";
const ONCE_KEY = "amk_attr_pinged";

// Query params consulted by the server-side classifier. Allowlist keeps the
// payload minimal and never forwards arbitrary query strings (PII discipline).
// MUST mirror the server `AttributionQuerySchema` allowlist exactly.
const ATTR_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
] as const;

export interface LandingSnapshot {
  path: string;
  referer?: string;
  query?: Record<string, string>;
}

/**
 * Capture the current (first-touch) landing signals **synchronously**. Call at
 * bootstrap, before any client navigation. Returns `null` if already pinged
 * this session or if there is nothing capturable (SSR).
 */
export function captureLandingAttribution(): LandingSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    if (safeSessionStorage.getItem(ONCE_KEY)) return null;

    const search = new URLSearchParams(window.location.search);
    const query: Record<string, string> = {};
    for (const key of ATTR_QUERY_KEYS) {
      const v = search.get(key);
      if (v) query[key] = v;
    }

    const snapshot: LandingSnapshot = { path: window.location.pathname };
    if (document.referrer) snapshot.referer = document.referrer;
    if (Object.keys(query).length > 0) snapshot.query = query;
    return snapshot;
  } catch {
    return null;
  }
}

/**
 * Deliver a previously-captured snapshot. Safe to call from an idle callback.
 * Marks the session as pinged BEFORE sending so a fire-and-forget failure never
 * triggers a retry storm; the server first-touch guard is the real idempotency.
 */
export function sendLandingAttribution(snapshot: LandingSnapshot | null): void {
  if (typeof window === "undefined") return;
  if (!snapshot) return;
  try {
    safeSessionStorage.setItem(ONCE_KEY, "1");
    postJsonBeacon(ENDPOINT, snapshot);
  } catch {
    // Attribution must never break the page.
  }
}
