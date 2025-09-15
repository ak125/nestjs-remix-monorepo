// 📁 frontend/app/components/home/ProductCatalog.tsx
// 📂 Catalogue produits par catégories - Version améliorée avec lazy loading

import { Link } from '@remix-run/react';
import { Package, ChevronRight, Wrench, Car, Zap, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';

// 🔧 Interface adaptée aux vraies données pieces_gamme
interface ProductCategory {
  pg_id: string | number;
  pg_name: string;
  pg_alias?: string;
  pg_pic?: string;
  pg_img?: string;
  is_featured?: boolean;
  is_displayed?: boolean;
  products_count?: number;
  // Rétrocompatibilité avec ancienne interface
  gamme_id?: number;
  gamme_name?: string;
  gamme_alias?: string;
  gamme_description?: string;
  gamme_image?: string;
}

// 🔧 Helper functions pour la compatibilité
function getCategoryName(category: ProductCategory): string {
  return category.pg_name || category.gamme_name || '';
}

function getCategoryId(category: ProductCategory): string | number {
  return category.pg_id || category.gamme_id || '';
}

function getCategoryAlias(category: ProductCategory): string {
  return category.pg_alias || category.gamme_alias || getCategoryId(category).toString();
}

function getCategoryImage(category: ProductCategory): string | undefined {
  return category.pg_pic || category.pg_img || category.gamme_image;
}

function getCategoryDescription(category: ProductCategory): string | undefined {
  return category.gamme_description; // Pas encore dans l'API pieces_gamme
}

interface ProductCatalogProps {
  categories: ProductCategory[];
  featuredCategories?: ProductCategory[]; // 🆕 Catégories featured séparées
  showDescription?: boolean;
  maxCategories?: number;
  showFeaturedSection?: boolean; // 🆕 Option pour section featured séparée
}

export function ProductCatalog({ 
  categories, 
  featuredCategories: propFeaturedCategories = [], // 🆕 Catégories featured passées en props
  showDescription = true, 
  maxCategories = 12,
  showFeaturedSection = true // 🆕 Inspiré du CatalogGrid
}: ProductCatalogProps) {
  const [showAll, setShowAll] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set()); // 🆕 Tracking images

  // 🎯 Lazy loading des images inspiré du CatalogGrid proposé
  useEffect(() => {
    const imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src && !loadedImages.has(src)) {
              img.src = src;
              img.classList.add('loaded');
              setLoadedImages(prev => new Set(prev).add(src));
              imageObserver.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px 0px', // Commence à charger 50px avant que l'image soit visible
        threshold: 0.1
      }
    );

    // Observer toutes les images lazy
    const lazyImages = document.querySelectorAll('.lazy-catalog-image[data-src]');
    lazyImages.forEach(img => imageObserver.observe(img));

    return () => {
      lazyImages.forEach(img => imageObserver.unobserve(img));
    };
  }, [categories, loadedImages]);

  // 🆕 Séparation featured/regular inspirée du CatalogGrid avec données externes  
  const featuredCategories = showFeaturedSection 
    ? (propFeaturedCategories.length > 0 ? propFeaturedCategories : categories.filter(cat => cat.is_featured))
    : [];
  const regularCategories = showFeaturedSection
    ? categories.filter(cat => !cat.is_featured)
    : categories;
  
  // Icônes par catégorie (mapping basé sur les noms communs)
  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    
    if (name.includes('moteur') || name.includes('engine')) return Wrench;
    if (name.includes('frein') || name.includes('brake')) return Shield;
    if (name.includes('electr') || name.includes('electric')) return Zap;
    if (name.includes('carross') || name.includes('body')) return Car;
    
    return Package; // Icône par défaut
  };

  // Couleurs par catégorie
  const getCategoryColor = (index: number) => {
    const colors = [
      'from-red-500 to-red-600',
      'from-blue-500 to-blue-600', 
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-orange-500 to-orange-600',
      'from-indigo-500 to-indigo-600',
      'from-pink-500 to-pink-600',
      'from-teal-500 to-teal-600',
      'from-yellow-500 to-yellow-600',
      'from-gray-500 to-gray-600',
      'from-cyan-500 to-cyan-600',
      'from-emerald-500 to-emerald-600',
    ];
    return colors[index % colors.length];
  };

  // 🎨 Placeholder SVG moderne pour lazy loading
  const getImagePlaceholder = () => {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120' viewBox='0 0 200 120'%3E%3Crect width='200' height='120' fill='%23f3f4f6'/%3E%3Cpath d='M60 40h80v8H60zM60 60h60v6H60zM60 80h40v4H60z' fill='%23d1d5db'/%3E%3C/svg%3E";
  };

  // 🎯 Données à afficher selon la logique featured/regular
  const displayCategories = showFeaturedSection ? regularCategories : categories;
  const categoriesToShow = showAll 
    ? displayCategories 
    : displayCategories.slice(0, maxCategories);

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucune catégorie de produits disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 🎯 En-tête */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          Catalogue par catégories
        </h3>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Explorez notre vaste sélection de pièces automobiles organisées par spécialités. 
          Trouvez rapidement ce dont vous avez besoin pour votre véhicule.
        </p>
      </div>

      {/* ⭐ Section Catégories Featured (inspirée du CatalogGrid) */}
      {showFeaturedSection && featuredCategories.length > 0 && (
        <div className="mb-12">
          <h4 className="text-xl font-semibold text-gray-800 mb-6 text-center">
            🌟 Catégories populaires
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {featuredCategories.slice(0, 8).map((category, index) => {
              const IconComponent = getCategoryIcon(getCategoryName(category));
              const colorClass = getCategoryColor(index);
              
              return (
                <Link
                  key={`featured-${getCategoryId(category)}`}
                  to={`/pieces/categories/${getCategoryAlias(category)}`}
                  className="group"
                >
                  <div className="bg-white rounded-xl p-4 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-2 border-orange-200 hover:border-orange-300">
                    {/* Image avec lazy loading si disponible */}
                    {getCategoryImage(category) ? (
                      <img
                        data-src={getCategoryImage(category)}
                        src={getImagePlaceholder()}
                        alt={getCategoryName(category)}
                        className="lazy-catalog-image w-16 h-16 mx-auto mb-3 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-16 h-16 mx-auto mb-3 bg-gradient-to-br ${colorClass} rounded-lg flex items-center justify-center shadow-md`}>
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                    )}
                    
                    <h5 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-orange-600 transition-colors">
                      {getCategoryName(category)}
                    </h5>
                    
                    {((category as any).products_count || (category as any).gamme_count || (category as any).pg_count) && (
                      <div className="bg-orange-100 text-orange-700 text-xs py-1 px-2 rounded-full inline-block">
                        {((category as any).products_count || (category as any).gamme_count || (category as any).pg_count || 0).toLocaleString()}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 📂 Grille des catégories principales */}
      <div>
        <h4 className="text-xl font-semibold text-gray-800 mb-6 text-center">
          📂 {showFeaturedSection ? 'Toutes les catégories' : 'Catalogue complet'}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categoriesToShow.map((category, index) => {
            const IconComponent = getCategoryIcon(getCategoryName(category));
            const colorClass = getCategoryColor(index);
            
            return (
              <Link
                key={getCategoryId(category)}
                to={`/pieces/categories/${getCategoryAlias(category)}`}
                className="group"
              >
                <div className="bg-white rounded-2xl p-6 text-center hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-transparent">
                  {/* 🎨 Image avec lazy loading ou icône avec gradient */}
                  {getCategoryImage(category) ? (
                    <img
                      data-src={getCategoryImage(category)}
                      src={getImagePlaceholder()}
                      alt={getCategoryName(category)}
                      className="lazy-catalog-image w-20 h-20 mx-auto mb-4 rounded-2xl object-cover shadow-lg"
                      loading="lazy"
                    />
                  ) : (
                    <div className={`w-20 h-20 mx-auto mb-4 bg-gradient-to-br ${colorClass} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <IconComponent className="w-10 h-10 text-white" />
                    </div>
                  )}
                  
                  {/* 📝 Nom de la catégorie */}
                  <h4 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-blue-600 transition-colors">
                    {getCategoryName(category)}
                  </h4>
                  
                  {/* 📊 Nombre de produits */}
                  <div className="text-sm text-gray-600">{(category as any).products_count || (category as any).gamme_count || (category as any).pg_count || 0}</div>
                  
                  {/* ⭐ Badge catégorie premium */}
                  {category.is_featured && !showFeaturedSection && (
                    <div className="bg-gradient-to-r from-orange-400 to-orange-500 text-white text-xs py-1 px-2 rounded-full inline-block">
                      ⭐ Premium
                    </div>
                  )}
                  
                  {/* 📄 Description */}
                  {showDescription && getCategoryDescription(category) && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {getCategoryDescription(category)}
                    </p>
                  )}
                  
                  {/* 🔗 Lien d'action */}
                  <div className="flex items-center justify-center text-blue-600 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span>Explorer</span>
                    <ChevronRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 📈 Statistiques rapides */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {categories.length}
            </div>
            <div className="text-gray-600 text-sm">Catégories</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {categories.reduce((total, cat) => total + (cat.products_count || 0), 0).toLocaleString()}
            </div>
            <div className="text-gray-600 text-sm">Produits total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {categories.filter(cat => cat.is_featured).length}
            </div>
            <div className="text-gray-600 text-sm">Populaires</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {Math.round(categories.reduce((total, cat) => total + (cat.products_count || 0), 0) / categories.length || 0).toLocaleString()}
            </div>
            <div className="text-gray-600 text-sm">Moy. par catégorie</div>
          </div>
        </div>
      </div>

      {/* 🔄 Bouton voir plus/moins */}
      {displayCategories.length > maxCategories && (
        <div className="text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-8 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300"
          >
            {showAll ? (
              <>
                Voir moins de catégories
                <ChevronRight className="w-5 h-5 ml-2 rotate-90" />
              </>
            ) : (
              <>
                Voir toutes les catégories ({displayCategories.length - maxCategories} de plus)
                <ChevronRight className="w-5 h-5 ml-2 -rotate-90" />
              </>
            )}
          </button>
        </div>
      )}

      {/* 🎯 Call-to-action complémentaire */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-2xl p-8 text-white text-center">
        <h4 className="text-2xl font-bold mb-4">Besoin d'aide pour choisir ?</h4>
        <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
          Nos experts techniques sont là pour vous accompagner dans le choix 
          de vos pièces automobiles. Conseil gratuit et personnalisé.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/contact"
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Contacter un expert
          </Link>
          <Link
            to="/catalogue"
            className="border-2 border-white text-white hover:bg-white hover:text-blue-600 font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Voir tout le catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}