/**
 * HeroTransaction — Intent class: TRANSACTION
 * hero_policy: photo (photo produit, gradient famille + badges confiance)
 *
 * Wrapper visuel uniquement — NE REND PAS de <h1>.
 * Le H1 reste dans la route, passé via children.
 *
 * @see frontend/app/components/heroes/_hero.contract.md
 * @see .spec/00-canon/image-matrix-v1.md §2
 */

import { type ReactNode } from "react";
import { getFamilyTheme } from "~/utils/family-theme";

interface HeroTransactionProps {
  /** Famille pour theming (gradient dynamique) */
  family?: { id?: number; name?: string };
  /** Override direct du gradient CSS (ex: depuis hierarchyApi.getFamilyColor) */
  gradient?: string;
  /** Badges de confiance (ex: "Livraison 24h", "Garantie 2 ans") */
  badges?: string[];
  /** Slogan genere par resolveSlogan() */
  slogan?: string;
  /** Slot pour overlays absolute-positioned (wallpaper, mesh gradient, extra glows) */
  backgroundSlot?: ReactNode;
  /** Contenu libre : H1, UXMessageBox, image, VehicleSelector — tout reste dans la route */
  children: ReactNode;
  /** Classes CSS additionnelles (ex: padding override) */
  className?: string;
}

/* --- Sous-bloc interne --- */

function TrustBadges({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-3 md:gap-4 max-w-3xl mx-auto mt-6">
      {badges.map((badge) => (
        <span
          key={badge}
          className="flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 text-white text-sm font-semibold"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

/* --- Composant principal --- */

export function HeroTransaction({
  family,
  gradient,
  badges = [],
  slogan,
  backgroundSlot,
  children,
  className = "",
  ...rest
}: HeroTransactionProps &
  Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const familyKey = family?.id || family?.name;
  const theme = familyKey ? getFamilyTheme(familyKey) : getFamilyTheme("gray");

  const gradientClass = gradient || theme.gradient;

  return (
    <section
      {...rest}
      className={`relative overflow-hidden bg-gradient-to-br ${gradientClass} text-white ${className}`}
    >
      {/* Grid pattern subtil */}
      <div
        className="absolute inset-0 z-[1] opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                           linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)`,
          backgroundSize: "3rem 3rem",
        }}
        aria-hidden="true"
      />
      {/* Glow decoratif top-right */}
      <div
        className="absolute -top-32 -right-32 w-96 h-96 bg-white/[0.07] rounded-full blur-3xl z-[1]"
        aria-hidden="true"
      />

      {/* Slot overlays custom (wallpaper, mesh, extra glows) */}
      {backgroundSlot}

      <div className="relative z-10 container mx-auto px-4 max-w-7xl">
        {children}

        {/* Slogan */}
        {slogan && (
          <p className="text-sm text-white/60 max-w-xl mx-auto text-center mt-2">
            {slogan}
          </p>
        )}

        {/* Trust badges */}
        <TrustBadges badges={badges} />
      </div>
    </section>
  );
}
