/**
 * SSR→API transport MUST stay on the loopback interface.
 *
 * The SSR bundle runs inside the NestJS process, so deriving the API host from the
 * incoming request's PUBLIC origin makes the server egress to Cloudflare and route
 * back into itself on every loader call. Measured on PROD 2026-08-15:
 * `/blog-pieces-auto/conseils/*` (public origin) TTFB 1.78-2.27 s vs `/` (loopback,
 * bigger document) 0.29 s — the delta capped mobile LCP at 4.6 s in CrUX.
 *
 * These tests are the anti-regression guard: if someone reintroduces
 * `new URL(request.url).origin` as the API host, the first test fails.
 */
import { beforeEach, afterEach, describe, expect, it } from "vitest";

import {
  getInternalApiUrl,
  getInternalApiUrlFromRequest,
} from "~/utils/internal-api.server";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.INTERNAL_API_BASE_URL;
  delete process.env.PORT;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getInternalApiUrlFromRequest", () => {
  it("never egresses to the public origin (the LCP regression)", () => {
    const request = new Request(
      "https://www.automecanik.com/blog-pieces-auto/conseils/capteur-abs",
    );

    const url = getInternalApiUrlFromRequest("/api/r3-guide/capteur-abs", request);

    expect(url).toBe("http://127.0.0.1:3000/api/r3-guide/capteur-abs");
    expect(url).not.toContain("automecanik.com");
  });

  it("ignores the public origin even behind a different public host", () => {
    const request = new Request("https://preview.example.com/whatever");

    expect(getInternalApiUrlFromRequest("/api/x", request)).toBe(
      "http://127.0.0.1:3000/api/x",
    );
  });

  it("honours PORT so it follows the process it lives in", () => {
    process.env.PORT = "4001";
    const request = new Request("https://www.automecanik.com/page");

    expect(getInternalApiUrlFromRequest("/api/x", request)).toBe(
      "http://127.0.0.1:4001/api/x",
    );
  });

  it("prefers INTERNAL_API_BASE_URL and strips its trailing slash", () => {
    process.env.INTERNAL_API_BASE_URL = "http://api.internal:8080/";
    const request = new Request("https://www.automecanik.com/page");

    expect(getInternalApiUrlFromRequest("/api/x", request)).toBe(
      "http://api.internal:8080/api/x",
    );
  });

  it("reuses an already-internal request origin (DEV / tests / probes)", () => {
    for (const origin of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
    ]) {
      const request = new Request(`${origin}/page`);
      expect(getInternalApiUrlFromRequest("/api/x", request)).toBe(
        `${origin}/api/x`,
      );
    }
  });

  it("falls back to the internal base on a malformed request url", () => {
    const request = { url: "not a url" } as Request;

    expect(getInternalApiUrlFromRequest("/api/x", request)).toBe(
      "http://127.0.0.1:3000/api/x",
    );
  });
});

describe("getInternalApiUrl", () => {
  it("resolves identically to the request-based helper", () => {
    expect(getInternalApiUrl("/api/x")).toBe("http://127.0.0.1:3000/api/x");
  });

  it("prefers INTERNAL_API_BASE_URL", () => {
    process.env.INTERNAL_API_BASE_URL = "http://api.internal:8080";
    expect(getInternalApiUrl("/api/x")).toBe("http://api.internal:8080/api/x");
  });
});
