/**
 * CompatibilityBadgeV2 Component
 * @description Prominent compatibility badge with 3 states for product pages
 * @version 2.0.0
 * @pack Pack Confiance V2 - Trust-First + Compatibility
 *
 * Design System: ui-ux-pro-max + frontend-design
 * Style: Trust & Authority
 * States: Compatible (green), Non compatible (red), Inconnu (gray with CTA)
 *
 * Killer Feature: "Compatibilité Instantanée + Résolution 10s"
 */

import {
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
  ChevronRight,
  Car,
  Loader2,
  Sparkles,
} from "lucide-react";
import { forwardRef, useState, useEffect, memo } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

// ============================================================================
// Design System Tokens (from design-system.ts)
// ============================================================================

const BADGE_COLORS = {
  compatible: {
    bg: "bg-gradient-to-r from-[#ECFDF5] to-[#D1FAE5]",
    border: "border-[#6EE7B7]",
    text: "text-[#065F46]",
    icon: "text-[#059669]",
    ring: "ring-[#059669]/20",
  },
  incompatible: {
    bg: "bg-gradient-to-r from-[#FEF2F2] to-[#FEE2E2]",
    border: "border-[#FCA5A5]",
    text: "text-[#991B1B]",
    icon: "text-[#DC2626]",
    ring: "ring-[#DC2626]/20",
  },
  unknown: {
    bg: "bg-gradient-to-r from-[#F8FAFC] to-[#F1F5F9]",
    border: "border-[#CBD5E1]",
    text: "text-[#475569]",
    icon: "text-[#64748B]",
    ring: "ring-[#64748B]/20",
  },
} as const;

// ============================================================================
// Types
// ============================================================================

export interface VehicleInfoV2 {
  brand: string;
  model: string;
  generation?: string;
  yearFrom?: number;
  yearTo?: number;
  fuelType?: "essence" | "diesel" | "hybride" | "electrique";
  powerHp?: number;
  engineCode?: string;
  cnit?: string;
  typeMine?: string;
}

export interface CompatibilityBadgeV2Props {
  /** Product ID for compatibility check */
  productId: string | number;
  /** Product name for display */
  productName?: string;
  /** Compatibility state: true = compatible, false = incompatible, null/undefined = unknown */
  isCompatible?: boolean | null;
  /** Current vehicle context */
  currentVehicle?: VehicleInfoV2 | null;
  /** Confidence score (0-100) */
  confidenceScore?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Click handler for "Verify" CTA (unknown state) */
  onVerifyClick?: () => void;
  /** Click handler for "Change vehicle" action */
  onChangeVehicle?: () => void;
  /** Additional className */
  className?: string;
  /** Display variant */
  variant?: "full" | "compact" | "minimal";
  /** Show confidence indicator */
  showConfidence?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

function VehicleDisplay({ vehicle }: { vehicle: VehicleInfoV2 }) {
  const displayText = [
    vehicle.brand,
    vehicle.model,
    vehicle.generation,
    vehicle.yearFrom && vehicle.yearTo
      ? `(${vehicle.yearFrom}-${vehicle.yearTo})`
      : vehicle.yearFrom
        ? `(${vehicle.yearFrom}+)`
        : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Car className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate max-w-[180px] sm:max-w-[250px]">
        {displayText}
      </span>
    </div>
  );
}

function ConfidenceIndicator({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 90) return "bg-[#059669]";
    if (score >= 70) return "bg-[#D97706]";
    return "bg-[#DC2626]";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            getColor(),
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">{score}%</span>
    </div>
  );
}

// ============================================================================
// Compatible State
// ============================================================================

