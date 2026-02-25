/**
 * HeroGuide — Intent class: GUIDE_ACHAT
 * hero_policy: photo (photo + pictos criteres, professionnel)
 *
 * @see frontend/app/components/heroes/_hero.contract.md
 * @see .spec/00-canon/image-matrix-v1.md §2
 */

import { getFamilyTheme, type FamilyTheme } from "~/utils/family-theme";

interface HeroGuideProps {
  /** Titre H1 principal */
  title: string;
  /** Description courte */
  description?: string;
  /** Slogan genere par resolveSlogan() */
  slogan?: string;
  /** Image hero (photo produit/comparatif) */
  image?: { src: string; alt: string };
  /** Criteres cles (max 3-5, pas de keyword stuffing) */
  criteria?: string[];
  /** Nom de famille pour theming */
  familyName?: string;
  /** Classes CSS additionnelles */
  className?: string;
}

export function HeroGuide({
  title,
  description,
  slogan,
  image,
  criteria,
  familyName,
  className = "",
}: HeroGuideProps) {
  const theme: FamilyTheme = familyName
    ? getFamilyTheme(familyName)
    : getFamilyTheme("gray");
  const hasImage = image && image.src;

  return (
    <section
      className={`relative overflow-hidden py-8 md:py-12 ${
        hasImage
          ? "text-white"
          : `bg-gradient-to-r ${theme.gradient} text-white`
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

          {/* Criteria pills */}
          {criteria && criteria.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {criteria.slice(0, 5).map((criterion) => (
                <span
                  key={criterion}
                  className={`inline-block text-xs font-medium px-3 py-1 rounded-full ${
                    hasImage
                      ? "bg-white/20 text-white backdrop-blur-sm"
                      : "bg-white/20 text-white"
                  }`}
                >
                  {criterion}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
