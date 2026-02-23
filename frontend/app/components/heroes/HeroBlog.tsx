/**
 * HeroBlog — Intent class: BLOG_CONSEIL
 * hero_policy: photo (warm gradient par defaut, overlay si image fournie)
 *
 * Remplace CompactBlogHeader progressivement.
 *
 * @see frontend/app/components/heroes/_hero.contract.md
 * @see .spec/00-canon/image-matrix-v1.md §2
 */

import { Link } from "@remix-run/react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeroBlogProps {
  /** Titre H1 principal */
  title: string;
  /** Description courte */
  description?: string;
  /** Image hero (photo technique) */
  image?: { src: string; alt: string };
  /** Fil d'Ariane */
  breadcrumb?: BreadcrumbItem[];
  /** Ligne meta: "12 fevrier 2026 · 8 min" */
  metaLine?: string;
  /** Classes CSS additionnelles */
  className?: string;
}

export function HeroBlog({
  title,
  description,
  image,
  breadcrumb,
  metaLine,
  className = "",
}: HeroBlogProps) {
  const hasImage = image && image.src;

  return (
    <section
      className={`relative overflow-hidden py-6 md:py-10 ${
        hasImage
          ? "text-white"
          : "bg-gradient-to-r from-orange-600 to-amber-600 text-white"
      } ${className}`}
    >
      {/* Background image with overlay */}
      {hasImage && (
        <>
          <img
            src={image.src}
            alt={image.alt}
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/40" />
        </>
      )}

      <div className="relative container mx-auto px-4">
        <div className="max-w-4xl">
          {/* Breadcrumb */}
          {breadcrumb && breadcrumb.length > 0 && (
            <nav
              className="flex items-center gap-2 text-sm mb-3 text-white/70"
              aria-label="Breadcrumb"
            >
              {breadcrumb.map((item, index) => (
                <span key={index} className="flex items-center gap-2">
                  {index > 0 && (
                    <span className="opacity-50" aria-hidden="true">
                      /
                    </span>
                  )}
                  {item.href ? (
                    <Link
                      to={item.href}
                      className="hover:text-white transition-opacity duration-200"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-white font-medium">{item.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}

          {/* Meta line (date + reading time) */}
          {metaLine && (
            <p className="text-xs md:text-sm text-white/60 mb-2">{metaLine}</p>
          )}

          {/* Title */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
            {title}
          </h1>

          {/* Description */}
          {description && (
            <p className="mt-2 text-sm md:text-base text-white/80 max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
