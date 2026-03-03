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

interface HeroBadge {
  label: string;
  value: string;
  color: "green" | "amber" | "red" | "blue" | "slate";
}

const BADGE_COLORS: Record<string, string> = {
  green: "bg-green-500/20 text-green-100 border-green-400/30",
  amber: "bg-amber-500/20 text-amber-100 border-amber-400/30",
  red: "bg-red-500/20 text-red-100 border-red-400/30",
  blue: "bg-blue-500/20 text-blue-100 border-blue-400/30",
  slate: "bg-white/10 text-white/80 border-white/20",
};

interface HeroBlogProps {
  /** Titre H1 principal */
  title: string;
  /** Description courte */
  description?: string;
  /** Slogan genere par resolveSlogan() */
  slogan?: string;
  /** Image hero (photo technique) */
  image?: { src: string; alt: string };
  /** Fil d'Ariane */
  breadcrumb?: BreadcrumbItem[];
  /** Ligne meta: "12 fevrier 2026 · 8 min" */
  metaLine?: string;
  /** Badges heuristiques (Difficulte, Temps, Securite) */
  badges?: HeroBadge[];
  /** CTA soft discret */
  ctaSoft?: { label: string; href: string };
  /** Classes CSS additionnelles */
  className?: string;
}

export function HeroBlog({
  title,
  description,
  slogan,
  image,
  breadcrumb,
  metaLine,
  badges,
  ctaSoft,
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

          {/* Slogan */}
          {slogan && (
            <p className="text-sm text-white/60 max-w-xl mt-1">{slogan}</p>
          )}

          {/* Badges */}
          {badges && badges.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border ${BADGE_COLORS[badge.color] ?? BADGE_COLORS.slate}`}
                >
                  <span className="opacity-70">{badge.label}</span>
                  <span className="font-semibold">{badge.value}</span>
                </span>
              ))}
            </div>
          )}

          {/* CTA soft */}
          {ctaSoft && (
            <Link
              to={ctaSoft.href}
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-white/70 hover:text-white transition-colors underline underline-offset-2 decoration-white/30 hover:decoration-white/60"
            >
              {ctaSoft.label} →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
