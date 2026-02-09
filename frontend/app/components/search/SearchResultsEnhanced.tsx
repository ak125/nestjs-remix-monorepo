/**
 * 🎨 SEARCH RESULTS ENHANCED - Design moderne avec Tailwind & Shadcn UI
 *
 * Améliorations :
 * - Badge "Référence OEM" visible
 * - Statut stock correct (en stock par défaut si non spécifié)
 * - Design Shadcn UI moderne
 * - Badge "Cache" pour résultats rapides
 * - Marques OES prioritaires (badge doré)
 * - ✅ Images WebP optimisées (90% plus légères !)
 */

import { Package, Zap, Award, AlertCircle } from "lucide-react";
import { memo } from "react";

import { logger } from "~/utils/logger";
import { AddToCartButton } from "../cart/AddToCartButton";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";

interface SearchResultItem {
  id: string;
  reference: string;
  brand: string | { name: string };
  brandId?: number;
  category: string | { name: string };
  categoryId?: number;
  oemRef?: string; // ✨ NOUVEAU: Référence OEM trouvée
  price?: number;
  originalPrice?: number;
  image?: string;
  inStock?: boolean;
  isNew?: boolean;
  onSale?: boolean;
  _qualityLevel?: number; // 1=OES, 2=Aftermarket, 3=Échange, 4=Adaptable
}

interface SearchResultsEnhancedProps {
  items: SearchResultItem[];
  viewMode?: "grid" | "list";
  isCached?: boolean; // ✨ Afficher badge "Cache"
  executionTime?: number;
  onItemClick?: (item: SearchResultItem) => void;
  className?: string;
}

