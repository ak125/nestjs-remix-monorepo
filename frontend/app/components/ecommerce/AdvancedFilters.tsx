/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔍 ADVANCED FILTERS - UX Garage Optimisée
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Filtres avancés multi-critères pour catalogue pièces auto avec :
 * • Filtres marque, OEM, prix, stock, catégorie
 * • Tags visuels des filtres actifs (ex: "Peugeot 208 2016, diesel, freinage")
 * • Bouton reset clair et visible
 * • Compteur résultats en temps réel
 * • Responsive mobile → desktop
 * • Collapsible sur mobile
 *
 * Design System intégré :
 * • Secondary #0F4C81 → Backgrounds filtres
 * • Primary #FF3B30 → Bouton appliquer, tags actifs
 * • Success #27AE60 → Badge "En stock uniquement"
 * • Neutral → Inputs, bordures
 * • Espacement 8px grid
 */

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Select, SelectItem } from "~/components/ui/select";

// Types
export interface FilterValues {
  // Véhicule
  brand?: string;
  model?: string;
  year?: number;
  engine?: string;

  // Produit
  category?: string;
  oemRef?: string;

  // Prix
  priceMin?: number;
  priceMax?: number;

  // Stock
  inStockOnly?: boolean;

  // Compatibilité
  compatibleOnly?: boolean;
}

export interface FilterTag {
  key: string;
  label: string;
  value: string;
  removable: boolean;
}

interface AdvancedFiltersProps {
  // Valeurs actuelles
  values: FilterValues;

  // Callback changement
  onChange: (values: FilterValues) => void;

  // Callback reset
  onReset?: () => void;

  // Options disponibles
  brands?: string[];
  categories?: string[];

  // Compteur résultats
  resultCount?: number;
  totalCount?: number;

