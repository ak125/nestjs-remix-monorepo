/**
 * AuditTable - Table d'audit avec vue mobile cards
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md Section 4
 *
 * Pattern responsive: Table sur desktop, Cards sur mobile
 * Utilise shadcn/ui Table + lucide-react icons
 */

import { StatusBadge, type StatusType } from "./StatusBadge";
import { Card, CardContent } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

export interface AuditColumn<T> {
  /** Clé de la propriété dans l'objet */
  key: keyof T;
  /** En-tête de colonne */
  header: string;
  /** Alignement du contenu */
  align?: "left" | "center" | "right";
  /** Largeur minimale */
  minWidth?: string;
  /** Fonction de rendu personnalisée */
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  /** Masquer sur mobile */
  hideOnMobile?: boolean;
}

export interface AuditTableProps<T extends Record<string, unknown>> {
  /** Données à afficher */
  data: T[];
  /** Configuration des colonnes */
  columns: AuditColumn<T>[];
  /** Colonne de status pour badge automatique */
  statusColumn?: {
    key: keyof T;
    mapping: Record<string, StatusType>;
  };
  /** Message si aucune donnée */
  emptyMessage?: string;
  /** Classes CSS additionnelles */
  className?: string;
  /** Fonction pour générer une clé unique par ligne */
  getRowKey?: (row: T, index: number) => string;
}

export function AuditTable<T extends Record<string, unknown>>({
  data,
  columns,
  statusColumn,
  emptyMessage = "Aucune donnée",
  className,
  getRowKey = (_row, index) => String(index),
}: AuditTableProps<T>) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  // Colonnes visibles sur mobile
  const mobileColumns = columns.filter((col) => !col.hideOnMobile);

  // Rendu d'une cellule
  const renderCell = (column: AuditColumn<T>, row: T) => {
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

  if (data.length === 0) {
    return (
      <div className={cn("rounded-md border p-8 text-center", className)}>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Desktop: Table standard */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    alignClasses[column.align || "left"],
                    column.minWidth && `min-w-[${column.minWidth}]`,
                  )}
                  style={
                    column.minWidth ? { minWidth: column.minWidth } : undefined
                  }
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={getRowKey(row, index)}>
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
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {data.map((row, index) => (
          <Card key={getRowKey(row, index)}>
            <CardContent className="p-4 space-y-2">
              {mobileColumns.map((column) => (
                <div
                  key={String(column.key)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {column.header}
                  </span>
                  <span className="text-sm text-right">
                    {renderCell(column, row)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Helpers pour créer des colonnes typées
 */
export function createColumn<T extends Record<string, unknown>>(
  config: AuditColumn<T>,
): AuditColumn<T> {
  return config;
}

export function createStatusColumn<T extends Record<string, unknown>>(
  key: keyof T,
  mapping: Record<string, StatusType>,
): { key: keyof T; mapping: Record<string, StatusType> } {
  return { key, mapping };
}
