/**
 * 📄 PAGINATION - Composant de navigation entre pages
 * 
 * Features:
 * - Boutons Précédent/Suivant
 * - Numéros de pages (avec ellipses)
 * - Sélecteur taille de page
 * - Informations "X - Y de Z résultats"
 */

import { Link, useSearchParams } from '@remix-run/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  const [searchParams] = useSearchParams();

  // Créer URL avec nouveau numéro de page
  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    return `?${params.toString()}`;
  };

  // Créer URL avec nouvelle taille de page
  const createPageSizeUrl = (size: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('limit', size.toString());
    params.set('page', '1'); // Reset à page 1
    return `?${params.toString()}`;
  };

  // Calculer les numéros de pages à afficher
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // Afficher toutes les pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Logique avec ellipses
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2">
      {/* Informations */}
      <div className="text-sm text-gray-600">
        Affichage de <span className="font-semibold">{startItem}</span> à{' '}
        <span className="font-semibold">{endItem}</span> sur{' '}
        <span className="font-semibold">{totalItems.toLocaleString()}</span>{' '}
        résultats
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        {/* Bouton Précédent */}
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
        >
          <Link
            to={createPageUrl(currentPage - 1)}
            className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Précédent
          </Link>
        </Button>

        {/* Numéros de pages */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isActive = pageNum === currentPage;

            return (
              <Button
                key={pageNum}
                asChild
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={isActive ? 'pointer-events-none' : ''}
              >
                <Link to={createPageUrl(pageNum)}>{pageNum}</Link>
              </Button>
            );
          })}
        </div>

        {/* Bouton Suivant */}
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
        >
          <Link
            to={createPageUrl(currentPage + 1)}
            className={
              currentPage === totalPages ? 'pointer-events-none opacity-50' : ''
            }
          >
            Suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Sélecteur taille de page */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Par page:</span>
        <Select
          value={itemsPerPage.toString()}
          onValueChange={(value) => {
            window.location.href = createPageSizeUrl(parseInt(value, 10));
          }}
        >
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
