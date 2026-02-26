import { Link } from "@remix-run/react";
import { Home, ChevronRight } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "./breadcrumb";

interface BreadcrumbItemType {
  label: string;
  href?: string;
}

interface PublicBreadcrumbProps {
  items: BreadcrumbItemType[];
  className?: string;
  /** Injecte un script JSON-LD Schema.org BreadcrumbList pour le SEO */
  withJsonLd?: boolean;
  /** Prefixe automatiquement "Accueil" (defaut: true) */
  showHome?: boolean;
}

const BASE_URL = "https://www.automecanik.com";

/**
 * Composant Breadcrumb unifié (public + admin)
 *
 * @example Public
 * ```tsx
 * <PublicBreadcrumb
 *   items={[
 *     { label: "Mon Compte", href: "/account" },
 *     { label: "Mes Commandes" }
 *   ]}
 * />
 * ```
 *
 * @example Avec JSON-LD SEO
 * ```tsx
 * <PublicBreadcrumb
 *   items={[
 *     { label: "Freinage", href: "/pieces/freinage" },
 *     { label: "Disque de frein" }
 *   ]}
 *   withJsonLd
 * />
 * ```
 */
export function PublicBreadcrumb({
  items,
  className = "",
  withJsonLd = false,
  showHome = true,
}: PublicBreadcrumbProps) {
  // Build full items list (optionally prepend Accueil)
  const allItems: BreadcrumbItemType[] =
    showHome && (items.length === 0 || items[0].label !== "Accueil")
      ? [{ label: "Accueil", href: "/" }, ...items]
      : items;

  return (
    <>
      <Breadcrumb className={`mb-6 ${className}`}>
        <BreadcrumbList>
          {allItems.map((item, index) => {
            const isLast = index === allItems.length - 1;
            const isFirst = index === 0;
            const isHome = item.label === "Accueil" && item.href === "/";

            return (
              <span key={index} className="contents">
                {!isFirst && (
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                )}
                <BreadcrumbItem>
                  {isLast || !item.href ? (
                    <BreadcrumbPage className="font-medium text-gray-900">
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        to={item.href}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        {isHome && <Home className="h-4 w-4" />}
                        {item.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {withJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: allItems.map((item, index) => {
                const entry: Record<string, unknown> = {
                  "@type": "ListItem",
                  position: index + 1,
                  name: item.label,
                };
                if (item.href) {
                  entry.item = `${BASE_URL}${item.href}`;
                }
                return entry;
              }),
            }),
          }}
        />
      )}
    </>
  );
}
