/**
 * 🗂️ COMPOSANT PRINCIPAL PAGE CATÉGORIE
 *
 * Page catégorie dynamique avec toutes les fonctionnalités intégrées
 */

import { Link } from '@remix-run/react';
import { Package, Car, Info, Wrench, TrendingUp, Users } from 'lucide-react';
import { VehicleSelector } from '../ui/VehicleSelector';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import type {
  CategoryPageData,
  CategoryProductSample,
  CategoryRelated,
  CategoryTechnicalInfo,
} from '../../types/category.types';

interface CategoryPageProps {
  categoryData: CategoryPageData;
  isLoading?: boolean;
  error?: string;
}

export function CategoryPage({
  categoryData,
  isLoading = false,
  error,
}: CategoryPageProps) {
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Erreur de chargement
          </h1>
          <p className="text-gray-600">{error}</p>
          <Link
            to="/pieces"
            className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Retour aux catégories
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded mb-4 w-1/3"></div>
          <div className="h-6 bg-gray-300 rounded mb-8 w-2/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { category, breadcrumbs, vehicleSelector, productsSample, relatedCategories, technicalInfo, stats } = categoryData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec breadcrumbs */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Section principale */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Contenu principal */}
          <div className="lg:col-span-3">
            {/* Header de la catégorie */}
            <CategoryHeader category={category} stats={stats} />

            {/* Sélecteur de véhicule */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Car className="w-5 h-5 mr-2" />
                Sélectionnez votre véhicule
              </h2>
              <VehicleSelector
                brands={vehicleSelector.brands}
                searchByTypemine={vehicleSelector.searchByTypemine}
                categorySlug={category.slug}
                className="w-full"
              />
              <p className="text-sm text-gray-600 mt-2">
                Sélectionnez votre véhicule pour voir les pièces compatibles
              </p>
            </div>

            {/* Échantillon de produits */}
            <ProductsSampleSection products={productsSample} category={category} />

            {/* Informations techniques */}
            <TechnicalInfoSection technicalInfo={technicalInfo} categoryName={category.name} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Statistiques */}
            <CategoryStatsCard stats={stats} />

            {/* Catégories liées */}
            <RelatedCategoriesCard relatedCategories={relatedCategories} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// 🧩 COMPOSANTS SECONDAIRES
// ========================================

function CategoryHeader({ category, stats }: { category: CategoryPageData['category'], stats: CategoryPageData['stats'] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-lg text-gray-600 mb-4 leading-relaxed">
              {category.description}
            </p>
          )}
          {category.shortDescription && (
            <p className="text-sm text-blue-600 font-medium">
              {category.shortDescription}
            </p>
          )}
        </div>
        {category.image && (
          <div className="ml-6">
            <img
              src={category.image}
              alt={category.name}
              className="w-24 h-24 object-cover rounded-lg"
            />
          </div>
        )}
      </div>
      
      {/* Statistiques rapides */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center text-sm text-gray-600">
          <Package className="w-4 h-4 mr-1" />
          {stats.totalProducts} produits
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Users className="w-4 h-4 mr-1" />
          {stats.totalBrands} marques
        </div>
        {stats.averagePrice && (
          <div className="flex items-center text-sm text-gray-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            Moy. {stats.averagePrice.toFixed(2)}€
          </div>
        )}
      </div>
    </div>
  );
}

function ProductsSampleSection({ products, category }: { products: CategoryProductSample[], category: CategoryPageData['category'] }) {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Produits de la catégorie</h2>
        <p className="text-gray-600">Aucun produit disponible pour cette catégorie.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center">
          <Package className="w-5 h-5 mr-2" />
          Produits {category.name}
        </h2>
        <Link
          to={`/pieces/${category.slug}/products`}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Voir tous les produits →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: CategoryProductSample }) {
  return (
    <Link
      to={`/pieces/product/${product.id}`}
      className="block bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
    >
      <div className="aspect-square bg-white rounded-lg mb-3 flex items-center justify-center">
        {product.hasImage ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <Package className="w-8 h-8 text-gray-400" />
        )}
      </div>
      
      <h3 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">
        {product.name}
      </h3>
      
      <p className="text-xs text-gray-600 mb-2">
        Réf: {product.reference}
      </p>
      
      {product.brand && (
        <p className="text-xs text-blue-600 font-medium mb-2">
          {product.brand}
        </p>
      )}
      
      {product.price && (
        <p className="text-sm font-bold text-green-600">
          {product.price.toFixed(2)}€
        </p>
      )}
    </Link>
  );
}

function TechnicalInfoSection({ technicalInfo, categoryName }: { technicalInfo: CategoryTechnicalInfo[], categoryName: string }) {
  if (technicalInfo.length === 0) return null;

  const mainInfo = technicalInfo.filter(info => info.isMainInfo).sort((a, b) => a.order - b.order);
  const additionalInfo = technicalInfo.filter(info => !info.isMainInfo).sort((a, b) => a.order - b.order);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <h2 className="text-xl font-bold mb-6 flex items-center">
        <Info className="w-5 h-5 mr-2" />
        Informations techniques - {categoryName}
      </h2>

      {/* Informations principales */}
      {mainInfo.length > 0 && (
        <div className="space-y-6 mb-8">
          {mainInfo.map((info) => (
            <div key={info.id}>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {info.title}
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {info.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Informations supplémentaires */}
      {additionalInfo.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Informations complémentaires
          </h3>
          <div className="space-y-4">
            {additionalInfo.map((info) => (
              <div key={info.id}>
                <h4 className="font-medium text-gray-900 mb-1">
                  {info.title}
                </h4>
                <p className="text-sm text-gray-700">
                  {info.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryStatsCard({ stats }: { stats: CategoryPageData['stats'] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="text-lg font-bold mb-4">Statistiques</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Produits disponibles</span>
          <span className="font-bold text-blue-600">{stats.totalProducts}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Marques référencées</span>
          <span className="font-bold text-green-600">{stats.totalBrands}</span>
        </div>
        {stats.averagePrice && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Prix moyen</span>
            <span className="font-bold text-orange-600">
              {stats.averagePrice.toFixed(2)}€
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedCategoriesCard({ relatedCategories }: { relatedCategories: CategoryRelated[] }) {
  if (relatedCategories.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-bold mb-4 flex items-center">
        <Wrench className="w-5 h-5 mr-2" />
        Catégories liées
      </h3>
      <div className="space-y-3">
        {relatedCategories.map((category) => (
          <Link
            key={category.id}
            to={`/pieces/${category.slug}`}
            className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              {category.image && (
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-10 h-10 object-cover rounded mr-3"
                />
              )}
              <div className="flex-1">
                <h4 className="font-medium text-sm text-gray-900">
                  {category.name}
                </h4>
                {category.productsCount && (
                  <p className="text-xs text-gray-600">
                    {category.productsCount} produits
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}