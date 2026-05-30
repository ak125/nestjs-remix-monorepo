import { Tag } from 'lucide-react';

/**
 * `PiecesHeroPriceCard` — Tier 1 du `PiecesHeroTrustStrip`.
 *
 * Affiche le prix "à partir de" en visuel dominant sur le hero R2.
 * Le `<output>` sémantique permet aux ATs et scrapers de lire la valeur
 * monétaire en machine-readable.
 *
 * **Rend null** si `minPrice` est falsy / <= 0 (anti-data-corruption).
 * **0 hex hardcodé**, tokens Tailwind uniquement (`bg-cta`, `bg-white/15`).
 */
export interface PiecesHeroPriceCardProps {
  /** Prix minimum en euros. Si absent ou <= 0, le composant rend null. */
  readonly minPrice?: number;
}

// Formatage FR canon : `49,90 €` (espace insécable géré par Intl)
const priceFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function PiecesHeroPriceCard({ minPrice }: PiecesHeroPriceCardProps) {
  if (minPrice == null || !Number.isFinite(minPrice) || minPrice <= 0) {
    return null;
  }

  const formatted = priceFormatter.format(minPrice);

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg md:backdrop-blur-xl',
        'bg-white/15 ring-1 ring-inset ring-white/30',
        'motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-xl',
      ].join(' ')}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cta ring-1 ring-inset ring-white/20">
        <Tag
          className="h-5 w-5 text-white"
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </div>
      <div>
        <p className="font-body text-[10px] font-bold uppercase tracking-wider text-white/75">
          À partir de
        </p>
        <output className="font-heading text-2xl font-black leading-none tracking-tight text-white">
          {formatted}
        </output>
      </div>
    </div>
  );
}
