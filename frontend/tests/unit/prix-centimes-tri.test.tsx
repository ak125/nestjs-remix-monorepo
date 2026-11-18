import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { formatPrice as formatCartPrice } from "~/components/cart/cart-utils";
import { PiecesGridView } from "~/components/pieces/PiecesGridView";
import { usePiecesFilters } from "~/hooks/use-pieces-filters";
import { type PieceData } from "~/types/pieces-route.types";
import { formatPrice, formatPriceNumber, splitPrice } from "~/utils/format";
import { sortPiecesInPlace } from "~/utils/pieces-filters.utils";
import { mapApiPieceToData } from "~/utils/pieces-route.utils";
import { buildPiecesProductSchema } from "~/utils/seo/pieces-schema.utils";

/**
 * Mandat CI (2026-11-18), demande de Marwane : « corriger le pb des centimes
 * et mettre les pièces dans l'ordre croissant » sur R2 et la recherche.
 *
 * Valeurs réelles relevées le 2026-11-18 sur plaquette de frein ×
 * Mercedes Classe C (W203) 200 CDI (gamme 402, type 17375) : la liste servait
 * 54 / 112 / 26 € (arrondi à l'euro par la fonction SQL de liste), le panier
 * 54,38 / 112,01 / 26,33 € (pri_vente_ttc_n).
 */

