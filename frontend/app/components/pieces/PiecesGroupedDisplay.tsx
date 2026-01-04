/**
 * PiecesGroupedDisplay - Affichage groupé des pièces avec filtres
 *
 * Gère l'affichage des pièces en groupes (Avant/Arrière, etc.)
 * avec application des filtres actifs sur chaque groupe.
 *
 * 📱 Pagination mobile-first:
 * - Affiche 20 produits initialement pour un LCP rapide
 * - Bouton "Charger plus" pour voir le reste
 * - Tous les produits restent chargés (SEO préservé)
 */

import { ChevronDown } from "lucide-react";
import { useState, useCallback } from "react";
import { type PieceData, type PiecesFilters } from "../../types/pieces-route.types";
import { mapApiPieceToData } from "../../utils/pieces-route.utils";

import { PiecesGridView } from "./PiecesGridView";
import { PiecesListView } from "./PiecesListView";

/** Nombre de produits affichés initialement (optimisé LCP mobile) */
const INITIAL_VISIBLE_COUNT = 20;
/** Nombre de produits ajoutés à chaque "Charger plus" */
const LOAD_MORE_INCREMENT = 20;

interface GroupedPiece {
  filtre_gamme: string;
  filtre_side: string;
  title_h2?: string;
  pieces?: any[];
}

interface PiecesGroupedDisplayProps {
  groupedPieces: GroupedPiece[];
  activeFilters: PiecesFilters;
  viewMode: "grid" | "list" | "comparison";
  vehicleModele: string;
  vehicleMarque: string;
  selectedPieces: number[];
  onSelectPiece: (pieceId: number) => void;
}

/**
 * Applique les filtres actifs sur une liste de pièces
 */
function applyFilters(pieces: any[], activeFilters: PiecesFilters): PieceData[] {
  return pieces.filter((p) => {
    const pieceData = mapApiPieceToData(p);

    // Filtre par marque
    if (activeFilters.brands.length > 0 && !activeFilters.brands.includes(pieceData.brand)) {
      return false;
    }

    // Filtre par texte de recherche
    if (activeFilters.searchText && !pieceData.name.toLowerCase().includes(activeFilters.searchText.toLowerCase())) {
      return false;
    }

    // Filtre par qualité
    if (activeFilters.quality !== "all" && pieceData.quality !== activeFilters.quality) {
      return false;
    }

    // Filtre par gamme de prix
    if (activeFilters.priceRange !== "all") {
      const price = pieceData.price;
      if (activeFilters.priceRange === "low" && price >= 50) return false;
      if (activeFilters.priceRange === "medium" && (price < 50 || price >= 150)) return false;
      if (activeFilters.priceRange === "high" && price < 150) return false;
    }

    // Filtre par disponibilité
    if (activeFilters.availability === "stock" && pieceData.stock !== "En stock") {
      return false;
    }

    // Filtre par note minimale (sur 10)
    if (activeFilters.minNote && activeFilters.minNote > 0) {
      const stars = pieceData.stars || 3;
      const note = Math.round((stars / 6) * 10);
      if (note < activeFilters.minNote) return false;
    }

    return true;
  }).map(mapApiPieceToData);
}

