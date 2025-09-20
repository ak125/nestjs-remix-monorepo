/**
 * 🧩 SEARCH FILTERS - Composant de filtrage facetté v3.0
 */

import { useState } from 'react';

export interface FilterFacet {
  field: string;
  label: string;
  values: Array<{
    value: string;
    label: string;
    count: number;
  }>;
}

interface SearchFiltersProps {
  facets?: FilterFacet[];
  currentFilters: Record<string, any>;
  resultCount: number;
  onFilterChange?: (filters: Record<string, any>) => void;
}

export function SearchFilters({ 
  facets = [], 
  currentFilters = {}, 
  resultCount,
  onFilterChange 
}: SearchFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['category', 'brand', 'price']) // Sections ouvertes par défaut
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleFilterChange = (field: string, value: any) => {
    const newFilters = { ...currentFilters };
    if (value === null || value === undefined || value === '') {
      delete newFilters[field];
    } else {
      newFilters[field] = value;
    }
    onFilterChange?.(newFilters);
  };

  const clearAllFilters = () => {
    onFilterChange?.({});
  };

  const activeFilterCount = Object.keys(currentFilters).filter(
    key => currentFilters[key] !== undefined && currentFilters[key] !== null && currentFilters[key] !== ''
  ).length;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      {/* En-tête des filtres */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b">
        <h3 className="font-semibold text-gray-900">
          Filtres
          {activeFilterCount > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </h3>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Tout effacer
          </button>
        )}
      </div>

      {/* Filtres de prix */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('price')}
          className="flex justify-between items-center w-full text-left font-medium text-gray-900 py-2"
        >
          Prix
          <span className={`transform transition-transform ${
            expandedSections.has('price') ? 'rotate-180' : ''
          }`}>
            ▼
          </span>
        </button>
        
        {expandedSections.has('price') && (
          <div className="mt-2 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min €</label>
                <input
                  type="number"
                  value={currentFilters.priceMin || ''}
                  onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max €</label>
                <input
                  type="number"
                  value={currentFilters.priceMax || ''}
                  onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                  placeholder="999"
                  min="0"
                />
              </div>
            </div>
            
            {/* Filtres rapides de prix */}
            <div className="flex flex-wrap gap-1">
              {[
                { label: '< 10€', max: 10 },
                { label: '10-50€', min: 10, max: 50 },
                { label: '50-100€', min: 50, max: 100 },
                { label: '> 100€', min: 100 },
              ].map((range, index) => (
                <button
                  key={index}
                  onClick={() => {
                    const newFilters = { ...currentFilters };
                    if (range.min) newFilters.priceMin = range.min.toString();
                    if (range.max) newFilters.priceMax = range.max.toString();
                    onFilterChange?.(newFilters);
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filtres booléens */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-2">Disponibilité</h4>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={currentFilters.inStock === 'true'}
              onChange={(e) => handleFilterChange('inStock', e.target.checked ? 'true' : '')}
              className="rounded border-gray-300"
            />
            <span className="ml-2 text-sm">En stock uniquement</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={currentFilters.onSale === 'true'}
              onChange={(e) => handleFilterChange('onSale', e.target.checked ? 'true' : '')}
              className="rounded border-gray-300"
            />
            <span className="ml-2 text-sm">En promotion</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={currentFilters.isNew === 'true'}
              onChange={(e) => handleFilterChange('isNew', e.target.checked ? 'true' : '')}
              className="rounded border-gray-300"
            />
            <span className="ml-2 text-sm">Nouveautés</span>
          </label>
        </div>
      </div>

      {/* Facettes dynamiques */}
      {facets.map((facet) => (
        <div key={facet.field} className="mb-6">
          <button
            onClick={() => toggleSection(facet.field)}
            className="flex justify-between items-center w-full text-left font-medium text-gray-900 py-2"
          >
            {facet.label}
            <span className={`transform transition-transform ${
              expandedSections.has(facet.field) ? 'rotate-180' : ''
            }`}>
              ▼
            </span>
          </button>
          
          {expandedSections.has(facet.field) && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {facet.values.slice(0, 10).map((option) => (
                <label key={option.value} className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={currentFilters[facet.field] === option.value}
                      onChange={(e) => handleFilterChange(
                        facet.field, 
                        e.target.checked ? option.value : ''
                      )}
                      className="rounded border-gray-300 flex-shrink-0"
                    />
                    <span className="ml-2 text-sm truncate" title={option.label}>
                      {option.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                    {option.count}
                  </span>
                </label>
              ))}
              {facet.values.length > 10 && (
                <button className="text-xs text-blue-600 hover:text-blue-800">
                  Voir plus ({facet.values.length - 10})
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Résumé */}
      <div className="pt-4 border-t text-xs text-gray-500">
        {resultCount.toLocaleString()} résultats trouvés
      </div>
    </div>
  );
}
