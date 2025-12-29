/**
 * FilterAccordion - Composant pour les filtres de catalogue avec sections pliables
 *
 * @features
 * - Filtres par prix (range slider)
 * - Filtres par marques (checkboxes multiples)
 * - Filtres par catégories
 * - Filtre de disponibilité (en stock uniquement)
 * - Reset des filtres par section
 * - Compteur de filtres actifs
 *
 * ⚡ Optimisé INP: Range sliders debouncés pour éviter les mises à jour excessives
 *
 * @example
 * <FilterAccordion
 *   filters={filters}
 *   onFilterChange={handleFilterChange}
 *   activeFiltersCount={3}
 * />
 */

import { X, Check, DollarSign, Tag, Package, Layers } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

import { debounce } from '../../utils/performance.utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
  selected?: boolean;
}

export interface FilterData {
  priceRange?: {
    min: number;
    max: number;
    currentMin: number;
    currentMax: number;
  };
  brands?: FilterOption[];
  categories?: FilterOption[];
  availability?: {
    inStockOnly: boolean;
  };
}

interface FilterAccordionProps {
  /** Données des filtres disponibles */
  filters: FilterData;
  /** Callback lors du changement de filtre */
  onFilterChange?: (filters: FilterData) => void;
  /** Nombre de filtres actifs */
  activeFiltersCount?: number;
  /** Permet de réinitialiser tous les filtres */
  onResetAll?: () => void;
  /** Classe CSS personnalisée */
  className?: string;
}

