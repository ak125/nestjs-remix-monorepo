/**
 * 🧩 SEARCH FILTERS - Composant de filtrage facetté v3.0
 * ✨ Features: Filtres dynamiques + Sauvegarde de presets
 */

import { Badge } from '@fafa/ui';
import { useState, useEffect } from 'react';

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

// 💾 Clé localStorage pour les presets
const PRESET_STORAGE_KEY = 'search_filters_presets';
const LAST_FILTERS_KEY = 'search_filters_last';

// 🎨 Interface pour un preset
interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, any>;
  createdAt: string;
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

  // 💾 État pour les presets
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);
  const [_showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [_showPresetsDropdown, setShowPresetsDropdown] = useState(false);

  // 📥 Charger les presets au montage
  useEffect(() => {
    loadPresets();
    // Restaurer les derniers filtres si aucun filtre actif
    if (Object.keys(currentFilters).length === 0) {
      const lastFilters = localStorage.getItem(LAST_FILTERS_KEY);
      if (lastFilters) {
        try {
          const filters = JSON.parse(lastFilters);
          console.log('🔄 Restauration des derniers filtres:', filters);
        } catch (error) {
          console.error('Erreur restauration filtres:', error);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 💾 Sauvegarder les filtres actuels dans localStorage
  useEffect(() => {
    if (Object.keys(currentFilters).length > 0) {
      localStorage.setItem(LAST_FILTERS_KEY, JSON.stringify(currentFilters));
    }
  }, [currentFilters]);

  // 📥 Charger les presets depuis localStorage
  const loadPresets = () => {
    try {
      const stored = localStorage.getItem(PRESET_STORAGE_KEY);
      if (stored) {
        const presets = JSON.parse(stored);
        setSavedPresets(presets);
        console.log(`📦 ${presets.length} preset(s) chargé(s)`);
      }
    } catch (error) {
      console.error('Erreur chargement presets:', error);
      setSavedPresets([]);
    }
  };

  // 💾 Sauvegarder un nouveau preset
  const savePreset = () => {
    if (!presetName.trim()) {
      alert('Veuillez donner un nom à votre preset');
      return;
    }

    if (Object.keys(currentFilters).length === 0) {
      alert('Aucun filtre actif à sauvegarder');
      return;
    }

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      filters: { ...currentFilters },
      createdAt: new Date().toISOString(),
    };

    const updatedPresets = [...savedPresets, newPreset];
    setSavedPresets(updatedPresets);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updatedPresets));

    console.log('✅ Preset sauvegardé:', newPreset);
    setPresetName('');
    setShowPresetModal(false);
    alert(`✅ Preset "${newPreset.name}" sauvegardé !`);
  };

  // 🗑️ Supprimer un preset
  const deletePreset = (presetId: string) => {
    if (!confirm('Supprimer ce preset ?')) return;

    const updatedPresets = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(updatedPresets);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updatedPresets));
    console.log('🗑️ Preset supprimé:', presetId);
  };

  // 🔄 Charger un preset
  const loadPreset = (preset: FilterPreset) => {
    console.log('📥 Chargement preset:', preset.name, preset.filters);
    onFilterChange?.(preset.filters);
    setShowPresetsDropdown(false);
  };

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

      {/* 💾 Section Presets */}
      <div className="mb-6 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-purple-900 text-sm flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Mes presets
          </h4>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setShowPresetModal(true)}
              className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 font-medium"
              title="Sauvegarder ces filtres"
            >
              💾 Sauvegarder
            </button>
          )}
        </div>

        {/* Liste des presets */}
        {savedPresets.length > 0 ? (
          <div className="space-y-1 mt-2">
            {savedPresets.map((preset) => (
              <div key={preset.id} className="flex items-center justify-between p-2 bg-white rounded border border-purple-200 hover:bg-purple-50 transition-colors">
                <button
                  onClick={() => loadPreset(preset)}
                  className="flex-1 text-left text-sm font-medium text-purple-900 hover:text-purple-700"
                >
                  📋 {preset.name}
                </button>
                <button
                  onClick={() => deletePreset(preset.id)}
                  className="text-xs text-red-600 hover:text-red-800 ml-2"
                  title="Supprimer"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-purple-700 italic mt-2">
            Aucun preset sauvegardé. Appliquez des filtres et cliquez sur "Sauvegarder".
          </p>
        )}
      </div>

      {/* Modal sauvegarde preset */}
      {_showPresetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPresetModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-gray-900">💾 Sauvegarder ce preset</h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nom du preset (ex: Filtres huile moteur)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') savePreset();
                if (e.key === 'Escape') setShowPresetModal(false);
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowPresetModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={savePreset}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                ✅ Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

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
