/**
 * 🎯 COMPOSANT PAGINATION OPTIMISÉ
 * 
 * Composant React pour pagination performante avec virtualisation
 */

import { memo } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  visiblePages: number[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onPageChange: (page: number) => void;
  onNext: () => void;
  onPrev: () => void;
  className?: string;
  showInfo?: boolean;
}

export const OptimizedPagination = memo(function OptimizedPagination({
  currentPage,
  totalPages,
  visiblePages,
  hasNextPage,
  hasPrevPage,
  onPageChange,
  onNext,
  onPrev,
  className = '',
  showInfo = true
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center space-x-2">
        {/* Bouton Précédent */}
        <button
          onClick={onPrev}
          disabled={!hasPrevPage}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Page précédente"
        >
          ← Précédent
        </button>

        {/* Première page + ellipsis */}
        {visiblePages[0] > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              aria-label="Page 1"
            >
              1
            </button>
            {visiblePages[0] > 2 && (
              <span className="px-2 py-2 text-sm text-gray-500" aria-hidden="true">
                ...
              </span>
            )}
          </>
        )}

        {/* Pages visibles */}
        {visiblePages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              page === currentPage
                ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ))}

        {/* Ellipsis + dernière page */}
        {visiblePages[visiblePages.length - 1] < totalPages && (
          <>
            {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
              <span className="px-2 py-2 text-sm text-gray-500" aria-hidden="true">
                ...
              </span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              aria-label={`Dernière page (${totalPages})`}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Bouton Suivant */}
        <button
          onClick={onNext}
          disabled={!hasNextPage}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Page suivante"
        >
          Suivant →
        </button>
      </div>

      {/* Informations pagination */}
      {showInfo && (
        <div className="hidden sm:flex sm:items-center sm:space-x-1">
          <p className="text-sm text-gray-700">
            Page <span className="font-medium">{currentPage}</span> sur{' '}
            <span className="font-medium">{totalPages}</span>
          </p>
        </div>
      )}
    </div>
  );
});

OptimizedPagination.displayName = 'OptimizedPagination';
