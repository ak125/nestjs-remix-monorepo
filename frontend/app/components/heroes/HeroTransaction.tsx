/**
 * HeroTransaction — Intent class: TRANSACTION
 * hero_policy: photo (photo produit, overlay leger + badge famille)
 *
 * 3 sous-blocs internes : HeaderBlock, MediaBlock, TrustBadges
 * Image hero = loading="eager" (LCP sur desktop)
 *
 * @see frontend/app/components/heroes/_hero.contract.md
 * @see .spec/00-canon/image-matrix-v1.md §2
 */

import { type ReactNode } from "react";
import { getFamilyTheme, type FamilyTheme } from "~/utils/family-theme";

interface HeroTransactionProps {
  /** Titre H1 principal */
  title: string;
  /** Description courte */
  description?: string;
  /** Image produit */
  image?: { src: string; alt: string };
  /** Famille pour theming */
  family?: { id?: number; name?: string };
  /** Badges de confiance (ex: "Livraison 24h", "Garantie 2 ans") */
  badges?: string[];
  /** Slot droit libre (ex: prix, CTA) */
  rightSlot?: ReactNode;
  /** Classes CSS additionnelles */
  className?: string;
}

/* --- Sous-blocs internes (pas exportes) --- */

function HeaderBlock({
  title,
  description,
  familyName,
  theme,
}: {
  title: string;
  description?: string;
  familyName?: string;
  theme: FamilyTheme;
}) {
  return (
    <div className="flex-1 min-w-0">
      {familyName && (
        <span
          className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full mb-2 ${theme.badge}`}
        >
          {familyName}
        </span>
      )}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
        {title}
      </h1>
      {description && (
        <p className="mt-1.5 text-sm md:text-base text-gray-600 max-w-xl">
          {description}
        </p>
      )}
    </div>
  );
}

function MediaBlock({
  image,
  theme,
}: {
  image?: { src: string; alt: string };
  theme: FamilyTheme;
}) {
  if (image && image.src) {
    return (
      <div className="flex-shrink-0 w-32 h-32 md:w-40 md:h-40">
        <img
          src={image.src}
          alt={image.alt}
          className="w-full h-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  // Reserve l'espace pour eviter CLS
  return (
    <div
      className={`flex-shrink-0 w-32 h-32 md:w-40 md:h-40 rounded-xl ${theme.bg} flex items-center justify-center`}
    >
      <div className={`w-12 h-12 rounded-full ${theme.accent} opacity-20`} />
    </div>
  );
}

function TrustBadges({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {badges.map((badge) => (
        <span
          key={badge}
          className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

/* --- Composant principal --- */

export function HeroTransaction({
  title,
  description,
  image,
  family,
  badges = [],
  rightSlot,
  className = "",
}: HeroTransactionProps) {
  const familyKey = family?.id || family?.name;
  const theme: FamilyTheme = familyKey
    ? getFamilyTheme(familyKey)
    : getFamilyTheme("gray");

  return (
    <section
      className={`border-b border-gray-200 py-8 md:py-12 ${
        theme.borderAccent
      } border-t-2 ${className}`}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Left: Image */}
            <MediaBlock image={image} theme={theme} />

            {/* Center: Title + Description */}
            <HeaderBlock
              title={title}
              description={description}
              familyName={family?.name}
              theme={theme}
            />

            {/* Right: Optional slot (prix, CTA, etc.) */}
            {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
          </div>

          {/* Trust badges */}
          <TrustBadges badges={badges} />
        </div>
      </div>
    </section>
  );
}
