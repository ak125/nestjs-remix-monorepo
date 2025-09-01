/**
 * 🚀 HOOK PAGINATION SERVEUR OPTIMISÉ
 * 
 * Hook spécialisé pour gérer la pagination côté serveur
 * avec de gros volumes de données (59k+ utilisateurs)
 */

import { useNavigate, useSearchParams } from "@remix-run/react";
import { useCallback } from "react";

interface UseServerPaginationProps {
  totalItems: number;
  itemsPerPage: number;
  maxVisiblePages?: number;
}

export function useServerPagination({
  totalItems,
  itemsPerPage,
  maxVisiblePages = 7
}: UseServerPaginationProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // 🔄 Navigation entre les pages
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('page', page.toString());
      navigate(`?${newSearchParams.toString()}`);
    }
  }, [navigate, searchParams, totalPages]);

  // ⏮️ Page précédente
  const goToPrevious = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  // ⏭️ Page suivante
  const goToNext = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  // 📄 Calcul des pages visibles
  const getVisiblePages = useCallback(() => {
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);
    
    // Ajuster le début si on est près de la fin
    if (end - start < maxVisiblePages - 1) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages, maxVisiblePages]);

  // 📊 Informations sur la plage actuelle
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    startItem,
    endItem,
    hasNext: currentPage < totalPages,
    hasPrevious: currentPage > 1,
    visiblePages: getVisiblePages(),
    goToPage,
    goToNext,
    goToPrevious,
    // 🎯 Métriques utiles
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
    pageInfo: `${startItem}-${endItem} sur ${totalItems.toLocaleString()}`
  };
}