  // Options affichage
  collapsed?: boolean;
  showVehicleFilters?: boolean;
  showPriceFilter?: boolean;
  showStockFilter?: boolean;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 ADVANCED FILTERS COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AdvancedFilters({
  values,
  onChange,
  onReset,
  brands = [],
  categories = [],
  resultCount = 0,
  totalCount = 0,
  collapsed = false,
  showVehicleFilters = true,
  showPriceFilter = true,
  showStockFilter = true,
}: AdvancedFiltersProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [localValues, setLocalValues] = useState<FilterValues>(values);

  // Sync avec props
  useEffect(() => {
    setLocalValues(values);
  }, [values]);

  // Générer tags actifs
  const activeTags: FilterTag[] = [];

  if (localValues.brand) {
    activeTags.push({
      key: "brand",
      label: "Marque",
      value: localValues.brand,
      removable: true,
    });
  }

  if (localValues.model) {
    activeTags.push({
      key: "model",
      label: "Modèle",
      value: localValues.model,
      removable: true,
    });
  }

  if (localValues.year) {
    activeTags.push({
      key: "year",
      label: "Année",
      value: localValues.year.toString(),
      removable: true,
    });
  }

  if (localValues.engine) {
    activeTags.push({
      key: "engine",
      label: "Moteur",
      value: localValues.engine,
      removable: true,
    });
  }

  if (localValues.category) {
    activeTags.push({
      key: "category",
      label: "Catégorie",
      value: localValues.category,
      removable: true,
    });
  }

  if (localValues.oemRef) {
    activeTags.push({
      key: "oemRef",
      label: "Référence",
      value: localValues.oemRef,
      removable: true,
    });
  }

  if (localValues.priceMin || localValues.priceMax) {
    const priceLabel =
      localValues.priceMin && localValues.priceMax
        ? `${localValues.priceMin}€ - ${localValues.priceMax}€`
        : localValues.priceMin
          ? `> ${localValues.priceMin}€`
          : `< ${localValues.priceMax}€`;

    activeTags.push({
      key: "price",
      label: "Prix",
      value: priceLabel,
      removable: true,
    });
  }

  if (localValues.inStockOnly) {
    activeTags.push({
      key: "inStockOnly",
      label: "Stock",
      value: "En stock uniquement",
      removable: true,
    });
  }

  if (localValues.compatibleOnly) {
    activeTags.push({
      key: "compatibleOnly",
      label: "Compatibilité",
      value: "Compatible uniquement",
      removable: true,
    });
  }

  // Update local value
  const updateValue = (key: keyof FilterValues, value: any) => {
    const newValues = { ...localValues, [key]: value };
    setLocalValues(newValues);
  };

  // Apply filters
  const handleApply = () => {
    onChange(localValues);
  };

  // Remove tag
  const handleRemoveTag = (tagKey: string) => {
    const newValues = { ...localValues };

    if (tagKey === "price") {
      delete newValues.priceMin;
      delete newValues.priceMax;
    } else {
      delete newValues[tagKey as keyof FilterValues];
    }

    setLocalValues(newValues);
    onChange(newValues);
  };

  // Reset all
  const handleReset = () => {
    const emptyValues: FilterValues = {};
    setLocalValues(emptyValues);
    onChange(emptyValues);
    onReset?.();
  };

  const hasActiveFilters = activeTags.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-md border border-neutral-200">
      {/* 
        ═════════════════════════════════════════════════════════════════════
        HEADER (Titre + Toggle Mobile + Compteur)
        ═════════════════════════════════════════════════════════════════════
      */}
      <div className="flex items-center justify-between p-md border-b border-neutral-200">
        {/* Titre */}
        <div className="flex items-center gap-sm">
          <svg
            className="w-5 h-5 text-secondary-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <h2 className="font-heading text-lg font-bold text-neutral-900">
            Filtres Avancés
          </h2>

          {/* Badge compteur filtres actifs */}
          {hasActiveFilters && (
            <span className="bg-primary-500 text-white px-sm py-xs rounded-full font-mono text-xs font-bold">
              {activeTags.length}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-sm">
          {/* Compteur résultats */}
          {resultCount > 0 && (
            <span className="font-sans text-sm text-neutral-600">
              <strong className="font-mono text-neutral-900">
                {resultCount}
              </strong>
              {totalCount > 0 && ` / ${totalCount}`} résultats
            </span>
          )}

          {/* Toggle mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="lg:hidden"
            aria-label={isCollapsed ? "Afficher filtres" : "Masquer filtres"}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </Button>
        </div>
      </div>

      {/* 
        ═════════════════════════════════════════════════════════════════════
        TAGS ACTIFS (Affichage visuel des filtres choisis)
        ═════════════════════════════════════════════════════════════════════
        • Exemple: "Peugeot 208 2016, diesel, freinage"
        • Cliquable pour supprimer
        • Toujours visible (même si collapsed)
      */}
      {hasActiveFilters && (
        <div className="p-md border-b border-neutral-200 bg-neutral-50">
          <div className="flex flex-wrap items-center gap-xs">
            <span className="font-sans text-xs text-neutral-600 font-semibold">
              Filtres actifs:
            </span>

            {activeTags.map((tag, index) => (
              <span key={tag.key}>
                <button
                  onClick={() => handleRemoveTag(tag.key)}
                  className="
                    inline-flex items-center gap-xs
                    bg-primary-500 hover:bg-primary-600
                    text-white
                    px-sm py-xs
                    font-sans text-xs font-semibold
                    rounded
                    transition-colors
                    group
                  "
                >
                  <span className="font-mono">{tag.value}</span>
                  <svg
                    className="w-3 h-3 group-hover:rotate-90 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                {index < activeTags.length - 1 && (
                  <span className="mx-xs text-neutral-400">•</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 
        ═════════════════════════════════════════════════════════════════════
        FORMULAIRE FILTRES (Collapsible sur mobile)
        ═════════════════════════════════════════════════════════════════════
      */}
      <div className={`${isCollapsed ? "hidden lg:block" : "block"}`}>
        <div className="p-md space-y-lg">
          {/* 
            ─────────────────────────────────────────────────────────────────
            Section: Véhicule
            ─────────────────────────────────────────────────────────────────
          */}
          {showVehicleFilters && (
            <section>
              <h3 className="font-heading text-sm font-bold text-neutral-900 mb-sm flex items-center gap-xs">
                <svg
                  className="w-4 h-4 text-secondary-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Véhicule
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                {/* Marque */}
                <div>
                  <label className="block font-sans text-xs font-semibold text-neutral-700 mb-xs">
                    Marque
                  </label>
                  <Select
                    value={localValues.brand || ""}
                    onValueChange={(value) =>
                      updateValue("brand", value || undefined)
                    }
                    placeholder="Toutes les marques"
                  >
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                {/* Modèle */}
                <div>
                  <label className="block font-sans text-xs font-semibold text-neutral-700 mb-xs">
                    Modèle
                  </label>
                  <Input
                    type="text"
                    value={localValues.model || ""}
                    onChange={(e) =>
                      updateValue("model", e.target.value || undefined)
                    }
                    placeholder="Ex: 208, 308, 3008..."
                  />
                </div>

                {/* Année */}
                <div>
                  <label className="block font-sans text-xs font-semibold text-neutral-700 mb-xs">
                    Année
                  </label>
                  <Input
                    type="number"
                    value={localValues.year || ""}
                    onChange={(e) =>
                      updateValue(
                        "year",
                        e.target.value ? parseInt(e.target.value) : undefined,
                      )
                    }
                    placeholder="Ex: 2016"
                    min={1990}
                    max={new Date().getFullYear() + 1}
                    className="font-mono"
                  />
                </div>

                {/* Moteur */}
                <div>
                  <label className="block font-sans text-xs font-semibold text-neutral-700 mb-xs">
                    Moteur
                  </label>
                  <Input
                    type="text"
                    value={localValues.engine || ""}
                    onChange={(e) =>
                      updateValue("engine", e.target.value || undefined)
                    }
                    placeholder="Ex: 1.6 HDi, 2.0 BlueHDi..."
                    className="font-mono"
                  />
                </div>
              </div>
            </section>
          )}

          {/* 
            ─────────────────────────────────────────────────────────────────
            Section: Produit
            ─────────────────────────────────────────────────────────────────
          */}
          <section>
            <h3 className="font-heading text-sm font-bold text-neutral-900 mb-sm flex items-center gap-xs">
              <svg
                className="w-4 h-4 text-secondary-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              Produit
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
              {/* Catégorie */}
              <div>
                <label className="block font-sans text-xs font-semibold text-neutral-700 mb-xs">
                  Catégorie
                </label>
                <Select
                  value={localValues.category || ""}
                  onValueChange={(value) =>
                    updateValue("category", value || undefined)
                  }
                  placeholder="Toutes les catégories"
                >
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {/* Référence OEM */}
              <div>
                <label className="block font-sans text-xs font-semibold text-neutral-700 mb-xs">
                  Référence OEM
                </label>
                <Input
                  type="text"
                  value={localValues.oemRef || ""}
                  onChange={(e) =>
                    updateValue("oemRef", e.target.value || undefined)
                  }
                  placeholder="Ex: 7701208265"
                  className="font-mono"
                />
              </div>
            </div>
          </section>

          {/* 
            ─────────────────────────────────────────────────────────────────
            Section: Prix
            ─────────────────────────────────────────────────────────────────
          */}
          {showPriceFilter && (
            <section>
              <h3 className="font-heading text-sm font-bold text-neutral-900 mb-sm flex items-center gap-xs">
                <svg
                  className="w-4 h-4 text-secondary-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Prix (€)
              </h3>

              <div className="grid grid-cols-2 gap-sm">
                {/* Prix min */}
                <div>
                  <label className="block font-sans text-xs font-semibold text-neutral-700 mb-xs">
                    Minimum
                  </label>
                  <Input
                    type="number"
                    value={localValues.priceMin || ""}
                    onChange={(e) =>
                      updateValue(
                        "priceMin",
                        e.target.value ? parseFloat(e.target.value) : undefined,
                      )
                    }
                    placeholder="0"
                    min={0}
                    step={0.01}
                    className="font-mono"
                  />
                </div>

                {/* Prix max */}
                <div>
                  <label className="block font-sans text-xs font-semibold text-neutral-700 mb-xs">
                    Maximum
                  </label>
                  <Input
                    type="number"
                    value={localValues.priceMax || ""}
                    onChange={(e) =>
                      updateValue(
                        "priceMax",
                        e.target.value ? parseFloat(e.target.value) : undefined,
                      )
                    }
                    placeholder="999"
                    min={0}
                    step={0.01}
                    className="font-mono"
                  />
                </div>
              </div>
            </section>
          )}

          {/* 
            ─────────────────────────────────────────────────────────────────
            Section: Options (Stock, Compatibilité)
            ─────────────────────────────────────────────────────────────────
          */}
          {showStockFilter && (
            <section>
              <h3 className="font-heading text-sm font-bold text-neutral-900 mb-sm">
                Options
              </h3>

              <div className="space-y-sm">
                {/* Stock uniquement */}
                <Checkbox
                  checked={localValues.inStockOnly || false}
                  onChange={(e) =>
                    updateValue("inStockOnly", e.target.checked || undefined)
                  }
                  label="En stock uniquement"
                  helperText="Disponible immédiatement"
                />

                {/* Compatible uniquement */}
                <Checkbox
                  checked={localValues.compatibleOnly || false}
                  onChange={(e) =>
                    updateValue("compatibleOnly", e.target.checked || undefined)
                  }
                  label="Compatible avec mon véhicule"
                  helperText="Pièces adaptées"
                />
              </div>
            </section>
          )}
        </div>

        {/* 
          ═════════════════════════════════════════════════════════════════
          FOOTER (Boutons Appliquer + Reset)
          ═════════════════════════════════════════════════════════════════
        */}
        <div className="border-t border-neutral-200 p-md bg-neutral-50">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-sm">
            {/* Bouton Appliquer (Primary) */}
            <Button onClick={handleApply} className="flex-1 gap-sm">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Appliquer les filtres</span>
              {hasActiveFilters && (
                <span className="bg-primary-foreground/20 px-xs py-xs rounded-full font-mono text-xs">
                  {activeTags.length}
                </span>
              )}
            </Button>

            {/* Bouton Reset (clair et visible) */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="gap-sm"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <span>Réinitialiser</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvancedFilters;
