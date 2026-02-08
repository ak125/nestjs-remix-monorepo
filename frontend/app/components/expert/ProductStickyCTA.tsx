/**
 * ProductStickyCTA Component
 * @description Above-fold sticky CTA for product pages (R2/Expert)
 * @version 1.0.0
 * @pack Pack Confiance - Trust-First + Compatibility
 *
 * Features:
 * - Sticky on mobile scroll
 * - Price + Stock + Compatibility badge
 * - CLS=0 with skeleton dimensions
 * - Distinctive design (anti-AI-slop)
 */

import { ShoppingCart, Check, AlertTriangle, Loader2 } from "lucide-react";
import { forwardRef, useState, memo } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface ProductStickyCTAProps {
  /** Product price in cents */
  price: number;
  /** Original price if discounted (in cents) */
  originalPrice?: number;
  /** Stock quantity */
  stockQuantity: number;
  /** Whether compatibility is verified */
  isCompatible?: boolean | null; // true=compatible, false=incompatible, null=unknown
  /** Vehicle context for compatibility */
  vehicleContext?: string;
  /** Product reference */
  productRef?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Add to cart handler */
  onAddToCart?: () => void | Promise<void>;
  /** Verify compatibility handler */
  onVerifyCompatibility?: () => void;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

function PriceDisplay({
  price,
  originalPrice,
}: {
  price: number;
  originalPrice?: number;
}) {
  const formattedPrice = (price / 100).toFixed(2).replace(".", ",");
  const formattedOriginal = originalPrice
    ? (originalPrice / 100).toFixed(2).replace(".", ",")
    : null;
  const discount = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-gray-900 font-heading tracking-tight">
        {formattedPrice}&nbsp;€
      </span>
      {formattedOriginal && (
        <>
          <span className="text-sm text-gray-400 line-through">
            {formattedOriginal}&nbsp;€
          </span>
          <Badge variant="destructive" size="sm" className="font-semibold">
            -{discount}%
          </Badge>
        </>
      )}
    </div>
  );
}

