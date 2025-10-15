/**
 * 📄 COMPOSANT PAGINATION SERVEUR OPTIMISÉ
 * 
 * Pagination haute performance pour de gros volumes (59k+ items)
 * avec navigation intelligente et saut rapide
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

interface ServerPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  startItem: number;
  endItem: number;
  hasNext: boolean;
  hasPrevious: boolean;
  visiblePages: number[];
  onPageChange: (page: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  showQuickJump?: boolean;
}

export function ServerPagination({
  currentPage,
  totalPages,
  totalItems,
  startItem,
  endItem,
  hasNext,
  hasPrevious,
  visiblePages,
  onPageChange,
  onNext,
  onPrevious,
  showQuickJump = true
}: ServerPaginationProps) {
  const [jumpPage, setJumpPage] = useState('');

  const handleQuickJump = () => {
    const page = parseInt(jumpPage, 10);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpPage('');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* 📊 Informations sur la plage */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium">
            {startItem.toLocaleString()}-{endItem.toLocaleString()}
          </span>
          <span>sur</span>
          <span className="font-bold text-blue-600">
            {totalItems.toLocaleString()} utilisateurs
          </span>
        </div>

        {/* 🔄 Navigation principale */}
        <div className="flex items-center gap-2">
          
          {/* ⏮️ Première page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={!hasPrevious}
            className="hidden sm:flex"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* ⏪ Page précédente */}
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={!hasPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Préc.</span>
          </Button>

          {/* 📄 Pages visibles */}
          <div className="flex items-center gap-1">
            {visiblePages.map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={page === currentPage ? "bg-blue-600 text-white" : ""}
              >
                {page}
              </Button>
            ))}
          </div>

          {/* ⏩ Page suivante */}
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={!hasNext}
          >
            <span className="mr-1 hidden sm:inline">Suiv.</span>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* ⏭️ Dernière page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={!hasNext}
            className="hidden sm:flex"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 🎯 Saut rapide (pour gros volumes) */}
        {showQuickJump && totalPages > 10 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Aller à:</span>
            <Input
              type="number"
              min="1"
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQuickJump();
                }
              }}
              className="w-20 h-8"
              placeholder="Page"
            />
            <Button
              size="sm"
              onClick={handleQuickJump}
              disabled={!jumpPage || parseInt(jumpPage, 10) < 1 || parseInt(jumpPage, 10) > totalPages}
            >
              OK
            </Button>
          </div>
        )}
      </div>

      {/* 📈 Barre de progression (pour grands datasets) */}
      {totalPages > 100 && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentPage / totalPages) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Page 1</span>
            <span>Page {currentPage} / {totalPages}</span>
            <span>Page {totalPages}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
