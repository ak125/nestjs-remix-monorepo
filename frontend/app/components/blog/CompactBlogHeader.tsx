/**
 * Header Compact pour toutes les pages du blog
 * Design minimaliste et efficace en espace
 */

import { Link } from "@remix-run/react";
import { type LucideIcon } from "lucide-react";
import * as React from "react";

interface Stat {
  icon: LucideIcon;
  value: string | number;
  label?: string;
}

interface CompactBlogHeaderProps {
  /** Titre H1 principal */
  title: string;

  /** Description courte sous le titre */
  description?: string;

  /** URL du logo à afficher */
  logo?: string;

  /** Texte alternatif du logo */
  logoAlt?: string;

  /** Fil d'Ariane (format "A > B > C" ou tableau d'items) */
  breadcrumb?: string | Array<{ label: string; href?: string }>;

  /** Statistiques à afficher (pills à droite) */
  stats?: Stat[];

  /** Couleur du gradient (par défaut: blue) */
  gradientFrom?: string;
  gradientTo?: string;

  /** Classes CSS additionnelles */
  className?: string;
}

export function CompactBlogHeader({
  title,
  description,
  logo,
  logoAlt,
  breadcrumb,
  stats = [],
  gradientFrom = "from-blue-600",
  gradientTo = "to-indigo-600",
  className = "",
}: CompactBlogHeaderProps) {
  // Parser le breadcrumb
  const breadcrumbItems = React.useMemo(() => {
    if (!breadcrumb) return [];

    if (typeof breadcrumb === "string") {
      return breadcrumb.split(">").map((item) => ({
        label: item.trim(),
        href: undefined,
      }));
    }

    return breadcrumb;
  }, [breadcrumb]);

  return (
    <section
      className={`relative bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white py-4 md:py-6 ${className}`}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          {breadcrumbItems.length > 0 && (
            <nav
              className="flex items-center gap-2 text-blue-50 text-xs mb-3"
              aria-label="Breadcrumb"
            >
              {breadcrumbItems.map((item, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <span className="opacity-50" aria-hidden="true">
                      /
                    </span>
                  )}
                  {item.href ? (
                    <Link
                      to={item.href}
                      className="hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        index === breadcrumbItems.length - 1
                          ? "text-white font-medium"
                          : ""
                      }
                    >
                      {item.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Title & Stats */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Left: Logo, Title & Description */}
            <div className="flex-1 flex items-center gap-3 md:gap-4">
              {/* Logo */}
              {logo && (
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl shadow-xl p-1.5 md:p-2 flex items-center justify-center hover:scale-105 hover:rotate-2 transition-all duration-300">
                    <img
                      src={logo}
                      alt={logoAlt || title}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // Masquer le conteneur si le logo 404
                        const container =
                          e.currentTarget.closest("div.flex-shrink-0");
                        if (container instanceof HTMLElement) {
                          container.style.display = "none";
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Title & Description */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-1 leading-tight">
                  {title}
                </h1>
                {description && (
                  <p className="text-blue-50 text-sm md:text-base">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Stats Pills */}
            {stats.length > 0 && (
              <div className="flex flex-wrap gap-2 md:gap-3">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={index}
                      className="bg-white/20 backdrop-blur-sm rounded-full px-3 md:px-4 py-1.5 md:py-2 flex items-center gap-2 hover:bg-white/30 transition-all duration-200 hover:scale-105"
                      title={stat.label}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-semibold">
                        {stat.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Variantes prédéfinies de couleurs
 */
export const BlogHeaderVariants = {
  blue: { from: "from-blue-600", to: "to-indigo-600" },
  green: { from: "from-green-600", to: "to-emerald-600" },
  purple: { from: "from-purple-600", to: "to-pink-600" },
  orange: { from: "from-orange-600", to: "to-red-600" },
  slate: { from: "from-slate-700", to: "to-gray-800" },
} as const;
