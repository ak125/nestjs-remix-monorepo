/**
 * 🍞 Composant Fil d'Ariane (Breadcrumb)
 * 
 * ✅ Optimisé SEO avec Schema.org
 * ✅ Support JSON-LD + Microdonnées
 * ✅ Responsive et accessible
 * ✅ Personnalisable (couleurs, tailles)
 */

import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  theme?: 'light' | 'dark';
  className?: string;
  separator?: string;
  showHome?: boolean;
}

export function Breadcrumb({
  items,
  theme = 'light',
  className = '',
  separator = '→',
  showHome = true
}: BreadcrumbProps) {
  const breadcrumbItems = showHome 
    ? [{ label: 'Accueil', href: '/' }, ...items]
    : items;

  // Générer le JSON-LD Schema.org
  const generateSchema = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbItems.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.label,
        ...(item.href && { "item": `${baseUrl}${item.href}` })
      }))
    };
  };

  const textColorClass = theme === 'dark' 
    ? 'text-blue-200' 
    : 'text-gray-600';
  
  const activeColorClass = theme === 'dark'
    ? 'text-white'
    : 'text-gray-900';

  const hoverColorClass = theme === 'dark'
    ? 'hover:text-white'
    : 'hover:text-blue-600';

  return (
    <>
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateSchema()) }}
      />

      {/* Fil d'ariane visuel */}
      <nav
        className={`text-sm ${textColorClass} ${className}`}
        itemScope
        itemType="https://schema.org/BreadcrumbList"
        aria-label="Fil d'ariane"
      >
        <ol className="flex flex-wrap items-center gap-2">
          {breadcrumbItems.map((item, index) => (
            <li
              key={index}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
              className="flex items-center gap-2"
            >
              {item.href && !item.active ? (
                <a
                  href={item.href}
                  itemProp="item"
                  className={`transition-colors ${hoverColorClass}`}
                >
                  <span itemProp="name">{item.label}</span>
                </a>
              ) : (
                <span itemProp="name" className={item.active ? activeColorClass : ''}>
                  {item.label}
                </span>
              )}
              <meta itemProp="position" content={String(index + 1)} />
              
              {index < breadcrumbItems.length - 1 && (
                <span className="text-gray-500" aria-hidden="true">
                  {separator}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

/**
 * 🎯 Hook pour générer automatiquement le breadcrumb depuis l'URL
 */
export function useBreadcrumbFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  
  return segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return {
      label,
      href: index < segments.length - 1 ? path : undefined,
      active: index === segments.length - 1
    };
  });
}

export default Breadcrumb;