export function PiecesGroupedDisplay({
  groupedPieces,
  activeFilters,
  viewMode,
  vehicleModele,
  vehicleMarque,
  selectedPieces,
  onSelectPiece,
}: PiecesGroupedDisplayProps) {
  // 📱 Pagination mobile-first: état du nombre de produits visibles par groupe
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  // Charger plus de produits pour un groupe spécifique
  const handleLoadMore = useCallback((groupKey: string, totalCount: number) => {
    setVisibleCounts((prev) => {
      const currentCount = prev[groupKey] || INITIAL_VISIBLE_COUNT;
      const newCount = Math.min(currentCount + LOAD_MORE_INCREMENT, totalCount);
      return { ...prev, [groupKey]: newCount };
    });
  }, []);

  // Afficher tous les produits d'un groupe
  const handleShowAll = useCallback((groupKey: string, totalCount: number) => {
    setVisibleCounts((prev) => ({ ...prev, [groupKey]: totalCount }));
  }, []);

  // Filtrer les groupes par position si un filtre est actif
  const filteredGroups = groupedPieces.filter((group) => {
    if (!activeFilters.position || activeFilters.position === "all") {
      return true;
    }
    return group.filtre_side === activeFilters.position;
  });

  return (
    <div className="space-y-8">
      {filteredGroups.map((group, idx) => {
        // Appliquer les filtres sur les pièces du groupe
        const groupPieces = applyFilters(group.pieces || [], activeFilters);

        if (groupPieces.length === 0) return null;

        // Clé unique pour ce groupe
        const groupKey = `${group.filtre_gamme}-${group.filtre_side}-${idx}`;

        // Nombre de produits visibles (défaut: INITIAL_VISIBLE_COUNT)
        const visibleCount = visibleCounts[groupKey] || INITIAL_VISIBLE_COUNT;

        // Produits à afficher (sliced pour performance LCP)
        const visiblePieces = groupPieces.slice(0, visibleCount);
        const remainingCount = groupPieces.length - visibleCount;
        const hasMore = remainingCount > 0;

        return (
          <div
            key={groupKey}
            className="animate-in fade-in slide-in-from-top duration-500"
          >
            {/* Titre H2 dynamique avec modèle véhicule */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b-2 border-blue-500 flex items-center gap-3">
              <span className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></span>
              {group.title_h2 || `${group.filtre_gamme} ${group.filtre_side}`} {vehicleModele}
              <span className="text-sm font-normal text-gray-500 ml-auto">
                ({groupPieces.length} article{groupPieces.length > 1 ? "s" : ""})
              </span>
            </h2>

            {/* Grille ou liste de pièces (avec pagination) */}
            {viewMode === "grid" && (
              <PiecesGridView
                pieces={visiblePieces}
                onSelectPiece={onSelectPiece}
                selectedPieces={selectedPieces}
                vehicleMarque={vehicleMarque}
              />
            )}

            {viewMode === "list" && (
              <PiecesListView
                pieces={visiblePieces}
                onSelectPiece={onSelectPiece}
                selectedPieces={selectedPieces}
              />
            )}

            {/* 📱 Bouton "Charger plus" - visible uniquement s'il reste des produits */}
            {hasMore && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleLoadMore(groupKey, groupPieces.length)}
                  className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                  aria-label={`Charger ${Math.min(remainingCount, LOAD_MORE_INCREMENT)} produits de plus`}
                >
                  <ChevronDown className="w-5 h-5" />
                  <span>
                    Charger {Math.min(remainingCount, LOAD_MORE_INCREMENT)} produit{Math.min(remainingCount, LOAD_MORE_INCREMENT) > 1 ? "s" : ""} de plus
                  </span>
                </button>

                {/* Bouton "Voir tout" si beaucoup de produits restants */}
                {remainingCount > LOAD_MORE_INCREMENT && (
                  <button
                    type="button"
                    onClick={() => handleShowAll(groupKey, groupPieces.length)}
                    className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                    aria-label={`Voir les ${remainingCount} produits restants`}
                  >
                    <span>Voir tout ({remainingCount})</span>
                  </button>
                )}
              </div>
            )}

            {/* Indicateur de pagination (visible quand pagination active) */}
            {groupPieces.length > INITIAL_VISIBLE_COUNT && (
              <div className="mt-4 text-center text-sm text-gray-500">
                {hasMore ? (
                  <span>Affichage de {visibleCount} sur {groupPieces.length} produits</span>
                ) : (
                  <span className="text-green-600 font-medium">✓ Tous les {groupPieces.length} produits affichés</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
