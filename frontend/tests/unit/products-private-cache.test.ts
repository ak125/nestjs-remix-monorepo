/**
 * PR B review, blocker #2: the /products/* routes are an authenticated Pro
 * namespace (requireUser / getOptionalUser, noindex, per-user identity +
 * price_pro/margin + demo data). They must NEVER be shared/public-cached.
 * This pins that their `headers` export emits private/no-store on the success
 * path (buildCacheHeaders) — never `public`/`s-maxage`.
 */
import { describe, it, expect, vi } from "vitest";

import { headers as headersCategory } from "~/routes/products.$category.$subcategory";
import { headers as headersProductId } from "~/routes/products.$id";
import { headers as headersBrands } from "~/routes/products.brands";
import { headers as headersGamme } from "~/routes/products.gammes.$gammeId";
import { headers as headersRanges } from "~/routes/products.ranges";
import { headers as headersRangeId } from "~/routes/products.ranges.$rangeId";
import { headers as headersRangesAdvanced } from "~/routes/products.ranges.advanced";

// The route modules only DEFINE (never execute) their loaders/components at
// import time, but they statically import a few server helpers — stub the
// noisy one so the module graph loads quietly under vitest.
vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

type HeadersFn = NonNullable<typeof headersProductId>;
type Args = Parameters<HeadersFn>[0];

const PRIVATE = "private, no-cache, no-store, must-revalidate";

function onSuccess(fn: HeadersFn): Record<string, string> {
  return fn({
    loaderHeaders: new Headers(),
    parentHeaders: new Headers(),
    actionHeaders: new Headers(),
    errorHeaders: undefined,
  } as unknown as Args) as Record<string, string>;
}

const ROUTES: Array<[string, HeadersFn]> = [
  ["products.$id", headersProductId],
  ["products.brands", headersBrands],
  ["products.ranges", headersRanges],
  ["products.ranges.advanced", headersRangesAdvanced],
  ["products.gammes.$gammeId", headersGamme],
  ["products.ranges.$rangeId", headersRangeId],
  ["products.$category.$subcategory", headersCategory],
];

describe("/products/* — never shared-cached", () => {
  it.each(ROUTES)(
    "%s emits private/no-store on success (no public, no s-maxage)",
    (_name, fn) => {
      const out = onSuccess(fn);
      expect(out["Cache-Control"]).toBe(PRIVATE);
      expect(out["Cache-Control"]).not.toContain("public");
      expect(out["Cache-Control"]).not.toContain("s-maxage");
    },
  );
});