export function FilterAccordion({
  filters,
  onFilterChange,
  activeFiltersCount = 0,
  onResetAll,
  className = '',
}: FilterAccordionProps) {
  const [localFilters, setLocalFilters] = useState<FilterData>(filters);

  // ⚡ État local pour les sliders (feedback visuel immédiat)
  const [sliderValues, setSliderValues] = useState({
    min: filters.priceRange?.currentMin ?? filters.priceRange?.min ?? 0,
    max: filters.priceRange?.currentMax ?? filters.priceRange?.max ?? 1000,
  });

  // Synchroniser les valeurs du slider quand les filtres changent de l'extérieur
  useEffect(() => {
    if (filters.priceRange) {
      setSliderValues({
        min: filters.priceRange.currentMin,
        max: filters.priceRange.currentMax,
      });
    }
  }, [filters.priceRange]);

  // ⚡ Debounce pour les mises à jour de prix (150ms)
  const debouncedPriceUpdateRef = useRef(
    debounce((newFilters: FilterData) => {
      setLocalFilters(newFilters);
      onFilterChange?.(newFilters);
    }, 150)
  );

  // Cleanup du debounce au démontage
  useEffect(() => {
    const debouncedFn = debouncedPriceUpdateRef.current;
    return () => {
      debouncedFn.cancel();
    };
  }, []);

  const updateFilters = (newFilters: FilterData) => {
    setLocalFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  // ⚡ Handler optimisé pour le slider min
  const handleMinPriceChange = useCallback((value: number) => {
    // Feedback visuel immédiat
    setSliderValues(prev => ({ ...prev, min: value }));

    // Mise à jour debouncée vers le parent
    debouncedPriceUpdateRef.current({
      ...localFilters,
      priceRange: {
        ...localFilters.priceRange!,
        currentMin: value,
      },
    });
  }, [localFilters]);

  // ⚡ Handler optimisé pour le slider max
  const handleMaxPriceChange = useCallback((value: number) => {
    // Feedback visuel immédiat
    setSliderValues(prev => ({ ...prev, max: value }));

    // Mise à jour debouncée vers le parent
    debouncedPriceUpdateRef.current({
      ...localFilters,
      priceRange: {
        ...localFilters.priceRange!,
        currentMax: value,
      },
    });
  }, [localFilters]);

  const toggleBrand = (brandId: string) => {
    const updatedBrands = localFilters.brands?.map((brand) =>
      brand.id === brandId
        ? { ...brand, selected: !brand.selected }
        : brand
    );
    updateFilters({ ...localFilters, brands: updatedBrands as any });
  };

  const toggleCategory = (categoryId: string) => {
    const updatedCategories = localFilters.categories?.map((cat) =>
      cat.id === categoryId
        ? { ...cat, selected: !cat.selected }
        : cat
    );
    updateFilters({ ...localFilters, categories: updatedCategories as any });
  };

  const resetPriceRange = () => {
    if (!localFilters.priceRange) return;
    // ⚡ Reset les valeurs locales immédiatement
    setSliderValues({
      min: localFilters.priceRange.min,
      max: localFilters.priceRange.max,
    });
    // Puis met à jour les filtres
    updateFilters({
      ...localFilters,
      priceRange: {
        ...localFilters.priceRange,
        currentMin: localFilters.priceRange.min,
        currentMax: localFilters.priceRange.max,
      },
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header avec compteur et reset */}
      <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 p-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">Filtres</span>
          {activeFiltersCount > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <button
            onClick={onResetAll}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <X className="h-4 w-4" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Accordéons de filtres */}
      <Accordion type="multiple" defaultValue={['price', 'brands']} className="space-y-2">
        {/* Filtre Prix */}
        {localFilters.priceRange && (
          <AccordionItem
            value="price"
            className="rounded-lg border border-gray-200 bg-white px-4"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-gray-900">Prix</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                {/* ⚡ Affiche les valeurs locales pour feedback immédiat */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {sliderValues.min}€
                  </span>
                  <span className="text-gray-400">-</span>
                  <span className="font-medium text-gray-700">
                    {sliderValues.max}€
                  </span>
                </div>
                <div className="space-y-2">
                  {/* ⚡ Slider min avec handler debouncé */}
                  <input
                    type="range"
                    min={localFilters.priceRange.min}
                    max={localFilters.priceRange.max}
                    value={sliderValues.min}
                    onChange={(e) => handleMinPriceChange(parseInt(e.target.value))}
                    className="w-full"
                  />
                  {/* ⚡ Slider max avec handler debouncé */}
                  <input
                    type="range"
                    min={localFilters.priceRange.min}
                    max={localFilters.priceRange.max}
                    value={sliderValues.max}
                    onChange={(e) => handleMaxPriceChange(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                {(sliderValues.min !== localFilters.priceRange.min ||
                  sliderValues.max !== localFilters.priceRange.max) && (
                  <button
                    onClick={resetPriceRange}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Réinitialiser le prix
                  </button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Filtre Marques */}
        {localFilters.brands && localFilters.brands.length > 0 && (
          <AccordionItem
            value="brands"
            className="rounded-lg border border-gray-200 bg-white px-4"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-gray-900">Marques</span>
                {localFilters.brands.filter((b: any) => b.selected).length > 0 && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-600">
                    {localFilters.brands.filter((b: any) => b.selected).length}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-2">
                {localFilters.brands.map((brand) => (
                  <label
                    key={brand.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-gray-50"
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                        (brand as any).selected
                          ? 'border-purple-600 bg-purple-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {(brand as any).selected && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={(brand as any).selected || false}
                      onChange={() => toggleBrand(brand.id)}
                      className="sr-only"
                    />
                    <span className="flex-1 text-sm text-gray-700">
                      {brand.label}
                    </span>
                    {brand.count !== undefined && (
                      <span className="text-xs text-gray-400">
                        ({brand.count})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Filtre Catégories */}
        {localFilters.categories && localFilters.categories.length > 0 && (
          <AccordionItem
            value="categories"
            className="rounded-lg border border-gray-200 bg-white px-4"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-green-600" />
                <span className="font-medium text-gray-900">Catégories</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-2">
                {localFilters.categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-gray-50"
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                        (category as any).selected
                          ? 'border-green-600 bg-green-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {(category as any).selected && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={(category as any).selected || false}
                      onChange={() => toggleCategory(category.id)}
                      className="sr-only"
                    />
                    <span className="flex-1 text-sm text-gray-700">
                      {category.label}
                    </span>
                    {category.count !== undefined && (
                      <span className="text-xs text-gray-400">
                        ({category.count})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Filtre Disponibilité */}
        {localFilters.availability && (
          <AccordionItem
            value="availability"
            className="rounded-lg border border-gray-200 bg-white px-4"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-gray-900">Disponibilité</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-gray-50">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                    localFilters.availability.inStockOnly
                      ? 'border-orange-600 bg-orange-600'
                      : 'border-gray-300'
                  }`}
                >
                  {localFilters.availability.inStockOnly && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={localFilters.availability.inStockOnly}
                  onChange={(e) =>
                    updateFilters({
                      ...localFilters,
                      availability: {
                        inStockOnly: e.target.checked,
                      },
                    })
                  }
                  className="sr-only"
                />
                <span className="text-sm text-gray-700">
                  En stock uniquement
                </span>
              </label>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
