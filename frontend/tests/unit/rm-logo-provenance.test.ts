import { describe, expect, it } from "vitest";
import {
  type RmPageV2Response,
  type RmProduct,
} from "~/services/api/rm-api.service";
import { mapApiPieceToData } from "~/utils/pieces-route.utils";
import {
  mapRmProductsToPieceData,
  mapRmV2ToLoaderData,
} from "~/utils/rm-mapper";

const product = {
  piece_id: 1,
  piece_reference: "A1",
  piece_name: "Filtre",
  pm_id: 5040,
  pm_name: "WIX FILTERS",
  price_ttc: 6,
  quality: "OE",
  piece_position: null,
  score: 1,
  has_image: false,
  pmi_folder: null,
  pmi_name: null,
} satisfies RmProduct;

function page(logo: string | null | undefined): RmPageV2Response {
  // Only fields read by the mapper are material to this wire-contract fixture.
  return {
    success: true,
    products: [{ ...product, pm_logo: logo }],
    count: 1,
    minPrice: 6,
    grouped_pieces: [],
    vehicleInfo: {},
    gamme: { pg_id: 7 },
    seo: {},
    oemRefs: [],
    crossSelling: [],
    filters: {},
    validation: {},
    duration_ms: 1,
  } as unknown as RmPageV2Response;
}

describe("RM supplier logo provenance", () => {
  it.each([
    "wix.webp",
    "uploads/equipementiers-automobiles/wix.webp",
    "https://cdn.example.com/logo/wix.png?version=2",
  ])("preserves the RPC source in V2: %s", (logo) => {
    expect(mapRmV2ToLoaderData(page(logo)).pieces[0].marque_logo).toBe(logo);
  });
  it("preserves a supplied V1 logo", () => {
    expect(
      mapRmProductsToPieceData([{ ...product, pm_logo: "wix.webp" }])[0]
        .marque_logo,
    ).toBe("wix.webp");
  });
  it.each([null, undefined])(
    "does not invent a logo when the RPC omits it (%s)",
    (logo) => {
      expect(
        mapRmV2ToLoaderData(page(logo)).pieces[0].marque_logo,
      ).toBeUndefined();
    },
  );
  it("preserves grouped piece logo through the existing batch mapper", () => {
    expect(
      mapApiPieceToData({
        id: 1,
        marque: "WIX FILTERS",
        marque_id: 5040,
        marque_logo: "wix.webp",
      }).marque_logo,
    ).toBe("wix.webp");
  });
});
