// 📁 frontend/app/components/home/DatabaseFamilyProductCatalog.tsx
// 👨‍👩‍👧‍👦 Composant d'affichage des catégories organisées par familles (données DB)

import { Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { Badge } from '@fafa/ui';
import { familiesApi, type FamiliesResponse, type FamilyCategory } from '../../services/api/families.api';

interface DatabaseFamilyProductCatalogProps {
  className?: string;
}

function getCategoryImage(category: FamilyCategory): string {
  const imageName = category.pg_img || category.pg_pic;
  if (!imageName) return '/images/categories/default.webp';
  return `/images/categories/${imageName}`;
}

export default function DatabaseFamilyProductCatalog({ className = '' }: DatabaseFamilyProductCatalogProps) {
  const [expandedFamilies, setExpandedFamilies] = useState<string[]>([]);
  const [familiesData, setFamiliesData] = useState<FamiliesResponse>({});
  const [loading, setLoading] = useState(true);
  
  // Charger les familles au montage du composant
  useEffect(() => {
    const loadFamilies = async () => {
      try {
        const data = await familiesApi.getAllFamilies();
        setFamiliesData(data);
        
        // Auto-expand les premières familles pour l'affichage
        const familyIds = Object.keys(data);
        if (familyIds.length > 0) {
          setExpandedFamilies(familyIds.slice(0, 6)); // Afficher les 6 premières familles
        }
      } catch (error) {
        console.error('Erreur chargement familles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFamilies();
  }, []);
  
  // Toggle d'expansion d'une famille
  const toggleFamily = (familyId: string) => {
    setExpandedFamilies(prev => 
      prev.includes(familyId)
        ? prev.filter(id => id !== familyId)
        : [...prev, familyId]
    );
  };

  // IDs des familles principales à afficher (toutes les familles disponibles)
  const mainFamilyIds = Object.keys(familiesData).map(Number).sort((a, b) => a - b);

  if (loading) {
    return (
      <section className={`py-8 ${className}`}>
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
            Catalogue par familles
          </h2>
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-gray-600">Chargement des familles...</span>
          </div>
        </div>
      </section>
    );
  }

  if (mainFamilyIds.length === 0) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <p className="text-gray-500">Aucune famille à afficher</p>
      </div>
    );
  }

  return (
    <section className={`py-12 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Catalogue par familles
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Découvrez nos pièces automobiles organisées par familles techniques. 
            Cliquez sur une famille pour explorer tous les produits disponibles.
          </p>
        </div>
        
        {/* Grille des familles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mainFamilyIds.map((familyId) => {
            const categories = familiesData[familyId] || [];
            const familyData = categories[0]; // Première catégorie contient les données de la famille
            const familyName = familyData?.pg_name || `Famille ${familyId}`;
            const familyDescription = familyData?.mf_description || 'Description non disponible';
            const familyIcon = familiesApi.getFamilyIcon(familyId.toString());
            const isExpanded = expandedFamilies.includes(familyId.toString());
            
            return (
              <div key={familyId} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
                {/* En-tête de famille */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-3xl bg-white/20 p-2 rounded-lg">{familyIcon}</span>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-1">{familyName}</h3>
                      <span className="bg-white/20 text-white text-sm px-3 py-1 rounded-full">
                        {categories.length} produit{categories.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  
                  {/* Description courte */}
                  <p className="text-blue-100 text-sm line-clamp-2 mb-4">
                    {familyDescription.substring(0, 120)}...
                  </p>
                  
                  <button
                    onClick={() => toggleFamily(familyId.toString())}
                    className="w-full bg-white/10 hover:bg-white/20 transition-colors duration-200 flex items-center justify-center py-3 px-4 rounded-lg border border-white/20"
                  >
                    <span className="mr-2">
                      {isExpanded ? 'Masquer les produits' : 'Voir les produits'}
                    </span>
                    <svg
                      className={`w-5 h-5 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                {/* Contenu expansible */}
                {isExpanded && (
                  <div className="p-6 bg-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {categories.map((category) => (
                        <Link
                          key={category.pg_id}
                          to={`/catalog/${category.pg_alias || category.pg_id}`}
                          className="group block bg-white rounded-lg p-4 hover:shadow-md transition-all duration-300 hover:scale-[1.02] border border-gray-200 hover:border-blue-300"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <img
                                src={getCategoryImage(category)}
                                alt={category.pg_name}
                                className="w-16 h-16 object-contain rounded-lg bg-gray-100 p-2"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/images/categories/default.webp';
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 mb-1">
                                {category.pg_name}
                              </h4>
                              {category.mf_description && (
                                <p className="text-sm text-gray-600 line-clamp-2">
                                  {category.mf_description.substring(0, 100)}...
                                </p>
                              )}
                              {category.is_featured && (
                                <Badge variant="warning">⭐ Populaire</Badge>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Statistiques */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{mainFamilyIds.length}</div>
                <div className="text-gray-600">Familles de produits</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600 mb-2">
                  {Object.values(familiesData).reduce((total, categories) => total + categories.length, 0)}
                </div>
                <div className="text-gray-600">Produits disponibles</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">100%</div>
                <div className="text-gray-600">Compatibilité véhicules</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}