/**
 * 🚀 HOOK D'OPTIMISATION PAGINATION
 * 
 * Hook React personnalisé pour pagination performante
 * avec virtualisation et lazy loading
 */

import { useState, useCallback, useMemo } from 'react';

interface UsePaginationProps {
  totalItems: number;
  itemsPerPage?: number;
  maxVisiblePages?: number;
}

interface UsePaginationReturn {
  currentPage: number;
  totalPages: number;
  visiblePages: number[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  goToPage: (page: number) => void;
  goToNext: () => void;
  goToPrev: () => void;
  getItemsForPage: <T>(items: T[]) => T[];
  paginationInfo: {
    start: number;
    end: number;
    total: number;
  };
}

export function usePagination({
  totalItems,
  itemsPerPage = 20, // Optimisé pour les grandes listes
  maxVisiblePages = 5
}: UsePaginationProps): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = useMemo(
    () => Math.ceil(totalItems / itemsPerPage),
    [totalItems, itemsPerPage]
  );

  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Calcul des pages visibles (ex: [...] 3 4 [5] 6 7 [...])
  const visiblePages = useMemo(() => {
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(currentPage - half, 1);
    let end = Math.min(start + maxVisiblePages - 1, totalPages);
    
    // Ajuster le début si on est proche de la fin
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(end - maxVisiblePages + 1, 1);
    }
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages, maxVisiblePages]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const goToNext = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const goToPrev = useCallback(() => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPrevPage]);

  // Helper pour extraire les items de la page courante
  const getItemsForPage = useCallback(<T>(items: T[]): T[] => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return items.slice(start, end);
  }, [currentPage, itemsPerPage]);

  const paginationInfo = useMemo(() => ({
    start: (currentPage - 1) * itemsPerPage + 1,
    end: Math.min(currentPage * itemsPerPage, totalItems),
    total: totalItems
  }), [currentPage, itemsPerPage, totalItems]);

  return {
    currentPage,
    totalPages,
    visiblePages,
    hasNextPage,
    hasPrevPage,
    goToPage,
    goToNext,
    goToPrev,
    getItemsForPage,
    paginationInfo
  };
}
