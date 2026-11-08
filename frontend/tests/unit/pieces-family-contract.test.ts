import { describe, expect, it } from "vitest";
import { buildCataloguePromise } from "~/utils/pieces-loader.utils";

describe("R2 family links consume the homepage hierarchy contract", () => {
  it("preserves ordered neighbours and excludes the current gamme", async () => {
    const response = {
      success: true,
      catalog: {
        families: [
          {
            mf_id: "2",
            mf_name: "Freinage",
            mf_pic: "Freinage.webp",
            gammes: [
              {
                pg_id: 402,
                pg_name: "Plaquette de frein",
                pg_alias: "plaquette-de-frein",
              },
              {
                pg_id: 82,
                pg_name: "Disque de frein",
                pg_alias: "disque-de-frein",
                pg_img: "disque.webp",
              },
            ],
          },
        ],
      },
    };
    const result = await buildCataloguePromise(402, Promise.resolve(response));
    expect(result?.family.mf_id).toBe(2);
    expect(result?.title).toBe("Catalogue Freinage");
    expect(result?.items.map((item) => item.link)).toEqual([
      "/pieces/disque-de-frein-82.html",
    ]);
  });

  it("preserves the existing unavailable and unknown-family result", async () => {
    expect(await buildCataloguePromise(402, Promise.resolve(null))).toBeNull();
    expect(
      await buildCataloguePromise(
        402,
        Promise.resolve({ catalog: { families: [] } }),
      ),
    ).toBeNull();
    expect(
      await buildCataloguePromise(402, Promise.reject(new Error("offline"))),
    ).toBeNull();
  });
});
