/**
 * HeroSelection — Intent class: SELECTION
 * hero_policy: gradient (gradient CSS, pas de photo)
 *
 * @see frontend/app/components/heroes/_hero.contract.md
 * @see .spec/00-canon/image-matrix-v1.md §2
 */

import { type ReactNode } from "react";
import { getFamilyTheme } from "~/utils/family-theme";

interface HeroSelectionProps {
  /** Titre H1 principal */
  title: string;
  /** Sous-titre optionnel */
  subtitle?: string;
  /** Slot libre pour breadcrumb (ReactNode) */
  breadcrumbSlot?: ReactNode;
  /** ID ou nom de famille pour le gradient */
  familyId?: string | number;
  /** Classes CSS additionnelles */
  className?: string;
}

export function HeroSelection({
  title,
  subtitle,
  breadcrumbSlot,
  familyId,
  className = "",
}: HeroSelectionProps) {
  const theme = familyId
    ? getFamilyTheme(familyId)
    : { gradient: "from-slate-700 to-gray-800" };

  return (
    <section
      className={`relative bg-gradient-to-r ${theme.gradient} text-white py-5 md:py-8 ${className}`}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {breadcrumbSlot && (
            <div className="mb-3 text-sm text-white/70">{breadcrumbSlot}</div>
          )}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm md:text-base text-white/80 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
