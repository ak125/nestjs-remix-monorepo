import { describe, it, expect } from "vitest";
import { type NoProductsData } from "~/components/pieces/NoProductsAlternatives";
import { findGammeThumbnail } from "~/utils/pieces-loader.utils";
import { buildPiecesVehicleMeta } from "~/utils/pieces-vehicle.meta";

const noProductsFixture: NoProductsData = {
  noProducts: true,
  gammeId: 3859,
  gammeAlias: "kit-de-freins-arriere",
  gammeName: "Kit de freins arrière",
  vehicleLabel: "BMW Série 5 (F10-F18) 525 d",
  vehicleContext: {
    marqueName: "BMW",
    modeleName: "Série 5 (F10-F18)",
    typeName: "525 d",
    typeFuel: "Diesel",
    typePowerPs: "218",
    yearFrom: "2011",
    yearTo: "2016",
  },
  alternativeGammes: [
    {
      pg_id: 3860,
      pg_name: "Disques arrière",
      pg_alias: "disques-arriere",
      pg_pic: null,
      piece_count: 42,
      tier: 1,
    },
  ],
  alternativeVehicles: [
    {
      type_id: "11838",
      type_name: "530 d",
      type_alias: "3-0-530-d",
      type_fuel: "Diesel",
      type_power_ps: "258",
      type_year_from: "2011",
      type_year_to: "2016",
      modele_id: 33053,
      modele_name: "Série 5 (F10-F18)",
      modele_alias: "serie-5-f10-f18",
      marque_id: 33,
      marque_name: "BMW",
      marque_alias: "bmw",
      tier: 1,
    },
  ],
  relatedModels: [],
};

const location = {
  pathname:
    "/pieces/kit-de-freins-arriere-3859/bmw-33/serie-5-f10-f18-33053/2-0-525-d-11836.html",
};

describe("buildPiecesVehicleMeta — soft-404 branch", () => {
  const meta = buildPiecesVehicleMeta(noProductsFixture, location);

  it("inclut robots: noindex, follow", () => {
    const robotsEntry = meta.find((m: any) => m.name === "robots");
    expect((robotsEntry as any)?.content).toBe("noindex, follow");
  });

  it('title contient gamme + véhicule + motif "non référencé" ou "alternatives"', () => {
    const titleEntry = meta.find((m: any) => "title" in m) as any;
    const title = titleEntry?.title as string;
    expect(title).toMatch(/Kit de freins arrière/);
    expect(title).toMatch(/BMW|525/);
    expect(title).toMatch(/non référencé|alternatives/i);
  });

  it("description évoque le véhicule et les alternatives", () => {
    const descEntry = meta.find((m: any) => m.name === "description") as any;
    const desc = descEntry?.content as string;
    expect(desc).toMatch(/525 d|525d/i);
    expect(desc).toMatch(/alternative/i);
  });

  it("émet un JSON-LD ItemList", () => {
    const ld = meta.find((m: any) => "script:ld+json" in m) as any;
    expect(ld).toBeDefined();
    const parsed = ld["script:ld+json"];
    expect(parsed["@type"]).toBe("ItemList");
    expect(Array.isArray(parsed.itemListElement)).toBe(true);
    expect(parsed.itemListElement.length).toBeGreaterThan(0);
  });

  it("og:title et og:description présents et cohérents", () => {
    const ogt = (meta.find((m: any) => m.property === "og:title") as any)
      ?.content;
    const ogd = (meta.find((m: any) => m.property === "og:description") as any)
      ?.content;
    expect(ogt).toBeTruthy();
    expect(ogd).toBeTruthy();
  });
});

const storage =
  "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public";

function productPage(gammeThumbnail: string | null) {
  return {
    canonicalPath:
      "/pieces/plaquette-de-frein-402/audi-22/a8-i-22060/4-2-quattro-14557.html",
    vehicle: { marque: "AUDI", marqueAlias: "audi", modele: "A8 I" },
    gamme: { id: 402, name: "Plaquette de frein", alias: "plaquette-de-frein" },
    pieces: [],
    count: 0,
    gammeThumbnail,
    seo: {
      title: "Plaquette de frein AUDI A8 I 4.2 Quattro",
      description: "Plaquettes de frein compatibles.",
    },
  };
}

function og(meta: ReturnType<typeof buildPiecesVehicleMeta>, property: string) {
  return (meta.find((m: any) => m.property === property) as any)?.content;
}

describe("buildPiecesVehicleMeta — og:image (canon image-matrix-v1, TRANSACTION)", () => {
  it("dérive og:image de la vignette pg_img de la gamme", () => {
    const meta = buildPiecesVehicleMeta(
      productPage("plaquette-de-frein.webp"),
      location,
    );
    expect(og(meta, "og:image")).toBe(
      `https://www.automecanik.com/imgproxy/rs:fit:1200:630/q:85/plain/${storage}/uploads/articles/gammes-produits/catalogue/plaquette-de-frein.webp@webp`,
    );
    expect(og(meta, "og:image:width")).toBe("1200");
    expect(og(meta, "og:image:height")).toBe("630");
    expect(og(meta, "og:image:alt")).toBe(
      "Plaquette de frein AUDI A8 I 4.2 Quattro",
    );
  });

  it("sans vignette : asset statique de la classe TRANSACTION", () => {
    const meta = buildPiecesVehicleMeta(productPage(null), location);
    expect(og(meta, "og:image")).toBe(
      "https://www.automecanik.com/images/og/transaction.webp",
    );
  });

  it("page alternatives (noindex) : pas d'og:image ajoutée", () => {
    const meta = buildPiecesVehicleMeta(noProductsFixture, location);
    expect(og(meta, "og:image")).toBeUndefined();
  });
});

describe("findGammeThumbnail", () => {
  const hierarchy = {
    catalog: {
      families: [
        {
          mf_id: 1,
          mf_name: "Freinage",
          gammes: [
            {
              pg_id: 402,
              pg_alias: "plaquette-de-frein",
              pg_name: "Plaquette",
              pg_img: "plaquette-de-frein.webp",
            },
            {
              pg_id: 82,
              pg_alias: "disque-de-frein",
              pg_name: "Disque",
              pg_img: "no.webp",
            },
            {
              pg_id: 78,
              pg_alias: "etrier-de-frein",
              pg_name: "Étrier",
              pg_img: null,
            },
          ],
        },
      ],
    },
  };

  it("renvoie pg_img de la gamme", () => {
    expect(findGammeThumbnail(hierarchy, 402)).toBe("plaquette-de-frein.webp");
  });

  it("null si vignette invalide ou absente, sans nom de fichier deviné", () => {
    expect(findGammeThumbnail(hierarchy, 82)).toBeNull();
    expect(findGammeThumbnail(hierarchy, 78)).toBeNull();
  });

  it("null si gamme hors hiérarchie ou hiérarchie indisponible", () => {
    expect(findGammeThumbnail(hierarchy, 2066)).toBeNull();
    expect(findGammeThumbnail(null, 402)).toBeNull();
  });
});
