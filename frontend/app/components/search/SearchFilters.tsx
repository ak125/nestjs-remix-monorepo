/**
 * 🧩 SEARCH FILTERS - Composant de filtrage facetté v5.0
 * ✨ Design aligné sur PiecesFilterSidebar
 * 🎨 Features: Glassmorphism premium, logos marques avec fiabilité, grille de cartes
 */

import { 
  Badge, 
  FilterSection, 
  ScrollArea 
} from '@fafa/ui';
import { Package, DollarSign, Star, RotateCcw, Bookmark, Tag, Layers } from 'lucide-react';
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

  // 💾 État pour les presets
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');

  // 📥 Charger les presets au montage
  useEffect(() => {
    loadPresets();
    // Restaurer les derniers filtres si aucun filtre actif
    if (Object.keys(currentFilters).length === 0) {
      const lastFilters = localStorage.getItem(LAST_FILTERS_KEY);
      if (lastFilters) {
        try {
          JSON.parse(lastFilters);
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

    setPresetName('');
    setShowPresetModal(false);
  };

  // 🗑️ Supprimer un preset
  const deletePreset = (presetId: string) => {
    if (!confirm('Supprimer ce preset ?')) return;

    const updatedPresets = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(updatedPresets);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updatedPresets));
  };

  // 🔄 Charger un preset
  const loadPreset = (preset: FilterPreset) => {
    onFilterChange?.(preset.filters);
  };

  const handleFilterChange = (field: string, value: any) => {
    const newFilters = { ...currentFilters };
    
    // Pour les facettes marque/gamme, supporter sélection multiple
    if (field === 'marque' || field === 'gamme') {
      const currentValues = Array.isArray(newFilters[field]) 
        ? newFilters[field] 
        : newFilters[field] ? [newFilters[field]] : [];
      
      if (value === null || value === undefined || value === '') {
        delete newFilters[field];
      } else {
        const valueIndex = currentValues.indexOf(value);
        if (valueIndex > -1) {
          currentValues.splice(valueIndex, 1);
          if (currentValues.length === 0) {
            delete newFilters[field];
          } else {
            newFilters[field] = currentValues;
          }
        } else {
          newFilters[field] = [...currentValues, value];
        }
      }
    } else {
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

  // 🎨 Couleurs de barre fiabilité (sync avec PiecesGridView)
  const getBarColor = (score: number) => {
    if (score >= 10) return 'from-cyan-400 via-teal-500 to-emerald-500';
    if (score >= 8)  return 'from-emerald-400 via-green-500 to-lime-500';
    if (score >= 7)  return 'from-blue-400 via-sky-500 to-cyan-500';
    if (score >= 5)  return 'from-yellow-400 via-amber-500 to-orange-400';
    if (score >= 3)  return 'from-orange-400 via-rose-500 to-red-400';
    return 'from-slate-400 via-gray-500 to-zinc-500';
  };
  
  const getTextColor = (score: number) => {
    if (score >= 10) return 'text-teal-600';
    if (score >= 8)  return 'text-emerald-600';
    if (score >= 7)  return 'text-blue-600';
    if (score >= 5)  return 'text-amber-600';
    if (score >= 3)  return 'text-rose-600';
    return 'text-slate-500';
  };

  // Trouver les facettes marque et catégorie
  const marqueFacet = safeFacets.find(f => f.field === 'marque');
  const gammeFacet = safeFacets.find(f => f.field === 'gamme');
  const otherFacets = safeFacets.filter(f => f.field !== 'marque' && f.field !== 'gamme');

  return (
    <div className="w-full h-[calc(100vh-8rem)] flex flex-col">
      {/* Card principale des filtres - Glassmorphism premium */}
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/80 overflow-hidden flex flex-col flex-1 min-h-0">
        
        {/* Header avec gradient premium dark - identique à PiecesFilterSidebar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-5 py-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-5 -left-5 w-20 h-20 bg-purple-500/20 rounded-full blur-2xl"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/20">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-xs">Filtres</h3>
                <p className="text-white/60 text-[10px] font-medium">Affiner la recherche</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/20">
              <span className="text-white font-bold text-xs">{resultCount}</span>
              <span className="text-white/60 text-[10px] ml-1">résultat{resultCount > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        
        {/* Contenu scrollable */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">

          {/* 💾 Section Presets */}
          <FilterSection 
            title="Mes presets" 
            icon={<Bookmark className="w-4 h-4 text-muted-foreground" />}
            badge={
              savedPresets.length > 0 ? (
                <Badge variant="secondary" className="text-xs">
                  {savedPresets.length}
                </Badge>
              ) : undefined
            }
          >
            <div className="space-y-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setShowPresetModal(true)}
                  className="w-full py-2 px-3 text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  Sauvegarder ces filtres
                </button>
              )}
              
              {savedPresets.length > 0 ? (
                <div className="space-y-1.5">
                  {savedPresets.map((preset) => (
                    <div key={preset.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors group">
                      <button
                        onClick={() => loadPreset(preset)}
                        className="flex-1 text-left text-xs font-medium text-slate-700 hover:text-slate-900 truncate"
                      >
                        📋 {preset.name}
                      </button>
                      <button
                        onClick={() => deletePreset(preset.id)}
                        className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic text-center py-2">
                  Aucun preset. Appliquez des filtres et sauvegardez.
                </p>
              )}
            </div>
          </FilterSection>

          {/* ⭐ Fiabilité - Section autonome avec couleurs par niveau */}
          <FilterSection 
            title="Fiabilité" 
            icon={<Star className="w-4 h-4 text-muted-foreground" />}
          >
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Tous', bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-600', activeBg: 'bg-slate-600', activeBorder: 'border-slate-700' },
                { value: '5', label: '5+', bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-600', activeBg: 'bg-gradient-to-r from-amber-500 to-orange-500', activeBorder: 'border-amber-600', shadow: 'shadow-amber-400/50' },
                { value: '7', label: '7+', bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-600', activeBg: 'bg-gradient-to-r from-blue-500 to-cyan-500', activeBorder: 'border-blue-600', shadow: 'shadow-blue-400/50' },
                { value: '8', label: '8+', bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-600', activeBg: 'bg-gradient-to-r from-emerald-500 to-green-500', activeBorder: 'border-emerald-600', shadow: 'shadow-emerald-400/50' },
                { value: '9', label: '9+', bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-600', activeBg: 'bg-gradient-to-r from-cyan-500 to-teal-500', activeBorder: 'border-cyan-600', shadow: 'shadow-cyan-400/50' }
              ].map(rating => {
                const isActive = (rating.value === 'all' && !currentFilters.minNote) ||
                  currentFilters.minNote?.toString() === rating.value;
                return (
                  <button
                    key={rating.value}
                    onClick={() => {
                      const newFilters = { ...currentFilters };
                      if (rating.value === 'all') {
                        delete newFilters.minNote;
                      } else {
                        newFilters.minNote = rating.value;
                      }
                      onFilterChange?.(newFilters);
                    }}
                    className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 border-2 ${
                      isActive
                        ? `${rating.activeBg} text-white shadow-lg ${rating.shadow || ''} scale-105 ${rating.activeBorder}` 
                        : `${rating.bg} ${rating.text} ${rating.border} hover:scale-102 hover:shadow-md`
                    }`}
                  >
                    {rating.label}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {/* 🏷️ Marques - Design Grille de Cartes avec Logos */}
          {marqueFacet && marqueFacet.values.length > 0 && (
            <FilterSection 
              title="Marques" 
              icon={<Tag className="w-4 h-4 text-muted-foreground" />}
              badge={
                (() => {
                  const currentValue = currentFilters.marque;
                  const selectedCount = Array.isArray(currentValue) ? currentValue.length : currentValue ? 1 : 0;
                  return selectedCount > 0 ? (
                    <Badge variant="default" className="text-xs bg-blue-600">
                      {selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {marqueFacet.values.length}
                    </Badge>
                  );
                })()
              }
            >
              <div className="grid grid-cols-2 gap-1.5">
                {marqueFacet.values.slice(0, 12).map(option => {
                  const brandName = option.label;
                  const currentValue = currentFilters.marque;
                  const isSelected = Array.isArray(currentValue)
                    ? currentValue.includes(option.value)
                    : currentValue === option.value;
                  
                  const logoFileName = `${brandName.toLowerCase().replace(/\s+/g, '-')}.webp`;
                  const logoUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/render/image/public/uploads/equipementiers-automobiles/${logoFileName}?width=48&quality=90&t=31536000`;
                  
                  // Note moyenne simulée (7 par défaut)
                  const noteAvg = 7;
                  const noteColor = getTextColor(noteAvg);
                  const barColor = getBarColor(noteAvg);
                  
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange('marque', option.value)}
                      className={`relative flex flex-col items-center p-1.5 rounded-lg transition-all duration-200 group ${
                        isSelected 
                          ? 'bg-blue-50 border-2 border-blue-500 shadow-md shadow-blue-500/20' 
                          : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      {/* Logo centré */}
                      <div className="w-full h-10 flex items-center justify-center mb-1 px-1">
                        <img
                          src={logoUrl}
                          alt={`Logo ${brandName}`}
                          width={40}
                          height={40}
                          loading="lazy"
                          decoding="async"
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-[10px] font-bold text-slate-500">${brandName.substring(0, 6)}</span>`;
                            }
                          }}
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
                      
                      {/* Badge count */}
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[8px] font-bold bg-slate-600 text-white rounded-full flex items-center justify-center">
                        {option.count}
                      </span>
                      
                      {/* Coche de sélection */}
                      {isSelected && (
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {marqueFacet.values.length > 12 && (
                <button className="w-full mt-2 py-2 text-[10px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all">
                  Voir plus ({marqueFacet.values.length - 12} autres)
                </button>
              )}
            </FilterSection>
          )}

          {/* 🚗 Gammes/Catégories - Design cards avec images */}
          {gammeFacet && gammeFacet.values.length > 0 && (
            <FilterSection 
              title="Catégories" 
              icon={<Layers className="w-4 h-4 text-muted-foreground" />}
              badge={
                (() => {
                  const currentValue = currentFilters.gamme;
                  const selectedCount = Array.isArray(currentValue) ? currentValue.length : currentValue ? 1 : 0;
                  return selectedCount > 0 ? (
                    <Badge variant="default" className="text-xs bg-emerald-600">
                      {selectedCount}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {gammeFacet.values.length}
                    </Badge>
                  );
                })()
              }
            >
              <div className="space-y-1.5">
                {gammeFacet.values.slice(0, 8).map(option => {
                  const currentValue = currentFilters.gamme;
                  const isSelected = Array.isArray(currentValue)
                    ? currentValue.includes(option.value)
                    : currentValue === option.value;
                  
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange('gamme', option.value)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 ${
                        isSelected 
                          ? 'bg-emerald-50 border-2 border-emerald-500 shadow-sm' 
                          : 'bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                      }`}
                    >
                      {/* Icône catégorie */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Layers className="w-4 h-4" />
                      </div>
                      
                      <span className="flex-1 text-left text-xs font-medium text-slate-700 truncate">
                        {option.label}
                      </span>
                      
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {option.count}
                      </span>
                      
                      {isSelected && (
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {gammeFacet.values.length > 8 && (
                <button className="w-full mt-2 py-2 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all">
                  Voir plus ({gammeFacet.values.length - 8} autres)
                </button>
              )}
            </FilterSection>
          )}

          {/* 💰 Prix - Inline compact (identique à PiecesFilterSidebar) */}
          <FilterSection 
            title="Prix" 
            icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
          >
            <div className="flex gap-1">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'low', label: '<50€', max: 50 },
                { id: 'medium', label: '50-150€', min: 50, max: 150 },
                { id: 'high', label: '>150€', min: 150 }
              ].map(price => {
                const isActive = currentFilters.priceRange === price.id || 
                  (!currentFilters.priceRange && price.id === 'all');
                
                return (
                  <button
                    key={price.id}
                    onClick={() => {
                      const newFilters = { ...currentFilters };
                      if (price.id === 'all') {
                        delete newFilters.priceRange;
                        delete newFilters.priceMin;
                        delete newFilters.priceMax;
                      } else {
                        newFilters.priceRange = price.id;
                        if (price.min) newFilters.priceMin = price.min.toString();
                        else delete newFilters.priceMin;
                        if (price.max) newFilters.priceMax = price.max.toString();
                        else delete newFilters.priceMax;
                      }
                      onFilterChange?.(newFilters);
                    }}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                      isActive 
                        ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/30' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                    }`}
                  >
                    {price.label}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {/* 📦 Disponibilité - Compact switches */}
          <FilterSection 
            title="Disponibilité" 
            icon={<Package className="w-4 h-4 text-muted-foreground" />}
          >
            <div className="space-y-2">
              {/* En stock */}
              <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                currentFilters.inStock === 'true' 
                  ? 'bg-emerald-50 border-2 border-emerald-400' 
                  : 'bg-white border border-slate-200 hover:border-emerald-200'
              }`}>
                <input
                  type="checkbox"
                  checked={currentFilters.inStock === 'true'}
                  onChange={(e) => handleFilterChange('inStock', e.target.checked ? 'true' : '')}
                  className="w-4 h-4 rounded border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="flex-1 text-xs font-medium text-slate-700">En stock</span>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              </label>
              
              {/* En promo */}
              <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                currentFilters.onSale === 'true' 
                  ? 'bg-rose-50 border-2 border-rose-400' 
                  : 'bg-white border border-slate-200 hover:border-rose-200'
              }`}>
                <input
                  type="checkbox"
                  checked={currentFilters.onSale === 'true'}
                  onChange={(e) => handleFilterChange('onSale', e.target.checked ? 'true' : '')}
                  className="w-4 h-4 rounded border-2 border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="flex-1 text-xs font-medium text-slate-700">En promo</span>
                <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-bold rounded">%</span>
              </label>
              
              {/* Nouveautés */}
              <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                currentFilters.isNew === 'true' 
                  ? 'bg-blue-50 border-2 border-blue-400' 
                  : 'bg-white border border-slate-200 hover:border-blue-200'
              }`}>
                <input
                  type="checkbox"
                  checked={currentFilters.isNew === 'true'}
                  onChange={(e) => handleFilterChange('isNew', e.target.checked ? 'true' : '')}
                  className="w-4 h-4 rounded border-2 border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 text-xs font-medium text-slate-700">Nouveautés</span>
                <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[8px] font-bold rounded">NEW</span>
              </label>
            </div>
          </FilterSection>

          {/* Autres facettes dynamiques */}
          {otherFacets.map((facet) => {
            const safeValues = Array.isArray(facet.values) ? facet.values : [];
            if (safeValues.length === 0) return null;
            
            const currentValue = currentFilters[facet.field];
            const selectedCount = Array.isArray(currentValue) ? currentValue.length : currentValue ? 1 : 0;
            
            return (
              <FilterSection 
                key={facet.field}
                title={facet.label} 
                icon={<Layers className="w-4 h-4 text-muted-foreground" />}
                badge={
                  selectedCount > 0 ? (
                    <Badge variant="default" className="text-xs bg-blue-600">
                      {selectedCount}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {safeValues.length}
                    </Badge>
                  )
                }
              >
                <div className="space-y-1">
                  {safeValues.slice(0, 8).map((option) => {
                    const isSelected = Array.isArray(currentValue)
                      ? currentValue.includes(option.value)
                      : currentValue === option.value;
                    
                    return (
                      <label 
                        key={option.value} 
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-blue-50 border border-blue-400' 
                            : 'bg-white border border-slate-200 hover:border-blue-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleFilterChange(facet.field, option.value)}
                          className="w-4 h-4 rounded border-2 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex-1 text-xs font-medium text-slate-700 truncate">
                          {option.label}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          isSelected 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {option.count}
                        </span>
                      </label>
                    );
                  })}
                </div>
                
                {safeValues.length > 8 && (
                  <button className="w-full mt-2 py-1.5 text-[10px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all">
                    Voir plus ({safeValues.length - 8} autres)
                  </button>
                )}
              </FilterSection>
            );
          })}

          {/* Bouton reset premium */}
          <button
            onClick={clearAllFilters}
            className="w-full bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 font-semibold py-2 px-3 rounded-lg text-xs transition-all duration-300 flex items-center justify-center gap-2 border border-slate-300 hover:border-slate-400 shadow-sm hover:shadow-md group"
          >
            <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
            Réinitialiser les filtres
          </button>
          </div>
        </ScrollArea>
      </div>

      {/* Modal sauvegarde preset */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowPresetModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-slate-900 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-purple-500" />
              Sauvegarder ce preset
            </h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nom du preset (ex: Filtres huile moteur)"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') savePreset();
                if (e.key === 'Escape') setShowPresetModal(false);
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowPresetModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={savePreset}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 font-medium text-sm shadow-md"
              >
                ✓ Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
