/**
 * 🧭 AdminBreadcrumb - Composant de navigation réutilisable
 * Utilise les design tokens pour une cohérence parfaite
 */

import { Link } from '@remix-run/react';
import { Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';

interface AdminBreadcrumbProps {
  /** Titre de la page actuelle */
  currentPage: string;
  /** Chemin personnalisé vers la page parente (défaut: /admin) */
  parentPath?: string;
  /** Nom de la page parente (défaut: Admin) */
  parentLabel?: string;
  /** Classe CSS additionnelle */
  className?: string;
}

/**
 * Breadcrumb standardisé pour toutes les pages admin
 * 
 * @example
 * ```tsx
 * <AdminBreadcrumb currentPage="Gestion des commandes" />
 * <AdminBreadcrumb currentPage="Utilisateurs" parentLabel="Administration" />
 * ```
 */
export function AdminBreadcrumb({
  currentPage,
  parentPath = '/admin',
  parentLabel = 'Admin',
  className = 'mb-6',
}: AdminBreadcrumbProps) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={parentPath} className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              <span>{parentLabel}</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentPage}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