function StockIndicator({ quantity }: { quantity: number }) {
  if (quantity <= 0) {
    return (
      <div className="flex items-center gap-1.5 text-red-600">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">Rupture de stock</span>
      </div>
    );
  }

  if (quantity <= 3) {
    return (
      <div className="flex items-center gap-1.5 text-amber-600">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          Plus que {quantity} en stock
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-green-600">
      <Check className="h-4 w-4" />
      <span className="text-sm font-medium">En stock</span>
    </div>
  );
}

function CompatibilityBadge({
  isCompatible,
  vehicleContext,
  onVerify,
}: {
  isCompatible: boolean | null | undefined;
  vehicleContext?: string;
  onVerify?: () => void;
}) {
  // Null/undefined = unknown
  if (isCompatible === null || isCompatible === undefined) {
    return (
      <button
        onClick={onVerify}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
          "bg-gray-100 text-gray-700 hover:bg-gray-200",
          "transition-colors duration-200 cursor-pointer",
          "border border-gray-200",
        )}
      >
        <span className="w-2 h-2 rounded-full bg-gray-400" />
        <span>Vérifier compatibilité</span>
      </button>
    );
  }

  if (isCompatible === false) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
          "bg-red-50 text-red-700 border border-red-200",
        )}
      >
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span>Non compatible</span>
        {vehicleContext && (
          <span className="text-red-500 text-xs">({vehicleContext})</span>
        )}
      </div>
    );
  }

  // Compatible
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        "bg-green-50 text-green-700 border border-green-200",
      )}
    >
      <Check className="h-4 w-4 text-green-600" />
      <span>Compatible</span>
      {vehicleContext && (
        <span className="text-green-600 text-xs truncate max-w-[120px]">
          {vehicleContext}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Skeleton Loading
// ============================================================================

export const ProductStickyCTASkeleton = memo(
  function ProductStickyCTASkeleton() {
    return (
      <div
        className={cn(
          // Fixed height to prevent CLS
          "h-[88px] md:h-auto",
          "fixed bottom-0 left-0 right-0 z-40 md:relative md:z-auto",
          "bg-white border-t md:border md:rounded-xl",
          "shadow-lg md:shadow-md",
          "px-4 py-3 md:p-4",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-12 w-40" />
        </div>
      </div>
    );
  },
);

// ============================================================================
// Main Component
// ============================================================================

const ProductStickyCTA = memo(
  forwardRef<HTMLDivElement, ProductStickyCTAProps>(
    (
      {
        price,
        originalPrice,
        stockQuantity,
        isCompatible,
        vehicleContext,
        productRef,
        isLoading = false,
        disabled = false,
        onAddToCart,
        onVerifyCompatibility,
        className,
      },
      ref,
    ) => {
      const [isAddingToCart, setIsAddingToCart] = useState(false);

      const handleAddToCart = async () => {
        if (isAddingToCart || disabled || stockQuantity <= 0) return;

        setIsAddingToCart(true);
        try {
          await onAddToCart?.();
        } finally {
          setIsAddingToCart(false);
        }
      };

      const isOutOfStock = stockQuantity <= 0;
      const isDisabled = disabled || isOutOfStock || isLoading;

      // Show skeleton while loading
      if (isLoading) {
        return <ProductStickyCTASkeleton />;
      }

      return (
        <div
          ref={ref}
          className={cn(
            // Fixed height to prevent CLS - CRITICAL
            "min-h-[88px] md:min-h-0",
            // Sticky on mobile, normal on desktop
            "fixed bottom-0 left-0 right-0 z-40",
            "md:relative md:z-auto",
            // Background and borders
            "bg-white border-t border-gray-200",
            "md:border md:rounded-xl md:border-gray-200",
            // Shadow - stronger on mobile (floating feel)
            "shadow-[0_-4px_20px_rgba(0,0,0,0.08)]",
            "md:shadow-md",
            // Padding
            "px-4 py-3 md:p-4",
            // Safe area for mobile notch
            "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
            "md:pb-4",
            className,
          )}
        >
          {/* Main content */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Price + Stock */}
            <div className="flex-1 min-w-0 space-y-1">
              <PriceDisplay price={price} originalPrice={originalPrice} />
              <div className="flex items-center gap-3 flex-wrap">
                <StockIndicator quantity={stockQuantity} />
                <CompatibilityBadge
                  isCompatible={isCompatible}
                  vehicleContext={vehicleContext}
                  onVerify={onVerifyCompatibility}
                />
              </div>
            </div>

            {/* Right: CTA Button */}
            <Button
              onClick={handleAddToCart}
              disabled={isDisabled}
              className={cn(
                // Size
                "h-12 px-6",
                // Colors - Pack Confiance green
                "bg-[#34C759] hover:bg-[#2DB84E] active:bg-[#28A745]",
                "text-white font-semibold",
                // Typography - Montserrat (heading font)
                "font-heading text-base",
                // Transition - 200ms as per Pack Confiance
                "transition-all duration-200 ease-out",
                // Hover effect - subtle elevation
                "hover:shadow-lg hover:-translate-y-0.5",
                "active:translate-y-0 active:shadow-md",
                // Disabled state
                "disabled:bg-gray-300 disabled:cursor-not-allowed",
                "disabled:hover:shadow-none disabled:hover:translate-y-0",
                // Focus ring for accessibility
                "focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2",
              )}
            >
              {isAddingToCart ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="hidden sm:inline">Ajout...</span>
                </>
              ) : isOutOfStock ? (
                <span>Indisponible</span>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  <span className="hidden sm:inline">Ajouter au panier</span>
                  <span className="sm:hidden">Ajouter</span>
                </>
              )}
            </Button>
          </div>

          {/* Product reference (subtle, for SEO and trust) */}
          {productRef && (
            <div className="hidden md:block mt-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400 font-mono">
                Réf: {productRef}
              </span>
            </div>
          )}
        </div>
      );
    },
  ),
);

ProductStickyCTA.displayName = "ProductStickyCTA";

export { ProductStickyCTA };
