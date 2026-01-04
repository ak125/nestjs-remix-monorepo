/**
 * 🔧 PiecesToolbar - Barre d'outils pour la page pièces
 * Version améliorée avec Shadcn UI + Lucide icons
 *
 * Fonctionnalités :
 * - Compteur de résultats + badge prix minimum
 * - Sélecteur de vue (Grid/List/Comparison)
 * - Boutons de tri (Nom/Prix croissant/Prix décroissant/Marque)
 *
 * Mobile-first:
 * - Vue icons-only (pas de labels texte)
 * - Tri en dropdown au lieu de 4 boutons icons
 */

import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowUpDown,
  ChevronDown,
  ClipboardList,
  Euro,
  LayoutGrid,
  LayoutList,
  Package,
  Tag,
} from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectItem } from "../ui/select";

interface PiecesToolbarProps {
  // État vue
  viewMode: "grid" | "list" | "comparison";
  setViewMode: (mode: "grid" | "list" | "comparison") => void;

  // État tri
  sortBy: "name" | "price-asc" | "price-desc" | "brand";
  setSortBy: (sort: "name" | "price-asc" | "price-desc" | "brand") => void;

  // Données affichage
  filteredCount: number;
  minPrice: number;
  selectedPiecesCount: number;
}

// Labels de tri pour le dropdown mobile
const SORT_OPTIONS = [
  { value: "name", label: "Nom (A-Z)", icon: ArrowDownAZ },
  { value: "price-asc", label: "Prix croissant", icon: ArrowUpDown },
  { value: "price-desc", label: "Prix décroissant", icon: ArrowDownUp },
  { value: "brand", label: "Par marque", icon: Tag },
] as const;

export function PiecesToolbar({
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  filteredCount,
  minPrice,
  selectedPiecesCount,
}: PiecesToolbarProps) {
  const currentSort = SORT_OPTIONS.find((o) => o.value === sortBy);

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 p-3 sm:p-5 sticky top-24 z-10">
      {/* Layout Mobile: Compact vertical */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Ligne 1: Compteur + Tri dropdown */}
        <div className="flex items-center justify-between gap-2">
          {/* Badge nombre compact */}
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1.5 rounded-lg border border-blue-100">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-600">{filteredCount}</span>
          </div>

          {/* Dropdown Tri mobile - Select natif simplifié */}
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as typeof sortBy)}
            className="w-[140px] h-9 text-xs bg-white border border-gray-200 rounded-md"
          >
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        {/* Ligne 2: Vue icons + Prix min */}
        <div className="flex items-center justify-between gap-2">
          {/* Vue icons-only */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <Button
              variant={viewMode === "grid" ? "blue" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className={`h-11 w-11 ${viewMode === "grid" ? "shadow-sm" : ""}`}
              title="Grille"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "blue" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className={`h-11 w-11 ${viewMode === "list" ? "shadow-sm" : ""}`}
              title="Liste"
            >
              <LayoutList className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "comparison" ? "blue" : "ghost"}
              size="icon"
              onClick={() => setViewMode("comparison")}
              className={`h-11 w-11 relative ${viewMode === "comparison" ? "shadow-sm" : ""}`}
              title="Comparer"
            >
              <ClipboardList className="w-4 h-4" />
              {selectedPiecesCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                >
                  {selectedPiecesCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Prix min compact */}
          {minPrice > 0 && (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 px-3 py-1.5 rounded-lg border border-green-100">
              <Euro className="w-4 h-4 text-green-600" />
              <span className="text-sm font-bold text-green-600">
                {minPrice.toFixed(2).replace(".", ",")} €
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Layout Desktop: Horizontal comme avant */}
      <div className="hidden sm:flex items-center justify-between flex-wrap gap-4">
        {/* Compteur de résultats */}
        <div className="flex items-center gap-3">
          {/* Badge nombre de pièces */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-xl border border-blue-100">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">
              <span className="text-blue-600">{filteredCount}</span>{" "}
              pièce{filteredCount > 1 ? "s" : ""}
            </span>
          </div>

          {/* Badge prix minimum */}
          {minPrice > 0 && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-xl border border-green-100">
              <Euro className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-900">
                Dès{" "}
                <span className="text-green-600">
                  {minPrice.toFixed(2).replace(".", ",")} €
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Sélecteur de vue */}
        <div className="flex items-center gap-1 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-1.5 border border-gray-200 shadow-inner">
          <Button
            variant={viewMode === "grid" ? "blue" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className={`gap-2 ${
              viewMode === "grid"
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md"
                : ""
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Grille
          </Button>

          <Button
            variant={viewMode === "list" ? "blue" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className={`gap-2 ${
              viewMode === "list"
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md"
                : ""
            }`}
          >
            <LayoutList className="w-4 h-4" />
            Liste
          </Button>

          <Button
            variant={viewMode === "comparison" ? "blue" : "ghost"}
            size="sm"
            onClick={() => setViewMode("comparison")}
            className={`gap-2 relative ${
              viewMode === "comparison"
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md"
                : ""
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Comparer
            {selectedPiecesCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
              >
                {selectedPiecesCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Boutons de tri desktop */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <Button
            variant={sortBy === "name" ? "blue" : "outline"}
            size="icon"
            onClick={() => setSortBy("name")}
            title="Trier par nom (A-Z)"
            className={
              sortBy === "name" ? "shadow-md" : "bg-white hover:bg-gray-50"
            }
          >
            <ArrowDownAZ className="w-5 h-5" />
          </Button>

          <Button
            variant={sortBy === "price-asc" ? "green" : "outline"}
            size="icon"
            onClick={() => setSortBy("price-asc")}
            title="Prix croissant"
            className={
              sortBy === "price-asc" ? "shadow-md" : "bg-white hover:bg-gray-50"
            }
          >
            <ArrowUpDown className="w-5 h-5" />
          </Button>

          <Button
            variant={sortBy === "price-desc" ? "red" : "outline"}
            size="icon"
            onClick={() => setSortBy("price-desc")}
            title="Prix décroissant"
            className={
              sortBy === "price-desc"
                ? "shadow-md"
                : "bg-white hover:bg-gray-50"
            }
          >
            <ArrowDownUp className="w-5 h-5" />
          </Button>

          <Button
            variant={sortBy === "brand" ? "purple" : "outline"}
            size="icon"
            onClick={() => setSortBy("brand")}
            title="Trier par marque"
            className={
              sortBy === "brand" ? "shadow-md" : "bg-white hover:bg-gray-50"
            }
          >
            <Tag className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PiecesToolbar;
