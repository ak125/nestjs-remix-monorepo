/**
 * 🍞 BREADCRUMBS - Fil d'Ariane intelligent
 * 
 * Fonctionnalités :
 * ✅ Génération automatique depuis l'URL
 * ✅ Données personnalisées
 * ✅ Icônes et séparateurs
 * ✅ Responsive et accessible
 */

import { Link } from "@remix-run/react";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  current?: boolean;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  separator?: 'chevron' | 'slash' | 'arrow';
  showHome?: boolean;
  maxItems?: number;
  className?: string;
  enableSchema?: boolean; // Active JSON-LD schema.org
}

export function Breadcrumbs({
  items = [],
  separator = 'chevron',
  showHome = true,
  maxItems = 5,
  className = "",
  enableSchema = true
}: BreadcrumbsProps) {
  
  // Utiliser les items fournis ou générer automatiquement
  let breadcrumbItems = items.length > 0 ? items : generateFromPath();
  
  // S'assurer que "Accueil" est toujours le premier élément si showHome = true
  if (showHome && breadcrumbItems.length > 0 && breadcrumbItems[0].label !== 'Accueil') {
    breadcrumbItems = [
      {
        label: 'Accueil',
        href: '/',
        icon: <Home className="w-4 h-4" />
      },
      ...breadcrumbItems
    ];
  }

  // Générer schema JSON-LD pour SEO
  const breadcrumbSchema = enableSchema && breadcrumbItems.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems
      .filter(item => item.href) // Seulement les items avec URL
      .map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.label,
        "item": `https://automecanik.com${item.href}`
      }))
  } : null;

  function generateFromPath(): BreadcrumbItem[] {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    const items: BreadcrumbItem[] = [];
    
    if (showHome) {
      items.push({
        label: 'Accueil',
        href: '/',
        icon: <Home className="w-4 h-4" />
      });
    }
    
    segments.forEach((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/');
      const label = formatSegment(segment);
      const current = index === segments.length - 1;
      
      items.push({
        label,
        href: current ? undefined : href,
        current
      });
    });
    
    return items;
  }

  function formatSegment(segment: string): string {
    return segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  // Limitation du nombre d'items
  const displayItems = breadcrumbItems.length > maxItems 
    ? [
        ...breadcrumbItems.slice(0, 1),
        { label: '...', href: undefined },
        ...breadcrumbItems.slice(-maxItems + 2)
      ]
    : breadcrumbItems;

  const getSeparator = () => {
    switch (separator) {
      case 'slash':
        return <span className="text-gray-400 mx-2">/</span>;
      case 'arrow':
        return <span className="text-gray-400 mx-2">→</span>;
      default:
        return <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />;
    }
  };

  return (
    <>
      <nav className={`breadcrumbs ${className}`} aria-label="Fil d'Ariane">
        <ol className="flex items-center space-x-1 text-sm">
          {displayItems.map((item, index) => (
            <li key={index} className="flex items-center">
              {index > 0 && getSeparator()}
              
              {item.href ? (
                <Link
                  to={item.href}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span 
                  className={`flex items-center space-x-1 ${
                    item.current 
                      ? 'text-gray-900 font-medium' 
                      : 'text-gray-500'
                  }`}
                  aria-current={item.current ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* JSON-LD Schema pour SEO */}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbSchema)
          }}
        />
      )}
    </>
  );
}
