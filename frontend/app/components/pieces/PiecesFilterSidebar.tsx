/**
 * 🎛️ Sidebar Filtres pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Design moderne avec recherche, filtres marques/prix/qualité/disponibilité
 */

import React from 'react';
import { type PiecesFilters } from '../../types/pieces-route.types';

interface PiecesFilterSidebarProps {
  // État des filtres
  activeFilters: PiecesFilters;
  setActiveFilters: (filters: PiecesFilters) => void;
  
  // Données pour les filtres
  uniqueBrands: string[];
  piecesCount: number;
  
  // Actions
  resetAllFilters: () => void;
  
  // Helper pour obtenir le count par marque
  getBrandCount?: (brand: string) => number;
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
  getBrandCount
}: PiecesFilterSidebarProps) {
  
  return (
    <div className="w-80 space-y-6">
      {/* Card principale des filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
            </svg>
            Filtres
          </h3>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Recherche moderne */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Rechercher</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher une pièce..."
                value={activeFilters.searchText}
                onChange={(e) => setActiveFilters({...activeFilters, searchText: e.target.value})}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Marques */}
          {uniqueBrands.length > 1 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Marques ({uniqueBrands.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {uniqueBrands.map(brand => {
                  const isSelected = activeFilters.brands.includes(brand);
                  const brandCount = getBrandCount ? getBrandCount(brand) : 0;
                  return (
                    <label 
                      key={brand} 
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                        isSelected ? 'bg-blue-50/50 border border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 mr-3"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setActiveFilters({
                                ...activeFilters,
                                brands: [...activeFilters.brands, brand]
                              });
                            } else {
                              setActiveFilters({
                                ...activeFilters,
                                brands: activeFilters.brands.filter(b => b !== brand)
                              });
                            }
                          }}
                        />
                        <span className={`text-sm ${
                          isSelected ? 'font-medium text-blue-900' : 'text-gray-700'
                        }`}>{brand}</span>
                      </div>
                      {brandCount > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {brandCount}
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
                { id: 'low', label: 'Moins de 50€', desc: '(économique)', color: 'border-green-200 bg-green-50' },
                { id: 'medium', label: '50€ - 150€', desc: '(standard)', color: 'border-blue-200 bg-blue-50' },
                { id: 'high', label: 'Plus de 150€', desc: '(premium)', color: 'border-purple-200 bg-purple-50' }
              ].map(price => {
                const isSelected = activeFilters.priceRange === price.id;
                return (
                  <label 
                    key={price.id} 
                    className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${
                      isSelected ? `${price.color} border-opacity-100` : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="priceRange"
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                      checked={isSelected}
                      onChange={() => {
                        setActiveFilters({
                          ...activeFilters,
                          priceRange: price.id as any
                        });
                      }}
                    />
                    <div>
                      <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                        {price.label} 
                      </span>
                      {price.desc && (
                        <span className="text-xs text-gray-500 block">{price.desc}</span>
                      )}
                    </div>
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
            </h4>
            <div className="space-y-2">
              {[
                { id: 'all', label: 'Toutes qualités', icon: '🔧' },
                { id: 'OES', label: 'OES (Origine)', icon: '🏆' },
                { id: 'AFTERMARKET', label: 'Aftermarket', icon: '⭐' },
                { id: 'Echange Standard', label: 'Échange Standard', icon: '🔄' }
              ].map(quality => {
                const isSelected = activeFilters.quality === quality.id;
                return (
                  <label 
                    key={quality.id} 
                    className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${
                      isSelected ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
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
              })}
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
                activeFilters.availability === "all" ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
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
                activeFilters.availability === "stock" ? 'border-green-200 bg-green-50' : 'border-gray-100 hover:bg-gray-50'
              }`}>
                <input 
                  type="radio" 
                  name="availability"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                  checked={activeFilters.availability === "stock"}
                  onChange={() => setActiveFilters({...activeFilters, availability: "stock"})}
                />
                <span className="text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
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
