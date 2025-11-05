/**
 * ProductQuickViewPopover - Aperçu rapide d'un produit au survol
 * 
 * @features
 * - Image produit en grand format
 * - Prix avec réduction si applicable
 * - Badge de stock (couleur selon disponibilité)
 * - Note et nombre d'avis
 * - Description courte
 * - Boutons d'action : Voir détails, Ajouter au panier
 * - Référence produit
 * 
 * @example
 * <ProductQuickViewPopover
 *   product={product}
 *   onViewDetails={() => navigate(`/products/${product.id}`)}
 *   onAddToCart={() => addToCart(product.id)}
 * >
 *   <Button variant="outline" size="sm">
 *     <Eye className="h-4 w-4" />
 *   </Button>
 * </ProductQuickViewPopover>
 */

import { Eye, ShoppingCart, Star, Package } from 'lucide-react';
import { type ReactNode } from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';

export interface ProductForQuickView {
  id: string | number;
  name: string;
  reference?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  rating?: number;
  reviewsCount?: number;
  imageUrl?: string;
  description?: string;
  category?: string;
}

interface ProductQuickViewPopoverProps {
  /** Produit à afficher */
  product: ProductForQuickView;
  /** Callback voir détails */
  onViewDetails?: () => void;
  /** Callback ajouter au panier */
  onAddToCart?: () => void;
  /** Element déclencheur du popover */
  children?: ReactNode;
  /** Position du popover */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignement du popover */
  align?: 'start' | 'center' | 'end';
}

export function ProductQuickViewPopover({
  product,
  onViewDetails,
  onAddToCart,
  children,
  side = 'right',
  align = 'start',
}: ProductQuickViewPopoverProps) {
  // Calcul de la réduction
  const hasDiscount =
    product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(
        ((product.originalPrice! - product.price) / product.originalPrice!) *
          100
      )
    : 0;

  // Badge de stock
  const getStockBadge = () => {
    if (product.stock === 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
          <Package className="h-3 w-3" />
          Rupture
        </span>
      );
    }
    if (product.stock < 5) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
          <Package className="h-3 w-3" />
          Stock faible ({product.stock})
        </span>
      );
    }
    if (product.stock >= 50) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
          <Package className="h-3 w-3" />
          En stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
        <Package className="h-3 w-3" />
        {product.stock} disponibles
      </span>
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children || (
          <button className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900">
            <Eye className="h-5 w-5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-80 p-0"
      >
        <div className="space-y-0">
          {/* Image produit */}
          <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-gray-100">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-16 w-16 text-gray-400" />
              </div>
            )}
            {/* Badge réduction */}
            {hasDiscount && (
              <div className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                -{discountPercent}%
              </div>
            )}
          </div>

          {/* Contenu */}
          <div className="space-y-3 p-4">
            {/* Header avec catégorie et stock */}
            <div className="flex items-center justify-between">
              {product.category && (
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                  {product.category}
                </span>
              )}
              {getStockBadge()}
            </div>

            {/* Nom produit */}
            <h3 className="text-lg font-semibold leading-tight text-gray-900">
              {product.name}
            </h3>

            {/* Référence */}
            {product.reference && (
              <div className="text-xs text-gray-500">
                Réf. {product.reference}
              </div>
            )}

            {/* Note et avis */}
            {product.rating !== undefined && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= product.rating!
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                {product.reviewsCount !== undefined && (
                  <span className="text-sm text-gray-600">
                    ({product.reviewsCount} avis)
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <p className="line-clamp-2 text-sm text-gray-600">
                {product.description}
              </p>
            )}

            {/* Prix */}
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-600">
                {product.price.toFixed(2)}€
              </span>
              {hasDiscount && (
                <span className="text-sm text-gray-500 line-through">
                  {product.originalPrice!.toFixed(2)}€
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {onViewDetails && (
                <button
                  onClick={onViewDetails}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  <Eye className="h-4 w-4" />
                  Détails
                </button>
              )}
              {onAddToCart && product.stock > 0 && (
                <button
                  onClick={onAddToCart}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Ajouter
                </button>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
