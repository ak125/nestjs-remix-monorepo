/**
 * 🗂️ INTERFACES TYPESCRIPT POUR LES PAGES CATÉGORIES
 *
 * Types partagés entre le frontend et l'API pour les données des catégories
 */

// ========================================
// 📋 INTERFACES DE BASE
// ========================================

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  image?: string;
  seoTitle?: string;
  seoDescription?: string;
  productsCount?: number;
}

export interface CategoryBreadcrumb {
  name: string;
  url: string;
}

export interface CategoryVehicleSelector {
  brands: CategoryBrand[];
  searchByTypemine: boolean;
}

export interface CategoryBrand {
  id: string;
  name: string;
  logo?: string;
}

export interface CategoryProductSample {
  id: string;
  reference: string;
  name: string;
  brand?: string;
  price?: number;
  image?: string;
  hasImage: boolean;
}

export interface CategoryRelated {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productsCount?: number;
  image?: string;
}

export interface CategoryTechnicalInfo {
  id: string;
  title: string;
  content: string;
  order: number;
  isMainInfo: boolean;
}

export interface CategoryStats {
  totalProducts: number;
  totalBrands: number;
  averagePrice?: number;
}

// ========================================
// 📦 INTERFACE PRINCIPALE
// ========================================

export interface CategoryPageData {
  category: CategoryInfo;
  breadcrumbs: CategoryBreadcrumb[];
  vehicleSelector: CategoryVehicleSelector;
  productsSample: CategoryProductSample[];
  relatedCategories: CategoryRelated[];
  technicalInfo: CategoryTechnicalInfo[];
  stats: CategoryStats;
}

// ========================================
// 🌐 INTERFACES API RESPONSES
// ========================================

export interface CategoryApiResponse<T = CategoryPageData> {
  success: boolean;
  data: T;
  message: string;
  meta?: {
    timestamp: string;
    slug: string;
    categoryId: string;
    productsCount: number;
  };
}

export interface CategoryProductsResponse {
  success: boolean;
  data: {
    products: CategoryProductSample[];
    category: {
      id: string;
      name: string;
      slug: string;
    };
    pagination: {
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };
  };
  message: string;
}

export interface CategoryInfoResponse {
  success: boolean;
  data: {
    category: CategoryInfo;
    stats: CategoryStats;
  };
  message: string;
}

// ========================================
// 🛠️ TYPES UTILITAIRES
// ========================================

// Type pour les props du composant principal de page catégorie
export interface CategoryPageProps {
  categoryData: CategoryPageData;
  isLoading?: boolean;
  error?: string;
}

// Type pour la navigation des catégories
export interface CategoryNavigation {
  current: CategoryInfo;
  breadcrumbs: CategoryBreadcrumb[];
  related: CategoryRelated[];
}

// Type pour les filtres de produits de catégorie
export interface CategoryProductFilters {
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  search?: string;
}

// Type pour la pagination des produits
export interface CategoryProductPagination {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ========================================
// 🎨 INTERFACES UI SPÉCIFIQUES
// ========================================

// Props pour le composant de header de catégorie
export interface CategoryHeaderProps {
  category: CategoryInfo;
  breadcrumbs: CategoryBreadcrumb[];
  stats: CategoryStats;
}

// Props pour le composant de sélecteur de véhicule
export interface CategoryVehicleSelectorProps {
  vehicleSelector: CategoryVehicleSelector;
  categorySlug: string;
  onBrandSelect?: (brandId: string | null) => void;
  selectedBrand?: string | null;
}

// Props pour la grille de produits de catégorie
export interface CategoryProductGridProps {
  products: CategoryProductSample[];
  isLoading?: boolean;
  pagination?: CategoryProductPagination;
  onPageChange?: (page: number) => void;
}

// Props pour les catégories liées
export interface CategoryRelatedProps {
  relatedCategories: CategoryRelated[];
  currentCategoryId: string;
}

// Props pour les informations techniques
export interface CategoryTechnicalInfoProps {
  technicalInfo: CategoryTechnicalInfo[];
  categoryName: string;
}

// ========================================
// 🔍 TYPES DE RECHERCHE ET FILTRAGE
// ========================================

export interface CategorySearchParams {
  q?: string; // Terme de recherche
  brand?: string; // Filtre par marque
  priceMin?: number;
  priceMax?: number;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'price' | 'brand' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface CategorySearchResult {
  products: CategoryProductSample[];
  filters: {
    brands: CategoryBrand[];
    priceRange: {
      min: number;
      max: number;
    };
  };
  pagination: CategoryProductPagination;
  searchMeta: {
    query: string;
    totalResults: number;
    searchTime: number;
  };
}

// ========================================
// 📱 TYPES POUR LE SEO ET MÉTADONNÉES
// ========================================

export interface CategorySeoData {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  ogImage?: string;
  structuredData: {
    '@type': 'ProductCategory';
    name: string;
    description: string;
    url: string;
    image?: string;
    numberOfItems: number;
  };
}

// ========================================
// 🚀 TYPES POUR L'OPTIMISATION
// ========================================

// Interface pour le cache des données de catégorie
export interface CategoryCacheEntry {
  data: CategoryPageData;
  timestamp: number;
  ttl: number; // Time to live en secondes
  slug: string;
}

// Interface pour les métriques de performance
export interface CategoryPerformanceMetrics {
  loadTime: number;
  apiResponseTime: number;
  renderTime: number;
  cacheHit: boolean;
  dataSize: number;
}

export default CategoryPageData;