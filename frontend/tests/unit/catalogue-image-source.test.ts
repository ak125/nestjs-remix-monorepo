import { describe, expect, it } from "vitest";
import { getOptimizedPartImageUrl } from "~/utils/image-optimizer";
import { buildCataloguePromise } from "~/utils/pieces-loader.utils";

const storage =
  "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public";
const generated = "articles/gammes-produits/generated/d444250580ab051a.png";
const cases = [
  [
    "absolute generated source",
    `${storage}/uploads/${generated}`,
    `${storage}/uploads/${generated}`,
  ],
  [
    "proxy source",
    `/img/uploads/${generated}`,
    `${storage}/uploads/${generated}`,
  ],
  ["bucket path", `uploads/${generated}`, `${storage}/uploads/${generated}`],
  ["object path", generated, `${storage}/uploads/${generated}`],
  [
    "legacy filename",
    "disque.webp",
    `${storage}/uploads/articles/gammes-produits/catalogue/disque.webp`,
  ],
  [
    "legacy nested filename",
    "freinage/disque.webp",
    `${storage}/uploads/articles/gammes-produits/catalogue/freinage/disque.webp`,
  ],
];

function source(url: string): string {
  expect(url).toContain("/plain/");
  return url.split("/plain/")[1].replace(/@webp$/, "");
}

describe("catalogue image sources", () => {
  it.each(cases)(
    "preserves %s in the product image helper",
    (_name, input, expected) => {
      const url = getOptimizedPartImageUrl(input);
      expect(source(url)).toBe(expected);
      expect(url).toContain("/rs:fit:600/");
    },
  );

  it.each(cases)(
    "preserves %s in the vehicle catalogue loader",
    async (_name, input, expected) => {
      const result = await buildCataloguePromise(
        82,
        Promise.resolve({
          families: [
            {
              id: 1,
              name: "Freinage",
              gammes: [
                {
                  id: 82,
                  name: "Courante",
                  alias: "courante",
                  image: "current.webp",
                },
                { id: 83, name: "Voisine", alias: "voisine", image: input },
              ],
            },
          ],
        }),
      );
      expect(result?.items).toHaveLength(1);
      expect(source(result!.items[0].image)).toBe(expected);
      expect(result!.items[0].image).toContain("/rs:fit:400/");
      expect(result!.items[0].link).toBe("/pieces/voisine-83.html");
    },
  );

  it("preserves the existing placeholder and missing-image catalogue behavior", async () => {
    expect(getOptimizedPartImageUrl()).toBe("/images/categories/default.svg");
    const result = await buildCataloguePromise(
      82,
      Promise.resolve({
        families: [
          {
            gammes: [
              { id: 82, name: "Courante", alias: "courante" },
              { id: 83, name: "Voisine", alias: "voisine" },
            ],
          },
        ],
      }),
    );
    expect(source(result!.items[0].image)).toBe(
      `${storage}/uploads/articles/gammes-produits/catalogue/voisine.webp`,
    );
  });
});
