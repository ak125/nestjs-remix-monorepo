/**
 * Contract test for the request-aware cache-privacy arbiter
 * (frontend/app/entry.server.tsx → applySessionCachePrivacy).
 *
 * PR B review, blocker #1: React Router `headers` exports are request-unaware,
 * so a public route would ship `public, s-maxage=…` even to a request carrying a
 * session cookie (whose document embeds the logged-in user / cart). The arbiter
 * re-establishes the pre-PR-B invariant ("public cache only WITHOUT a session")
 * that Caddy's `@public_cached` cookie matcher used to enforce.
 */
import { describe, it, expect } from "vitest";

import { applySessionCachePrivacy } from "~/entry.server";

const PRIVATE = "private, no-cache, no-store, must-revalidate";
const PUBLIC =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=3600";

function reqWithCookie(cookie?: string): Request {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("cookie", cookie);
  return new Request("https://www.automecanik.com/pieces/x.html", { headers });
}

/** Simulate the leaf route having already set a public policy on the response. */
function publicResponseHeaders(): Headers {
  return new Headers({ "Cache-Control": PUBLIC });
}

describe("applySessionCachePrivacy — session-bearing requests", () => {
  it("forces private + no-store at every tier when connect.sid is present, overriding a public leaf policy", () => {
    const h = publicResponseHeaders();
    applySessionCachePrivacy(
      reqWithCookie("connect.sid=s%3Aabc.def; foo=1"),
      h,
    );
    expect(h.get("Cache-Control")).toBe(PRIVATE);
    expect(h.get("CDN-Cache-Control")).toBe("no-store");
    expect(h.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  it("matches a generic `session` cookie too (parity with the Caddy matcher)", () => {
    const h = publicResponseHeaders();
    applySessionCachePrivacy(reqWithCookie("session=xyz"), h);
    expect(h.get("Cache-Control")).toBe(PRIVATE);
    expect(h.get("CDN-Cache-Control")).toBe("no-store");
  });
});

describe("applySessionCachePrivacy — anonymous requests (public cache preserved)", () => {
  it("leaves a public leaf policy untouched when there is no cookie at all", () => {
    const h = publicResponseHeaders();
    applySessionCachePrivacy(reqWithCookie(undefined), h);
    expect(h.get("Cache-Control")).toBe(PUBLIC);
    expect(h.get("CDN-Cache-Control")).toBeNull();
    expect(h.get("Cloudflare-CDN-Cache-Control")).toBeNull();
  });

  it("leaves a public leaf policy untouched for a non-session cookie (e.g. theme/consent)", () => {
    const h = publicResponseHeaders();
    applySessionCachePrivacy(reqWithCookie("theme=dark; cookie_consent=1"), h);
    expect(h.get("Cache-Control")).toBe(PUBLIC);
    expect(h.get("CDN-Cache-Control")).toBeNull();
  });

  it("does not invent a Cache-Control when neither the leaf nor a session set one", () => {
    const h = new Headers();
    applySessionCachePrivacy(reqWithCookie("theme=dark"), h);
    expect(h.get("Cache-Control")).toBeNull();
  });
});
