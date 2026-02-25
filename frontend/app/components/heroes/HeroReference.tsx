/**
 * HeroReference — Intent class: GLOSSAIRE_REFERENCE
 * hero_policy: none (pas d'image, texte seul, minimal encyclopedique)
 *
 * @see frontend/app/components/heroes/_hero.contract.md
 * @see .spec/00-canon/image-matrix-v1.md §2
 */

import { getFamilyTheme, type FamilyTheme } from "~/utils/family-theme";

interface HeroReferenceProps {
  /** Titre H1 principal */
  title: string;
  /** Sous-titre optionnel */
  subtitle?: string;
  /** Slogan genere par resolveSlogan() */
  slogan?: string;
  /** Badge categorie (ex: "Freinage", "Distribution") — active le theme couleur */
  categoryBadge?: string;
  /** Classes CSS additionnelles */
  className?: string;
}

export function HeroReference({
  title,
  subtitle,
  slogan,
  categoryBadge,
  className = "",
}: HeroReferenceProps) {
  const theme: FamilyTheme | null = categoryBadge
    ? getFamilyTheme(categoryBadge)
    : null;

  return (
    <section
      className={`bg-gray-50 border-b border-gray-200 py-4 md:py-6 ${
        theme ? theme.borderAccent : ""
      } ${theme ? "border-t-2" : ""} ${className}`}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-4xl">
          {categoryBadge && theme && (
            <span
              className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full mb-2 ${theme.badge}`}
            >
              {categoryBadge}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm md:text-base text-gray-600">
              {subtitle}
            </p>
          )}
          {slogan && (
            <p className="text-sm text-gray-500 max-w-xl mt-1">{slogan}</p>
          )}
        </div>
      </div>
    </section>
  );
}
