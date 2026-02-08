/**
 * 📄 SEARCH PAGINATION - Composant de pagination intelligent v3.0
 */

import { memo } from "react";

interface SearchPaginationProps {
  current: number;
  total: number;
  onPageChange?: (page: number) => void;
  showQuickJump?: boolean;
  className?: string;
}

export const SearchPagination = memo(function SearchPagination({
  current,
  total,
  onPageChange,
  showQuickJump = false,
  className = "",
}: SearchPaginationProps) {
  if (total <= 1) return null;

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= total && page !== current) {
      onPageChange?.(page);
    }
  };

  // Génération des numéros de pages à afficher
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showRange = 2; // Nombre de pages à afficher de chaque côté

    // Toujours afficher la première page
    if (current > showRange + 2) {
      pages.push(1);
      if (current > showRange + 3) {
        pages.push("...");
      }
    }

    // Pages autour de la page courante
    const start = Math.max(1, current - showRange);
    const end = Math.min(total, current + showRange);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Toujours afficher la dernière page
    if (current < total - showRange - 1) {
      if (current < total - showRange - 2) {
        pages.push("...");
      }
      pages.push(total);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
    >
      {/* Informations de pagination */}
      <div className="text-sm text-gray-600">
        Page {current} sur {total}
      </div>

      {/* Navigation principale */}
      <div className="flex items-center gap-1">
        {/* Bouton Précédent */}
        <button
          onClick={() => handlePageClick(current - 1)}
          disabled={current <= 1}
          className={`px-3 py-2 text-sm rounded-md transition-colors ${
            current <= 1
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          ← Précédent
        </button>

        {/* Numéros de pages */}
        <div className="hidden sm:flex items-center gap-1 mx-2">
          {pageNumbers.map((page, index) => (
            <div key={index}>
              {typeof page === "number" ? (
                <button
                  onClick={() => handlePageClick(page)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    page === current
                      ? "bg-primary text-primary-foreground"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              ) : (
                <span className="px-2 py-2 text-gray-400 text-sm">{page}</span>
              )}
            </div>
          ))}
        </div>

        {/* Sélecteur de page (mobile) */}
        <div className="sm:hidden mx-2">
          <select
            value={current}
            onChange={(e) => handlePageClick(parseInt(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 rounded"
          >
            {Array.from({ length: total }, (_, i) => i + 1).map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
          </select>
        </div>

        {/* Bouton Suivant */}
        <button
          onClick={() => handlePageClick(current + 1)}
          disabled={current >= total}
          className={`px-3 py-2 text-sm rounded-md transition-colors ${
            current >= total
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          Suivant →
        </button>
      </div>

      {/* Saut rapide aux pages */}
      {showQuickJump && total > 10 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Aller à :</span>
          <input
            type="number"
            min="1"
            max={total}
            placeholder="Page"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const page = parseInt(e.currentTarget.value);
                if (page >= 1 && page <= total) {
                  handlePageClick(page);
                  e.currentTarget.value = "";
                }
              }
            }}
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
          />
        </div>
      )}
    </div>
  );
});
