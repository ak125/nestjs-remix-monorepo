/**
 * 🧩 SEARCH FILTERS - Composant de filtrage facetté v3.0
 */

import { useState } from 'react';
import { Badge } from '@fafa/ui';

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
  // 🛡️ Protection: s'assurer que facets est bien un array
  const safeFacets = Array.isArray(facets) ? facets : [];
  
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
    
    // Pour les facettes marque/gamme, supporter sélection multiple
    if (field === 'marque' || field === 'gamme') {
      const currentValues = Array.isArray(newFilters[field]) 
        ? newFilters[field] 
        : newFilters[field] ? [newFilters[field]] : [];
      
      if (value === null || value === undefined || value === '') {
        // Désélection
        delete newFilters[field];
      } else {
        // Toggle de la valeur
        const valueIndex = currentValues.indexOf(value);
        if (valueIndex > -1) {
          // Déjà sélectionné, on retire
          currentValues.splice(valueIndex, 1);
          if (currentValues.length === 0) {
            delete newFilters[field];
          } else {
            newFilters[field] = currentValues;
          }
        } else {
          // Pas encore sélectionné, on ajoute
          newFilters[field] = [...currentValues, value];
        }
      }
    } else {
      // Pour les autres filtres, comportement simple
      if (value === null || value === undefined || value === '') {
        delete newFilters[field];
      } else {
        newFilters[field] = value;
      }
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
            <Badge variant="info">{activeFilterCount}</Badge>
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
      {safeFacets.map((facet) => {
        // 🛡️ Protection supplémentaire pour les values
        const safeValues = Array.isArray(facet.values) ? facet.values : [];
        
        return (
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
          
          {expandedSections.has(facet.field) && safeValues.length > 0 && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {safeValues.slice(0, 10).map((option) => {
                // Vérifier si cette option est sélectionnée (support multi-valeurs)
                const currentValue = currentFilters[facet.field];
                const isSelected = Array.isArray(currentValue)
                  ? currentValue.includes(option.value)
                  : currentValue === option.value;
                
                return (
                <label key={option.value} className="flex items-center justify-between hover:bg-gray-50 px-1 py-1 rounded cursor-pointer">
                  <div className="flex items-center flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleFilterChange(
                        facet.field, 
                        e.target.checked ? option.value : option.value
                      )}
                      className="rounded border-gray-300 flex-shrink-0 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm truncate" title={String(option.label)}>
                      {String(option.label)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 ml-2 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">
                    {option.count}
                  </span>
                </label>
                );
              })}
              {safeValues.length > 10 && (
                <button className="text-xs text-blue-600 hover:text-blue-800 mt-2">
                  Voir plus ({safeValues.length - 10})
                </button>
              )}
            </div>
          )}
        </div>
        );
      })}

      {/* Résumé */}
      <div className="pt-4 border-t text-xs text-gray-500">
        {(resultCount || 0).toLocaleString()} résultats trouvés
      </div>
    </div>
  );
}
