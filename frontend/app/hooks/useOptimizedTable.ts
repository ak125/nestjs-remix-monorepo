/**
 * 📋 HOOK OPTIMISÉ POUR TABLEAU AVEC PAGINATION
 * 
 * Hook personnalisé pour gérer les tableaux paginés avec performance
 * optimisée pour de gros volumes de données (409k+ items)
 */

import { useState, useCallback, useMemo } from 'react';
import { usePagination } from '../hooks/usePagination';

interface UseOptimizedTableProps<T> {
  data: T[];
  itemsPerPage?: number;
  searchFields?: (keyof T)[];
  sortField?: keyof T;
  sortDirection?: 'asc' | 'desc';
  enableVirtualization?: boolean;
}

interface UseOptimizedTableReturn<T> {
  // Pagination
  currentPage: number;
  totalPages: number;
  visiblePages: number[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  goToPage: (page: number) => void;
  goToNext: () => void;
  goToPrev: () => void;
  paginationInfo: {
    start: number;
    end: number;
    total: number;
  };

  // Données filtrées et paginées
  displayedData: T[];
  totalItems: number;
  filteredItems: number;

  // Recherche et tri
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortField: keyof T | undefined;
  sortDirection: 'asc' | 'desc';
  handleSort: (field: keyof T) => void;

  // Performance
  isLoading: boolean;
  loadTime: number;
}

export function useOptimizedTable<T extends Record<string, any>>({
  data,
  itemsPerPage = 20,
  searchFields = [],
  sortField: initialSortField,
  sortDirection: initialSortDirection = 'asc',
  enableVirtualization: _enableVirtualization = true
}: UseOptimizedTableProps<T>): UseOptimizedTableReturn<T> {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof T | undefined>(initialSortField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  const [isLoading, setIsLoading] = useState(false);
  const [loadTime, setLoadTime] = useState(0);

  // 🔍 Filtrage et tri optimisés avec memoization
  const processedData = useMemo(() => {
    const startTime = performance.now();
    setIsLoading(true);

    let filtered = [...data];

    // Filtrage par recherche
    if (searchTerm && searchFields.length > 0) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        searchFields.some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Tri
    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;
        
        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    const endTime = performance.now();
    setLoadTime(endTime - startTime);
    setIsLoading(false);

    return filtered;
  }, [data, searchTerm, searchFields, sortField, sortDirection]);

  // 📄 Pagination avec les données filtrées
  const pagination = usePagination({
    totalItems: processedData.length,
    itemsPerPage,
    maxVisiblePages: 7
  });

  // 📊 Données de la page courante
  const displayedData = useMemo(() => {
    return pagination.getItemsForPage(processedData);
  }, [processedData, pagination]);

  // 🎯 Gestion du tri avec optimisation
  const handleSort = useCallback((field: keyof T) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  return {
    // Pagination
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
    visiblePages: pagination.visiblePages,
    hasNextPage: pagination.hasNextPage,
    hasPrevPage: pagination.hasPrevPage,
    goToPage: pagination.goToPage,
    goToNext: pagination.goToNext,
    goToPrev: pagination.goToPrev,
    paginationInfo: {
      start: pagination.paginationInfo.start,
      end: Math.min(pagination.paginationInfo.end, processedData.length),
      total: processedData.length
    },

    // Données
    displayedData,
    totalItems: data.length,
    filteredItems: processedData.length,

    // Recherche et tri
    searchTerm,
    setSearchTerm,
    sortField,
    sortDirection,
    handleSort,

    // Performance
    isLoading,
    loadTime
  };
}
