/**
 * KpiCard - Carte KPI standardisée pour dashboards admin
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md
 *
 * Patterns respectés:
 * - shadcn/ui Card + Badge
 * - lucide-react pour icônes
 * - Gradient subtil inspiré dashboard-01 SectionCards
 * - Couleurs sémantiques (variant → token)
 */

import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export interface KpiCardProps {
  /** Titre du KPI */
  title: string;
  /** Valeur principale à afficher */
  value: string | number;
  /** Icône lucide-react */
  icon: LucideIcon;
  /** Variante de couleur sémantique */
  variant?: "default" | "success" | "warning" | "danger" | "info";
  /** Trend optionnel (pourcentage + direction) */
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  /** Sous-titre ou description */
  subtitle?: string;
  /** Classes CSS additionnelles */
  className?: string;
}

/**
 * Gradient subtil sur le Card entier (bas → haut)
 * Inspiré de dashboard-01 SectionCards: bg-gradient-to-t from-primary/5 to-card
 */
const variantGradients: Record<NonNullable<KpiCardProps["variant"]>, string> = {
  default: "",
  success: "bg-gradient-to-t from-success/5 to-card",
  warning: "bg-gradient-to-t from-warning/5 to-card",
  danger: "bg-gradient-to-t from-destructive/5 to-card",
  info: "bg-gradient-to-t from-info/5 to-card",
};

/**
 * Fond de la pastille icône
 */
const variantPillStyles: Record<
  NonNullable<KpiCardProps["variant"]>,
  string
> = {
  default: "bg-muted",
  success: "bg-success/10",
  warning: "bg-warning/10",
  danger: "bg-destructive/10",
  info: "bg-info/10",
};

const variantTextStyles: Record<
  NonNullable<KpiCardProps["variant"]>,
  string
> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
};

export function KpiCard({
  title,
  value,
  icon: Icon,
  variant = "default",
  trend,
  subtitle,
  className,
}: KpiCardProps) {
  const formattedValue =
    typeof value === "number" ? value.toLocaleString("fr-FR") : value;

  return (
    <Card
      className={cn(
        "transition-shadow duration-200 hover:shadow-md",
        variantGradients[variant],
        className,
      )}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Header: Icon pill + Title ← → Trend Badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("rounded-md p-1.5", variantPillStyles[variant])}>
              <Icon className={cn("h-4 w-4", variantTextStyles[variant])} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </span>
          </div>
          {trend && (
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1 rounded-lg text-xs",
                trend.direction === "up" ? "text-success" : "text-destructive",
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trend.value > 0 ? "+" : ""}
              {trend.value}%
            </Badge>
          )}
        </div>

        {/* Value */}
        <div className={cn("text-2xl font-bold", variantTextStyles[variant])}>
          {formattedValue}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
