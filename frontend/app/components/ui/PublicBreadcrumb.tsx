import { Link } from '@remix-run/react';
import { Home, ChevronRight } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from './breadcrumb';

interface BreadcrumbItemType {
  label: string;
  href?: string;
}

interface PublicBreadcrumbProps {
  items: BreadcrumbItemType[];
  className?: string;
}

/**
 * Composant Breadcrumb générique pour les pages publiques
 * 
 * @example
 * ```tsx
 * <PublicBreadcrumb 
 *   items={[
 *     { label: "Mon Compte", href: "/account" },
 *     { label: "Mes Commandes" }
 *   ]}
 * />
 * ```
 */
export function PublicBreadcrumb({ items, className = '' }: PublicBreadcrumbProps) {
  return (
    <Breadcrumb className={`mb-6 ${className}`}>
      <BreadcrumbList>
        {/* Home */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center gap-1 hover:text-primary transition-colors">
              <Home className="h-4 w-4" />
              <span>Accueil</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <div key={index} className="flex items-center gap-2">
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage className="font-medium text-gray-900">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.href} className="hover:text-primary transition-colors">
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
