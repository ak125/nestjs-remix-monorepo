import { render, cleanup, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PiecesGroupedDisplay } from "~/components/pieces/PiecesGroupedDisplay";
import { type PiecesFilters } from "~/types/pieces-route.types";

// Keep the real product cards; isolate cart and modal side effects.
vi.mock("~/hooks/useCart", () => ({
  useCart: () => ({ addToCart: vi.fn().mockResolvedValue(true) }),
}));
vi.mock("~/hooks/useCartSidebar", () => ({ openCartSidebar: vi.fn() }));
vi.mock("~/utils/analytics", () => ({ trackAddToCart: vi.fn() }));
vi.mock("~/components/pieces/PieceDetailModal", () => ({
  PieceDetailModal: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);
const filters: PiecesFilters = {
  brands: [],
  priceRange: "all",
  quality: "all",
  availability: "all",
  searchText: "",
};
const product = (id: number) => ({
  id,
  nom: "Alternateur",
  reference: `REF-${id}`,
  marque: "BOSCH",
  marque_id: 30,
  prix_unitaire: 50,
  prix_ttc: 50,
  image: "",
  dispo: true,
  quality: "OE",
  stock_status: "IN_STOCK",
  score: 90,
});
const props = {
  activeFilters: filters,
  viewMode: "grid" as const,
  vehicleModele: "146",
  vehicleMarque: "ALFA ROMEO",
  selectedPieces: [],
  onSelectPiece: vi.fn(),
  typeId: 7766,
};

describe("PiecesGroupedDisplay — nullable catalog labels", () => {
  it.each([1, 2])(
    "SSR: a group without a label keeps its %i products without a fabricated heading",
    (count) => {
      // Real RM shape observed for gamme=4 / vehicle=7766; loader converts side null to undefined.
      const html = renderToStaticMarkup(
        <PiecesGroupedDisplay
          {...props}
          groupedPieces={[
            {
              filtre_gamme: null,
              filtre_side: undefined,
              title_h2: null,
              pieces: Array.from({ length: count }, (_, i) => product(i + 1)),
            },
          ]}
        />,
      );
      const container = document.createElement("div");
      container.innerHTML = html;
      expect(container.querySelectorAll("h2, h3")).toHaveLength(0);
      expect(container.textContent).not.toMatch(/null|undefined/);
      expect(
        container.querySelectorAll('[role="button"][tabindex="0"]'),
      ).toHaveLength(count);
    },
  );

  it.each([
    {
      title_h2: null,
      filtre_gamme: "Alternateur",
      filtre_side: undefined,
      expected: "Alternateur",
    },
    {
      title_h2: "",
      filtre_gamme: "Disque de frein",
      filtre_side: "Avant",
      expected: "Disque de frein Avant",
    },
    {
      title_h2: "Courroie trapézoïdale à nervures",
      filtre_gamme: "Courroie",
      filtre_side: null,
      expected: "Courroie trapézoïdale à nervures",
    },
  ])("uses available catalog labels: $expected", ({ expected, ...group }) => {
    const { getByRole } = render(
      <PiecesGroupedDisplay
        {...props}
        groupedPieces={[{ ...group, pieces: [product(1)] }]}
      />,
    );
    expect(getByRole("heading", { level: 3 }).textContent).toBe(expected);
  });

  it("keeps the authoritative H2 and vehicle context for a populated group", () => {
    const { getByRole } = render(
      <PiecesGroupedDisplay
        {...props}
        groupedPieces={[
          {
            filtre_gamme: "Disque de frein",
            filtre_side: "Avant",
            title_h2: "Disque de frein - Avant",
            pieces: [product(1), product(2)],
          },
        ]}
      />,
    );
    expect(getByRole("heading", { level: 2 }).textContent).toBe(
      "Disque de frein - Avant 146(2 articles)",
    );
  });

  it("does not create an empty heading for whitespace-only metadata", () => {
    const { queryByRole, getAllByRole } = render(
      <PiecesGroupedDisplay
        {...props}
        groupedPieces={[
          {
            filtre_gamme: " ",
            filtre_side: " ",
            title_h2: " ",
            pieces: [product(1)],
          },
        ]}
      />,
    );
    expect(queryByRole("heading")).toBeNull();
    expect(getAllByRole("button", { name: /Voir Alternateur/ })).toHaveLength(
      1,
    );
  });

  it("preserves pagination and selection for groups without labels", () => {
    const onSelectPiece = vi.fn();
    const { getByRole, getAllByRole, queryByRole } = render(
      <PiecesGroupedDisplay
        {...props}
        onSelectPiece={onSelectPiece}
        groupedPieces={[
          {
            filtre_gamme: null,
            filtre_side: null,
            title_h2: null,
            pieces: Array.from({ length: 21 }, (_, i) => product(i + 1)),
          },
        ]}
      />,
    );
    expect(getAllByRole("button", { name: /Voir Alternateur/ })).toHaveLength(
      20,
    );
    fireEvent.click(
      getByRole("button", { name: "Charger 1 produits de plus" }),
    );
    expect(getAllByRole("button", { name: /Voir Alternateur/ })).toHaveLength(
      21,
    );
    expect(queryByRole("heading")).toBeNull();
    fireEvent.click(
      getAllByRole("button", { name: "Sélectionner Alternateur" })[0],
    );
    expect(onSelectPiece).toHaveBeenCalledWith(1);
  });
});
