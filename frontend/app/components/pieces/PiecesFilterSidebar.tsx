/**
 * 🎛️ Sidebar Filtres pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Design moderne avec recherche, filtres marques/prix/qualité/disponibilité
 */

import React from 'react';
import { type PiecesFilters } from '../../types/pieces-route.types';
import { StarRating } from '../common/StarRating';

interface FilterOption {
  id: number | string;
  label: string;
  count: number;
  trending?: boolean;
}

interface FilterGroup {
  type: string;
  options: FilterOption[];
}

interface FiltersData {
  filters: FilterGroup[];
  summary?: {
    total_filters: number;
    total_options: number;
    trending_options?: number;
  };
}

interface PiecesFilterSidebarProps {
  // État des filtres
  activeFilters: PiecesFilters;
  setActiveFilters: (filters: PiecesFilters) => void;
  
  // Données pour les filtres
  uniqueBrands: string[];
  piecesCount: number;
  
  // Actions
  resetAllFilters: () => void;
  
  // Helpers pour obtenir les comptages dynamiques croisés
  getBrandCount?: (brand: string) => number;
  getQualityCount?: (quality: string) => number;
  getPriceRangeCount?: (range: string) => number;
  
  // Nouvelles données réelles de l'API
  filtersData?: FiltersData | null;
}

/**
 * Sidebar moderne avec tous les filtres (style route actuelle)
 */
