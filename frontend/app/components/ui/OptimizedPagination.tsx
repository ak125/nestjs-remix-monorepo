/**
 * 🎯 COMPOSANT PAGINATION OPTIMISÉ
 *
 * Composant React pour pagination performante avec virtualisation
 */

import { memo } from "react";
import { Button } from "~/components/ui/button";

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
  className = "",
  showInfo = true,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center space-x-2">
        {/* Bouton Précédent */}
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!hasPrevPage}
          aria-label="Page précédente"
        >
          ← Précédent
        </Button>

        {/* Première page + ellipsis */}
        {visiblePages[0] > 1 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              aria-label="Page 1"
            >
              1
            </Button>
            {visiblePages[0] > 2 && (
              <span
                className="px-2 py-2 text-sm text-gray-500"
                aria-hidden="true"
              >
                ...
              </span>
            )}
          </>
        )}

        {/* Pages visibles */}
        {visiblePages.map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </Button>
        ))}

        {/* Ellipsis + dernière page */}
        {visiblePages[visiblePages.length - 1] < totalPages && (
          <>
            {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
              <span
                className="px-2 py-2 text-sm text-gray-500"
                aria-hidden="true"
              >
                ...
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              aria-label={`Dernière page (${totalPages})`}
            >
              {totalPages}
            </Button>
          </>
        )}

        {/* Bouton Suivant */}
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNextPage}
          aria-label="Page suivante"
        >
          Suivant →
        </Button>
      </div>

      {/* Informations pagination */}
      {showInfo && (
        <div className="hidden sm:flex sm:items-center sm:space-x-1">
          <p className="text-sm text-gray-700">
            Page <span className="font-medium">{currentPage}</span> sur{" "}
            <span className="font-medium">{totalPages}</span>
          </p>
        </div>
      )}
    </div>
  );
});

OptimizedPagination.displayName = "OptimizedPagination";
