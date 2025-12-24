/**
 * PiecesGroupedDisplay - Affichage groupé des pièces avec filtres
 *
 * Gère l'affichage des pièces en groupes (Avant/Arrière, etc.)
 * avec application des filtres actifs sur chaque groupe.
 */

import { type PieceData, type PiecesFilters } from "../../types/pieces-route.types";
import { mapApiPieceToData } from "../../utils/pieces-route.utils";

import { PiecesGridView } from "./PiecesGridView";
import { PiecesListView } from "./PiecesListView";

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

        return (
          <div
            key={`${group.filtre_gamme}-${group.filtre_side}-${idx}`}
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

            {/* Grille ou liste de pièces */}
            {viewMode === "grid" && (
              <PiecesGridView
                pieces={groupPieces}
                onSelectPiece={onSelectPiece}
                selectedPieces={selectedPieces}
                vehicleMarque={vehicleMarque}
              />
            )}

            {viewMode === "list" && (
              <PiecesListView
                pieces={groupPieces}
                onSelectPiece={onSelectPiece}
                selectedPieces={selectedPieces}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
