/**
 * 🚗 COMPOSANT SÉLECTEUR DE VÉHICULE
 * 
 * Interface pour sélectionner un véhicule par marque et modèle
 */

import { useState, useEffect } from 'react';
import { Link } from '@remix-run/react';

interface Brand {
  id: string;
  name: string;
  logo?: string;
}

interface VehicleSelectorProps {
  brands: Brand[];
  searchByTypemine: boolean;
  onBrandSelect?: (brandId: string | null) => void;
  selectedBrand?: string | null;
  categorySlug: string;
  className?: string;
}

export function VehicleSelector({ 
  brands, 
  searchByTypemine, 
  onBrandSelect,
  selectedBrand,
  categorySlug,
  className = '' 
}: VehicleSelectorProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 🔍 Filtrage des marques selon la recherche
  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 📱 Gestion clavier pour l'accessibilité
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`vehicle-selector ${className}`}>
      
      {/* 🎯 Section principale */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
        
        {/* 🔍 Mode recherche par type mine */}
        {searchByTypemine && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">
              🔍 Recherche par type mine
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Ex: 1K0 ou saisissez votre type mine..."
                className="flex-1 px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <button className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors">
                Rechercher
              </button>
            </div>
          </div>
        )}

        {/* 🚗 Sélection par marque */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            🚗 Ou sélectionnez votre marque
          </h3>
          
          {/* 🎮 Dropdown de marques */}
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white text-left flex justify-between items-center hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <span>
                {selectedBrand 
                  ? brands.find(b => b.id === selectedBrand)?.name || 'Marque sélectionnée'
                  : 'Choisissez votre marque...'
                }
              </span>
              <svg 
                className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 📋 Liste déroulante */}
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-80 overflow-hidden">
                
                {/* 🔍 Champ de recherche dans la liste */}
                <div className="p-3 border-b border-gray-200">
                  <input
                    type="text"
                    placeholder="Rechercher une marque..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                {/* 🏷️ Liste des marques */}
                <div className="max-h-60 overflow-y-auto">
                  {filteredBrands.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1 p-2">
                      {filteredBrands.map((brand) => (
                        <button
                          key={brand.id}
                          onClick={() => {
                            onBrandSelect?.(brand.id);
                            setIsOpen(false);
                            setSearchTerm('');
                          }}
                          className={`p-3 text-left rounded-md hover:bg-blue-50 transition-colors text-sm font-medium ${
                            selectedBrand === brand.id 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'text-gray-700 hover:text-blue-600'
                          }`}
                        >
                          {brand.logo && (
                            <img 
                              src={brand.logo} 
                              alt={brand.name}
                              className="w-6 h-6 mb-1"
                            />
                          )}
                          <div>{brand.name}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Aucune marque trouvée pour "{searchTerm}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 🚀 Bouton d'action */}
          <div className="mt-4 flex gap-3">
            <Link
              to={`/pieces/${categorySlug}${selectedBrand ? `?brand=${selectedBrand}` : ''}`}
              className="flex-1 px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-center"
            >
              Voir les produits
            </Link>
            
            {selectedBrand && (
              <button
                onClick={() => {
                  onBrandSelect?.(null);
                  setSearchTerm('');
                }}
                className="px-4 py-3 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                title="Réinitialiser la sélection"
              >
                ✕
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 🌐 Overlay pour fermer le dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}