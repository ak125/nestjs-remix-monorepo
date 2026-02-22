/**
 * ResponsiveDataTable - Table dual-mode (cards mobile / table desktop)
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md Section "Mobile-First Data UX"
 *
 * Mobile (< md): Cards avec 3 champs prioritaires + "Voir+" drawer
 * Desktop (>= md): Table complète avec tri et pagination
 *
 * Pattern Senior: UX type Stripe/Notion
 */

import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { StatusBadge, type StatusType } from "./StatusBadge";

export interface DataColumn<T> {
  /** Clé de la propriété */
  key: keyof T;
  /** En-tête de colonne */
  header: string;
  /** Alignement */
  align?: "left" | "center" | "right";
  /** Largeur (desktop) */
  width?: string;
  /** Tri activé */
  sortable?: boolean;
  /** Priorité mobile (1-3 = visible, >3 = drawer only) */
  mobilePriority?: number;
  /** Fonction de rendu custom */
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface ResponsiveDataTableProps<T extends Record<string, unknown>> {
  /** Données à afficher */
  data: T[];
  /** Configuration des colonnes */
  columns: DataColumn<T>[];
  /** Colonne de status pour badge automatique */
  statusColumn?: {
    key: keyof T;
    mapping: Record<string, StatusType>;
  };
  /** Fonction pour générer une clé unique */
  getRowKey: (row: T) => string;
  /** Message si vide */
  emptyMessage?: string;
  /** Tri actuel */
  sortBy?: keyof T;
  /** Direction du tri */
  sortDirection?: "asc" | "desc";
  /** Callback changement de tri */
  onSort?: (key: keyof T) => void;
  /** Callback click sur ligne (desktop) */
  onRowClick?: (row: T) => void;
  /** Classes CSS */
  className?: string;
  /** @deprecated Utiliser pageSize. Conservé pour rétrocompatibilité. */
  maxRows?: number;
  /** Lignes par page (default 50) */
  pageSize?: number;
}

export function ResponsiveDataTable<T extends Record<string, unknown>>({
  data,
  columns,
  statusColumn,
  getRowKey,
  emptyMessage = "Aucune donnée",
  sortBy,
  sortDirection = "asc",
  onSort,
  onRowClick,
  className,
  maxRows,
  pageSize: pageSizeProp,
}: ResponsiveDataTableProps<T>) {
  const perPage = pageSizeProp ?? maxRows ?? 50;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<T | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Reset to page 1 when data changes (e.g. filter applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  // Colonnes visibles sur mobile (priorité 1-3)
  const mobileColumns = columns
    .filter((col) => col.mobilePriority && col.mobilePriority <= 3)
    .sort((a, b) => (a.mobilePriority || 99) - (b.mobilePriority || 99));

  // Colonnes dans le drawer (priorité > 3 ou toutes)
  const drawerColumns = columns.filter(
    (col) => !col.mobilePriority || col.mobilePriority > 3,
  );

  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  // Rendu d'une cellule
  const renderCell = (column: DataColumn<T>, row: T) => {
    const value = row[column.key];

    // Status column avec badge automatique
    if (statusColumn && column.key === statusColumn.key) {
      const statusValue = String(value);
      const statusType = statusColumn.mapping[statusValue];
      if (statusType) {
        return (
          <StatusBadge status={statusType} label={statusValue} size="sm" />
        );
      }
    }

    // Rendu personnalisé
    if (column.render) {
      return column.render(value, row);
    }

    // Rendu par défaut
    if (typeof value === "number") {
      return <span className="font-mono">{value.toLocaleString("fr-FR")}</span>;
    }

    return String(value ?? "-");
  };

  // Ouvrir le drawer avec les détails
  const openDetailDrawer = (row: T) => {
    setSelectedRow(row);
    setDrawerOpen(true);
  };

  if (data.length === 0) {
    return (
      <div className={cn("rounded-md border p-8 text-center", className)}>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.length / perPage);
  const safeCurrentPage = Math.min(currentPage, totalPages || 1);
  const startIdx = (safeCurrentPage - 1) * perPage;
  const displayData = data.slice(startIdx, startIdx + perPage);
  const showPagination = totalPages > 1;

  return (
    <div className={className}>
      {/* Mobile: Cards */}
      <div className="block md:hidden space-y-3">
        {displayData.map((row) => (
          <Card
            key={getRowKey(row)}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openDetailDrawer(row)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 space-y-2">
                  {mobileColumns.map((column) => (
                    <div
                      key={String(column.key)}
                      className="flex items-center gap-2"
                    >
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide min-w-[60px]">
                        {column.header}
                      </span>
                      <span className="text-sm">{renderCell(column, row)}</span>
                    </div>
                  ))}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}

        {showPagination && (
          <PaginationBar
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={data.length}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    alignClasses[column.align || "left"],
                    column.sortable &&
                      "cursor-pointer select-none hover:bg-muted/50",
                    column.width && `w-[${column.width}]`,
                  )}
                  style={column.width ? { width: column.width } : undefined}
                  onClick={() => column.sortable && onSort?.(column.key)}
                >
                  <span className="flex items-center gap-1">
                    {column.header}
                    {column.sortable &&
                      sortBy === column.key &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      ))}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((row) => (
              <TableRow
                key={getRowKey(row)}
                className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <TableCell
                    key={String(column.key)}
                    className={cn(
                      alignClasses[column.align || "left"],
                      "text-sm",
                    )}
                  >
                    {renderCell(column, row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {showPagination && (
          <PaginationBar
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={data.length}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Drawer détail (mobile) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle>Détails</SheetTitle>
          </SheetHeader>
          {selectedRow && (
            <div className="py-4 space-y-4 overflow-y-auto">
              {/* Champs prioritaires */}
              <div className="space-y-3">
                {mobileColumns.map((column) => (
                  <div
                    key={String(column.key)}
                    className="flex justify-between items-center py-2 border-b"
                  >
                    <span className="text-sm font-medium text-muted-foreground">
                      {column.header}
                    </span>
                    <span className="text-sm text-right">
                      {renderCell(column, selectedRow)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Champs secondaires */}
              {drawerColumns.length > 0 && (
                <div className="space-y-3 pt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Informations complémentaires
                  </p>
                  {drawerColumns.map((column) => (
                    <div
                      key={String(column.key)}
                      className="flex justify-between items-center py-2 border-b"
                    >
                      <span className="text-sm font-medium text-muted-foreground">
                        {column.header}
                      </span>
                      <span className="text-sm text-right">
                        {renderCell(column, selectedRow)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action ouvrir détail complet */}
              {onRowClick && (
                <Button
                  className="w-full mt-4 min-h-11"
                  onClick={() => {
                    setDrawerOpen(false);
                    onRowClick(selectedRow);
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Voir la fiche complète
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  // Show max 5 page buttons with ellipsis
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
      <span className="text-xs text-muted-foreground">
        {totalItems} résultat{totalItems > 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="px-1 text-xs text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0 text-xs"
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Helper pour créer une colonne typée
 */
export function createDataColumn<T extends Record<string, unknown>>(
  config: DataColumn<T>,
): DataColumn<T> {
  return {
    mobilePriority: 99, // Par défaut, pas visible sur mobile
    ...config,
  };
}