export function PiecesFilterSidebar({
  activeFilters,
  setActiveFilters,
  uniqueBrands,
  piecesCount,
  resetAllFilters,
  getBrandCount,
  getQualityCount,
  getPriceRangeCount,
  filtersData
}: PiecesFilterSidebarProps) {
  
  // Extract data from API response
  const brandFilters = filtersData?.filters?.find(f => f.type === 'brand')?.options || [];
  const qualityFilters = filtersData?.filters?.find(f => f.type === 'quality')?.options || [];
  
  // Use API data if available, fallback to old uniqueBrands
  const brandsToDisplay = brandFilters.length > 0 
    ? brandFilters 
    : uniqueBrands.map(brand => ({ id: brand, label: brand, count: getBrandCount?.(brand) || 0 }));
  
  return (
    <div className="w-80 space-y-6">
      {/* Card principale des filtres */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-xl">
        {/* Header avec gradient moderne */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-5 relative overflow-hidden">
          {/* Effet de brillance */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
          
          <div className="relative z-10">
            <h3 className="font-bold text-lg text-white flex items-center gap-2.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
              </svg>
              Filtres
            </h3>
            <p className="text-white/80 text-xs mt-1 font-medium">{piecesCount} résultat{piecesCount > 1 ? 's' : ''}</p>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Recherche moderne */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              Recherche rapide
            </label>
            <div className="relative group">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher une pièce..."
                value={activeFilters.searchText}
                onChange={(e) => setActiveFilters({...activeFilters, searchText: e.target.value})}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 hover:bg-white"
              />
              {activeFilters.searchText && (
                <button
                  onClick={() => setActiveFilters({...activeFilters, searchText: ''})}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Marques */}
          {brandsToDisplay.length > 1 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Marques ({brandsToDisplay.length})
                {filtersData?.summary?.trending_options ? (
                  <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    {filtersData.summary.trending_options} 🔥
                  </span>
                ) : null}
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {brandsToDisplay.map(brandOption => {
                  // ✅ Utiliser le LABEL (nom marque) pour le filtrage, pas l'ID
                  const brandName = brandOption.label;
                  const isSelected = activeFilters.brands.includes(brandName);
                  
                  // Construction URL logo marque équipementier
                  const logoFileName = `${brandName.toLowerCase().replace(/\s+/g, '-')}.webp`;
                  const logoUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/equipementiers-automobiles/${logoFileName}`;
                  
                  return (
                    <label 
                      key={brandOption.id} 
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:scale-[1.02] ${
                        isSelected ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 shadow-sm' : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setActiveFilters({
                                ...activeFilters,
                                brands: [...activeFilters.brands, brandName]
                              });
                            } else {
                              setActiveFilters({
                                ...activeFilters,
                                brands: activeFilters.brands.filter(b => b !== brandName)
                              });
                            }
                          }}
                        />
                        {/* Logo marque */}
                        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                          <img 
                            src={logoUrl}
                            alt={`Logo ${brandName}`}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                        <span className={`text-sm ${
                          isSelected ? 'font-medium text-blue-900' : 'text-gray-700'
                        }`}>{brandOption.label}</span>
                        {brandOption.trending && (
                          <span className="text-xs" title="Marque tendance">🔥</span>
                        )}
                      </div>
                      {brandOption.count > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {brandOption.count}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prix moderne */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              Prix
            </h4>
            <div className="space-y-2">
              {[
                { id: 'all', label: 'Tous les prix', desc: '', color: 'border-gray-200' },
                { id: 'low', label: 'Moins de 50€', desc: '(économique)', color: 'border-success bg-success/10' },
                { id: 'medium', label: '50€ - 150€', desc: '(standard)', color: 'border-primary bg-primary/10' },
                { id: 'high', label: 'Plus de 150€', desc: '(premium)', color: 'border-purple-500 bg-purple-50' }
              ].map(price => {
                const isSelected = activeFilters.priceRange === price.id;
                const dynamicCount = price.id !== 'all' && getPriceRangeCount 
                  ? getPriceRangeCount(price.id) 
                  : undefined;
                const isDisabled = price.id !== 'all' && dynamicCount === 0;
                
                return (
                  <label 
                    key={price.id} 
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                      isSelected ? `${price.color} border-opacity-100` : 
                      isDisabled ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' :
                      'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        name="priceRange"
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => {
                          setActiveFilters({
                            ...activeFilters,
                            priceRange: price.id as any
                          });
                        }}
                      />
                      <div>
                        <span className={`text-sm ${isSelected ? 'font-medium' : ''} ${isDisabled ? 'text-gray-400' : ''}`}>
                          {price.label} 
                        </span>
                        {price.desc && (
                          <span className="text-xs text-gray-500 block">{price.desc}</span>
                        )}
                      </div>
                    </div>
                    {dynamicCount !== undefined && dynamicCount > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {dynamicCount}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Qualité moderne */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Qualité
              {qualityFilters.length > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {qualityFilters.reduce((sum, q) => sum + q.count, 0)} pièces
                </span>
              )}
            </h4>
            <div className="space-y-2">
              {/* Option "Toutes qualités" toujours visible */}
              {(() => {
                const isSelected = activeFilters.quality === 'all';
                return (
                  <label 
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                      isSelected ? 'border-primary bg-primary/10' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="quality"
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
                        checked={isSelected}
                        onChange={() => {
                          setActiveFilters({
                            ...activeFilters,
                            quality: 'all'
                          });
                        }}
                      />
                      <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                        🔧 Toutes qualités
                      </span>
                    </div>
                  </label>
                );
              })()}
              
              {/* Options de qualité réelles depuis l'API */}
              {qualityFilters.length > 0 ? (
                qualityFilters.map(qualityOption => {
                  const isSelected = activeFilters.quality === qualityOption.id;
                  // Comptage dynamique croisé (tient compte des autres filtres actifs)
                  const dynamicCount = getQualityCount ? getQualityCount(String(qualityOption.id)) : qualityOption.count;
                  
                  // Map quality IDs to icons
                  const iconMap: Record<string, string> = {
                    'OES': '🏆',
                    'A': '⭐',
                    'aftermarket': '⭐',
                    'O': '🔧'
                  };
                  const icon = iconMap[String(qualityOption.id)] || '🔧';
                  
                  return (
                    <label 
                      key={String(qualityOption.id)} 
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                        isSelected ? 'border-primary bg-primary/10' : 
                        dynamicCount === 0 ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' : 
                        'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="quality"
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
                          checked={isSelected}
                          disabled={dynamicCount === 0}
                          onChange={() => {
                            setActiveFilters({
                              ...activeFilters,
                              quality: String(qualityOption.id)
                            });
                          }}
                        />
                        <span className={`text-sm ${isSelected ? 'font-medium' : ''} ${dynamicCount === 0 ? 'text-gray-400' : ''}`}>
                          {icon} {qualityOption.label}
                        </span>
                      </div>
                      {dynamicCount > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {dynamicCount}
                        </span>
                      )}
                    </label>
                  );
                })
              ) : (
                // Fallback vers options statiques si pas de données API
                [
                  { id: 'OES', label: 'OES (Origine)', icon: '🏆' },
                  { id: 'AFTERMARKET', label: 'Aftermarket', icon: '⭐' },
                  { id: 'Echange Standard', label: 'Échange Standard', icon: '🔄' }
                ].map(quality => {
                  const isSelected = activeFilters.quality === quality.id;
                  return (
                    <label 
                      key={quality.id} 
                      className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${
                        isSelected ? 'border-primary bg-primary/10' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="quality"
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                        checked={isSelected}
                        onChange={() => {
                          setActiveFilters({
                            ...activeFilters,
                            quality: quality.id as any
                          });
                        }}
                      />
                      <span className={`text-sm flex items-center gap-2 ${isSelected ? 'font-medium' : ''}`}>
                        <span>{quality.icon}</span>
                        {quality.label}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Filtre Étoiles (Note minimale) */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Note minimale
            </h4>
            <div className="space-y-2">
              {/* Toutes les notes */}
              <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                !activeFilters.minStars ? 'border-primary bg-primary/10' : 'border-gray-100 hover:bg-gray-50'
              }`}>
                <div className="flex items-center">
                  <input 
                    type="radio" 
                    name="minStars"
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    checked={!activeFilters.minStars}
                    onChange={() => setActiveFilters({...activeFilters, minStars: undefined})}
                  />
                  <span className={`text-sm ml-3 ${!activeFilters.minStars ? 'font-medium' : ''}`}>
                    Toutes les notes
                  </span>
                </div>
              </label>

              {/* 3+ étoiles */}
              <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                activeFilters.minStars === 3 ? 'border-warning bg-warning/10' : 'border-gray-100 hover:bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="minStars"
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    checked={activeFilters.minStars === 3}
                    onChange={() => setActiveFilters({...activeFilters, minStars: 3})}
                  />
                  <div className="flex items-center gap-1">
                    <StarRating rating={3} size="sm" />
                    <span className={`text-sm ${activeFilters.minStars === 3 ? 'font-medium' : ''}`}>
                      et plus
                    </span>
                  </div>
                </div>
              </label>

              {/* 5+ étoiles */}
              <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                activeFilters.minStars === 5 ? 'border-success bg-success/10' : 'border-gray-100 hover:bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="minStars"
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    checked={activeFilters.minStars === 5}
                    onChange={() => setActiveFilters({...activeFilters, minStars: 5})}
                  />
                  <div className="flex items-center gap-1">
                    <StarRating rating={5} size="sm" />
                    <span className={`text-sm ${activeFilters.minStars === 5 ? 'font-medium' : ''}`}>
                      et plus
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Disponibilité moderne */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Disponibilité
            </h4>
            <div className="space-y-2">
              <label className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${
                activeFilters.availability === "all" ? 'border-primary bg-primary/10' : 'border-gray-100 hover:bg-gray-50'
              }`}>
                <input 
                  type="radio" 
                  name="availability"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                  checked={activeFilters.availability === "all"}
                  onChange={() => setActiveFilters({...activeFilters, availability: "all"})}
                />
                <span className="text-sm">Toutes disponibilités</span>
              </label>
              <label className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${
                activeFilters.availability === "stock" ? 'border-success bg-success/10' : 'border-gray-100 hover:bg-gray-50'
              }`}>
                <input 
                  type="radio" 
                  name="availability"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                  checked={activeFilters.availability === "stock"}
                  onChange={() => setActiveFilters({...activeFilters, availability: "stock"})}
                />
                <span className="text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-success rounded-full"></span>
                  En stock uniquement
                </span>
              </label>
            </div>
          </div>

          {/* Bouton reset moderne */}
          <button
            onClick={resetAllFilters}
            className="w-full bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Réinitialiser les filtres
          </button>
        </div>
      </div>

      {/* Stats résumé (optionnel) */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-900">{piecesCount}</div>
          <div className="text-sm text-blue-700">pièce{piecesCount > 1 ? 's' : ''} trouvée{piecesCount > 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
  );
}
