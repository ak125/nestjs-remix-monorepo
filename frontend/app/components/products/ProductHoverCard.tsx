/**
 * 📦 Product Hover Card - Preview rapide produit au survol
 *
 * Affiche un aperçu riche au hover avec:
 * - Image produit
 * - Nom + référence
 * - Prix avec réduction
 * - Stock disponible
 * - Note moyenne
 * - Lien vers fiche produit
 */

import { Link } from "@remix-run/react";
import {
  ExternalLink,
  Package,
  ShoppingCart,
  Star,
  TrendingUp,
} from "lucide-react";
import { memo } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";

interface ProductPreview {
  id: string;
  name: string;
  reference?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  rating?: number;
  reviewsCount?: number;
  imageUrl?: string;
  category?: string;
}

interface ProductHoverCardProps {
  product: ProductPreview;
  /** Élément qui déclenche le hover */
  children: React.ReactNode;
  /** Afficher le bouton "Voir produit" */
  showViewButton?: boolean;
}

export const ProductHoverCard = memo(function ProductHoverCard({
  product,
  children,
  showViewButton = true,
}: ProductHoverCardProps) {
  // Calculer le pourcentage de réduction
  const discountPercent = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100,
      )
    : 0;

  // Déterminer le badge de stock
  const getStockBadge = (stock: number) => {
    if (stock === 0)
      return { label: "Rupture", variant: "destructive" as const };
    if (stock < 5)
      return { label: "Stock faible", variant: "secondary" as const };
    if (stock >= 50) return { label: "En stock", variant: "success" as const };
    return {
      label: `${stock} disponible${stock > 1 ? "s" : ""}`,
      variant: "outline" as const,
    };
  };

  const stockBadge = getStockBadge(product.stock);

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-3">
          {/* Image produit */}
          {product.imageUrl && (
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={product.imageUrl}
                alt={product.name}
                width={320}
                height={180}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
              {discountPercent > 0 && (
                <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  -{discountPercent}%
                </div>
              )}
            </div>
          )}

          {/* Nom et référence */}
          <div>
            <h4 className="font-semibold text-sm leading-tight">
              {product.name}
            </h4>
            {product.reference && (
              <p className="text-xs text-muted-foreground mt-1">
                Réf: {product.reference}
              </p>
            )}
            {product.category && (
              <Badge variant="outline" className="mt-2 text-xs">
                {product.category}
              </Badge>
            )}
          </div>

          {/* Prix */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">
              {product.price.toFixed(2)}€
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-sm text-muted-foreground line-through">
                {product.originalPrice.toFixed(2)}€
              </span>
            )}
          </div>

          {/* Informations */}
          <div className="space-y-2 text-xs">
            {/* Stock */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                Stock:
              </span>
              <Badge variant={stockBadge.variant} className="text-xs">
                {stockBadge.label}
              </Badge>
            </div>

            {/* Note */}
            {product.rating !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" />
                  Évaluation:
                </span>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < Math.floor(product.rating!)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-medium">
                    {product.rating.toFixed(1)}
                    {product.reviewsCount && (
                      <span className="text-muted-foreground ml-1">
                        ({product.reviewsCount})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Popularité si réduction */}
            {discountPercent > 0 && (
              <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 p-2 rounded">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="font-medium">
                  Offre spéciale -{discountPercent}%
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          {showViewButton && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link to={`/products/${product.id}`}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Voir produit
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});