function CompatibleBadge({
  vehicle,
  confidenceScore,
  showConfidence,
  onChangeVehicle,
  variant,
}: {
  vehicle?: VehicleInfoV2 | null;
  confidenceScore?: number;
  showConfidence?: boolean;
  onChangeVehicle?: () => void;
  variant: "full" | "compact" | "minimal";
}) {
  const [showCelebration, setShowCelebration] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowCelebration(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5",
          "px-2.5 py-1 rounded-full",
          "text-sm font-medium",
          BADGE_COLORS.compatible.bg,
          BADGE_COLORS.compatible.text,
          "border",
          BADGE_COLORS.compatible.border,
        )}
      >
        <ShieldCheck className={cn("h-4 w-4", BADGE_COLORS.compatible.icon)} />
        <span>Compatible</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-between",
        "px-4 py-3 rounded-xl",
        BADGE_COLORS.compatible.bg,
        "border",
        BADGE_COLORS.compatible.border,
        "shadow-sm",
        "transition-all duration-300",
        "hover:shadow-md",
        showCelebration && "ring-2 ring-offset-2",
        showCelebration && BADGE_COLORS.compatible.ring,
      )}
    >
      {/* Celebration sparkle effect */}
      {showCelebration && (
        <div className="absolute -top-1 -right-1">
          <Sparkles
            className={cn(
              "h-5 w-5 text-amber-400",
              "animate-[verified-reveal_300ms_ease-out]",
            )}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center",
            "h-10 w-10 rounded-full",
            "bg-[#059669]/10",
            "animate-[verified-reveal_300ms_ease-out]",
          )}
        >
          <ShieldCheck
            className={cn("h-5 w-5", BADGE_COLORS.compatible.icon)}
          />
        </div>

        <div className="min-w-0">
          <div
            className={cn("text-sm font-bold", BADGE_COLORS.compatible.text)}
            style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
          >
            Compatible avec votre véhicule
          </div>

          {vehicle && variant === "full" && (
            <div
              className={cn(
                "mt-0.5",
                BADGE_COLORS.compatible.text,
                "opacity-80",
              )}
            >
              <VehicleDisplay vehicle={vehicle} />
            </div>
          )}

          {showConfidence && confidenceScore !== undefined && (
            <div className="mt-1.5">
              <ConfidenceIndicator score={confidenceScore} />
            </div>
          )}
        </div>
      </div>

      {onChangeVehicle && variant === "full" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onChangeVehicle}
          className="text-[#059669] hover:text-[#047857] hover:bg-[#D1FAE5]"
        >
          Modifier
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Incompatible State
// ============================================================================

