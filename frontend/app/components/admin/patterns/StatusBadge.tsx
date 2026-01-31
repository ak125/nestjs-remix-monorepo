/**
 * StatusBadge - Badge sémantique standardisé pour statuts
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md Section 3
 *
 * Mapping automatique status → couleur + icône + label
 * Remplace les badges manuels incohérents dans le codebase
 */

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export type StatusType =
  | "PASS"
  | "FAIL"
  | "WARN"
  | "PENDING"
  | "INFO"
  | "NEUTRAL";

export interface StatusBadgeProps {
  /** Type de status sémantique */
  status: StatusType;
  /** Label personnalisé (override le label par défaut) */
  label?: string;
  /** Masquer l'icône */
  hideIcon?: boolean;
  /** Taille du badge */
  size?: "sm" | "default";
  /** Classes CSS additionnelles */
  className?: string;
}

/**
 * Configuration complète par status
 * Respecte DESIGN-SYSTEM.automecanik.md "Mapping Status → Couleurs"
 */
interface StatusConfig {
  /** Classes Tailwind pour background + text */
  className: string;
  /** Icône lucide-react */
  icon: LucideIcon;
  /** Label par défaut (français) */
  defaultLabel: string;
}

const statusConfig: Record<StatusType, StatusConfig> = {
  PASS: {
    className: "bg-success/10 text-success hover:bg-success/20",
    icon: CheckCircle2,
    defaultLabel: "CONFORME",
  },
  FAIL: {
    className: "bg-destructive/10 text-destructive hover:bg-destructive/20",
    icon: XCircle,
    defaultLabel: "NON-CONFORME",
  },
  WARN: {
    className: "bg-warning/10 text-warning hover:bg-warning/20",
    icon: AlertTriangle,
    defaultLabel: "ATTENTION",
  },
  PENDING: {
    className: "bg-muted text-muted-foreground hover:bg-muted/80",
    icon: Clock,
    defaultLabel: "EN ATTENTE",
  },
  INFO: {
    className: "bg-info/10 text-info hover:bg-info/20",
    icon: Info,
    defaultLabel: "INFO",
  },
  NEUTRAL: {
    className: "bg-muted text-muted-foreground hover:bg-muted/80",
    icon: Info,
    defaultLabel: "-",
  },
};

export function StatusBadge({
  status,
  label,
  hideIcon = false,
  size = "default",
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const displayLabel = label ?? config.defaultLabel;

  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "px-2.5 py-1";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium transition-colors",
        config.className,
        sizeClasses,
        className,
      )}
    >
      {!hideIcon && <Icon className={cn("mr-1", iconSize)} />}
      {displayLabel}
    </Badge>
  );
}

/**
 * Alias pour les cas d'usage courants
 */
export function PassBadge({ label = "CONFORME" }: { label?: string }) {
  return <StatusBadge status="PASS" label={label} />;
}

export function FailBadge({ label = "NON-CONFORME" }: { label?: string }) {
  return <StatusBadge status="FAIL" label={label} />;
}

export function WarnBadge({ label = "ATTENTION" }: { label?: string }) {
  return <StatusBadge status="WARN" label={label} />;
}
