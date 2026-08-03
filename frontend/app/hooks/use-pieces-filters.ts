/**
 * 🎯 Hook personnalisé pour gérer les filtres et la sélection des pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 *
 * ⚡ OPTIMISÉ INP v2: Algorithme single-pass pour réduire l'INP de 50-100ms
 * - Une seule boucle calcule: filteredProducts + dynamicFilterCounts + brandAverageNotes
 * - Collator mis en cache avec useRef
 * - Set pré-calculé pour lookups O(1)
 */

import { useState, useMemo, useRef, useCallback, useTransition } from "react";
import {
  type PieceData,
  type PiecesFilters,
  type SortBy,
  type ViewMode,
} from "../types/pieces-route.types";
import { convertStarsToNote } from "../utils/pieces-filters.utils";

// ⚡ Helper functions pré-définies (évite recréation à chaque render)
const getPriceCategory = (price: number): "low" | "medium" | "high" => {
  if (price < 50) return "low";
  if (price < 150) return "medium";
  return "high";
};

const matchesPriceFilter = (price: number, priceRange: string): boolean => {
  if (priceRange === "all") return true;
  return getPriceCategory(price) === priceRange;
};

export function usePiecesFilters(inputPieces: PieceData[] | undefined | null) {
  // ✅ Protection: S'assurer que pieces est toujours un tableau (stabilisé avec useMemo)
  const pieces = useMemo(() => inputPieces ?? [], [inputPieces]);

  // ⚡ Collator mis en cache (évite recréation à chaque appel de sort)
  const collatorRef = useRef(
    new Intl.Collator("fr", { numeric: true, sensitivity: "base" }),
  );

  // État des filtres
  const [activeFilters, setActiveFilters] = useState<PiecesFilters>({
    brands: [],
    priceRange: "all",
    quality: "all",
    availability: "all",
    searchText: "",
    minNote: undefined,
    position: "all",
  });

  // ⚡ useTransition: defer filter recalc so browser paints interaction feedback first
  const [isFilterPending, startTransition] = useTransition();

  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedPieces, setSelectedPieces] = useState<number[]>([]);
  const [favoritesPieces, setFavoritesPieces] = useState<number[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(true);

  // ⚡ Pré-calculer le Set des marques pour lookups O(1)
  const brandsSet = useMemo(
    () => new Set(activeFilters.brands),
    [activeFilters.brands],
  );

  // ⚡⚡⚡ ALGORITHME SINGLE-PASS OPTIMISÉ ⚡⚡⚡
  // Une seule boucle calcule tout: produits filtrés + comptages dynamiques + notes moyennes
  const {
    filteredProducts,
    dynamicFilterCounts,
    brandAverageNotes,
    uniqueBrands,
  } = useMemo(() => {
    // Pré-calculer la recherche une seule fois
    const searchLower = activeFilters.searchText?.toLowerCase() || "";
    const hasSearch = searchLower.length > 0;
    const hasBrandFilter = brandsSet.size > 0;
    const hasQualityFilter = activeFilters.quality !== "all";
    const hasPriceFilter = activeFilters.priceRange !== "all";
    const hasAvailFilter = activeFilters.availability === "stock";
    const hasPositionFilter =
      activeFilters.position && activeFilters.position !== "all";
    const hasNoteFilter = activeFilters.minNote && activeFilters.minNote > 0;

    // Structures pour les résultats
    const filtered: PieceData[] = [];

    // Compteurs dynamiques croisés
    const brandCounts = new Map<string, number>();
    const qualityCounts = new Map<string, number>();
    const priceCounts = { low: 0, medium: 0, high: 0 };

    // Notes moyennes par marque
    const brandNotes = new Map<string, { sum: number; count: number }>();

    // Marques uniques
    const uniqueBrandsSet = new Set<string>();

    // ⚡ UNE SEULE BOUCLE pour tout calculer
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const price = piece.price || 0;
      const brand = piece.brand || "";
      const quality = piece.quality || "";
      const note = convertStarsToNote(piece.stars);

      // Collecter marques uniques (toujours)
      if (brand) {
        uniqueBrandsSet.add(brand);
      }

      // Calculer notes moyennes par marque (toujours, pour affichage sidebar)
      if (brand && piece.stars !== undefined) {
        const existing = brandNotes.get(brand) || { sum: 0, count: 0 };
        brandNotes.set(brand, {
          sum: existing.sum + note,
          count: existing.count + 1,
        });
      }

      // Vérifier recherche textuelle (premier filtre, le plus sélectif)
      if (hasSearch) {
        const name = (piece.name || "").toLowerCase();
        const ref = (piece.reference || "").toLowerCase();
        const brandLower = brand.toLowerCase();
        if (
          !name.includes(searchLower) &&
          !ref.includes(searchLower) &&
          !brandLower.includes(searchLower)
        ) {
          continue; // Skip cette pièce pour tous les comptages
        }
      }

      // Calculer les états de chaque filtre
      const matchesBrand = !hasBrandFilter || brandsSet.has(brand);
      const matchesQuality =
        !hasQualityFilter || quality === activeFilters.quality;
      const matchesPrice =
        !hasPriceFilter || matchesPriceFilter(price, activeFilters.priceRange);
      const matchesAvail = !hasAvailFilter || piece.stock === "En stock";
      const matchesPosition =
        !hasPositionFilter || piece.side === activeFilters.position;
      const matchesNote = !hasNoteFilter || note >= activeFilters.minNote!;

      // ⚡ Comptages dynamiques croisés (exclut le filtre correspondant)
      // Brand count: si passe qualité + prix + dispo (exclut brand filter)
      if (
        matchesQuality &&
        matchesPrice &&
        matchesAvail &&
        matchesPosition &&
        matchesNote &&
        brand
      ) {
        brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
      }

      // Quality count: si passe brand + prix + dispo (exclut quality filter)
      if (
        matchesBrand &&
        matchesPrice &&
        matchesAvail &&
        matchesPosition &&
        matchesNote &&
        quality
      ) {
        qualityCounts.set(quality, (qualityCounts.get(quality) || 0) + 1);
      }

      // Price count: si passe brand + quality + dispo (exclut price filter)
      if (
        matchesBrand &&
        matchesQuality &&
        matchesAvail &&
        matchesPosition &&
        matchesNote
      ) {
        const category = getPriceCategory(price);
        priceCounts[category]++;
      }

      // ⚡ Ajouter au résultat final si tous les filtres passent
      if (
        matchesBrand &&
        matchesQuality &&
        matchesPrice &&
        matchesAvail &&
        matchesPosition &&
        matchesNote
      ) {
        filtered.push(piece);
      }
    }

    // ⚡ Tri avec collator mis en cache
    const collator = collatorRef.current;
    switch (sortBy) {
      case "name":
        filtered.sort((a, b) => collator.compare(a.name || "", b.name || ""));
        break;
      case "price-asc":
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "price-desc":
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "brand":
        filtered.sort((a, b) => collator.compare(a.brand || "", b.brand || ""));
        break;
    }

    // Calculer les moyennes de notes
    const averages = new Map<string, number>();
    brandNotes.forEach((data, brandName) => {
      averages.set(brandName, Math.round((data.sum / data.count) * 10) / 10);
    });

    // Trier les marques uniques
    const sortedBrands = Array.from(uniqueBrandsSet).sort();

    return {
      filteredProducts: filtered,
      dynamicFilterCounts: { brandCounts, qualityCounts, priceCounts },
      brandAverageNotes: averages,
      uniqueBrands: sortedBrands,
    };
  }, [pieces, activeFilters, brandsSet, sortBy]);

  // Pièces recommandées
  const recommendedPieces = useMemo(() => {
    if (!showRecommendations) return [];

    return filteredProducts
      .filter(
        (piece) => piece.quality === "OES" && piece.stars && piece.stars >= 4,
      )
      .slice(0, 3);
  }, [filteredProducts, showRecommendations]);

  // Données des pièces sélectionnées
  const selectedPiecesData = useMemo(() => {
    if (selectedPieces.length === 0) return [];
    const selectedSet = new Set(selectedPieces);
    return pieces.filter((piece) => selectedSet.has(piece.id));
  }, [pieces, selectedPieces]);

  // Actions mémorisées avec useCallback — wrapped in startTransition for INP
  const resetAllFilters = useCallback(() => {
    startTransition(() => {
      setActiveFilters({
        brands: [],
        priceRange: "all",
        quality: "all",
        availability: "all",
        searchText: "",
        minNote: undefined,
        position: "all",
      });
      setSortBy("name");
    });
  }, [startTransition]);

  const togglePieceSelection = useCallback((pieceId: number) => {
    setSelectedPieces((prev) =>
      prev.includes(pieceId)
        ? prev.filter((id) => id !== pieceId)
        : [...prev, pieceId],
    );
  }, []);

  const toggleFavorite = useCallback((pieceId: number) => {
    setFavoritesPieces((prev) =>
      prev.includes(pieceId)
        ? prev.filter((id) => id !== pieceId)
        : [...prev, pieceId],
    );
  }, []);

  const clearAllSelections = useCallback(() => {
    setSelectedPieces([]);
    setFavoritesPieces([]);
  }, []);

  const updateFilters = useCallback(
    (updates: Partial<PiecesFilters>) => {
      startTransition(() => {
        setActiveFilters((prev) => ({ ...prev, ...updates }));
      });
    },
    [startTransition],
  );

  // 🆕 Supprimer un filtre individuel (pour les chips)
  const removeFilter = useCallback(
    (type: keyof PiecesFilters, value?: string) => {
      startTransition(() => {
        setActiveFilters((prev) => {
          const updated = { ...prev };

          switch (type) {
            case "brands":
              // Supprimer une marque spécifique du tableau
              if (value) {
                updated.brands = prev.brands.filter((b) => b !== value);
              } else {
                updated.brands = [];
              }
              break;
            case "priceRange":
              updated.priceRange = "all";
              break;
            case "quality":
              updated.quality = "all";
              break;
            case "position":
              updated.position = "all";
              break;
            case "minNote":
              updated.minNote = undefined;
              break;
            case "availability":
              updated.availability = "all";
              break;
            case "searchText":
              updated.searchText = "";
              break;
            default:
              break;
          }

          return updated;
        });
      });
    },
    [startTransition],
  );

  // Wrap setActiveFilters so all callers go through startTransition
  const setActiveFiltersTransitioned = useCallback(
    (
      filtersOrUpdater:
        | PiecesFilters
        | ((prev: PiecesFilters) => PiecesFilters),
    ) => {
      startTransition(() => {
        setActiveFilters(filtersOrUpdater);
      });
    },
    [startTransition],
  );

  // ⚡ Wrap setSortBy/setViewMode in startTransition (INP fix — these two setters
  // were the only ones in this hook not deferred, unlike setActiveFilters above)
  const setSortByTransitioned = useCallback(
    (value: SortBy | ((prev: SortBy) => SortBy)) => {
      startTransition(() => {
        setSortBy(value);
      });
    },
    [startTransition],
  );

  const setViewModeTransitioned = useCallback(
    (value: ViewMode | ((prev: ViewMode) => ViewMode)) => {
      startTransition(() => {
        setViewMode(value);
      });
    },
    [startTransition],
  );

  return {
    // État
    activeFilters,
    sortBy,
    viewMode,
    selectedPieces,
    favoritesPieces,
    showRecommendations,
    isFilterPending,

    // Données calculées
    filteredProducts,
    uniqueBrands,
    recommendedPieces,
    selectedPiecesData,
    dynamicFilterCounts,
    brandAverageNotes,

    // Actions
    setActiveFilters: setActiveFiltersTransitioned,
    setSortBy: setSortByTransitioned,
    setViewMode: setViewModeTransitioned,
    setShowRecommendations,
    resetAllFilters,
    togglePieceSelection,
    toggleFavorite,
    clearAllSelections,
    updateFilters,
    removeFilter,
  };
}
