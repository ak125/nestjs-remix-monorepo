// 📁 frontend/app/components/catalog/ProductCatalog.tsx
// 🎨 Catalogue moderne de pièces automobiles avec design récupéré

import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  Package, 
  Star,
  Eye,
  ShoppingCart,
  Wrench,
  Car,
  Disc,
  Settings,
  Zap
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Badge } from '@fafa/ui';

// ========================================
// 🎯 TYPES POUR LE CATALOGUE
// ========================================

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  image_url?: string;
  products_count: number;
  featured?: boolean;
  color?: string;
}

export interface Product {
  piece_id: string;
  piece_name: string;
  piece_alias?: string;
  piece_sku: string;
  piece_activ: boolean;
  piece_top: boolean;
  piece_description?: string;
  piece_price?: number;
  piece_image?: string;
  category?: string;
  brand?: string;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface ProductCatalogProps {
  categories?: ProductCategory[];
  products?: Product[];
  searchTerm?: string;
  loading?: boolean;
  onSearch?: (term: string) => void;
  onCategorySelect?: (categoryId: string) => void;
  onProductClick?: (product: Product) => void;
  viewMode?: 'grid' | 'list';
  showCategories?: boolean;
  showStats?: boolean;
}

// ========================================
// 🎨 ICÔNES DES CATÉGORIES
// ========================================

const CategoryIcons = {
  moteur: Wrench,
  freinage: Disc,
  electrique: Zap,
  suspension: Settings,
  carrosserie: Car,
  accessoires: Package,
  default: Package
};

// ========================================
// 🛒 COMPOSANT CATALOGUE PRINCIPAL
// ========================================

export function ProductCatalog({
  categories = [],
  products = [],
  searchTerm = '',
  loading = false,
  onSearch,
  onCategorySelect,
  onProductClick,
  viewMode: initialViewMode = 'grid',
  showCategories = true,
  showStats = true
}: ProductCatalogProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'popular'>('name');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [localSearch, setLocalSearch] = useState(searchTerm);

  // Tri et filtrage des produits
  const filteredProducts = products
    .filter(product => 
      !selectedCategory || product.category === selectedCategory
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.piece_name.localeCompare(b.piece_name);
        case 'price':
          return (a.piece_price || 0) - (b.piece_price || 0);
        case 'popular':
          return (b.piece_top ? 1 : 0) - (a.piece_top ? 1 : 0);
        default:
          return 0;
      }
    });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(localSearch);
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId === selectedCategory ? '' : categoryId);
    onCategorySelect?.(categoryId);
  };

  // Stats calculées
  const stats = {
    total: products.length,
    active: products.filter(p => p.piece_activ).length,
    popular: products.filter(p => p.piece_top).length,
    inStock: products.filter(p => p.stock_status === 'in_stock').length
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      {/* 📊 Header avec statistiques */}
      {showStats && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Catalogue pièces détachées</h1>
              <p className="text-gray-600 mt-1">
                {stats.total.toLocaleString()} pièces automobiles disponibles
                {searchTerm && ` • Recherche: "${searchTerm}"`}
              </p>
            </div>
          </div>

          {/* Statistiques rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <Filter className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Actifs</p>
                  <p className="text-xl font-bold text-gray-900">{stats.active}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center">
                <Star className="h-8 w-8 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Populaires</p>
                  <p className="text-xl font-bold text-gray-900">{stats.popular}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <ShoppingCart className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">En stock</p>
                  <p className="text-xl font-bold text-gray-900">{stats.inStock}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        {/* 🔍 Barre de recherche et filtres */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Recherche */}
            <div className="flex-1">
              <form onSubmit={handleSearch} className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher des pièces..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </form>
            </div>

            {/* Tri */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Nom A-Z</option>
              <option value="price">Prix croissant</option>
              <option value="popular">Popularité</option>
            </select>

            {/* Mode d'affichage */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-white shadow-sm text-blue-600' 
                    : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white shadow-sm text-blue-600' 
                    : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 📂 Catégories de pièces */}
        {showCategories && categories.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Catégories</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => {
                const IconComponent = CategoryIcons[category.slug as keyof typeof CategoryIcons] || CategoryIcons.default;
                const isSelected = selectedCategory === category.id;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <IconComponent className={`h-8 w-8 mx-auto mb-2 ${
                      isSelected ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div className="text-sm font-medium">{category.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {category.products_count} pièces
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 🛍️ Liste/Grille des produits */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des produits...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="p-6">
              {viewMode === 'grid' ? (
                /* Vue grille */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.piece_id}
                      onClick={() => onProductClick?.(product)}
                      className={`border rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer ${
                        product.piece_top 
                          ? 'border-yellow-300 bg-yellow-50' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {/* Image du produit */}
                      <div className="w-full h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                        {product.piece_image ? (
                          <img
                            src={product.piece_image}
                            alt={product.piece_name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Package className="h-16 w-16 text-gray-300" />
                        )}
                      </div>
                      
                      {/* Informations produit */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1 mr-2">
                            {product.piece_name.length > 60 
                              ? product.piece_name.substring(0, 60) + "..." 
                              : product.piece_name}
                          </h3>
                          {product.piece_top && (
                            <Badge variant="warning">TOP</Badge>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          SKU: {product.piece_sku}
                        </div>
                        
                        {product.piece_price && (
                          <div className="text-lg font-bold text-blue-600">
                            {product.piece_price.toFixed(2)} €
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <Badge className="text-xs px-2 py-1 rounded-full font-medium " variant={product.piece_activ ? 'success' : 'error'}>\n  {product.piece_activ ? 'Disponible' : 'Indisponible'}\n</Badge>
                          
                          <Button className="px-3 py-1 rounded-md text-xs" variant="blue">
                            <Eye className="h-3 w-3 inline mr-1" />
                            Voir
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Vue liste */
                <div className="divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.piece_id}
                      onClick={() => onProductClick?.(product)}
                      className={`py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        product.piece_top ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        {/* Image miniature */}
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product.piece_image ? (
                            <img
                              src={product.piece_image}
                              alt={product.piece_name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Package className="h-8 w-8 text-gray-300" />
                          )}
                        </div>
                        
                        {/* Informations principales */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {product.piece_name}
                            </h3>
                            {product.piece_top && (
                              <Badge variant="warning">TOP</Badge>
                            )}
                          </div>
                          
                          <div className="mt-1 text-sm text-gray-500">
                            SKU: {product.piece_sku}
                          </div>
                        </div>
                        
                        {/* Prix */}
                        {product.piece_price && (
                          <div className="text-lg font-bold text-blue-600">
                            {product.piece_price.toFixed(2)} €
                          </div>
                        )}
                        
                        {/* Status et actions */}
                        <div className="flex items-center space-x-4">
                          <Badge className="text-xs px-2 py-1 rounded-full font-medium " variant={product.piece_activ ? 'success' : 'error'}>\n  {product.piece_activ ? 'Disponible' : 'Indisponible'}\n</Badge>
                          
                          <Button className="px-4 py-2 rounded-md text-sm" variant="blue">
                            <Eye className="h-4 w-4 inline mr-2" />
                            Voir détails
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || selectedCategory ? "Aucun produit trouvé" : "Catalogue vide"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm 
                  ? `Aucun produit ne correspond à "${searchTerm}"`
                  : selectedCategory
                  ? "Aucun produit dans cette catégorie"
                  : "Il n'y a actuellement aucun produit dans le catalogue."}
              </p>
              {(searchTerm || selectedCategory) && (
                <button 
                  onClick={() => {
                    setLocalSearch('');
                    setSelectedCategory('');
                    onSearch?.('');
                  }}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Effacer les filtres
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// 🎯 EXPORT PAR DÉFAUT
// ========================================

export default ProductCatalog;