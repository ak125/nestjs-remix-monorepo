import { Link } from "@remix-run/react";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Badge } from "~/components/ui/badge";
import { ResponsiveImage } from "~/components/ui/ResponsiveImage";
import { type VehicleData } from "~/types/vehicle.types";
import { logger } from "~/utils/logger";

// ========================================
// 🎯 TYPES TYPESCRIPT STRICTS
// ========================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  subcategories: Subcategory[];
  description?: string;
  featured?: boolean;
  sort_order?: number;
}

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parts_count?: number;
  featured?: boolean;
}

export interface CategoryGridProps {
  categories: Category[];
  vehicle: VehicleData;
  loading?: boolean;
  onCategoryClick?: (category: Category, subcategory?: Subcategory) => void;
  onImageLoad?: (categoryId: string) => void;
  onImageError?: (categoryId: string, error: Error) => void;
  maxColumns?: 2 | 3 | 4 | 6;
  showSubcategories?: boolean;
  showPartsCount?: boolean;
}

// ========================================
// 🎨 COMPOSANT CATEGORY CARD
// ========================================

interface CategoryCardProps {
  category: Category;
  vehicle: VehicleData;
  showSubcategories: boolean;
  showPartsCount: boolean;
  onCategoryClick?: (category: Category, subcategory?: Subcategory) => void;
  onImageLoad?: () => void;
  onImageError?: (error: Error) => void;
}

