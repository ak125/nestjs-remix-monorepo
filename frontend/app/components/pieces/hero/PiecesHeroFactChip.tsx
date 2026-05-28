import type { LucideIcon } from 'lucide-react';

/**
 * Chip atomique de la `PiecesHeroTrustStrip` — Tier 2 du hero R2.
 *
 * Affiche un fait court (count + label, compatibilité véhicule, etc.)
 * sur l'overlay du hero gradient brand. Variantes pour différencier
 * un fait "verified" (compatibilité confirmée, success token) du
 * standard (overlay subtle).
 *
 * **Non-cliquable** (pas de hover scale, pas d'action). Affichage pur.
 * Pour les hover purement visuels (élévation shadow), on respecte
 * `motion-safe:` (prefers-reduced-motion canon).
 */
export interface PiecesHeroFactChipProps {
  /** Icône Lucide affichée à gauche (décorative, aria-hidden). */
  readonly icon: LucideIcon;
  /** Contenu textuel principal. */
  readonly label: React.ReactNode;
  /** Variante visuelle. `verified` = success semantic (compatibilité). */
  readonly variant?: 'default' | 'verified';
  /** Label sr-only pour describe la nature de la donnée (a11y data list). */
  readonly srLabel?: string;
}

const surfaceClassByVariant = {
  default:
    'bg-white/10 ring-1 ring-inset ring-white/20 hover:bg-white/[0.12]',
  verified:
    'bg-success/15 ring-1 ring-inset ring-success/30 hover:bg-success/20',
} as const;

export function PiecesHeroFactChip({
  icon: Icon,
  label,
  variant = 'default',
  srLabel,
}: PiecesHeroFactChipProps) {
  return (
    <div
      className={[
        'flex items-center gap-2 rounded-xl px-4 py-3 shadow-md md:backdrop-blur-xl',
        'motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-lg',
        'font-body text-sm text-white',
        surfaceClassByVariant[variant],
      ].join(' ')}
    >
      <Icon
        className="h-4 w-4 shrink-0"
        strokeWidth={2.25}
        aria-hidden="true"
      />
      {srLabel && <span className="sr-only">{srLabel}</span>}
      <span className="font-body">{label}</span>
    </div>
  );
}
