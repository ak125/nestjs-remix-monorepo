/**
 * 🔍 FILTER PRESETS - Sauvegarde et chargement de filtres prédéfinis
 * 
 * Permet aux utilisateurs de sauvegarder leurs combinaisons de filtres favorites
 * (marque, prix, catégorie) et de les recharger rapidement.
 * 
 * Stockage: localStorage pour persistence côté client
 */

import { useState, useEffect } from 'react';
import { ChevronDown, Save, Trash2, Star } from 'lucide-react';

export interface FilterPreset {
  id: string;
  name: string;
  filters: {
    brands?: string[];
    priceMin?: number;
    priceMax?: number;
    categories?: string[];
    stockOnly?: boolean;
  };
  createdAt: string;
  isFavorite?: boolean;
}

interface FilterPresetsProps {
  currentFilters: FilterPreset['filters'];
  onLoadPreset: (filters: FilterPreset['filters']) => void;
  className?: string;
}

const STORAGE_KEY = 'filter_presets_v1';

export function FilterPresets({
  currentFilters,
  onLoadPreset,
  className = '',
}: FilterPresetsProps) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Charger les presets depuis localStorage au montage
  useEffect(() => {
    loadPresetsFromStorage();
  }, []);

  // Sauvegarder dans localStorage à chaque modification
  useEffect(() => {
    if (presets.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    }
  }, [presets]);

  const loadPresetsFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPresets(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Erreur chargement presets:', error);
    }
  };

  const saveCurrentFilters = () => {
    if (!presetName.trim()) {
      alert('Veuillez entrer un nom pour ce preset');
      return;
    }

    const newPreset: FilterPreset = {
      id: `preset_${Date.now()}`,
      name: presetName.trim(),
      filters: { ...currentFilters },
      createdAt: new Date().toISOString(),
      isFavorite: false,
    };

    setPresets([...presets, newPreset]);
    setPresetName('');
    setShowSaveDialog(false);
  };

  const deletePreset = (id: string) => {
    setPresets(presets.filter((p) => p.id !== id));
  };

  const toggleFavorite = (id: string) => {
    setPresets(
      presets.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p,
      ),
    );
  };

  const loadPreset = (preset: FilterPreset) => {
    onLoadPreset(preset.filters);
    setIsOpen(false);
  };

  const hasActiveFilters =
    (currentFilters.brands?.length ?? 0) > 0 ||
    currentFilters.priceMin !== undefined ||
    currentFilters.priceMax !== undefined ||
    (currentFilters.categories?.length ?? 0) > 0;

  return (
    <div className={`relative ${className}`}>
      {/* Bouton dropdown */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-700">
            Presets ({presets.length})
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Bouton sauvegarder */}
        {hasActiveFilters && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            title="Sauvegarder ces filtres"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm font-semibold">Sauvegarder</span>
          </button>
        )}
      </div>

      {/* Dropdown liste presets */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {presets.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p className="text-sm">Aucun preset sauvegardé</p>
              <p className="text-xs mt-2">
                Appliquez des filtres puis cliquez sur "Sauvegarder"
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {presets
                .sort((a, b) =>
                  a.isFavorite === b.isFavorite
                    ? 0
                    : a.isFavorite
                      ? -1
                      : 1,
                )
                .map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 group"
                  >
                    {/* Favorite star */}
                    <button
                      onClick={() => toggleFavorite(preset.id)}
                      className="flex-shrink-0"
                    >
                      <Star
                        className={`w-4 h-4 ${preset.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                      />
                    </button>

                    {/* Nom et infos */}
                    <button
                      onClick={() => loadPreset(preset)}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        {preset.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {preset.filters.brands?.length || 0} marque(s),{' '}
                        {preset.filters.categories?.length || 0} catégorie(s)
                      </p>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog sauvegarde */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Sauvegarder ce preset
            </h3>

            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Ex: Filtres BOSCH < 100€"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />

            {/* Aperçu filtres */}
            <div className="mt-4 p-3 bg-gray-50 rounded text-xs space-y-1">
              {currentFilters.brands && currentFilters.brands.length > 0 && (
                <p>
                  <strong>Marques:</strong> {currentFilters.brands.join(', ')}
                </p>
              )}
              {(currentFilters.priceMin || currentFilters.priceMax) && (
                <p>
                  <strong>Prix:</strong>{' '}
                  {currentFilters.priceMin || 0}€ -{' '}
                  {currentFilters.priceMax || '∞'}€
                </p>
              )}
              {currentFilters.categories &&
                currentFilters.categories.length > 0 && (
                  <p>
                    <strong>Catégories:</strong>{' '}
                    {currentFilters.categories.join(', ')}
                  </p>
                )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveCurrentFilters}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterPresets;
