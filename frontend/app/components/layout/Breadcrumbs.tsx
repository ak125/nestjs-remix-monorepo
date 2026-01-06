/**
 * 🍞 BREADCRUMBS - Fil d'Ariane SEO Optimisé
 *
 * Bonnes pratiques SEO implémentées :
 * ✅ Tous les éléments cliquables (sauf le dernier = page actuelle)
 * ✅ Schema.org BreadcrumbList JSON-LD pour rich snippets
 * ✅ Attributs aria pour accessibilité
 * ✅ URLs canoniques et valides
 * ✅ Maillage interne optimisé
 */

import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;          // URL du lien (aussi utilisé pour Schema.org)
  icon?: React.ReactNode;
  current?: boolean;      // 🆕 Si true, affiche comme texte même si href existe (pour Schema.org)
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  separator?: "chevron" | "slash" | "arrow" | "left-arrow";
  showHome?: boolean;
  maxItems?: number;
  className?: string;
  enableSchema?: boolean; // Active JSON-LD schema.org
}

export function Breadcrumbs({
  items = [],
  separator = "chevron",
  showHome = true,
  maxItems = 6,
  className = "",
  enableSchema = true,
}: BreadcrumbsProps) {
  // Utiliser les items fournis ou générer automatiquement
  // SSR-safe: ne pas appeler generateFromPath() côté serveur (window n'existe pas)
  let breadcrumbItems = items.length > 0 ? items : (typeof window !== 'undefined' ? generateFromPath() : []);

  // S'assurer que "Accueil" est toujours le premier élément si showHome = true
  if (
    showHome &&
    breadcrumbItems.length > 0 &&
    breadcrumbItems[0].label !== "Accueil"
  ) {
    breadcrumbItems = [
      {
        label: "Accueil",
        href: "/",
        icon: <Home className="w-4 h-4" />,
      },
      ...breadcrumbItems,
    ];
  }

  // Marquer le dernier élément comme current (pour le style) MAIS garder le href s'il existe
  if (breadcrumbItems.length > 0) {
    const lastItem = breadcrumbItems[breadcrumbItems.length - 1];
    if (!lastItem.current) {
      lastItem.current = true;
      // NE PAS retirer le href - laisser le lien cliquable si fourni
    }
  }

  // Générer schema JSON-LD pour SEO - OPTIMISÉ
  // 🔧 FIX: Ne pas utiliser window.location (incompatible SSR)
  // Chaque élément doit avoir une URL, sauf le dernier qui peut l'omettre selon Google
  const breadcrumbSchema =
    enableSchema && breadcrumbItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbItems.map((item, index) => {
            const _isLast = index === breadcrumbItems.length - 1;
            const itemUrl = item.href
              ? `https://www.automecanik.com${item.href}`
              : undefined;

            // Construire l'objet ListItem
            const listItem: Record<string, unknown> = {
              "@type": "ListItem",
              position: index + 1,
              name: item.label,
            };

            // 🔧 FIX: Ajouter item uniquement si URL existe
            // Le dernier élément peut omettre item selon la spec Google
            if (itemUrl) {
              listItem.item = itemUrl;
            }

            return listItem;
          }),
        }
      : null;

  function generateFromPath(): BreadcrumbItem[] {
    const path = window.location.pathname;
    const segments = path.split("/").filter(Boolean);

    const items: BreadcrumbItem[] = [];

    if (showHome) {
      items.push({
        label: "Accueil",
        href: "/",
        icon: <Home className="w-4 h-4" />,
      });
    }

    segments.forEach((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");
      const label = formatSegment(segment);
      const current = index === segments.length - 1;

      items.push({
        label,
        href: current ? undefined : href,
        current,
      });
    });

    return items;
  }

  function formatSegment(segment: string): string {
    return segment.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  // Limitation du nombre d'items
  const displayItems =
    breadcrumbItems.length > maxItems
      ? [
          ...breadcrumbItems.slice(0, 1),
          { label: "...", href: undefined },
          ...breadcrumbItems.slice(-maxItems + 2),
        ]
      : breadcrumbItems;

  const getSeparator = () => {
    switch (separator) {
      case "slash":
        return <span className="text-gray-500 mx-2">/</span>;
      case "arrow":
        return <span className="text-gray-500 mx-2">→</span>;
      case "left-arrow":
        return <span className="text-gray-500 mx-2">←&apos;</span>;
      default:
        return <ChevronRight className="w-4 h-4 text-gray-500 mx-2" />;
    }
  };

  return (
    <>
      <nav className={`breadcrumbs ${className}`} aria-label="Fil d'Ariane">
        <ol
          className="flex items-center flex-wrap gap-1 text-sm"
          itemScope
          itemType="https://schema.org/BreadcrumbList"
        >
          {displayItems.map((item, index) => (
            <li
              key={index}
              className="flex items-center"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {index > 0 && getSeparator()}

              {/* Meta position pour Schema.org */}
              <meta itemProp="position" content={String(index + 1)} />

              {/* 🔧 FIX: Si current=true, afficher comme texte même avec href (pour Schema.org) */}
              {item.href && item.href.length > 0 && !item.current ? (
                <a
                  href={item.href}
                  className="flex items-center space-x-1 font-medium cursor-pointer"
                  itemProp="item"
                  style={{
                    color: "#2563eb",
                    textDecoration: "none",
                    pointerEvents: "auto",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = "underline";
                    e.currentTarget.style.color = "#1e40af";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = "none";
                    e.currentTarget.style.color = "#2563eb";
                  }}
                >
                  {item.icon}
                  <span itemProp="name">{item.label}</span>
                </a>
              ) : (
                // 🔧 FIX: Page courante - afficher comme texte mais inclure href pour Schema.org
                <span
                  className={`flex items-center space-x-1 ${
                    item.current
                      ? "text-gray-800 font-semibold"
                      : "text-gray-500"
                  }`}
                  aria-current={item.current ? "page" : undefined}
                  itemProp={item.href ? "item" : undefined}
                  itemScope={item.href ? true : undefined}
                  itemType={item.href ? "https://schema.org/WebPage" : undefined}
                >
                  {/* 🔧 FIX: Inclure URL cachée pour Schema.org si href existe */}
                  {item.href && (
                    <meta itemProp="url" content={`https://www.automecanik.com${item.href}`} />
                  )}
                  {item.icon}
                  <span itemProp="name">{item.label}</span>
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
            __html: JSON.stringify(breadcrumbSchema),
          }}
        />
      )}
    </>
  );
}
