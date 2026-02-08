/**
 * 🏷️ ActiveFiltersChips
 *
 * Affiche les filtres actifs sous forme de chips cliquables
 * Permet la suppression rapide d'un filtre sans rouvrir le drawer
 *
 * @example
 * ```tsx
 * <ActiveFiltersChips
 *   filters={activeFilters}
 *   onRemoveFilter={(type, value) => updateFilters(...)}
 *   onClearAll={() => resetAllFilters()}
 * />
 * ```
 */

import { X, RotateCcw } from "lucide-react";
import { memo } from "react";
import { type PiecesFilters } from "../../types/pieces-route.types";

interface ActiveFiltersChipsProps {
  filters: PiecesFilters;
  onRemoveFilter: (type: keyof PiecesFilters, value?: string) => void;
  onClearAll: () => void;
}

// Labels pour les filtres prix
const PRICE_LABELS: Record<string, string> = {
  low: "< 50€",
  medium: "50€ - 150€",
  high: "> 150€",
};

// Labels pour les filtres qualité
const QUALITY_LABELS: Record<string, string> = {
  OES: "Qualité OES",
  OEM: "Qualité OEM",
  aftermarket: "Aftermarket",
};

// Labels pour les positions
const POSITION_LABELS: Record<string, string> = {
  avant: "Avant",
  arriere: "Arrière",
  gauche: "Gauche",
  droite: "Droite",
};

// Labels pour les notes
const NOTE_LABELS: Record<number, string> = {
  5: "★★★★★ 5+",
  7: "★★★★ 7+",
  8: "★★★★ 8+",
  9: "★★★★★ 9+",
};

export const ActiveFiltersChips = memo(function ActiveFiltersChips({
  filters,
  onRemoveFilter,
  onClearAll,
}: ActiveFiltersChipsProps) {
  // Collecter tous les filtres actifs
  const activeChips: Array<{
    type: keyof PiecesFilters;
    value?: string;
    label: string;
  }> = [];

  // Marques
  if (filters.brands && filters.brands.length > 0) {
    filters.brands.forEach((brand) => {
      activeChips.push({
        type: "brands",
        value: brand,
        label: brand,
      });
    });
  }

  // Prix
  if (filters.priceRange && filters.priceRange !== "all") {
    activeChips.push({
      type: "priceRange",
      label: PRICE_LABELS[filters.priceRange] || filters.priceRange,
    });
  }

  // Qualité
  if (filters.quality && filters.quality !== "all") {
    activeChips.push({
      type: "quality",
      label: QUALITY_LABELS[filters.quality] || filters.quality,
    });
  }

  // Position
  if (filters.position && filters.position !== "all") {
    activeChips.push({
      type: "position",
      label: POSITION_LABELS[filters.position] || filters.position,
    });
  }

  // Note minimale
  if (filters.minNote && filters.minNote > 0) {
    activeChips.push({
      type: "minNote",
      label: NOTE_LABELS[filters.minNote] || `Note ≥ ${filters.minNote}`,
    });
  }

  // Disponibilité - DÉSACTIVÉ (flux tendu)
  // Stock non fiable, ne pas afficher de chip

  // Ne rien afficher si pas de filtres actifs
  if (activeChips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      {/* Label "Filtres:" */}
      <span className="text-sm text-gray-500 font-medium mr-1">Filtres :</span>

      {/* Chips */}
      {activeChips.map((chip, index) => (
        <button
          key={`${chip.type}-${chip.value || index}`}
          onClick={() => onRemoveFilter(chip.type, chip.value)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full
                     bg-blue-100 text-blue-800 text-sm font-medium
                     hover:bg-blue-200 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          aria-label={`Supprimer le filtre ${chip.label}`}
        >
          <span>{chip.label}</span>
          <X className="w-3.5 h-3.5" />
        </button>
      ))}

      {/* Bouton "Tout effacer" */}
      {activeChips.length > 1 && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full
                     text-gray-500 text-sm font-medium
                     hover:text-red-600 hover:bg-red-50 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
          aria-label="Effacer tous les filtres"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Tout effacer</span>
        </button>
      )}
    </div>
  );
});

export default ActiveFiltersChips;
