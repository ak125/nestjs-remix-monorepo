/**
 * 🎛️ Sidebar Filtres pour Route Pièces - VERSION MIGRÉE
 * ✅ Utilise shadcn/ui (Checkbox, RadioGroup, ScrollArea, Label)
 * ✅ Utilise design tokens sémantiques
 * ✅ Utilise FilterSection pour réduire duplication
 * ✅ Support dark mode via tokens
 */

import { DollarSign, Package, RotateCcw, Star } from "lucide-react";
import { memo } from "react";

import { type PiecesFilters } from "../../types/pieces-route.types";
import { BrandLogo } from "../ui/BrandLogo";
import { Badge, FilterSection, ScrollArea } from "~/components/ui";

export interface FilterOptionData {
  id: number | string;
  label: string;
  count: number;
  trending?: boolean;
}

export interface FilterGroup {
  type: string;
  options: FilterOptionData[];
}

export interface FiltersData {
  filters: FilterGroup[];
  summary?: {
    total_filters: number;
    total_options: number;
    trending_options?: number;
  };
}

interface PiecesFilterSidebarProps {
  activeFilters: PiecesFilters;
  setActiveFilters: (filters: PiecesFilters) => void;
  uniqueBrands: string[];
  piecesCount: number;
  resetAllFilters: () => void;
  getBrandCount?: (brand: string) => number;
  getQualityCount?: (quality: string) => number;
  getPriceRangeCount?: (range: string) => number;
  filtersData?: FiltersData | null;
  availablePositions?: string[]; // Positions disponibles (Avant, Arrière, Gauche, Droite...)
  positionLabel?: string; // Label du filtre ("Position" ou "Côté")
  brandAverageNotes?: Map<string, number>; // Notes moyennes par marque
}

/**
 * 🎛️ Sidebar Filtres avec memo pour optimisation
 * Re-render uniquement si les props changent
 */