const CategoryCard = memo(function CategoryCard({
  category,
  vehicle,
  showSubcategories,
  showPartsCount,
  onCategoryClick,
  onImageLoad: _onImageLoad,
  onImageError,
}: CategoryCardProps) {
  const buildPartUrl = useCallback(
    (subcategory: Subcategory): string => {
      if (!vehicle.brand || !vehicle.model) {
        logger.warn("Vehicle data incomplete for URL building");
        return "#";
      }

      const brandSlug = vehicle.brand.toLowerCase().replace(/\s+/g, "-");
      const modelSlug = vehicle.model.toLowerCase().replace(/\s+/g, "-");
      const typeSlug = vehicle.type.toLowerCase().replace(/\s+/g, "-");

      return `/pieces/${subcategory.slug}/${brandSlug}-${vehicle.brandId}/${modelSlug}-${vehicle.modelId}/${typeSlug}-${vehicle.typeId}.html`;
    },
    [vehicle],
  );

  const handleSubcategoryClick = useCallback(
    (subcategory: Subcategory) => {
      onCategoryClick?.(category, subcategory);
    },
    [category, onCategoryClick],
  );

  const totalPartsCount = useMemo(() => {
    return category.subcategories.reduce(
      (total, sub) => total + (sub.parts_count || 0),
      0,
    );
  }, [category.subcategories]);

  return (
    <div className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Image avec aspect ratio fixe */}
      <div className="aspect-[4/3] bg-gray-100">
        <ResponsiveImage
          src={category.image_url}
          alt={`Pièces ${category.name} pour ${vehicle.brand} ${vehicle.model}`}
          className="w-full h-full object-cover"
          loading="lazy"
          showPlaceholder
          aspectRatio="4/3"
          fallback="/images/pieces/default.png"
          widths={[240, 320, 480]}
          sizes="(max-width: 640px) 50vw, 33vw"
          onError={() =>
            onImageError?.(
              new Error(`Failed to load image: ${category.image_url}`),
            )
          }
        />
      </div>

      {/* Contenu de la carte */}
      <div className="p-4">
        {/* Header avec nom et badge featured */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
            {category.name}
          </h3>
          {category.featured && <Badge variant="info">Populaire</Badge>}
        </div>

        {/* Description si disponible */}
        {category.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {category.description}
          </p>
        )}

        {/* Statistiques */}
        {showPartsCount && (
          <div className="flex items-center text-sm text-gray-500 mb-3">
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            {totalPartsCount} pièce{totalPartsCount > 1 ? "s" : ""} disponible
            {totalPartsCount > 1 ? "s" : ""}
          </div>
        )}

        {/* Sous-catégories */}
        {showSubcategories && category.subcategories.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Sous-catégories :
            </h4>
            <div className="space-y-1">
              {category.subcategories.slice(0, 6).map((subcategory) => (
                <Link
                  key={subcategory.id}
                  to={buildPartUrl(subcategory)}
                  onClick={() => handleSubcategoryClick(subcategory)}
                  className="block text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span>{subcategory.name}</span>
                    {showPartsCount && subcategory.parts_count && (
                      <span className="text-xs text-gray-500">
                        ({subcategory.parts_count})
                      </span>
                    )}
                  </div>
                </Link>
              ))}

              {category.subcategories.length > 6 && (
                <div className="text-xs text-gray-500 mt-1">
                  +{category.subcategories.length - 6} autres sous-catégories
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ========================================
// 🏗️ COMPOSANT PRINCIPAL CATEGORYGRID
// ========================================

export function CategoryGrid({
  categories,
  vehicle,
  loading = false,
  onCategoryClick,
  onImageLoad,
  onImageError,
  maxColumns = 3,
  showSubcategories = true,
  showPartsCount = true,
}: CategoryGridProps) {
  // Use arrays instead of Sets to avoid React hydration issues (Set doesn't serialize correctly during SSR)
  const [_loadedImages, setLoadedImages] = useState<string[]>([]);
  const [_imageErrors, setImageErrors] = useState<string[]>([]);

  // Gestion des événements d'images
  const handleImageLoad = useCallback(
    (categoryId: string) => {
      setLoadedImages((prev) =>
        prev.includes(categoryId) ? prev : [...prev, categoryId],
      );
      onImageLoad?.(categoryId);
    },
    [onImageLoad],
  );

  const handleImageError = useCallback(
    (categoryId: string, error: Error) => {
      setImageErrors((prev) =>
        prev.includes(categoryId) ? prev : [...prev, categoryId],
      );
      onImageError?.(categoryId, error);
      logger.warn(`Image failed to load for category ${categoryId}:`, error);
    },
    [onImageError],
  );

  // Classes CSS responsives selon le nombre de colonnes
  const gridClasses = useMemo(() => {
    const baseClasses = "grid gap-6 auto-rows-fr";
    switch (maxColumns) {
      case 2:
        return `${baseClasses} grid-cols-1 md:grid-cols-2`;
      case 3:
        return `${baseClasses} grid-cols-1 md:grid-cols-2 lg:grid-cols-3`;
      case 4:
        return `${baseClasses} grid-cols-2 md:grid-cols-3 lg:grid-cols-4`;
      case 6:
        return `${baseClasses} grid-cols-2 md:grid-cols-4 lg:grid-cols-6`;
      default:
        return `${baseClasses} grid-cols-1 md:grid-cols-2 lg:grid-cols-3`;
    }
  }, [maxColumns]);

  // Tri des catégories (featured en premier, puis par sort_order)
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return (a.sort_order || 999) - (b.sort_order || 999);
    });
  }, [categories]);

  // Loading state
  if (loading) {
    return (
      <div className={gridClasses}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            <div className="h-48 bg-gray-200 animate-pulse"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // État vide
  if (!categories.length) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-16 w-16 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p className="mt-4 text-lg text-gray-500">
          Aucune catégorie disponible
        </p>
        <p className="text-sm text-gray-400">
          Les catégories de pièces pour ce véhicule seront bientôt disponibles.
        </p>
      </div>
    );
  }

  return (
    <div
      className={gridClasses}
      role="grid"
      aria-label={`Catégories de pièces pour ${vehicle.brand} ${vehicle.model} ${vehicle.type}`}
    >
      {sortedCategories.map((category) => (
        <div
          key={category.id}
          role="gridcell"
          tabIndex={0}
          aria-label={`Catégorie ${category.name}`}
        >
          <CategoryCard
            category={category}
            vehicle={vehicle}
            showSubcategories={showSubcategories}
            showPartsCount={showPartsCount}
            onCategoryClick={onCategoryClick}
            onImageLoad={() => handleImageLoad(category.id)}
            onImageError={(error) => handleImageError(category.id, error)}
          />
        </div>
      ))}
    </div>
  );
}

// ========================================
// 🎯 HOOK POUR L'UTILISATION SIMPLIFIÉE
// ========================================

export function useCategoryGrid(
  categories: Category[],
  vehicle: VehicleData,
  options?: Partial<CategoryGridProps>,
) {
  const [analytics, setAnalytics] = useState({
    totalViews: 0,
    categoryClicks: 0,
    subcategoryClicks: 0,
    imageLoads: 0,
    imageErrors: 0,
  });

  const handleCategoryClick = useCallback(
    (category: Category, subcategory?: Subcategory) => {
      setAnalytics((prev) => ({
        ...prev,
        categoryClicks: prev.categoryClicks + 1,
        subcategoryClicks: subcategory
          ? prev.subcategoryClicks + 1
          : prev.subcategoryClicks,
      }));

      // Analytics tracking
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag(
          "event",
          subcategory ? "subcategory_click" : "category_click",
          {
            category_name: category.name,
            subcategory_name: subcategory?.name,
            vehicle_brand: vehicle.brand,
            vehicle_model: vehicle.model,
            vehicle_type: vehicle.type,
          },
        );
      }

      options?.onCategoryClick?.(category, subcategory);
    },
    [vehicle, options],
  );

  const handleImageLoad = useCallback(
    (categoryId: string) => {
      setAnalytics((prev) => ({ ...prev, imageLoads: prev.imageLoads + 1 }));
      options?.onImageLoad?.(categoryId);
    },
    [options],
  );

  const handleImageError = useCallback(
    (categoryId: string, error: Error) => {
      setAnalytics((prev) => ({ ...prev, imageErrors: prev.imageErrors + 1 }));
      options?.onImageError?.(categoryId, error);
    },
    [options],
  );

  useEffect(() => {
    setAnalytics((prev) => ({ ...prev, totalViews: prev.totalViews + 1 }));
  }, [categories]);

  return {
    analytics,
    handlers: {
      onCategoryClick: handleCategoryClick,
      onImageLoad: handleImageLoad,
      onImageError: handleImageError,
    },
  };
}

// Types globaux pour analytics (si nécessaire)
// declare global {
//   interface Window {
//     gtag?: (...args: any[]) => void;
//   }
// }
