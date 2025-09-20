/**
 * 🍞 COMPOSANT BREADCRUMBS
 * 
 * Fil d'Ariane pour la navigation
 */

import { Link } from '@remix-run/react';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {items.map((item, index) => (
          <li key={index} className="inline-flex items-center">
            {index > 0 && (
              <svg 
                className="w-6 h-6 text-gray-400" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            
            {index === items.length - 1 ? (
              // Dernier élément - non cliquable
              <span className="ml-1 text-sm font-medium text-gray-700 md:ml-2">
                {item.name}
              </span>
            ) : (
              // Éléments intermédiaires - liens
              <Link
                to={item.url}
                className="ml-1 text-sm font-medium text-gray-500 hover:text-blue-600 md:ml-2 transition-colors"
              >
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}