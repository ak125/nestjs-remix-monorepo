/**
 * TrustRow V2 Component
 * @description Trust badges with Trust & Authority design system
 * @version 2.0.0
 * @pack Pack Confiance V2 - Trust-First + Certificate Style
 *
 * Design System: ui-ux-pro-max + frontend-design
 * Style: Trust & Authority
 * Effects: Badge hover, metric pulse, certificate shimmer
 * Typography: Lexend (heading) + Source Sans 3 (body)
 *
 * Anti-patterns avoided:
 * - No generic colored badges
 * - No rainbow palette
 * - No cookie-cutter badge patterns
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
  CheckCircle2,
} from "lucide-react";
import { forwardRef, useState, memo } from "react";
import { cn } from "~/lib/utils";

// ============================================================================
// Design System Tokens
// ============================================================================

const TRUST_COLORS = {
  // Primary trust palette - teal-based
  primary: {
    bg: "#F0FDFA",
    border: "#99F6E4",
    text: "#0F766E",
    icon: "#14B8A6",
  },
  // Secondary - slate (professional)
  secondary: {
    bg: "#F8FAFC",
    border: "#E2E8F0",
    text: "#475569",
    icon: "#64748B",
  },
  // Verified - green
  verified: {
    bg: "#ECFDF5",
    border: "#A7F3D0",
    text: "#065F46",
    icon: "#059669",
  },
  // Highlight - amber/gold (premium)
  highlight: {
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#92400E",
    icon: "#D97706",
  },
} as const;

// ============================================================================
// Types
// ============================================================================

export interface TrustBadgeV2 {
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
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  highlighted?: boolean;
}

export interface TrustRowV2Props {
  badges?: TrustBadgeV2[];
  rating?: number;
  reviewCount?: number;
  warrantyYears?: number;
  returnDays?: number;
  deliveryText?: string;
  isOemQuality?: boolean;
  compact?: boolean;
  variant?: "row" | "grid" | "stack" | "certificates";
  className?: string;
}

// ============================================================================
// Badge Configuration
// ============================================================================

const BADGE_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    colors: (typeof TRUST_COLORS)[keyof typeof TRUST_COLORS];
  }
> = {
  warranty: {
    icon: <Shield className="h-5 w-5" />,
    colors: TRUST_COLORS.primary,
  },
  returns: {
    icon: <RotateCcw className="h-5 w-5" />,
    colors: TRUST_COLORS.secondary,
  },
  secure: {
    icon: <Lock className="h-5 w-5" />,
    colors: TRUST_COLORS.verified,
  },
  delivery: {
    icon: <Truck className="h-5 w-5" />,
    colors: TRUST_COLORS.secondary,
  },
  oem: {
    icon: <Award className="h-5 w-5" />,
    colors: TRUST_COLORS.highlight,
  },
  stock: {
    icon: <Package className="h-5 w-5" />,
    colors: TRUST_COLORS.verified,
  },
  rating: {
    icon: <Star className="h-5 w-5" />,
    colors: TRUST_COLORS.highlight,
  },
  certified: {
    icon: <BadgeCheck className="h-5 w-5" />,
    colors: TRUST_COLORS.primary,
  },
  custom: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    colors: TRUST_COLORS.secondary,
  },
};

// ============================================================================
// Sub-components
// ============================================================================

function TrustBadgeV2Component({
  badge,
  compact = false,
  index = 0,
}: {
  badge: TrustBadgeV2;
  compact?: boolean;
  index?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const config = BADGE_CONFIG[badge.type] || BADGE_CONFIG.custom;
  const { colors } = config;
  const icon = badge.icon || config.icon;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5",
        "px-3.5 py-2.5 rounded-lg",
        "border transition-all duration-200",
        "cursor-default",
        // Animation delay based on index
        "animate-[stat-reveal_300ms_ease-out_forwards]",
        // Hover effect
        isHovered && "shadow-md -translate-y-0.5",
        // Highlighted badge gets extra styling
        badge.highlighted && "ring-1 ring-offset-2",
      )}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        animationDelay: `${index * 50}ms`,
        // Ring color for highlighted
        ...(badge.highlighted &&
          ({
            "--tw-ring-color": colors.border,
          } as React.CSSProperties)),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon with pulse effect on highlight */}
      <div
        className={cn(
          "flex-shrink-0 transition-transform duration-200",
          isHovered && "scale-110",
        )}
        style={{ color: colors.icon }}
      >
        {icon}
      </div>

      {/* Text content */}
      {!compact && (
        <div className="min-w-0 flex-1">
          <div
            className="text-xs sm:text-sm font-semibold leading-tight"
            style={{
              color: colors.text,
              fontFamily: "'Lexend', system-ui, sans-serif",
            }}
          >
            {badge.label}
          </div>
          {badge.sublabel && (
            <div
              className="text-[11px] sm:text-xs mt-0.5 opacity-80"
              style={{
                color: colors.text,
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
              }}
            >
              {badge.sublabel}
            </div>
          )}
        </div>
      )}

      {/* Shimmer effect on hover for highlighted badges */}
      {badge.highlighted && (
        <div
          className={cn(
            "absolute inset-0 rounded-lg overflow-hidden pointer-events-none",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          )}
        >
          <div
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
            style={{
              background: `linear-gradient(90deg, transparent, ${colors.border}40, transparent)`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function RatingDisplayV2({
  rating,
  reviewCount,
}: {
  rating: number;
  reviewCount?: number;
}) {
  const displayRating = Math.round(rating * 10) / 10;
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-3">
      {/* Stars - gold gradient, larger on mobile for touch */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-5 w-5 sm:h-4 sm:w-4 transition-all duration-200", // Larger on mobile for touch
              star <= fullStars
                ? "text-amber-400 fill-amber-400 drop-shadow-sm"
                : star === fullStars + 1 && hasHalf
                  ? "text-amber-400 fill-amber-400/50"
                  : "text-slate-200 fill-slate-200",
            )}
            style={{
              filter:
                star <= fullStars
                  ? "drop-shadow(0 1px 1px rgb(0 0 0 / 0.1))"
                  : undefined,
            }}
          />
        ))}
      </div>

      {/* Rating number - bold */}
      <span
        className="text-base font-bold text-slate-800"
        style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
      >
        {displayRating}
      </span>

      {/* Review count with link style */}
      {reviewCount !== undefined && (
        <button className="text-sm text-[#0369A1] hover:text-[#075985] hover:underline transition-colors cursor-pointer">
          ({reviewCount} avis)
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Certificate-Style Badge (Premium variant)
// ============================================================================

function CertificateBadge({
  badge,
  index = 0,
}: {
  badge: TrustBadgeV2;
  index?: number;
}) {
  const config = BADGE_CONFIG[badge.type] || BADGE_CONFIG.custom;
  const { colors } = config;
  const icon = badge.icon || config.icon;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center",
        "p-4 rounded-xl",
        "border-2 border-dashed",
        "transition-all duration-300",
        "hover:border-solid hover:shadow-lg hover:-translate-y-1",
        "cursor-default",
        "animate-[stat-reveal_400ms_ease-out_forwards]",
      )}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* Certificate ribbon effect */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{
          backgroundColor: colors.icon,
          color: "white",
        }}
      >
        Certifié
      </div>

      {/* Icon */}
      <div className="mb-2" style={{ color: colors.icon }}>
        {icon}
      </div>

      {/* Label */}
      <div
        className="text-sm font-bold text-center"
        style={{
          color: colors.text,
          fontFamily: "'Lexend', system-ui, sans-serif",
        }}
      >
        {badge.label}
      </div>

      {badge.sublabel && (
        <div
          className="text-xs text-center mt-1 opacity-75"
          style={{ color: colors.text }}
        >
          {badge.sublabel}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const TrustRowV2 = memo(
  forwardRef<HTMLDivElement, TrustRowV2Props>(
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
      const computedBadges: TrustBadgeV2[] = badges || [];

      if (!badges) {
        if (warrantyYears) {
          computedBadges.push({
            type: "warranty",
            label: `Garantie ${warrantyYears} an${warrantyYears > 1 ? "s" : ""}`,
            sublabel: "Constructeur",
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
            sublabel: "Équipementier d'origine",
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
          sublabel: "Chiffrement SSL 256-bit",
        });
      }

      // Layout classes by variant
      const layoutClasses = {
        row: "flex flex-wrap items-stretch gap-2 sm:gap-3",
        grid: "grid grid-cols-2 lg:grid-cols-4 gap-3",
        stack: "flex flex-col gap-2",
        certificates: "grid grid-cols-2 sm:grid-cols-4 gap-4",
      };

      return (
        <div ref={ref} className={cn("w-full", className)}>
          {/* Rating row (if provided) */}
          {rating !== undefined && (
            <div className="mb-4 pb-4 border-b border-slate-100">
              <RatingDisplayV2 rating={rating} reviewCount={reviewCount} />
            </div>
          )}

          {/* Trust badges */}
          <div className={cn(layoutClasses[variant])}>
            {computedBadges.map((badge, index) =>
              variant === "certificates" ? (
                <CertificateBadge
                  key={`${badge.type}-${index}`}
                  badge={badge}
                  index={index}
                />
              ) : (
                <TrustBadgeV2Component
                  key={`${badge.type}-${index}`}
                  badge={badge}
                  compact={compact}
                  index={index}
                />
              ),
            )}
          </div>
        </div>
      );
    },
  ),
);

TrustRowV2.displayName = "TrustRowV2";

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Product page trust row (Pack Confiance V2)
 */
export const ProductTrustRowV2 = memo(function ProductTrustRowV2({
  rating,
  reviewCount,
  warrantyYears = 2,
  returnDays = 30,
  isOemQuality = false,
  className,
}: Partial<TrustRowV2Props>) {
  return (
    <TrustRowV2
      rating={rating}
      reviewCount={reviewCount}
      warrantyYears={warrantyYears}
      returnDays={returnDays}
      isOemQuality={isOemQuality}
      variant="row"
      className={className}
    />
  );
});

/**
 * Compact trust badges for mobile
 */
export const CompactTrustBadgesV2 = memo(function CompactTrustBadgesV2({
  warrantyYears = 2,
  isOemQuality = false,
  className,
}: Pick<TrustRowV2Props, "warrantyYears" | "isOemQuality" | "className">) {
  return (
    <TrustRowV2
      warrantyYears={warrantyYears}
      isOemQuality={isOemQuality}
      compact
      variant="row"
      className={className}
    />
  );
});

/**
 * Footer trust row with certificate style
 */
export const FooterTrustRowV2 = memo(function FooterTrustRowV2({
  className,
}: {
  className?: string;
}) {
  const badges: TrustBadgeV2[] = [
    {
      type: "secure",
      label: "Paiement sécurisé",
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
      label: "Garantie",
      sublabel: "2 ans minimum",
    },
  ];

  return (
    <TrustRowV2 badges={badges} variant="certificates" className={className} />
  );
});

export { TrustRowV2 };
