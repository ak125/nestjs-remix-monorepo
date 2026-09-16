import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loader } from "~/routes/blog-pieces-auto.guide-achat.$pg_alias";
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrlFromRequest: (path: string) =>
    `https://fixture.invalid${path}`,
}));
afterEach(() => vi.restoreAllMocks());
const args = {
  params: { pg_alias: "filtre-a-huile" },
  request: new Request(
    "https://fixture.invalid/blog-pieces-auto/guide-achat/filtre-a-huile",
  ),
  context: new RouterContextProvider(),
  url: new URL(
    "https://fixture.invalid/blog-pieces-auto/guide-achat/filtre-a-huile",
  ),
  pattern: "/blog-pieces-auto/guide-achat/:pg_alias",
} satisfies Parameters<typeof loader>[0];
describe("R6 loader provenance and comparison state", () => {
  it("does not manufacture expert verification in the manual fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.includes("/redirect/")) return Response.json(null);
      if (path.includes("/api/blog/guides/slug/"))
        return Response.json({
          data: {
            slug: "filtre-a-huile",
            title: "Filtre à huile",
            sections: [],
          },
        });
      return new Response(null, { status: 404 });
    });
    expect(await loader(args)).toMatchObject({
      guide: { sourceType: "manual", sourceVerified: false },
    });
  });
  it("preserves the server's explicit incomplete-comparison state", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.includes("/redirect/")) return Response.json(null);
      if (path.includes("/api/r6-guide/"))
        return Response.json({
          data: {
            intentType: "R6",
            page: { pg_id: 0 },
            qualityTiers: [],
            qualityTiersReviewRequired: true,
          },
        });
      return new Response(null, { status: 404 });
    });
    expect(await loader(args)).toMatchObject({
      guide: { qualityTiers: [], qualityTiersReviewRequired: true },
    });
  });
});
