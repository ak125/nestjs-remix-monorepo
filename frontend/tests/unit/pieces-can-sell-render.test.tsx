import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { PiecesGridView } from "~/components/pieces/PiecesGridView";
import { type PieceData } from "~/types/pieces-route.types";

/**
 * #850 storefront can_sell gate — render proof of the OWNER's #1 requirement:
 * "aucune pièce à 0,00 € ne doit être achetable".
 *
 * Renders the real PiecesGridView and asserts:
 *  - price 0 (no sellable-dispo price) → "Indisponible", add-to-cart disabled.
 *  - price > 0 → price shown, add-to-cart enabled.
 * (Mocks the cart/analytics/sub-component deps, per the repo test convention.)
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

const piece = (over: Partial<PieceData>): PieceData => ({
  id: 0,
  name: "Pièce",
  price: 0,
  priceFormatted: "0,00",
  brand: "NK",
  stock: "",
  reference: "REF",
  ...over,
});

describe("PiecesGridView — can_sell gate (#850)", () => {
  it("price 0 (no sellable price) → 'Indisponible' + add-to-cart disabled", () => {
    render(
      <PiecesGridView
        pieces={[piece({ id: 1, name: "Sans prix", price: 0 })]}
        typeId={1}
      />,
    );
    expect(screen.getByText("Indisponible")).toBeTruthy();
    const btn = screen.getByRole("button", { name: /indisponible/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("price > 0 → buyable (Ajouter, enabled), no 'Indisponible'", () => {
    render(
      <PiecesGridView
        pieces={[
          piece({ id: 2, name: "Vendable", price: 42.9, priceFormatted: "42,90" }),
        ]}
        typeId={1}
      />,
    );
    expect(screen.getByText("Ajouter")).toBeTruthy();
    const btn = screen.getByRole("button", { name: /Ajouter .* au panier/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("Indisponible")).toBeNull();
  });
});
