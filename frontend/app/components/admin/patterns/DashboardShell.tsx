/**
 * DashboardShell - Layout standardisé pour dashboards admin
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md Section 6
 *
 * Hiérarchie obligatoire: Header → KPIs → Filters → Data → Actions
 * Mobile-first avec responsive breakpoints progressifs
 */

import { cn } from "~/lib/utils";

export interface DashboardShellProps {
  /** Titre de la page */
  title: string;
  /** Description sous le titre */
  description?: string;
  /** Breadcrumb navigation */
  breadcrumb?: React.ReactNode;
  /** Actions en haut à droite (boutons) */
  actions?: React.ReactNode;
  /** Grille de KPIs */
  kpis?: React.ReactNode;
  /** Barre de filtres */
  filters?: React.ReactNode;
  /** Contenu principal */
  children: React.ReactNode;
  /** Classes CSS additionnelles */
  className?: string;
}

export function DashboardShell({
  title,
  description,
  breadcrumb,
  actions,
  kpis,
  filters,
  children,
  className,
}: DashboardShellProps) {
  return (
    <div className={cn("space-y-4 sm:space-y-6", className)}>
      {/* Breadcrumb */}
      {breadcrumb && (
        <nav className="text-sm text-muted-foreground">{breadcrumb}</nav>
      )}

      {/* Header: Title + Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold sm:text-xl lg:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {actions}
          </div>
        )}
      </div>

      {/* KPIs Grid */}
      {kpis && <div className="w-full">{kpis}</div>}

      {/* Filters */}
      {filters && <div className="w-full">{filters}</div>}

      {/* Main Content */}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/**
 * KpiGrid - Grille responsive mobile-first pour KPIs
 *
 * OBLIGATOIRE: grid-cols-1 en premier (mobile-first)
 */
export interface KpiGridProps {
  children: React.ReactNode;
  /** Nombre de colonnes sur desktop (2, 3, ou 4) */
  columns?: 2 | 3 | 4;
  /** Classes CSS additionnelles */
  className?: string;
}

export function KpiGrid({ children, columns = 4, className }: KpiGridProps) {
  const columnClasses = {
    2: "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4",
    3: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4",
    4: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4",
  };

  return (
    <div className={cn(columnClasses[columns], className)}>{children}</div>
  );
}

/**
 * ContentGrid - Grille responsive pour contenu principal
 */
export interface ContentGridProps {
  children: React.ReactNode;
  /** Layout: sidebar + main ou full width */
  layout?: "full" | "sidebar";
  /** Classes CSS additionnelles */
  className?: string;
}

export function ContentGrid({
  children,
  layout = "full",
  className,
}: ContentGridProps) {
  const layoutClasses = {
    full: "w-full",
    sidebar: "grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6",
  };

  return <div className={cn(layoutClasses[layout], className)}>{children}</div>;
}
