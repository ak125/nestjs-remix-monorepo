// 📁 frontend/app/components/home/CatalogGrid.tsx
// 🎨 Catalogue moderne avec design précédent optimisé

import { Link } from '@remix-run/react';
import { Package, ChevronRight, Wrench, Car, Zap, Shield, Grid, Star, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';

// 🔧 Interface unifiée supportant toutes les sources de données
interface CatalogItem {
  // Format pieces_gamme (nouveau)
  pg_id?: string | number;
  pg_name?: string;
  pg_alias?: string;
  pg_pic?: string;
  pg_img?: string;
  pg_count?: number;
  
  // Format gamme (ancien)
  gamme_id?: number;
  gamme_name?: string;
  gamme_alias?: string;
  gamme_image?: string;
  gamme_count?: number;
  
  // Format famille (backup)
  mf_id?: number;
  mf_name?: string;
  mf_pic?: string;
  
  // Propriétés communes
  id?: string | number;
  name?: string;
  alias?: string;
  image?: string;
  image_url?: string;
  products_count?: number;
  is_featured?: boolean;
  is_displayed?: boolean;
  description?: string;
}

interface CatalogGridProps {
  items: CatalogItem[];
  title?: string;
  subtitle?: string;
  maxItems?: number;
  showStats?: boolean;
  showFeaturedSection?: boolean;
  viewMode?: 'modern' | 'classic' | 'compact';
  className?: string;
}

// 🔧 Helpers pour la compatibilité entre formats
function getItemId(item: CatalogItem): string | number {
  return item.id || item.pg_id || item.gamme_id || item.mf_id || '';
}

function getItemName(item: CatalogItem): string {
  return item.name || item.pg_name || item.gamme_name || item.mf_name || '';
}

function getItemAlias(item: CatalogItem): string {
  return item.alias || item.pg_alias || item.gamme_alias || getItemId(item).toString();
}

function getItemImage(item: CatalogItem): string | undefined {
  // Priorité aux nouvelles images
  if (item.image || item.image_url) return item.image || item.image_url;
  if (item.pg_pic) return `/upload/articles/pieces-gammes/${item.pg_pic}`;
  if (item.pg_img) return `/upload/articles/pieces-gammes/${item.pg_img}`;
  if (item.gamme_image) return `/upload/articles/gammes/${item.gamme_image}`;
  if (item.mf_pic) return `/upload/articles/familles-produits/${item.mf_pic}`;
  return undefined;
}

function getItemCount(item: CatalogItem): number {
  return item.products_count || item.pg_count || item.gamme_count || 0;
}

function getItemUrl(item: CatalogItem): string {
  const alias = getItemAlias(item);
  const id = getItemId(item);
  
  // Format moderne pour les nouvelles URLs
  if (item.pg_id || item.pg_name) {
    return `/pieces/categories/${alias}`;
  }
  
  // Format classique pour la compatibilité
  if (item.gamme_id) {
    return `/pieces/${alias}-${id}.html`;
  }
  
  // Format famille
  if (item.mf_id) {
    return `/products/catalog?family=${id}`;
  }
  
  return `/pieces/categories/${alias}`;
}

export function CatalogGrid({
  items,
  title = "Catalogue pièces détachées",
  subtitle = "Découvrez notre sélection organisée par catégories",
  maxItems = 12,
  showStats = true,
  showFeaturedSection = true,
  viewMode = 'modern',
  className = ""
}: CatalogGridProps) {
  const [showAll, setShowAll] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // 🎨 Lazy loading des images - Performance optimisée
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
      { rootMargin: '50px 0px', threshold: 0.1 }
    );

    const lazyImages = document.querySelectorAll('.lazy-catalog-image[data-src]');
    lazyImages.forEach(img => imageObserver.observe(img));

    return () => {
      lazyImages.forEach(img => imageObserver.unobserve(img));
    };
  }, [items, loadedImages]);

  // 🔄 Séparation featured/regular
  const featuredItems = showFeaturedSection 
    ? items.filter(item => item.is_featured)
    : [];
  const regularItems = showFeaturedSection
    ? items.filter(item => !item.is_featured)
    : items;
  
  const displayItems = showAll ? regularItems : regularItems.slice(0, maxItems);

  // 🎨 Icônes intelligentes par catégorie
  const getCategoryIcon = (itemName: string) => {
    const name = itemName.toLowerCase();
    
    if (name.includes('moteur') || name.includes('engine')) return Wrench;
    if (name.includes('frein') || name.includes('brake')) return Shield;
    if (name.includes('electr') || name.includes('electric')) return Zap;
    if (name.includes('carross') || name.includes('body')) return Car;
    if (name.includes('filtr') || name.includes('filter')) return Package;
    
    return Grid; // Icône par défaut
  };

  // 🌈 Couleurs gradient par index
  const getGradientClass = (index: number) => {
    const gradients = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600', 
      'from-purple-500 to-purple-600',
      'from-red-500 to-red-600',
      'from-orange-500 to-orange-600',
      'from-indigo-500 to-indigo-600',
      'from-pink-500 to-pink-600',
      'from-teal-500 to-teal-600',
      'from-yellow-500 to-yellow-600',
      'from-cyan-500 to-cyan-600',
    ];
    return gradients[index % gradients.length];
  };

  // 🎯 Placeholder SVG moderne
  const placeholderSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120' viewBox='0 0 200 120'%3E%3Crect width='200' height='120' fill='%23f8fafc'/%3E%3Cpath d='M60 40h80v8H60zM60 60h60v6H60zM60 80h40v4H60z' fill='%23e2e8f0'/%3E%3C/svg%3E";

  if (items.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucune catégorie disponible</p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* 🎯 En-tête élégant */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
        <div className="mt-4 h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded-full"></div>
      </div>

      {/* ⭐ Section Featured - Design Premium */}
      {showFeaturedSection && featuredItems.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-center mb-6">
            <Star className="w-6 h-6 text-yellow-500 mr-2" />
            <h3 className="text-xl font-semibold text-gray-800">Catégories populaires</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredItems.slice(0, 8).map((item, index) => {
              const IconComponent = getCategoryIcon(getItemName(item));
              const gradientClass = getGradientClass(index);
              const itemImage = getItemImage(item);
              
              return (
                <Link
                  key={`featured-${getItemId(item)}`}
                  to={getItemUrl(item)}
                  className="group transform hover:scale-105 transition-all duration-300"
                >
                  <div className="bg-white rounded-xl p-4 text-center shadow-md hover:shadow-xl border-2 border-yellow-200 hover:border-yellow-300">
                    {/* Image ou icône */}
                    {itemImage ? (
                      <img
                        data-src={itemImage}
                        src={placeholderSvg}
                        alt={getItemName(item)}
                        className="lazy-catalog-image w-16 h-16 mx-auto mb-3 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-16 h-16 mx-auto mb-3 bg-gradient-to-br ${gradientClass} rounded-lg flex items-center justify-center`}>
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                    )}
                    
                    <h4 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-yellow-600 transition-colors">
                      {getItemName(item)}
                    </h4>
                    
                    {getItemCount(item) > 0 && (
                      <div className="bg-yellow-100 text-yellow-700 text-xs py-1 px-2 rounded-full inline-block">
                        {getItemCount(item).toLocaleString()}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 📂 Grille principale - Design adaptatif selon viewMode */}
      <div>
        <div className="flex items-center justify-center mb-6">
          <Grid className="w-5 h-5 text-gray-600 mr-2" />
          <h3 className="text-xl font-semibold text-gray-800">
            {showFeaturedSection ? 'Toutes les catégories' : 'Catalogue complet'}
          </h3>
        </div>

        {viewMode === 'modern' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {displayItems.map((item, index) => {
              const IconComponent = getCategoryIcon(getItemName(item));
              const gradientClass = getGradientClass(index);
              const itemImage = getItemImage(item);
              
              return (
                <Link
                  key={getItemId(item)}
                  to={getItemUrl(item)}
                  className="group"
                >
                  <div className="bg-white rounded-2xl p-6 text-center hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-blue-200">
                    {/* Image ou icône gradient */}
                    {itemImage ? (
                      <img
                        data-src={itemImage}
                        src={placeholderSvg}
                        alt={getItemName(item)}
                        className="lazy-catalog-image w-20 h-20 mx-auto mb-4 rounded-2xl object-cover shadow-lg"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-20 h-20 mx-auto mb-4 bg-gradient-to-br ${gradientClass} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg`}>
                        <IconComponent className="w-10 h-10 text-white" />
                      </div>
                    )}
                    
                    <h4 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-blue-600 transition-colors">
                      {getItemName(item)}
                    </h4>
                    
                    {getItemCount(item) > 0 && (
                      <div className="text-sm text-gray-600 mb-2">
                        {getItemCount(item).toLocaleString()} produits
                      </div>
                    )}
                    
                    {item.description && (
                      <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-center text-blue-600 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Explorer</span>
                      <ChevronRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {viewMode === 'classic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayItems.map((item) => {
              const itemImage = getItemImage(item);
              
              return (
                <div key={getItemId(item)} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  {itemImage && (
                    <div className="aspect-video bg-gray-100">
                      <img
                        data-src={itemImage}
                        src={placeholderSvg}
                        alt={getItemName(item)}
                        className="lazy-catalog-image w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  
                  <div className="p-4 text-center">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">
                      {getItemName(item)}
                    </h3>
                    
                    {getItemCount(item) > 0 && (
                      <div className="text-sm text-blue-600 mb-3">
                        {getItemCount(item).toLocaleString()} produits disponibles
                      </div>
                    )}
                    
                    <Link
                      to={getItemUrl(item)}
                      className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Voir les produits
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'compact' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {displayItems.map((item, index) => {
              const IconComponent = getCategoryIcon(getItemName(item));
              const gradientClass = getGradientClass(index);
              
              return (
                <Link
                  key={getItemId(item)}
                  to={getItemUrl(item)}
                  className="group"
                >
                  <div className="bg-white rounded-lg p-3 text-center hover:shadow-md transition-shadow border border-gray-100">
                    <div className={`w-12 h-12 mx-auto mb-2 bg-gradient-to-br ${gradientClass} rounded-lg flex items-center justify-center`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    
                    <h4 className="font-semibold text-gray-900 text-xs group-hover:text-blue-600 transition-colors">
                      {getItemName(item)}
                    </h4>
                    
                    {getItemCount(item) > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {getItemCount(item)}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 📊 Statistiques si activées */}
      {showStats && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {items.length}
              </div>
              <div className="text-gray-600 text-sm">Catégories</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {items.reduce((total, item) => total + getItemCount(item), 0).toLocaleString()}
              </div>
              <div className="text-gray-600 text-sm">Produits total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {featuredItems.length}
              </div>
              <div className="text-gray-600 text-sm">Populaires</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {Math.round(items.reduce((total, item) => total + getItemCount(item), 0) / items.length || 0)}
              </div>
              <div className="text-gray-600 text-sm">Moy. par catégorie</div>
            </div>
          </div>
        </div>
      )}

      {/* 🔄 Bouton Voir plus/moins */}
      {regularItems.length > maxItems && (
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
                Voir toutes les catégories ({regularItems.length - maxItems} de plus)
                <ChevronRight className="w-5 h-5 ml-2 -rotate-90" />
              </>
            )}
          </button>
        </div>
      )}

      {/* 🎯 Call-to-action final */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-2xl p-8 text-white text-center">
        <div className="flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 mr-3" />
          <h4 className="text-2xl font-bold">Besoin d'aide pour choisir ?</h4>
        </div>
        <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
          Nos experts techniques vous accompagnent dans le choix de vos pièces automobiles. 
          Conseil gratuit et personnalisé.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/contact"
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Contacter un expert
          </Link>
          <Link
            to="/products/catalog"
            className="border-2 border-white text-white hover:bg-white hover:text-blue-600 font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Voir tout le catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}