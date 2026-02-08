/**
 * ProductStickyCTA V2 Component
 * @description Above-fold sticky CTA with Trust & Authority design system
 * @version 2.0.0
 * @pack Pack Confiance V2 - Trust-First + Professional Blue CTA
 *
 * Design System: ui-ux-pro-max + frontend-design
 * Style: Trust & Authority
 * Colors: Trust Teal + Professional Blue CTA
 * Typography: Lexend (heading) + Source Sans 3 (body)
 *
 * Anti-patterns avoided:
 * - No generic green (#34C759)
 * - No Inter/Roboto fonts
 * - No cookie-cutter patterns
 */

import {
  ShoppingCart,
  Check,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { forwardRef, useState, useEffect, memo } from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

// ============================================================================
// Design System Tokens
// ============================================================================

const _TOKENS = {
  colors: {
    cta: {
      bg: "#0369A1", // Professional Blue
      hover: "#075985",
      active: "#0C4A6E",
      shadow: "rgb(3 105 161 / 0.25)",
    },
    verified: {
      bg: "#059669",
      light: "#D1FAE5",
      text: "#065F46",
    },
    trust: {
      primary: "#0F766E", // Trust Teal
      light: "#F0FDFA",
      text: "#134E4A",
    },
    urgency: {
      bg: "#DC2626",
      light: "#FEE2E2",
      text: "#991B1B",
    },
    warning: {
      bg: "#D97706",
      light: "#FEF3C7",
      text: "#92400E",
    },
  },
} as const;

// ============================================================================
// Types
// ============================================================================

export interface ProductStickyCTAV2Props {
  /** Product price in cents */
  price: number;
  /** Original price if discounted (in cents) */
  originalPrice?: number;
  /** Stock quantity */
  stockQuantity: number;
  /** Whether compatibility is verified */
  isCompatible?: boolean | null;
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
// Sub-components with Trust & Authority Design
// ============================================================================

function PriceDisplayV2({
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
    <div className="flex items-baseline gap-2.5">
      {/* Main price - Lexend Bold, Trust Teal */}
      <span
        className={cn(
          "text-2xl font-bold tracking-tight",
          "font-heading", // Lexend
          "text-[#0F766E]", // Trust Teal
        )}
        style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
      >
        {formattedPrice}&nbsp;€
      </span>

      {formattedOriginal && (
        <>
          {/* Original price - strikethrough */}
          <span className="text-sm text-slate-400 line-through font-medium">
            {formattedOriginal}&nbsp;€
          </span>

          {/* Discount badge - distinctive diagonal design */}
          <span
            className={cn(
              "inline-flex items-center",
              "px-2 py-0.5",
              "text-xs font-bold text-white",
              "bg-gradient-to-r from-[#DC2626] to-[#B91C1C]",
              "rounded-sm",
              "transform -rotate-1", // Slight rotation for distinctive look
              "shadow-sm",
            )}
          >
            -{discount}%
          </span>
        </>
      )}
    </div>
  );
}

function StockIndicatorV2({ quantity }: { quantity: number }) {
  // Stock animation
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (quantity <= 3 && quantity > 0) {
      const interval = setInterval(() => setPulse((p) => !p), 2000);
      return () => clearInterval(interval);
    }
  }, [quantity]);

  if (quantity <= 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5",
          "px-2.5 py-1 rounded-md",
          "bg-[#FEE2E2] text-[#991B1B]",
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          Rupture
        </span>
      </div>
    );
  }

  if (quantity <= 3) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5",
          "px-2.5 py-1 rounded-md",
          "bg-[#FEF3C7] text-[#92400E]",
          "transition-all duration-300",
          pulse && "ring-2 ring-amber-300 ring-offset-1",
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Plus que {quantity}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        "px-2.5 py-1 rounded-md",
        "bg-[#D1FAE5] text-[#065F46]",
      )}
    >
      <Check className="h-3.5 w-3.5" />
      <span className="text-xs font-semibold">En stock</span>
    </div>
  );
}

