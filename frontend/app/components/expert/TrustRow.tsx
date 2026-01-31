/**
 * TrustRow Component
 * @description Row of trust badges and signals for product pages
 * @version 1.0.0
 * @pack Pack Confiance - Trust-First + Compatibility
 *
 * Features:
 * - Trust badges (warranty, returns, secure payment)
 * - OEM quality indicators
 * - Customer rating display
 * - Delivery information
 * - Distinctive design (anti-AI-slop)
 */

import {
  Shield,
  Truck,
  RotateCcw,
  Star,
  Award,
  Lock,
  Package,
  BadgeCheck,
} from "lucide-react";
import { forwardRef } from "react";
import { cn } from "~/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface TrustBadge {
  /** Badge type */
  type:
    | "warranty"
    | "returns"
    | "secure"
    | "delivery"
    | "oem"
    | "stock"
    | "rating"
    | "certified"
    | "custom";
  /** Badge label */
  label: string;
  /** Badge sublabel (optional detail) */
  sublabel?: string;
  /** Custom icon (for custom type) */
  icon?: React.ReactNode;
  /** Whether this is a highlighted/premium badge */
  highlighted?: boolean;
}

export interface TrustRowProps {
  /** Array of trust badges to display */
  badges?: TrustBadge[];
  /** Average customer rating (0-5) */
  rating?: number;
  /** Number of reviews */
  reviewCount?: number;
  /** Warranty duration in years */
  warrantyYears?: number;
  /** Return policy days */
  returnDays?: number;
  /** Estimated delivery text */
  deliveryText?: string;
  /** Whether the product is OEM quality */
  isOemQuality?: boolean;
  /** Compact mode (icons only on mobile) */
  compact?: boolean;
  /** Layout variant */
  variant?: "row" | "grid" | "stack";
  /** Additional className */
  className?: string;
}

// ============================================================================
// Badge Icon Map
// ============================================================================

const BADGE_ICONS: Record<string, React.ReactNode> = {
  warranty: <Shield className="h-5 w-5" />,
  returns: <RotateCcw className="h-5 w-5" />,
  secure: <Lock className="h-5 w-5" />,
  delivery: <Truck className="h-5 w-5" />,
  oem: <Award className="h-5 w-5" />,
  stock: <Package className="h-5 w-5" />,
  rating: <Star className="h-5 w-5" />,
  certified: <BadgeCheck className="h-5 w-5" />,
};

const BADGE_COLORS: Record<string, { bg: string; text: string; icon: string }> =
  {
    warranty: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      icon: "text-blue-500",
    },
    returns: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      icon: "text-purple-500",
    },
    secure: {
      bg: "bg-green-50",
      text: "text-green-700",
      icon: "text-green-500",
    },
    delivery: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      icon: "text-amber-500",
    },
    oem: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      icon: "text-gray-600",
    },
    stock: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      icon: "text-emerald-500",
    },
    rating: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      icon: "text-yellow-500",
    },
    certified: {
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      icon: "text-indigo-500",
    },
    custom: {
      bg: "bg-gray-50",
      text: "text-gray-700",
      icon: "text-gray-500",
    },
  };

// ============================================================================
// Sub-components
// ============================================================================

