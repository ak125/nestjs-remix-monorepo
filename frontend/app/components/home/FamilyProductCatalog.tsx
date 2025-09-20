// 📁 frontend/app/components/home/FamilyProductCatalog.tsx
// 👨‍👩‍👧‍👦 Composant d'affichage des catégories organisées par familles

import { Link } from '@remix-run/react';
import { useState } from 'react';
import { organizeCategoriesByFamily } from '../../config/categoryFamilies';

interface ProductCategory {
  pg_id?: number;
  pg_name?: string;
  pg_alias?: string;
  pg_img?: string;
  pg_pic?: string;
  // Compatibilité avec l'ancien format
  gamme_id?: number;
  gamme_designation?: string;
  gamme_alias?: string;
  gamme_image?: string;
}

interface FamilyProductCatalogProps {
  categories: ProductCategory[];
  className?: string;
}

// Helper functions similaires à ProductCatalog
function getCategoryName(category: ProductCategory): string {
  return category.pg_name || category.gamme_designation || 'Catégorie inconnue';
}

function getCategoryAlias(category: ProductCategory): string {
  return category.pg_alias || category.gamme_alias || '';
}

function getCategoryImage(category: ProductCategory): string {
  const imageName = category.pg_img || category.pg_pic || category.gamme_image;
  if (!imageName) return '/images/categories/default.webp';
  return `/images/categories/${imageName}`;
}

function getCategoryId(category: ProductCategory): number {
  return category.pg_id || category.gamme_id || 0;
}

export default function FamilyProductCatalog({ categories, className = '' }: FamilyProductCatalogProps) {
  const [expandedFamilies, setExpandedFamilies] = useState<string[]>([]);
  
  // Organiser les catégories par familles
  const categoriesByFamily = organizeCategoriesByFamily(categories);
  const familyNames = Object.keys(categoriesByFamily);
  
  // Toggle d'expansion d'une famille
  const toggleFamily = (familyName: string) => {
    setExpandedFamilies(prev => 
      prev.includes(familyName)
        ? prev.filter(name => name !== familyName)
        : [...prev, familyName]
    );
  };
  
  // Icônes par famille (mapping simple)
  const getFamilyIcon = (familyName: string): string => {
    const iconMap: { [key: string]: string } = {
      'Système de filtration': '🔍',
      'Système de freinage': '🛑',
      'Courroie, galet, poulie et chaîne': '⚙️',
      'Préchauffage et allumage': '⚡',
      'Direction et liaison au sol': '🎯',
      'Amortisseur et suspension': '🌊',
      'Support moteur': '🔧',
      'Embrayage': '🔄',
      'Transmission': '🔩',
      'Système électrique': '🔌',
      'Capteurs': '📡',
      'Système d\'alimentation': '⛽',
      'Moteur': '🏭',
      'Refroidissement': '❄️',
      'Climatisation': '🌡️',
      'Echappement': '💨',
      'Eclairage': '💡',
      'Accessoires': '🔧',
      'Autres': '📦'
    };
    return iconMap[familyName] || '📦';
  };

  if (familyNames.length === 0) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <p className="text-gray-500">Aucune catégorie à afficher</p>
      </div>
    );
  }

  return (
    <section className={`py-8 ${className}`}>
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Catalogue par familles
        </h2>
        
        <div className="space-y-6">
          {familyNames.map(familyName => {
            const familyCategories = categoriesByFamily[familyName];
            const isExpanded = expandedFamilies.includes(familyName);
            const icon = getFamilyIcon(familyName);
            
            return (
              <div key={familyName} className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* En-tête de famille */}
                <button
                  onClick={() => toggleFamily(familyName)}
                  className="w-full flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl">{icon}</span>
                    <div className="text-left">
                      <h3 className="text-xl font-semibold text-gray-800">
                        {familyName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {familyCategories.length} catégorie{familyCategories.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 font-medium">
                      {isExpanded ? 'Masquer' : 'Afficher'}
                    </span>
                    <svg 
                      className={`w-6 h-6 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {/* Contenu de la famille (collapsible) */}
                {isExpanded && (
                  <div className="p-6 bg-gray-50">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      {familyCategories.map(category => (
                        <Link
                          key={getCategoryId(category)}
                          to={`/categories/${getCategoryAlias(category)}`}
                          className="group bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                        >
                          <div className="aspect-square mb-3 overflow-hidden rounded-lg bg-gray-100">
                            <img
                              src={getCategoryImage(category)}
                              alt={getCategoryName(category)}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                              loading="lazy"
                            />
                          </div>
                          
                          <h4 className="text-sm font-medium text-gray-800 text-center leading-tight">
                            {getCategoryName(category)}
                          </h4>
                        </Link>
                      ))}
                    </div>
                    
                    {familyCategories.length === 0 && (
                      <p className="text-center text-gray-500 py-4">
                        Aucune catégorie trouvée pour cette famille
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Statistiques */}
        <div className="mt-8 text-center">
          <p className="text-gray-600">
            <span className="font-semibold">{familyNames.length}</span> familles • 
            <span className="font-semibold ml-1">{categories.length}</span> catégories au total
          </p>
        </div>
      </div>
    </section>
  );
}