/**
 * Tests — `translate="no"` sur les sous-arbres interactifs de la route R2
 * /pieces (pattern PR #1187, étendu suite à l'incident Sentry PROD 2026-07-10 :
 * NotFoundError `removeChild` sur /pieces/sonde-de-refroidissement-…, pile
 * 100 % reconciler React = mutation DOM externe par la traduction navigateur).
 *
 * La traduction auto (Chrome / Google Translate) re-parente les nœuds texte
 * dans des `<font>` ; au re-render suivant (clic filtre/tri, load-more), React
 * appelle `removeChild` sur un nœud déplacé → DOMException code 8, et
 * l'ErrorBoundary de la route remplace TOUTE la page produit par une carte 500.
 * Marquer les sous-arbres interactifs non-traduisibles supprime la cause ; la
 * prose (titres, descriptions, FAQ) reste traduisible.
 * Cf. audit/sentry-prod-links-undefined-and-removechild-triage-2026-07-14.md.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PiecesFilterSidebar } from "~/components/pieces/PiecesFilterSidebar";
import { PiecesGroupedDisplay } from "~/components/pieces/PiecesGroupedDisplay";
import { PiecesToolbar } from "~/components/pieces/PiecesToolbar";
import { type PiecesFilters } from "~/types/pieces-route.types";

// Vues lourdes hors sujet (cartes produit) — le test cible uniquement les blocs
// load-more / indicateur de pagination du wrapper.
vi.mock("~/components/pieces/PiecesGridView", () => ({
  PiecesGridView: () => null,
}));
vi.mock("~/components/pieces/PiecesListView", () => ({
  PiecesListView: () => null,
}));

const noop = () => {};

const FILTERS: PiecesFilters = {
  brands: [],
  priceRange: "all",
  quality: "all",
  availability: "all",
  searchText: "",
};

describe('translate="no" — sous-arbres interactifs R2 (anti removeChild)', () => {
  it('PiecesToolbar : la racine porte translate="no" (compteur pièce{s} re-rendu à chaque filtre)', () => {
    const { container } = render(
      <PiecesToolbar
        viewMode="grid"
        setViewMode={noop}
        sortBy="name"
        setSortBy={noop}
        filteredCount={2}
        minPrice={12.5}
        selectedPiecesCount={0}
      />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.getAttribute("translate")).toBe("no");
  });

  it('PiecesGroupedDisplay : blocs load-more + indicateur de pagination portent translate="no"', () => {
    // 21 pièces > INITIAL_VISIBLE_COUNT (20) → hasMore=true → les deux blocs
    // conditionnels (« Charger N produits de plus » + « Affichage de X sur Y »)
    // sont rendus — les surfaces exactes du crash load-more.
    const pieces = Array.from({ length: 21 }, (_, i) => ({ id: i + 1 }));
    const { container } = render(
      <PiecesGroupedDisplay
        groupedPieces={[{ filtre_gamme: "Plaquettes", pieces }]}
        activeFilters={FILTERS}
        viewMode="grid"
        vehicleModele="Passat III"
        vehicleMarque="Volkswagen"
        selectedPieces={[]}
        onSelectPiece={noop}
      />,
    );

    const marked = container.querySelectorAll('[translate="no"]');
    expect(marked.length).toBeGreaterThanOrEqual(2);
    const texts = Array.from(marked).map((el) => el.textContent ?? "");
    expect(texts.some((t) => t.includes("de plus"))).toBe(true);
    expect(texts.some((t) => t.includes("Affichage de"))).toBe(true);
  });

  it('PiecesFilterSidebar : la racine porte translate="no" (compteur résultat{s} + badges)', () => {
    const { container } = render(
      <PiecesFilterSidebar
        activeFilters={FILTERS}
        setActiveFilters={noop}
        uniqueBrands={["BOSCH", "VALEO"]}
        piecesCount={3}
        resetAllFilters={noop}
      />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.getAttribute("translate")).toBe("no");
  });
});