function CompatibilityBadgeV2({
  isCompatible,
  vehicleContext,
  onVerify,
}: {
  isCompatible: boolean | null | undefined;
  vehicleContext?: string;
  onVerify?: () => void;
}) {
  // Verified animation
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    if (isCompatible === true) {
      const timer = setTimeout(() => setShowCheck(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isCompatible]);

  if (isCompatible === null || isCompatible === undefined) {
    return (
      <button
        onClick={onVerify}
        className={cn(
          "flex items-center gap-2",
          "px-3 py-1.5 rounded-full",
          "text-sm font-medium",
          "bg-slate-100 text-slate-600",
          "border border-slate-200",
          "hover:bg-slate-200 hover:border-slate-300",
          "transition-all duration-200",
          "cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
        )}
      >
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>Vérifier compatibilité</span>
      </button>
    );
  }

  if (isCompatible === false) {
    return (
      <div
        className={cn(
          "flex items-center gap-2",
          "px-3 py-1.5 rounded-full",
          "text-sm font-medium",
          "bg-[#FEE2E2] text-[#991B1B]",
          "border border-[#FCA5A5]",
        )}
      >
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span>Non compatible</span>
      </div>
    );
  }

  // Compatible - distinctive verified badge
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        "px-3 py-1.5 rounded-full",
        "text-sm font-semibold",
        "bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]",
        "text-[#065F46]",
        "border border-[#6EE7B7]",
        "shadow-sm",
      )}
    >
      <ShieldCheck
        className={cn(
          "h-4 w-4 text-[#059669]",
          "transition-all duration-300",
          showCheck ? "scale-100 opacity-100" : "scale-0 opacity-0",
        )}
      />
      <span>Compatible</span>
      {vehicleContext && (
        <span className="text-[#059669] text-xs truncate max-w-[80px] sm:max-w-[100px]">
          • {vehicleContext}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Skeleton Loading
// ============================================================================

export const ProductStickyCTAV2Skeleton = memo(
  function ProductStickyCTAV2Skeleton() {
    return (
      <div
        className={cn(
          "min-h-[96px] md:min-h-0",
          "fixed bottom-0 left-0 right-0 z-40",
          "md:relative md:z-auto",
          "bg-white/95 backdrop-blur-sm",
          "border-t border-slate-200",
          "md:border md:rounded-xl",
          "shadow-[0_-4px_20px_rgba(0,0,0,0.08)]",
          "md:shadow-lg",
          "px-4 py-4 md:p-5",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-28 bg-slate-200" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-md bg-slate-200" />
              <Skeleton className="h-6 w-32 rounded-full bg-slate-200" />
            </div>
          </div>
          <Skeleton className="h-12 w-44 rounded-lg bg-slate-200" />
        </div>
      </div>
    );
  },
);

// ============================================================================
// Main Component
// ============================================================================

const ProductStickyCTAV2 = memo(
  forwardRef<HTMLDivElement, ProductStickyCTAV2Props>(
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
      const [ctaHovered, setCtaHovered] = useState(false);

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

      if (isLoading) {
        return <ProductStickyCTAV2Skeleton />;
      }

      return (
        <div
          ref={ref}
          className={cn(
            // Fixed height to prevent CLS
            "min-h-[96px] md:min-h-0",
            // Sticky on mobile
            "fixed bottom-0 left-0 right-0 z-40",
            "md:relative md:z-auto",
            // Background - frosted glass effect
            "bg-white/95 backdrop-blur-sm",
            // Borders
            "border-t border-slate-200/80",
            "md:border md:rounded-xl md:border-slate-200",
            // Shadow - trust elevation
            "shadow-[0_-8px_30px_rgba(15,118,110,0.08)]",
            "md:shadow-lg md:shadow-slate-200/50",
            // Padding
            "px-4 py-4 md:p-5",
            // Safe area
            "pb-[calc(1rem+env(safe-area-inset-bottom))]",
            "md:pb-5",
            className,
          )}
        >
          {/* Main content */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Price + Indicators */}
            <div className="flex-1 min-w-0 space-y-2">
              <PriceDisplayV2 price={price} originalPrice={originalPrice} />

              <div className="flex items-center gap-2 flex-wrap">
                <StockIndicatorV2 quantity={stockQuantity} />
                <CompatibilityBadgeV2
                  isCompatible={isCompatible}
                  vehicleContext={vehicleContext}
                  onVerify={onVerifyCompatibility}
                />
              </div>
            </div>

            {/* Right: CTA Button - Professional Blue */}
            <Button
              onClick={handleAddToCart}
              disabled={isDisabled}
              onMouseEnter={() => setCtaHovered(true)}
              onMouseLeave={() => setCtaHovered(false)}
              className={cn(
                // Size
                "h-12 px-6 min-w-[160px]",
                // Colors - Professional Blue (Trust & Authority)
                "bg-[#0369A1] hover:bg-[#075985] active:bg-[#0C4A6E]",
                "text-white font-semibold",
                // Typography - Lexend
                "text-base",
                // Border radius - slightly more rounded
                "rounded-lg",
                // Transitions
                "transition-all duration-200 ease-out",
                // Hover effects - CTA elevation
                "hover:shadow-[0_6px_20px_rgba(3,105,161,0.3)]",
                "hover:-translate-y-0.5",
                "active:translate-y-0 active:shadow-md",
                // Disabled
                "disabled:bg-slate-300 disabled:cursor-not-allowed",
                "disabled:hover:shadow-none disabled:hover:translate-y-0",
                // Focus ring
                "focus-visible:ring-2 focus-visible:ring-[#0369A1] focus-visible:ring-offset-2",
                // Attention pulse for in-stock items
                stockQuantity > 0 &&
                  stockQuantity <= 5 &&
                  !isDisabled &&
                  "animate-[cta-pulse_2s_ease-in-out_infinite]",
              )}
              style={{
                fontFamily: "'Lexend', system-ui, sans-serif",
              }}
            >
              {isAddingToCart ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="hidden sm:inline">Ajout...</span>
                </>
              ) : isOutOfStock ? (
                <span>Indisponible</span>
              ) : (
                <>
                  <ShoppingCart
                    className={cn(
                      "h-5 w-5 mr-2",
                      "transition-transform duration-200",
                      ctaHovered && "scale-110",
                    )}
                  />
                  <span className="hidden sm:inline">Ajouter au panier</span>
                  <span className="sm:hidden">Ajouter</span>
                </>
              )}
            </Button>
          </div>

          {/* Product reference - monospace, subtle */}
          {productRef && (
            <div
              className={cn(
                "hidden md:flex items-center gap-2",
                "mt-3 pt-3 border-t border-slate-100",
              )}
            >
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                Réf
              </span>
              <code
                className="text-xs text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {productRef}
              </code>
            </div>
          )}
        </div>
      );
    },
  ),
);

ProductStickyCTAV2.displayName = "ProductStickyCTAV2";

export { ProductStickyCTAV2 };
