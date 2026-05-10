import { describe, expect, it } from "vitest";
import {
  NO_STORE_CACHE_CONTROL,
  buildCacheHeaders,
} from "~/utils/cache-control";

const SUCCESS_POLICY =
  "public, max-age=60, s-maxage=86400, stale-while-revalidate=3600";

const headers = (entries: Array<[string, string]>): Headers => {
  const h = new Headers();
  for (const [k, v] of entries) h.set(k, v);
  return h;
};

describe("buildCacheHeaders", () => {
  it("returns the success policy when neither loader nor error set anything", () => {
    const fn = buildCacheHeaders(SUCCESS_POLICY);
    const result = fn({
      loaderHeaders: new Headers(),
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
      errorHeaders: undefined,
    });

    expect(result).toEqual({ "Cache-Control": SUCCESS_POLICY });
  });

  it("honours an explicit Cache-Control set by the loader on success", () => {
    const fn = buildCacheHeaders(SUCCESS_POLICY);
    const result = fn({
      loaderHeaders: headers([
        ["Cache-Control", "public, max-age=10, s-maxage=120"],
      ]),
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
      errorHeaders: undefined,
    });

    expect(result["Cache-Control"]).toBe(
      "public, max-age=10, s-maxage=120",
    );
  });

  it("propagates X-Robots-Tag from loaderHeaders on success", () => {
    const fn = buildCacheHeaders(SUCCESS_POLICY);
    const result = fn({
      loaderHeaders: headers([["X-Robots-Tag", "noindex, follow"]]),
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
      errorHeaders: undefined,
    });

    expect(result["X-Robots-Tag"]).toBe("noindex, follow");
  });

  it("forces no-store when the loader threw a Response without Cache-Control", () => {
    const fn = buildCacheHeaders(SUCCESS_POLICY);
    const result = fn({
      loaderHeaders: new Headers(),
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
      errorHeaders: new Headers(),
    });

    expect(result["Cache-Control"]).toBe(NO_STORE_CACHE_CONTROL);
  });

  it("honours an explicit no-cache the loader set on the thrown Response", () => {
    const fn = buildCacheHeaders(SUCCESS_POLICY);
    const result = fn({
      loaderHeaders: new Headers(),
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
      errorHeaders: headers([["Cache-Control", "no-cache"]]),
    });

    expect(result["Cache-Control"]).toBe("no-cache");
  });

  it("propagates X-Robots-Tag from errorHeaders on failure", () => {
    const fn = buildCacheHeaders(SUCCESS_POLICY);
    const result = fn({
      loaderHeaders: new Headers(),
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
      errorHeaders: headers([
        ["Cache-Control", "no-cache"],
        ["X-Robots-Tag", "noindex"],
      ]),
    });

    expect(result["X-Robots-Tag"]).toBe("noindex");
  });

  it("never leaks the success policy onto an error response (the cache-poisoning regression)", () => {
    const fn = buildCacheHeaders(SUCCESS_POLICY);
    const result = fn({
      loaderHeaders: headers([["Cache-Control", SUCCESS_POLICY]]),
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
      errorHeaders: new Headers(),
    });

    expect(result["Cache-Control"]).not.toContain("s-maxage");
    expect(result["Cache-Control"]).toBe(NO_STORE_CACHE_CONTROL);
  });
});
