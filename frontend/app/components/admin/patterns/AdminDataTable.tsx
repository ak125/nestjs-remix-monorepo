/**
 * AdminDataTable - Table enrichie pour dashboards admin
 *
 * Etend le pattern ResponsiveDataTable avec :
 * - Selection (checkboxes + select-all)
 * - Rows expandables (contenu collapsible)
 * - Toolbar slot (search, filtres, bulk actions)
 * - Loading overlay (skeleton)
 * - Server-side pagination
 *
 * Usage simple (4 props) :
 *   <AdminDataTable data={items} columns={cols} getRowKey={r => r.id} />
 *
 * Usage complet :
 *   <AdminDataTable
 *     data={items} columns={cols} getRowKey={r => r.id}
 *     selectable onSelectionChange={setSelected}
 *     expandable renderExpandedRow={r => <Details row={r} />}
 *     toolbar={<FilterBar />}
 *     isLoading={navigation.state !== "idle"}
 *   />
 */

import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

import { PaginationBar, type DataColumn } from "./ResponsiveDataTable";
import { StatusBadge, type StatusType } from "./StatusBadge";
import { TableSkeleton } from "./TableSkeleton";

export interface AdminDataTableProps<T extends Record<string, any>> {
  /** Data rows */
  data: T[];
  /** Column definitions (reuses DataColumn from ResponsiveDataTable) */
  columns: DataColumn<T>[];
  /** Unique key extractor */
  getRowKey: (row: T) => string;

  /** Status column auto-badge */
  statusColumn?: {
    key: keyof T;
    mapping: Record<string, StatusType>;
  };

  /** Empty state message */
  emptyMessage?: string;
  /** Custom empty state node */
  emptyState?: React.ReactNode;

  /** Sorting */
  sortBy?: keyof T;
  sortDirection?: "asc" | "desc";
  onSort?: (key: keyof T) => void;

  /** Row click handler */
  onRowClick?: (row: T) => void;

  /** CSS class */
  className?: string;

  // --- Enhanced features (opt-in) ---

  /** Enable row selection with checkboxes */
  selectable?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: Set<string>) => void;

  /** Enable expandable rows */
  expandable?: boolean;
  /** Render function for expanded content */
  renderExpandedRow?: (row: T) => React.ReactNode;

  /** Server-side pagination (overrides client-side) */
  serverPagination?: {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  /** Client-side page size (default 50) */
  pageSize?: number;

  /** Toolbar slot (renders above table) */
  toolbar?: React.ReactNode;

  /** Loading overlay */
  isLoading?: boolean;
}

export function AdminDataTable<T extends Record<string, any>>({
  data,
  columns,
  getRowKey,
  statusColumn,
  emptyMessage = "Aucune donnée",
  emptyState,
  sortBy,
  sortDirection = "asc",
  onSort,
  onRowClick,
  className,
  selectable = false,
  onSelectionChange,
  expandable = false,
  renderExpandedRow,
  serverPagination,
  pageSize = 50,
  toolbar,
  isLoading = false,
}: AdminDataTableProps<T>) {
  // --- Selection state ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange?.(next);
        return next;
      });
    },
    [onSelectionChange],
  );

  const toggleSelectAll = useCallback(() => {
    const allIds = data.map(getRowKey);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    const next = allSelected ? new Set<string>() : new Set(allIds);
    setSelectedIds(next);
    onSelectionChange?.(next);
  }, [data, getRowKey, selectedIds, onSelectionChange]);

  // Clear selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [data.length]);

  // --- Expandable state ---
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // --- Pagination ---
  const [clientPage, setClientPage] = useState(1);

  useEffect(() => {
    setClientPage(1);
  }, [data.length]);

  const isServerPaginated = !!serverPagination;
  const currentPage = isServerPaginated ? serverPagination.page : clientPage;
  const perPage = isServerPaginated ? serverPagination.pageSize : pageSize;
  const totalItems = isServerPaginated ? serverPagination.total : data.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const safeCurrentPage = Math.min(currentPage, totalPages || 1);
  const showPagination = totalPages > 1;

  const displayData = useMemo(() => {
    if (isServerPaginated) return data; // Server already sliced
    const startIdx = (safeCurrentPage - 1) * perPage;
    return data.slice(startIdx, startIdx + perPage);
  }, [data, isServerPaginated, safeCurrentPage, perPage]);

  const handlePageChange = isServerPaginated
    ? serverPagination.onPageChange
    : setClientPage;

  // --- Helpers ---
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  const renderCell = (column: DataColumn<T>, row: T) => {
    const value = row[column.key];
    if (statusColumn && column.key === statusColumn.key) {
      const statusValue = String(value);
      const statusType = statusColumn.mapping[statusValue];
      if (statusType) {
        return (
          <StatusBadge status={statusType} label={statusValue} size="sm" />
        );
      }
    }
    if (column.render) return column.render(value, row);
    if (typeof value === "number") {
      return <span className="font-mono">{value.toLocaleString("fr-FR")}</span>;
    }
    return String(value ?? "-");
  };

  // --- Selection helpers ---
  const allIds = data.map(getRowKey);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));
  const isIndeterminate = someSelected && !allSelected;

  // Total columns (for colSpan)
  const totalCols =
    columns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);

  // --- Empty state ---
  if (data.length === 0 && !isLoading) {
    return (
      <div className={className}>
        {toolbar && <div className="mb-4">{toolbar}</div>}
        {emptyState || (
          <div className="rounded-md border p-8 text-center">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Toolbar */}
      {toolbar && <div className="mb-4">{toolbar}</div>}

      {/* Selection summary */}
      {selectable && selectedIds.size > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <span className="font-medium">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            className="ml-auto text-xs underline hover:no-underline"
            onClick={() => {
              setSelectedIds(new Set());
              onSelectionChange?.(new Set());
            }}
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-[40px] px-3">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={isIndeterminate}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
              )}
              {expandable && <TableHead className="w-[40px] px-2" />}
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    alignClasses[column.align || "left"],
                    column.sortable &&
                      "cursor-pointer select-none hover:bg-muted/50",
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
            {displayData.map((row) => {
              const rowKey = getRowKey(row);
              const isExpanded = expandedIds.has(rowKey);
              const isSelected = selectedIds.has(rowKey);

              return (
                <RowGroup key={rowKey}>
                  <TableRow
                    className={cn(
                      onRowClick && "cursor-pointer",
                      isSelected && "bg-blue-50",
                      !isSelected && "hover:bg-muted/50",
                    )}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => {
                      if (expandable) toggleExpand(rowKey);
                      else onRowClick?.(row);
                    }}
                  >
                    {selectable && (
                      <TableCell
                        className="px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(rowKey)}
                          aria-label={`Sélectionner ${rowKey}`}
                        />
                      </TableCell>
                    )}
                    {expandable && (
                      <TableCell className="px-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    )}
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

                  {/* Expanded row */}
                  {expandable && isExpanded && renderExpandedRow && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={totalCols} className="p-0">
                        <div className="px-6 py-4">
                          {renderExpandedRow(row)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </RowGroup>
              );
            })}
          </TableBody>
        </Table>

        {showPagination && (
          <PaginationBar
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-[1px]">
          <TableSkeleton
            columns={totalCols}
            rows={Math.min(displayData.length || 5, 8)}
          />
        </div>
      )}
    </div>
  );
}

/** Fragment wrapper for row + expanded row pair */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