function Badge({
  badge,
  compact = false,
}: {
  badge: TrustBadge;
  compact?: boolean;
}) {
  const colors = BADGE_COLORS[badge.type] || BADGE_COLORS.custom;
  const icon = badge.icon || BADGE_ICONS[badge.type];

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        "px-3 py-2 rounded-lg",
        "transition-all duration-200",
        colors.bg,
        badge.highlighted && "ring-2 ring-offset-1 ring-current/20",
      )}
    >
      {/* Icon */}
      <div className={cn("flex-shrink-0", colors.icon)}>{icon}</div>

      {/* Text */}
      {!compact && (
        <div className="min-w-0">
          <div className={cn("text-sm font-medium leading-tight", colors.text)}>
            {badge.label}
          </div>
          {badge.sublabel && (
            <div className={cn("text-xs opacity-75", colors.text)}>
              {badge.sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RatingDisplay({
  rating,
  reviewCount,
}: {
  rating: number;
  reviewCount?: number;
}) {
  // Round to 1 decimal
  const displayRating = Math.round(rating * 10) / 10;
  // Full stars count
  const fullStars = Math.floor(rating);
  // Has half star
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-2">
      {/* Stars */}
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-4 w-4",
              star <= fullStars
                ? "text-yellow-400 fill-yellow-400"
                : star === fullStars + 1 && hasHalf
                  ? "text-yellow-400 fill-yellow-400/50"
                  : "text-gray-200",
            )}
          />
        ))}
      </div>

      {/* Rating number */}
      <span className="text-sm font-semibold text-gray-900">
        {displayRating}
      </span>

      {/* Review count */}
      {reviewCount !== undefined && (
        <span className="text-sm text-gray-500">({reviewCount} avis)</span>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const TrustRow = forwardRef<HTMLDivElement, TrustRowProps>(
  (
    {
      badges,
      rating,
      reviewCount,
      warrantyYears,
      returnDays,
      deliveryText,
      isOemQuality,
      compact = false,
      variant = "row",
      className,
    },
    ref,
  ) => {
    // Build badges array from props if not provided
    const computedBadges: TrustBadge[] = badges || [];

    // Add standard badges if props are provided
    if (!badges) {
      if (warrantyYears) {
        computedBadges.push({
          type: "warranty",
          label: `Garantie ${warrantyYears} an${warrantyYears > 1 ? "s" : ""}`,
          sublabel: "Fabricant",
        });
      }

      if (returnDays) {
        computedBadges.push({
          type: "returns",
          label: `Retour ${returnDays}j`,
          sublabel: "Satisfait ou remboursé",
        });
      }

      if (isOemQuality) {
        computedBadges.push({
          type: "oem",
          label: "Qualité OEM",
          sublabel: "Équipementier",
          highlighted: true,
        });
      }

      if (deliveryText) {
        computedBadges.push({
          type: "delivery",
          label: deliveryText,
        });
      }

      // Always add secure payment
      computedBadges.push({
        type: "secure",
        label: "Paiement sécurisé",
        sublabel: "SSL 256-bit",
      });
    }

    // Layout classes
    const layoutClasses = {
      row: "flex flex-wrap items-center gap-2 sm:gap-3",
      grid: "grid grid-cols-2 sm:grid-cols-4 gap-2",
      stack: "flex flex-col gap-2",
    };

    return (
      <div ref={ref} className={cn("w-full", className)}>
        {/* Rating row (if provided) */}
        {rating !== undefined && (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <RatingDisplay rating={rating} reviewCount={reviewCount} />
          </div>
        )}

        {/* Trust badges */}
        <div className={cn(layoutClasses[variant])}>
          {computedBadges.map((badge, index) => (
            <Badge
              key={`${badge.type}-${index}`}
              badge={badge}
              compact={compact}
            />
          ))}
        </div>
      </div>
    );
  },
);

TrustRow.displayName = "TrustRow";

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Standard trust row for product pages (Pack Confiance)
 */
export function ProductTrustRow({
  rating,
  reviewCount,
  warrantyYears = 2,
  returnDays = 30,
  isOemQuality = false,
  className,
}: Partial<TrustRowProps>) {
  return (
    <TrustRow
      rating={rating}
      reviewCount={reviewCount}
      warrantyYears={warrantyYears}
      returnDays={returnDays}
      isOemQuality={isOemQuality}
      variant="row"
      className={className}
    />
  );
}

/**
 * Compact trust badges for mobile above-fold
 */
export function CompactTrustBadges({
  warrantyYears = 2,
  isOemQuality = false,
  className,
}: Pick<TrustRowProps, "warrantyYears" | "isOemQuality" | "className">) {
  return (
    <TrustRow
      warrantyYears={warrantyYears}
      isOemQuality={isOemQuality}
      compact
      variant="row"
      className={className}
    />
  );
}

/**
 * Footer trust row (grid layout)
 */
export function FooterTrustRow({ className }: { className?: string }) {
  const badges: TrustBadge[] = [
    {
      type: "secure",
      label: "Paiement 100% sécurisé",
      sublabel: "CB, PayPal, virement",
    },
    {
      type: "delivery",
      label: "Livraison rapide",
      sublabel: "48h en France",
    },
    {
      type: "returns",
      label: "Retour gratuit",
      sublabel: "30 jours",
    },
    {
      type: "warranty",
      label: "Garantie constructeur",
      sublabel: "2 ans minimum",
    },
  ];

  return <TrustRow badges={badges} variant="grid" className={className} />;
}

export { TrustRow };