function IncompatibleBadge({
  vehicle,
  onChangeVehicle,
  variant,
}: {
  vehicle?: VehicleInfoV2 | null;
  onChangeVehicle?: () => void;
  variant: "full" | "compact" | "minimal";
}) {
  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5",
          "px-2.5 py-1 rounded-full",
          "text-sm font-medium",
          BADGE_COLORS.incompatible.bg,
          BADGE_COLORS.incompatible.text,
          "border",
          BADGE_COLORS.incompatible.border,
        )}
      >
        <ShieldX className={cn("h-4 w-4", BADGE_COLORS.incompatible.icon)} />
        <span>Non compatible</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "px-4 py-3 rounded-xl",
        BADGE_COLORS.incompatible.bg,
        "border",
        BADGE_COLORS.incompatible.border,
        "shadow-sm",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center",
            "h-10 w-10 rounded-full",
            "bg-[#DC2626]/10",
          )}
        >
          <ShieldX className={cn("h-5 w-5", BADGE_COLORS.incompatible.icon)} />
        </div>

        <div className="min-w-0">
          <div
            className={cn("text-sm font-bold", BADGE_COLORS.incompatible.text)}
            style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
          >
            Non compatible avec votre véhicule
          </div>

          {vehicle && variant === "full" && (
            <div
              className={cn(
                "mt-0.5",
                BADGE_COLORS.incompatible.text,
                "opacity-80",
              )}
            >
              <VehicleDisplay vehicle={vehicle} />
            </div>
          )}
        </div>
      </div>

      {onChangeVehicle && (
        <Button
          variant="outline"
          size="sm"
          onClick={onChangeVehicle}
          className="border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2]"
        >
          Changer véhicule
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Unknown State (with CTA)
// ============================================================================

function UnknownBadge({
  onVerifyClick,
  isLoading,
  variant,
}: {
  onVerifyClick?: () => void;
  isLoading?: boolean;
  variant: "full" | "compact" | "minimal";
}) {
  if (variant === "minimal") {
    return (
      <button
        onClick={onVerifyClick}
        disabled={isLoading}
        className={cn(
          "inline-flex items-center gap-1.5",
          "px-2.5 py-1 rounded-full",
          "text-sm font-medium",
          BADGE_COLORS.unknown.bg,
          BADGE_COLORS.unknown.text,
          "border",
          BADGE_COLORS.unknown.border,
          "cursor-pointer",
          "hover:bg-slate-100",
          "transition-colors duration-200",
        )}
      >
        <ShieldQuestion className={cn("h-4 w-4", BADGE_COLORS.unknown.icon)} />
        <span>Vérifier</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "px-4 py-3 rounded-xl",
        BADGE_COLORS.unknown.bg,
        "border",
        BADGE_COLORS.unknown.border,
        "shadow-sm",
        "transition-all duration-200",
        "hover:shadow-md hover:border-[#0369A1]",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center",
            "h-10 w-10 rounded-full",
            "bg-slate-200/50",
          )}
        >
          <ShieldQuestion
            className={cn("h-5 w-5", BADGE_COLORS.unknown.icon)}
          />
        </div>

        <div>
          <div
            className={cn("text-sm font-bold", BADGE_COLORS.unknown.text)}
            style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
          >
            Compatibilité inconnue
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Vérifiez en 10 secondes
          </div>
        </div>
      </div>

      <Button
        onClick={onVerifyClick}
        disabled={isLoading}
        className={cn(
          "bg-[#0369A1] hover:bg-[#075985]",
          "text-white font-semibold",
          "px-4 py-2",
          "rounded-lg",
          "shadow-sm hover:shadow-md",
          "transition-all duration-200",
          "min-h-[44px]", // WCAG touch target
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Vérification...
          </>
        ) : (
          <>
            Vérifier
            <ChevronRight className="h-4 w-4 ml-1" />
          </>
        )}
      </Button>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingBadge({
  variant,
}: {
  variant: "full" | "compact" | "minimal";
}) {
  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5",
          "px-2.5 py-1 rounded-full",
          "text-sm font-medium",
          "bg-slate-100 text-slate-500",
          "border border-slate-200",
          "animate-pulse",
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Vérification...</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        "px-4 py-3 rounded-xl",
        "bg-slate-50",
        "border border-slate-200",
        "animate-pulse",
      )}
    >
      <div className="h-10 w-10 rounded-full bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-48" />
        <div className="h-3 bg-slate-200 rounded w-32" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const CompatibilityBadgeV2 = memo(
  forwardRef<HTMLDivElement, CompatibilityBadgeV2Props>(
    (
      {
        productId: _productId,
        productName: _productName,
        isCompatible,
        currentVehicle,
        confidenceScore,
        isLoading = false,
        onVerifyClick,
        onChangeVehicle,
        className,
        variant = "full",
        showConfidence = false,
      },
      ref,
    ) => {
      // Loading state
      if (isLoading) {
        return (
          <div ref={ref} className={className}>
            <LoadingBadge variant={variant} />
          </div>
        );
      }

      // Compatible state
      if (isCompatible === true) {
        return (
          <div ref={ref} className={className}>
            <CompatibleBadge
              vehicle={currentVehicle}
              confidenceScore={confidenceScore}
              showConfidence={showConfidence}
              onChangeVehicle={onChangeVehicle}
              variant={variant}
            />
          </div>
        );
      }

      // Incompatible state
      if (isCompatible === false) {
        return (
          <div ref={ref} className={className}>
            <IncompatibleBadge
              vehicle={currentVehicle}
              onChangeVehicle={onChangeVehicle}
              variant={variant}
            />
          </div>
        );
      }

      // Unknown state (null or undefined)
      return (
        <div ref={ref} className={className}>
          <UnknownBadge
            onVerifyClick={onVerifyClick}
            isLoading={isLoading}
            variant={variant}
          />
        </div>
      );
    },
  ),
);

CompatibilityBadgeV2.displayName = "CompatibilityBadgeV2";

export { CompatibilityBadgeV2 };