vi.mock("~/hooks/useCart", () => ({
  useCart: () => ({ addToCart: vi.fn().mockResolvedValue(true) }),
}));
vi.mock("~/hooks/useCartSidebar", () => ({ openCartSidebar: vi.fn() }));
vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("~/utils/analytics", () => ({ trackAddToCart: vi.fn() }));
vi.mock("~/components/ui/BrandLogo", () => ({ BrandLogo: () => null }));
vi.mock("~/components/pieces/PieceDetailModal", () => ({
  PieceDetailModal: () => null,
}));
vi.mock("~/components/pieces/ProductGallery", () => ({
  ProductGallery: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** Intl fr-FR sépare « 54,38 » et « € » par une espace insécable. */
const plain = (s: string) => s.replace(/[  ]/g, " ");

const piece = (
  id: number,
  brand: string,
  price: number,
  extra: Partial<PieceData> = {},
): PieceData => ({
  id,
  name: "Plaquette de frein Avant",
  brand,
  price,
  priceFormatted: formatPriceNumber(price),
  stock: "",
  reference: `REF-${id}`,
  // L'ItemList JSON-LD ne liste que les pièces avec image ou logo.
  image: `https://www.automecanik.com/img/rack-images/1/${id}.webp`,
  ...extra,
});

/** Ordre reçu de la fonction SQL : score décroissant (OE 115, EQUIV 65). */
const rpcOrder = (): PieceData[] => [
  piece(1, "ATE", 54.38),
  piece(2, "BREMBO", 112.01),
  piece(3, "TEXTAR", 54.38),
  piece(4, "SASIC", 26.33),
  piece(5, "SANS PRIX", 0),
];

describe("format du prix — deux décimales, format français", () => {
  it.each([
    [54.38, "54,38", "54", "38"],
    [45.96, "45,96", "45", "96"],
    [9, "9,00", "9", "00"],
    [112.5, "112,50", "112", "50"],
  ])("%s → %s", (amount, formatted, whole, cents) => {
    expect(formatPriceNumber(amount)).toBe(formatted);
    expect(plain(formatPrice(amount))).toBe(`${formatted} €`);
    expect(splitPrice(amount)).toEqual({ whole, cents });
  });

  it("arrondit au centime sans perdre l'euro (9,995 → 10,00)", () => {
    expect(splitPrice(9.995)).toEqual({ whole: "10", cents: "00" });
  });

  it("mapApiPieceToData garde le prix exact et le formate « 54,38 »", () => {
    const data = mapApiPieceToData({ id: 1, prix_unitaire: 54.38 });
    expect(data.price).toBe(54.38);
    expect(data.priceFormatted).toBe("54,38");
  });
});

describe("carte produit (grille) — prix exact", () => {
  it("affiche 54 puis ,38€ et annonce « 54,38 € » à l'accessibilité", () => {
    render(<PiecesGridView pieces={[piece(1, "TEXTAR", 54.38)]} typeId={1} />);
    expect(screen.getByText("54")).toBeTruthy();
    expect(screen.getByText(",38€")).toBeTruthy();
    const link = screen.getByLabelText(/TEXTAR/);
    expect(plain(link.getAttribute("aria-label") ?? "")).toContain("— 54,38 €");
  });
});

describe("tri — prix croissant", () => {
  it("le hook de filtres trie par prix croissant par défaut", () => {
    const { result } = renderHook(() => usePiecesFilters(rpcOrder()));
    expect(result.current.sortBy).toBe("price-asc");
    expect(result.current.filteredProducts.map((p) => p.brand)).toEqual([
      "SASIC",
      "ATE",
      "TEXTAR",
      "BREMBO",
      "SANS PRIX",
    ]);
  });

  it("prix croissant : pièces sans prix en fin, ordre reçu gardé à prix égal", () => {
    const sorted = sortPiecesInPlace(rpcOrder(), "price-asc");
    expect(sorted.map((p) => p.price)).toEqual([
      26.33, 54.38, 54.38, 112.01, 0,
    ]);
    // ATE (score 115) reste devant TEXTAR (score 65) à 54,38 €.
    expect(sorted[1].brand).toBe("ATE");
    expect(sorted[2].brand).toBe("TEXTAR");
  });

  it("prix décroissant : pièces sans prix aussi en fin", () => {
    const sorted = sortPiecesInPlace(rpcOrder(), "price-desc");
    expect(sorted.map((p) => p.price)).toEqual([
      112.01, 54.38, 54.38, 26.33, 0,
    ]);
  });

  it("le choix de l'utilisateur reste respecté (tri par marque)", () => {
    const sorted = sortPiecesInPlace(rpcOrder(), "brand");
    expect(sorted.map((p) => p.brand)).toEqual([
      "ATE",
      "BREMBO",
      "SANS PRIX",
      "SASIC",
      "TEXTAR",
    ]);
  });
});

describe("JSON-LD — offers.price exact", () => {
  it("chaque offre et l'agrégat portent le prix au centime", () => {
    const schema = buildPiecesProductSchema({
      vehicle: {
        marque: "MERCEDES",
        modele: "CLASSE C (W203)",
        type: "200 CDI",
        typeId: 17375,
        marqueId: 108,
        modeleId: 108038,
      },
      gamme: {
        id: 402,
        name: "Plaquette de frein",
        alias: "plaquette-de-frein",
        description: "",
      },
      pieces: rpcOrder(),
      seo: { description: "Plaquette de frein" },
      count: 5,
      canonicalUrl:
        "https://www.automecanik.com/pieces/plaquette-de-frein-402/mercedes-benz-108/classe-c-w203-108038/c-200-cdi-2-2-17375.html",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graph = (schema?.["@graph"] ?? []) as Record<string, any>[];
    const product = graph.find((n) => n["@type"] === "Product");
    expect(product?.offers.lowPrice).toBe(26.33);
    expect(product?.offers.highPrice).toBe(112.01);
    const list = graph.find((n) => n["@type"] === "ItemList");
    const prices = (list?.itemListElement ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: Record<string, any>) => e.item.offers?.price,
    );
    expect(prices).toContain(54.38);
    expect(prices).toContain(112.01);
    expect(prices).not.toContain(54);
  });
});

describe("cohérence liste ↔ panier", () => {
  it("la liste affiche le même montant que le panier (pri_vente_ttc_n)", () => {
    // Le panier lit Number(pri_vente_ttc_n) (cart-data.service.ts) ; la liste
    // reçoit le même numeric depuis la fonction SQL corrigée.
    const cartUnitPrice = Number("54.38");
    const listed = mapApiPieceToData({ id: 3, prix_unitaire: 54.38 });
    expect(listed.price).toBe(cartUnitPrice);
    expect(plain(formatPrice(listed.price))).toBe(
      plain(formatCartPrice(cartUnitPrice)),
    );
  });
});
