/**
 * KpiCard - Carte KPI standardisée pour dashboards admin
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md
 *
 * Patterns respectés:
 * - shadcn/ui Card
 * - lucide-react pour icônes
 * - Couleurs sémantiques (variant → token)
 */

import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
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
 * Mapping variant → classes Tailwind sémantiques
 * Respecte DESIGN-SYSTEM.automecanik.md Section 3
 */
const variantStyles: Record<NonNullable<KpiCardProps["variant"]>, string> = {
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
        className,
      )}
    >
      <CardContent className="p-4">
        <div className={cn("rounded-lg p-3", variantStyles[variant])}>
          {/* Header: Icon + Title */}
          <div className="flex items-center gap-2 mb-2">
            <Icon className={cn("h-4 w-4", variantTextStyles[variant])} />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </span>
          </div>

          {/* Value */}
          <div className={cn("text-2xl font-bold", variantTextStyles[variant])}>
            {formattedValue}
          </div>

          {/* Footer: Subtitle or Trend */}
          {(subtitle || trend) && (
            <div className="mt-1 flex items-center gap-2">
              {trend && (
                <span
                  className={cn(
                    "flex items-center text-xs font-medium",
                    trend.direction === "up"
                      ? "text-success"
                      : "text-destructive",
                  )}
                >
                  {trend.direction === "up" ? (
                    <TrendingUp className="mr-1 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3" />
                  )}
                  {trend.value > 0 ? "+" : ""}
                  {trend.value}%
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
