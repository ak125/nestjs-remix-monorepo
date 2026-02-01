/**
 * 🧭 AdminBreadcrumb - Composant de navigation réutilisable
 * Utilise les design tokens pour une cohérence parfaite
 */

import { Link } from "@remix-run/react";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

interface BreadcrumbItemData {
  label: string;
  href: string;
}

export interface AdminBreadcrumbProps {
  /** Items de navigation (pattern moderne) */
  items?: BreadcrumbItemData[];
  /** Titre de la page actuelle (pattern legacy) */
  currentPage?: string;
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
 * @example Pattern items (recommandé):
 * ```tsx
 * <AdminBreadcrumb items={[
 *   { label: "Admin", href: "/admin" },
 *   { label: "Diagnostic", href: "/admin/diagnostic" },
 * ]} />
 * ```
 *
 * @example Pattern legacy:
 * ```tsx
 * <AdminBreadcrumb currentPage="Gestion des commandes" />
 * ```
 */
export function AdminBreadcrumb({
  items,
  currentPage,
  parentPath = "/admin",
  parentLabel = "Admin",
  className = "mb-6",
}: AdminBreadcrumbProps) {
  // Pattern moderne avec items array
  if (items && items.length > 0) {
    const lastItem = items[items.length - 1];
    const parentItems = items.slice(0, -1);

    return (
      <Breadcrumb className={className}>
        <BreadcrumbList>
          {parentItems.map((item, index) => (
            <span key={item.href} className="contents">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={item.href} className="flex items-center gap-1">
                    {index === 0 && <Home className="h-4 w-4" />}
                    <span>{item.label}</span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </span>
          ))}
          <BreadcrumbItem>
            <BreadcrumbPage>{lastItem.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Pattern legacy avec currentPage
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
