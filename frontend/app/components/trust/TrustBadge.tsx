/**
 * 🏆 TrustBadge - Badges de confiance pour rassurer l'acheteur
 *
 * Types:
 * - oem: Pièce d'origine équipementier
 * - warranty: Garantie 1 an
 * - stock: Stock temps réel
 * - fast-delivery: Livraison rapide
 * - certified: Certifié qualité
 * - eco: Éco-responsable
 */

import { Shield, Package, Truck, CheckCircle, Leaf } from "lucide-react";
import { memo } from "react";
import { cn } from "~/lib/utils";

export type BadgeType =
  | "oem"
  | "warranty"
  | "stock"
  | "fast-delivery"
  | "certified"
  | "eco";

interface TrustBadgeProps {
  type: BadgeType;
  className?: string;
  variant?: "default" | "compact" | "icon-only";
}

const BADGE_CONFIG = {
  oem: {
    icon: Shield,
    label: "Pièce OEM",
    description: "Qualité équipementier d'origine",
    color: "blue",
  },
  warranty: {
    icon: Shield,
    label: "Garantie 1 an",
    description: "Garantie constructeur incluse",
    color: "green",
  },
  stock: {
    icon: Package,
    label: "En stock",
    description: "Stock temps réel vérifié",
    color: "emerald",
  },
  "fast-delivery": {
    icon: Truck,
    label: "Livraison rapide",
    description: "Expédition sous 24h",
    color: "orange",
  },
  certified: {
    icon: CheckCircle,
    label: "Certifié",
    description: "Conforme normes ISO",
    color: "purple",
  },
  eco: {
    icon: Leaf,
    label: "Éco-responsable",
    description: "Recyclable et durable",
    color: "teal",
  },
} as const;

const COLOR_VARIANTS = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-green-50 text-green-700 border-green-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  purple: "bg-muted text-foreground border-purple-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
} as const;

export const TrustBadge = memo(function TrustBadge({
  type,
  className,
  variant = "default",
}: TrustBadgeProps) {
  const config = BADGE_CONFIG[type];
  const Icon = config.icon;
  const colorClass = COLOR_VARIANTS[config.color];

  // Icon only
  if (variant === "icon-only") {
    return (
      <div
        className={cn("inline-flex items-center justify-center", className)}
        title={config.description}
      >
        <Icon
          className={cn("w-4 h-4", config.color === "blue" && "text-blue-600")}
        />
      </div>
    );
  }

  // Compact
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border",
          colorClass,
          className,
        )}
        title={config.description}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{config.label}</span>
      </div>
    );
  }

  // Default (avec description)
  return (
    <div
      className={cn(
        "inline-flex items-start gap-2 px-3 py-2 rounded-lg border",
        colorClass,
        className,
      )}
    >
      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{config.label}</span>
        <span className="text-xs opacity-80">{config.description}</span>
      </div>
    </div>
  );
});

/**
 * TrustBadgeGroup - Groupe de badges pour affichage cohérent
 */
interface TrustBadgeGroupProps {
  badges: BadgeType[];
  variant?: "default" | "compact" | "icon-only";
  className?: string;
}

export const TrustBadgeGroup = memo(function TrustBadgeGroup({
  badges,
  variant = "compact",
  className,
}: TrustBadgeGroupProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {badges.map((type) => (
        <TrustBadge key={type} type={type} variant={variant} />
      ))}
    </div>
  );
});
