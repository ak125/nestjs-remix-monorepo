/**
 * Contract test for the canonical Cache-Control helper
 * (frontend/app/utils/cache-control.ts), referenced by:
 *   - scripts/lint/check-no-zero-arg-headers-with-s-maxage.sh
 *   - .ast-grep/rules/frontend-no-headers-bypass-buildCacheHeaders.yml
 *
 * The helper is the SINGLE owner of a route's Cache-Control (PR "single-owner
 * Cache-Control"): Caddy no longer backfills a duplicate header, so the value
 * this returns is exactly what ships to Cloudflare. The error branch MUST NOT
 * leak the success `s-maxage` onto a loader-thrown 4xx/5xx (INC-2026-005).
 */
import { describe, it, expect } from "vitest";

import { buildCacheHeaders, NO_STORE_CACHE_CONTROL } from "~/utils/cache-control";

type HeadersFn = ReturnType<typeof buildCacheHeaders>;
type Args = Parameters<HeadersFn>[0];

const SUCCESS =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=3600";

/** Invoke the returned HeadersFunction with only the fields it reads. */
function invoke(
  fn: HeadersFn,
  opts: { loader?: Record<string, string>; error?: Record<string, string> } = {},
): Record<string, string> {
  const args = {
    loaderHeaders: new Headers(opts.loader ?? {}),
    parentHeaders: new Headers(),
    actionHeaders: new Headers(),
    errorHeaders: opts.error ? new Headers(opts.error) : undefined,
  } as unknown as Args;
  return fn(args) as Record<string, string>;
}

describe("buildCacheHeaders — success path", () => {
  it("applies the success policy when the loader set no Cache-Control", () => {
    const out = invoke(buildCacheHeaders(SUCCESS));
    expect(out["Cache-Control"]).toBe(SUCCESS);
  });

  it("honours a per-request Cache-Control the loader set on data()/json() (TTL-neutral override)", () => {
    const out = invoke(buildCacheHeaders(SUCCESS), {
      loader: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    });
    expect(out["Cache-Control"]).toBe(
      "public, max-age=30, stale-while-revalidate=60",
    );
  });

  it("propagates a loader X-Robots-Tag unchanged and adds no default on success", () => {
    const out = invoke(buildCacheHeaders(SUCCESS), {
      loader: { "X-Robots-Tag": "noindex, follow" },
    });
    expect(out["X-Robots-Tag"]).toBe("noindex, follow");
    expect(out["Cache-Control"]).toBe(SUCCESS);
  });

  it("emits no X-Robots-Tag key when the loader carried none", () => {
    const out = invoke(buildCacheHeaders(SUCCESS));
    expect("X-Robots-Tag" in out).toBe(false);
  });
});

describe("buildCacheHeaders — error path (anti cache-poisoning)", () => {
  it("forces no-store on a bare loader-thrown error, never leaking the success s-maxage", () => {
    const out = invoke(buildCacheHeaders(SUCCESS), { error: {} });
    expect(out["Cache-Control"]).toBe(NO_STORE_CACHE_CONTROL);
    expect(out["Cache-Control"]).not.toContain("s-maxage");
  });

  it("honours an explicit Cache-Control the error Response carried", () => {
    const out = invoke(buildCacheHeaders(SUCCESS), {
      error: { "Cache-Control": "public, max-age=300, must-revalidate" },
    });
    expect(out["Cache-Control"]).toBe("public, max-age=300, must-revalidate");
  });

  it("stamps defaultErrorRobots on a bare error throw (404/500 with no headers)", () => {
    const out = invoke(
      buildCacheHeaders(SUCCESS, { defaultErrorRobots: "noindex, follow" }),
      { error: {} },
    );
    expect(out["X-Robots-Tag"]).toBe("noindex, follow");
    expect(out["Cache-Control"]).toBe(NO_STORE_CACHE_CONTROL);
  });

  it("does not override an explicit error X-Robots-Tag with defaultErrorRobots", () => {
    const out = invoke(
      buildCacheHeaders(SUCCESS, { defaultErrorRobots: "noindex, follow" }),
      { error: { "X-Robots-Tag": "noindex, nofollow" } },
    );
    expect(out["X-Robots-Tag"]).toBe("noindex, nofollow");
  });

  it("emits no X-Robots-Tag key when neither the error nor a default provides one", () => {
    const out = invoke(buildCacheHeaders(SUCCESS), { error: {} });
    expect("X-Robots-Tag" in out).toBe(false);
  });
});

describe("NO_STORE_CACHE_CONTROL", () => {
  it("refuses every cache tier", () => {
    expect(NO_STORE_CACHE_CONTROL).toBe("no-cache, no-store, must-revalidate");
  });
});
