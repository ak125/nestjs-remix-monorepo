/**
 * HeroRole — Intent class: ROLE_PIECE
 * hero_policy: illustration (gradient pedagogique + illustration technique)
 *
 * Pour les pages "role d'une piece" (R4 enrichi).
 * Distinct de HeroReference (minimal, encyclopedique).
 * HeroRole est pedagogique : gradient chaud, illustration, animation subtile.
 *
 * @see frontend/app/components/heroes/_hero.contract.md
 * @see .spec/00-canon/image-matrix-v1.md §2
 */

import { type LucideIcon, Cog } from "lucide-react";
import { getFamilyTheme } from "~/utils/family-theme";

interface HeroRoleProps {
  /** Titre H1 principal */
  title: string;
  /** Description courte du role de la piece */
  description?: string;
  /** Slogan genere par resolveSlogan() */
  slogan?: string;
  /** Icone lucide-react (defaut: Cog) */
  icon?: LucideIcon;
  /** Nom ou ID de famille pour le gradient */
  familyName?: string | number;
  /** Illustration technique (image SVG/WebP de la piece) */
  illustration?: { src: string; alt: string };
  /** Classes CSS additionnelles */
  className?: string;
}

export function HeroRole({
  title,
  description,
  slogan,
  icon: Icon = Cog,
  familyName,
  illustration,
  className = "",
}: HeroRoleProps) {
  const theme = familyName
    ? getFamilyTheme(familyName)
    : getFamilyTheme("gray");

  return (
    <section
      className={`relative overflow-hidden bg-gradient-to-br ${theme.gradient} text-white py-8 md:py-12 ${className}`}
    >
      {/* Motif decoratif subtil */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)",
          backgroundSize: "2rem 2rem",
        }}
        aria-hidden="true"
      />

      <div className="relative container mx-auto px-4">
        <div className="max-w-4xl flex items-start gap-6">
          {/* Illustration ou icone */}
          <div className="flex-shrink-0">
            {illustration ? (
              <img
                src={illustration.src}
                alt={illustration.alt}
                className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-contain bg-white/10 p-2"
                loading="eager"
              />
            ) : (
              <div className="p-3 md:p-4 rounded-xl bg-white/10 border border-white/20">
                <Icon className="w-8 h-8 md:w-10 md:h-10 text-white/90" />
              </div>
            )}
          </div>

          {/* Texte */}
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm md:text-base text-white/80 max-w-2xl">
                {description}
              </p>
            )}
            {slogan && (
              <p className="mt-1 text-sm text-white/60 max-w-xl">{slogan}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