export const SearchResultsEnhanced = memo(function SearchResultsEnhanced({
  items = [],
  viewMode = "grid",
  isCached = false,
  executionTime,
  onItemClick,
  className = "",
}: SearchResultsEnhancedProps) {
  if (!items.length) {
    return (
      <div className="text-center py-16">
        <Package className="mx-auto h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Aucun résultat trouvé
        </h3>
        <p className="text-gray-500">
          Essayez avec d'autres mots-clés ou une référence OEM
        </p>
      </div>
    );
  }

  // 🖼️ HELPERS D'OPTIMISATION D'IMAGES
  // ✅ Migration 2026-01-21: Utiliser /img/* proxy au lieu d'URLs Supabase directes
  const optimizeImageUrl = (imageUrl: string, _width: number = 400): string => {
    if (!imageUrl) return "";

    // Si c'est une URL Supabase, la convertir vers le proxy /img/*
    if (imageUrl.includes("supabase.co/storage")) {
      // Extraire le chemin après /public/
      const match = imageUrl.match(/\/public\/(.+?)(?:\?|$)/);
      if (match) {
        const path = match[1];
        // ✅ Utiliser le proxy /img/* au lieu d'URL Supabase directe
        return `/img/${path}`;
      }
    }

    // Sinon retourner l'URL originale
    return imageUrl;
  };

  const generateSrcSet = (
    imageUrl: string,
    widths: number[] = [300, 400, 600],
  ): string => {
    if (!imageUrl) return "";

    return widths
      .map((width) => `${optimizeImageUrl(imageUrl, width)} ${width}w`)
      .join(", ");
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const getBrandName = (brand: string | { name: string } | undefined) => {
    if (!brand) return "N/A";
    return typeof brand === "object" ? brand.name : brand;
  };

  const getCategoryName = (category: string | { name: string } | undefined) => {
    if (!category) return "N/A";
    return typeof category === "object" ? category.name : category;
  };

  const getQualityBadge = (qualityLevel?: number) => {
    switch (qualityLevel) {
      case 1: // OES
        return (
          <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
            <Award className="h-3 w-3 mr-1" />
            OES
          </Badge>
        );
      case 2: // Aftermarket
        return <Badge variant="secondary">Aftermarket</Badge>;
      case 3: // Échange Standard
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-700">
            Échange Standard
          </Badge>
        );
      default:
        return null;
    }
  };

  // Helper pour mapper SearchResultItem vers PieceData pour AddToCartButton
  const mapToPieceData = (item: SearchResultItem) => {
    const price = item.price || 0;
    const pieceData = {
      id: parseInt(item.id) || 0,
      name: item.reference,
      price: price,
      priceFormatted: formatPrice(price),
      brand: getBrandName(item.brand),
      stock: item.inStock !== false ? "available" : "unavailable",
      reference: item.reference,
    };
    logger.log("🛒 mapToPieceData:", { original: item, mapped: pieceData });
    return pieceData;
  };

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.map((item) => {
        // ✅ Par défaut: en stock si non spécifié (optimiste)
        const isInStock = item.inStock !== false;
        const brandName = getBrandName(item.brand);
        const categoryName = getCategoryName(item.category);

        return (
          <Card
            key={item.id}
            className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/50"
            onClick={() => onItemClick?.(item)}
          >
            <CardContent className="p-4">
              {/* En-tête: Badges */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {getQualityBadge(item._qualityLevel)}

                {item.oemRef && (
                  <Badge
                    variant="outline"
                    className="border-green-600 text-success bg-success/10"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    OEM: {item.oemRef}
                  </Badge>
                )}

                {item.isNew && (
                  <Badge className="bg-success hover:bg-success">Nouveau</Badge>
                )}

                {item.onSale && (
                  <Badge className="bg-destructive hover:bg-destructive">
                    Promo
                  </Badge>
                )}
              </div>

              {/* Image placeholder - ✅ OPTIMISÉE WEBP */}
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-4 flex items-center justify-center overflow-hidden group-hover:from-gray-200 group-hover:to-gray-300 transition-colors">
                {item.image ? (
                  <img
                    src={optimizeImageUrl(item.image, 400)}
                    srcSet={generateSrcSet(item.image)}
                    sizes="(max-width: 640px) 300px, 400px"
                    alt={item.reference}
                    width={400}
                    height={400}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <Package className="h-16 w-16 text-gray-400" />
                )}
              </div>

              {/* Référence et marque */}
              <div className="mb-3">
                <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-primary transition-colors">
                  {item.reference}
                </h3>
                <p className="text-sm text-gray-600 font-medium">{brandName}</p>
                <p className="text-xs text-gray-500">{categoryName}</p>
              </div>

              {/* Statut stock */}
              <div className="mb-3">
                {isInStock ? (
                  <div className="flex items-center text-green-600 text-sm font-medium">
                    <div className="h-2 w-2 bg-success rounded-full mr-2 animate-pulse"></div>
                    En stock
                  </div>
                ) : (
                  <div className="flex items-center text-red-600 text-sm font-medium">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Rupture de stock
                  </div>
                )}
              </div>

              {/* Prix */}
              {item.price && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatPrice(item.price)}
                    </div>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <div className="text-sm text-gray-500 line-through">
                        {formatPrice(item.originalPrice)}
                      </div>
                    )}
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    <AddToCartButton
                      piece={mapToPieceData(item)}
                      variant="small"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-4">
      {items.map((item) => {
        const isInStock = item.inStock !== false;
        const brandName = getBrandName(item.brand);
        const categoryName = getCategoryName(item.category);

        return (
          <Card
            key={item.id}
            className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/50"
            onClick={() => onItemClick?.(item)}
          >
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Image - ✅ OPTIMISÉE WEBP */}
                <div className="flex-shrink-0 w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden flex items-center justify-center group-hover:from-gray-200 group-hover:to-gray-300 transition-colors">
                  {item.image ? (
                    <img
                      src={optimizeImageUrl(item.image, 300)}
                      srcSet={generateSrcSet(item.image, [200, 300])}
                      sizes="128px"
                      alt={item.reference}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Package className="h-12 w-12 text-gray-400" />
                  )}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      {/* Badges */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getQualityBadge(item._qualityLevel)}

                        {item.oemRef && (
                          <Badge
                            variant="outline"
                            className="border-green-600 text-success bg-success/10"
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            OEM: {item.oemRef}
                          </Badge>
                        )}

                        {item.isNew && (
                          <Badge className="bg-success">Nouveau</Badge>
                        )}

                        {item.onSale && (
                          <Badge className="bg-destructive">Promo</Badge>
                        )}
                      </div>

                      {/* Titre */}
                      <h3 className="font-bold text-xl text-gray-900 mb-2 group-hover:text-primary transition-colors">
                        {item.reference}
                      </h3>

                      {/* Métadonnées */}
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Marque:</span>{" "}
                          <span className="font-medium text-gray-900">
                            {brandName}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Catégorie:</span>{" "}
                          <span className="font-medium text-gray-900">
                            {categoryName}
                          </span>
                        </div>
                      </div>

                      {/* Statut stock */}
                      {isInStock ? (
                        <div className="flex items-center text-green-600 text-sm font-medium">
                          <div className="h-2 w-2 bg-success rounded-full mr-2 animate-pulse"></div>
                          En stock • Livraison rapide
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600 text-sm font-medium">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Rupture de stock • Nous contacter
                        </div>
                      )}
                    </div>

                    {/* Prix et action */}
                    <div className="text-right ml-4">
                      {item.price && (
                        <>
                          <div className="text-3xl font-bold text-gray-900 mb-1">
                            {formatPrice(item.price)}
                          </div>
                          {item.originalPrice &&
                            item.originalPrice > item.price && (
                              <div className="text-sm text-gray-500 line-through mb-3">
                                {formatPrice(item.originalPrice)}
                              </div>
                            )}
                        </>
                      )}

                      <div onClick={(e) => e.stopPropagation()}>
                        <AddToCartButton
                          piece={mapToPieceData(item)}
                          variant="default"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className={className}>
      {/* En-tête avec métriques */}
      {(isCached || executionTime) && (
        <div className="mb-6 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">{items.length}</span> résultat
              {items.length > 1 ? "s" : ""}
            </div>

            {executionTime && (
              <div className="text-sm text-gray-600">
                • <span className="font-mono">{executionTime}ms</span>
              </div>
            )}
          </div>

          {isCached && (
            <Badge
              variant="secondary"
              className="bg-primary/15 text-blue-700 border-blue-300"
            >
              <Zap className="h-3 w-3 mr-1" />
              Résultats en cache
            </Badge>
          )}
        </div>
      )}

      {/* Grille ou liste */}
      {viewMode === "grid" ? renderGridView() : renderListView()}
    </div>
  );
});
