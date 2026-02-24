/**
 * useTableUrlState - Hook pour etat table synchronise avec URL
 *
 * Remplace le boilerplate useSearchParams repetitif dans les routes admin.
 * Gere : page, search, sort, direction, filtres custom.
 *
 * Usage:
 *   const table = useTableUrlState({
 *     defaultSort: "created_at",
 *     defaultDir: "desc",
 *     filterKeys: ["status", "type", "role"],
 *   });
 *
 *   // Lecture
 *   table.page, table.search, table.sortBy, table.sortDir
 *   table.filters.status, table.filters.type
 *
 *   // Actions
 *   table.setPage(2), table.setSearch("disque"), table.setSort("name")
 *   table.setFilter("status", "draft"), table.resetFilters()
 */

import { useSearchParams } from "@remix-run/react";
import { useCallback, useMemo } from "react";

interface UseTableUrlStateConfig {
  /** Default sort column */
  defaultSort?: string;
  /** Default sort direction */
  defaultDir?: "asc" | "desc";
  /** Known filter keys to track */
  filterKeys?: string[];
  /** Default page size (for reference, not stored in URL) */
  pageSize?: number;
}

interface TableUrlState {
  page: number;
  search: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  filters: Record<string, string>;
  pageSize: number;
  activeFilterCount: number;
  setPage: (page: number) => void;
  setSearch: (query: string) => void;
  setSort: (key: string) => void;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
}

export function useTableUrlState(
  config: UseTableUrlStateConfig = {},
): TableUrlState {
  const {
    defaultSort = "",
    defaultDir = "asc",
    filterKeys = [],
    pageSize = 50,
  } = config;

  const [searchParams, setSearchParams] = useSearchParams();

  // Read state from URL
  const page = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("q") || "";
  const sortBy = searchParams.get("sort") || defaultSort;
  const sortDir = (searchParams.get("dir") as "asc" | "desc") || defaultDir;

  const filters = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of filterKeys) {
      const value = searchParams.get(key);
      if (value) result[key] = value;
    }
    return result;
  }, [searchParams, filterKeys]);

  const activeFilterCount = useMemo(
    () => Object.keys(filters).length + (search ? 1 : 0),
    [filters, search],
  );

  // Helper to update params (resets page to 1 on filter/search change)
  const updateParams = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        if (resetPage && !("page" in updates)) {
          next.delete("page");
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => updateParams({ page: p > 1 ? String(p) : null }, false),
    [updateParams],
  );

  const setSearch = useCallback(
    (q: string) => updateParams({ q: q || null }),
    [updateParams],
  );

  const setSort = useCallback(
    (key: string) => {
      // Toggle direction if same column, otherwise default
      const newDir = key === sortBy && sortDir === "asc" ? "desc" : "asc";
      updateParams({ sort: key, dir: newDir }, false);
    },
    [updateParams, sortBy, sortDir],
  );

  const setFilter = useCallback(
    (key: string, value: string) => updateParams({ [key]: value || null }),
    [updateParams],
  );

  const resetFilters = useCallback(() => {
    const resets: Record<string, null> = { q: null, page: null };
    for (const key of filterKeys) {
      resets[key] = null;
    }
    updateParams(resets, false);
  }, [updateParams, filterKeys]);

  return {
    page,
    search,
    sortBy,
    sortDir,
    filters,
    pageSize,
    activeFilterCount,
    setPage,
    setSearch,
    setSort,
    setFilter,
    resetFilters,
  };
}