export const PiecesFilterSidebar = memo(function PiecesFilterSidebar({
  activeFilters,
  setActiveFilters,
  uniqueBrands,
  piecesCount,
  resetAllFilters,
  getBrandCount,
  getQualityCount,
  getPriceRangeCount: _getPriceRangeCount,
  filtersData,
  availablePositions = [],
  positionLabel = "Position",
  brandAverageNotes,
}: PiecesFilterSidebarProps) {
  // Extract data from API response
  const brandFilters =
    filtersData?.filters?.find((f) => f.type === "brand")?.options || [];
  const qualityFilters =
    filtersData?.filters?.find((f) => f.type === "quality")?.options || [];

  // Use API data if available, fallback to old uniqueBrands
  const brandsToDisplay =
    brandFilters.length > 0
      ? brandFilters
      : uniqueBrands.map((brand) => ({
          id: brand,
          label: brand,
          count: getBrandCount?.(brand) || 0,
        }));

  return (
    <div className="w-72 h-[calc(100vh-8rem)] flex flex-col">
      {/* Card principale des filtres - Glassmorphism premium */}
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/80 overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Header avec gradient premium dark */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-5 py-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-5 -left-5 w-20 h-20 bg-purple-500/20 rounded-full blur-2xl"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/20">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white text-xs">Filtres</h2>
                <p className="text-white/60 text-[10px] font-medium">
                  Affiner la recherche
                </p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/20">
              <span className="text-white font-bold text-xs">
                {piecesCount}
              </span>
              <span className="text-white/60 text-[10px] ml-1">
                résultat{piecesCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Contenu scrollable */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {/* Position (Avant/Arrière ou Gauche/Droite) - affiché si positions disponibles */}
            {availablePositions.length > 1 && (
              <FilterSection
                title={positionLabel}
                icon={
                  <svg
                    className="w-4 h-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                }
              >
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() =>
                      setActiveFilters({ ...activeFilters, position: "all" })
                    }
                    className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-colors duration-200 ${
                      !activeFilters.position ||
                      activeFilters.position === "all"
                        ? "bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/30"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                    }`}
                  >
                    Tous
                  </button>
                  {availablePositions.map((pos) => (
                    <button
                      key={pos}
                      onClick={() =>
                        setActiveFilters({ ...activeFilters, position: pos })
                      }
                      className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-colors duration-200 ${
                        activeFilters.position === pos
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Fiabilité - Section autonome avec couleurs par niveau */}
            <FilterSection
              title="Fiabilité"
              icon={<Star className="w-4 h-4 text-muted-foreground" />}
            >
              <div className="flex gap-2">
                {[
                  {
                    value: "all",
                    label: "Tous",
                    bg: "bg-slate-100",
                    border: "border-slate-400",
                    text: "text-slate-600",
                    activeBg: "bg-slate-600",
                    activeBorder: "border-slate-700",
                  },
                  {
                    value: "5",
                    label: "5+",
                    bg: "bg-amber-50",
                    border: "border-amber-400",
                    text: "text-amber-700",
                    activeBg: "bg-gradient-to-r from-amber-500 to-orange-500",
                    activeBorder: "border-amber-600",
                    shadow: "shadow-amber-400/50",
                  },
                  {
                    value: "7",
                    label: "7+",
                    bg: "bg-blue-50",
                    border: "border-blue-400",
                    text: "text-blue-700",
                    activeBg: "bg-gradient-to-r from-blue-500 to-cyan-500",
                    activeBorder: "border-blue-600",
                    shadow: "shadow-blue-400/50",
                  },
                  {
                    value: "8",
                    label: "8+",
                    bg: "bg-emerald-50",
                    border: "border-emerald-400",
                    text: "text-emerald-700",
                    activeBg: "bg-gradient-to-r from-emerald-500 to-green-500",
                    activeBorder: "border-emerald-600",
                    shadow: "shadow-emerald-400/50",
                  },
                  {
                    value: "9",
                    label: "9+",
                    bg: "bg-cyan-50",
                    border: "border-cyan-400",
                    text: "text-cyan-700",
                    activeBg: "bg-gradient-to-r from-cyan-500 to-teal-500",
                    activeBorder: "border-cyan-600",
                    shadow: "shadow-cyan-400/50",
                  },
                ].map((rating) => {
                  const isActive =
                    (rating.value === "all" && !activeFilters.minNote) ||
                    activeFilters.minNote?.toString() === rating.value;
                  return (
                    <button
                      key={rating.value}
                      onClick={() =>
                        setActiveFilters({
                          ...activeFilters,
                          minNote:
                            rating.value === "all"
                              ? undefined
                              : parseInt(rating.value),
                        })
                      }
                      className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold transition-colors duration-200 border-2 ${
                        isActive
                          ? `${rating.activeBg} text-white shadow-lg ${rating.shadow || ""} ${rating.activeBorder}`
                          : `${rating.bg} ${rating.text} ${rating.border} hover:shadow-md`
                      }`}
                    >
                      {rating.label}
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            {/* Marques - Design Grille de Cartes Premium */}
            {brandsToDisplay.length > 1 && (
              <FilterSection
                title="Marques"
                icon={<Package className="w-4 h-4 text-muted-foreground" />}
                badge={
                  activeFilters.brands.length > 0 ? (
                    <Badge variant="default" className="text-xs bg-blue-600">
                      {activeFilters.brands.length} sélectionnée
                      {activeFilters.brands.length > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {brandsToDisplay.length}
                    </Badge>
                  )
                }
              >
                <div className="grid grid-cols-2 gap-1.5">
                  {brandsToDisplay.map((brandOption) => {
                    const brandName = brandOption.label;
                    const isSelected = activeFilters.brands.includes(brandName);

                    // Note moyenne réelle depuis les pièces
                    const noteAvg = brandAverageNotes?.get(brandName) ?? 7;

                    // Couleurs synchronisées avec PiecesGridView
                    const getBarColor = (score: number) => {
                      if (score >= 10)
                        return "from-cyan-400 via-teal-500 to-emerald-500";
                      if (score >= 8)
                        return "from-emerald-400 via-green-500 to-lime-500";
                      if (score >= 7)
                        return "from-blue-400 via-sky-500 to-cyan-500";
                      if (score >= 5)
                        return "from-yellow-400 via-amber-500 to-orange-400";
                      if (score >= 3)
                        return "from-orange-400 via-rose-500 to-red-400";
                      return "from-slate-400 via-gray-500 to-zinc-500";
                    };
                    const getTextColor = (score: number) => {
                      if (score >= 10) return "text-teal-700";
                      if (score >= 8) return "text-emerald-700";
                      if (score >= 7) return "text-blue-700";
                      if (score >= 5) return "text-amber-700";
                      if (score >= 3) return "text-rose-700";
                      return "text-slate-600";
                    };
                    const noteColor = getTextColor(noteAvg);
                    const barColor = getBarColor(noteAvg);

                    return (
                      <button
                        key={brandOption.id}
                        onClick={() => {
                          if (isSelected) {
                            setActiveFilters({
                              ...activeFilters,
                              brands: activeFilters.brands.filter(
                                (b) => b !== brandName,
                              ),
                            });
                          } else {
                            setActiveFilters({
                              ...activeFilters,
                              brands: [...activeFilters.brands, brandName],
                            });
                          }
                        }}
                        className={`relative flex flex-col items-center p-1.5 rounded-lg transition-colors duration-200 group ${
                          isSelected
                            ? "bg-blue-50 border-2 border-blue-500 shadow-md shadow-blue-500/20"
                            : "bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md"
                        }`}
                      >
                        {/* Logo centré avec Avatar Shadcn */}
                        <div className="w-full h-10 flex items-center justify-center mb-1 px-1">
                          <BrandLogo
                            logoPath={null}
                            brandName={brandName}
                            type="equipementier"
                            size="lg"
                          />
                        </div>

                        {/* Note compacte avec barre */}
                        <div className="w-full flex items-center gap-1">
                          <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${barColor} rounded-full`}
                              style={{ width: `${(noteAvg / 10) * 100}%` }}
                            />
                          </div>
                          <span className={`text-[9px] font-bold ${noteColor}`}>
                            {noteAvg.toFixed(1)}
                          </span>
                        </div>

                        {/* Coche de sélection */}
                        {isSelected && (
                          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </FilterSection>
            )}

            {/* Qualité - Design boutons colorés */}
            <FilterSection
              title="Qualité"
              icon={<Star className="w-4 h-4 text-muted-foreground" />}
            >
              <div className="flex flex-col gap-1.5">
                {/* Bouton Toutes qualités */}
                <button
                  onClick={() =>
                    setActiveFilters({ ...activeFilters, quality: "all" })
                  }
                  className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center justify-between border-2 ${
                    activeFilters.quality === "all"
                      ? "bg-slate-600 text-white border-slate-700 shadow-lg"
                      : "bg-slate-50 text-slate-600 border-slate-300 hover:border-slate-400 hover:shadow-md"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🔧</span>
                    Toutes qualités
                  </span>
                </button>

                {/* Grille OE / Aftermarket */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(qualityFilters.length > 0
                    ? qualityFilters.map((q) => ({
                        id: String(q.id),
                        label: q.label,
                        count: getQualityCount
                          ? getQualityCount(String(q.id))
                          : q.count,
                        color:
                          q.id === "OES" || q.label?.includes("Origine")
                            ? {
                                bg: "bg-amber-50",
                                border: "border-amber-400",
                                text: "text-amber-700",
                                activeBg:
                                  "bg-gradient-to-r from-amber-500 to-yellow-500",
                                shadow: "shadow-amber-400/50",
                              }
                            : {
                                bg: "bg-blue-50",
                                border: "border-blue-400",
                                text: "text-blue-700",
                                activeBg:
                                  "bg-gradient-to-r from-blue-500 to-indigo-500",
                                shadow: "shadow-blue-400/50",
                              },
                      }))
                    : [
                        {
                          id: "OES",
                          label: "Origine (OE)",
                          count: 0,
                          color: {
                            bg: "bg-amber-50",
                            border: "border-amber-400",
                            text: "text-amber-700",
                            activeBg:
                              "bg-gradient-to-r from-amber-500 to-yellow-500",
                            shadow: "shadow-amber-400/50",
                          },
                        },
                        {
                          id: "AFTERMARKET",
                          label: "Aftermarket",
                          count: 0,
                          color: {
                            bg: "bg-blue-50",
                            border: "border-blue-400",
                            text: "text-blue-700",
                            activeBg:
                              "bg-gradient-to-r from-blue-500 to-indigo-500",
                            shadow: "shadow-blue-400/50",
                          },
                        },
                      ]
                  ).map((quality) => {
                    const isSelected = activeFilters.quality === quality.id;
                    const isDisabled = quality.count === 0;
                    return (
                      <button
                        key={quality.id}
                        onClick={() =>
                          !isDisabled &&
                          setActiveFilters({
                            ...activeFilters,
                            quality: quality.id,
                          })
                        }
                        disabled={isDisabled}
                        className={`py-2.5 px-2 rounded-lg text-[11px] font-bold transition-colors duration-200 flex flex-col items-center gap-1 border-2 ${
                          isDisabled
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50"
                            : isSelected
                              ? `${quality.color.activeBg} text-white ${quality.color.border} shadow-lg ${quality.color.shadow}`
                              : `${quality.color.bg} ${quality.color.text} ${quality.color.border} hover:shadow-md`
                        }`}
                      >
                        <span className="leading-tight text-center">
                          {quality.label}
                        </span>
                        {quality.count > 0 && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                              isSelected ? "bg-white/20" : "bg-slate-200/60"
                            }`}
                          >
                            {quality.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </FilterSection>

            {/* Prix - Inline compact */}
            <FilterSection
              title="Prix"
              icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
            >
              <div className="flex gap-1">
                {[
                  { id: "all", label: "Tous" },
                  { id: "low", label: "<50€" },
                  { id: "medium", label: "50-150€" },
                  { id: "high", label: ">150€" },
                ].map((price) => (
                  <button
                    key={price.id}
                    onClick={() =>
                      setActiveFilters({
                        ...activeFilters,
                        priceRange: price.id as any,
                      })
                    }
                    className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors duration-200 ${
                      activeFilters.priceRange === price.id
                        ? "bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/30"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                    }`}
                  >
                    {price.label}
                  </button>
                ))}
              </div>
            </FilterSection>

            {/* Disponibilité - Désactivé temporairement
          <FilterSection 
            title="Disponibilité" 
            icon={<Box className="w-4 h-4 text-muted-foreground" />}
          >
            <RadioGroup
              value={activeFilters.availability}
              onValueChange={(value) => setActiveFilters({...activeFilters, availability: value as any})}
            >
              <FilterOption isSelected={activeFilters.availability === "all"}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" className="h-3.5 w-3.5" />
                  <Label className="text-xs cursor-pointer">
                    Toutes disponibilités
                  </Label>
                </div>
              </FilterOption>
              
              <FilterOption isSelected={activeFilters.availability === "stock"}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="stock" className="h-3.5 w-3.5" />
                  <Label className="text-xs cursor-pointer flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
                    En stock uniquement
                  </Label>
                </div>
              </FilterOption>
            </RadioGroup>
          </FilterSection>
          */}

            {/* Bouton reset premium */}
            <button
              onClick={resetAllFilters}
              className="w-full bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 font-semibold py-2 px-3 rounded-lg text-xs transition-colors duration-200 flex items-center justify-center gap-2 border border-slate-300 hover:border-slate-400 shadow-sm hover:shadow-md group"
            >
              <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
              Réinitialiser les filtres
            </button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});
