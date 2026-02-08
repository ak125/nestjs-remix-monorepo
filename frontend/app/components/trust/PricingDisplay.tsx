/**
 * 💰 PricingDisplay - Affichage prix avec persuasion
 *
 * Règles prix barré crédible:
 * - Ancien prix max +50% du prix actuel
 * - Réduction min 5%, max 70%
 * - Afficher économies en €
 * - Optionnel: prix HT/TTC
 */

import { TrendingDown } from "lucide-react";
import { memo } from "react";
import { cn } from "~/lib/utils";

interface PricingDisplayProps {
  price: number;
  originalPrice?: number;
  currency?: string;
  showTax?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PricingDisplay = memo(function PricingDisplay({
  price,
  originalPrice,
  currency = "€",
  showTax = true,
  size = "md",
  className,
}: PricingDisplayProps) {
  // Valider prix barré crédible
  const validatedOriginalPrice = validateOriginalPrice(price, originalPrice);
  const hasDiscount = validatedOriginalPrice && validatedOriginalPrice > price;
  const savings = hasDiscount ? validatedOriginalPrice - price : 0;
  const discountPercent = hasDiscount
    ? Math.round(
        ((validatedOriginalPrice - price) / validatedOriginalPrice) * 100,
      )
    : 0;

  const sizeClasses = {
    sm: { current: "text-xl", original: "text-sm", savings: "text-xs" },
    md: { current: "text-2xl", original: "text-base", savings: "text-sm" },
    lg: { current: "text-4xl", original: "text-xl", savings: "text-base" },
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Prix principal */}
      <div className="flex items-baseline gap-3">
        <div
          className={cn("font-bold text-gray-900", sizeClasses[size].current)}
        >
          {formatPrice(price)} {currency}
        </div>

        {hasDiscount && (
          <>
            {/* Prix barré */}
            <div
              className={cn(
                "font-medium text-gray-400 line-through",
                sizeClasses[size].original,
              )}
            >
              {formatPrice(validatedOriginalPrice)} {currency}
            </div>

            {/* Badge réduction */}
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold">
              <TrendingDown className="w-3 h-3" />-{discountPercent}%
            </div>
          </>
        )}
      </div>

      {/* Ligne secondaire */}
      <div className="flex items-center gap-2 text-xs text-gray-600">
        {hasDiscount && (
          <span className="font-medium text-green-600">
            Économisez {formatPrice(savings)} {currency}
          </span>
        )}
        {showTax && (
          <span className="text-gray-500">
            TTC ({formatPrice(price / 1.2)} {currency} HT)
          </span>
        )}
      </div>
    </div>
  );
});

/**
 * Valider prix barré selon règles e-commerce
 * Retourne null si pas crédible
 */
function validateOriginalPrice(
  currentPrice: number,
  originalPrice?: number,
): number | null {
  if (!originalPrice || originalPrice <= currentPrice) {
    return null;
  }

  const maxAllowed = currentPrice * 1.5; // Max +50%
  const minDiscount = currentPrice * 0.05; // Min -5%
  const maxDiscount = currentPrice * 0.7; // Max -70%

  const discount = originalPrice - currentPrice;

  // Prix barré trop élevé
  if (originalPrice > maxAllowed) {
    return null;
  }

  // Réduction trop faible
  if (discount < minDiscount) {
    return null;
  }

  // Réduction trop forte (suspect)
  if (discount > maxDiscount) {
    return null;
  }

  return originalPrice;
}

/**
 * Formater prix (12.5 → 12,50)
 */
function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",");
}

/**
 * PriceComparison - Comparaison multi-prix
 */
interface PriceComparisonProps {
  prices: {
    label: string;
    price: number;
    isCurrent?: boolean;
  }[];
  className?: string;
}

export const PriceComparison = memo(function PriceComparison({
  prices,
  className,
}: PriceComparisonProps) {
  const currentPrice = prices.find((p) => p.isCurrent);
  const minCompetitor = Math.min(
    ...prices.filter((p) => !p.isCurrent).map((p) => p.price),
  );
  const savings =
    currentPrice && minCompetitor > currentPrice.price
      ? minCompetitor - currentPrice.price
      : 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-semibold text-gray-700">
        Comparaison de prix
      </div>

      {prices.map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg",
            item.isCurrent
              ? "bg-green-50 border border-green-200"
              : "bg-gray-50",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{item.label}</span>
            {item.isCurrent && (
              <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded">
                NOTRE PRIX
              </span>
            )}
          </div>
          <span className="font-bold">{formatPrice(item.price)} €</span>
        </div>
      ))}

      {savings > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-semibold text-blue-900">
            💰 Vous économisez {formatPrice(savings)} € par rapport à la
            concurrence
          </p>
        </div>
      )}
    </div>
  );
});
