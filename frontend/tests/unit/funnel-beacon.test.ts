import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { classifyReferrer } from "~/utils/funnel-beacon";

describe("classifyReferrer", () => {
  // Cleanup avant ET après chaque test : évite leak de stub entre tests
  // (un test qui fail au milieu pourrait laisser le stub actif sinon).
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns "direct" if no referrer', () => {
    vi.stubGlobal("document", { referrer: "" });
    vi.stubGlobal("window", { location: { hostname: "www.automecanik.com" } });
    expect(classifyReferrer()).toBe("direct");
  });

  it('returns "internal" for same-host www referrer', () => {
    vi.stubGlobal("document", {
      referrer: "https://www.automecanik.com/blog-pieces-auto/conseils/cardan",
    });
    vi.stubGlobal("window", { location: { hostname: "www.automecanik.com" } });
    expect(classifyReferrer()).toBe("internal");
  });

  it('returns "internal" for apex referrer (non-www → www)', () => {
    vi.stubGlobal("document", { referrer: "https://automecanik.com/anything" });
    vi.stubGlobal("window", { location: { hostname: "www.automecanik.com" } });
    expect(classifyReferrer()).toBe("internal");
  });

  it('returns "internal" for any automecanik.com subdomain', () => {
    vi.stubGlobal("document", { referrer: "https://blog.automecanik.com/x" });
    vi.stubGlobal("window", { location: { hostname: "www.automecanik.com" } });
    expect(classifyReferrer()).toBe("internal");
  });

  it('returns "organic" for google referrer', () => {
    vi.stubGlobal("document", {
      referrer: "https://www.google.fr/search?q=cardan+206",
    });
    vi.stubGlobal("window", { location: { hostname: "www.automecanik.com" } });
    expect(classifyReferrer()).toBe("organic");
  });

  it('returns "other" for arbitrary external referrer', () => {
    vi.stubGlobal("document", { referrer: "https://example.com/whatever" });
    vi.stubGlobal("window", { location: { hostname: "www.automecanik.com" } });
    expect(classifyReferrer()).toBe("other");
  });

  it('returns "direct" in SSR (no window)', () => {
    vi.stubGlobal("window", undefined);
    expect(classifyReferrer()).toBe("direct");
  });
});
