import { CheckCircle2, Package } from 'lucide-react';

import { PiecesHeroFactChip } from './PiecesHeroFactChip';
import { PiecesHeroMetaStrip } from './PiecesHeroMetaStrip';
import { PiecesHeroPriceCard } from './PiecesHeroPriceCard';

/**
 * `PiecesHeroTrustStrip` — composition 3-tier du hero R2.
 *
 *  - Tier 1 — `PiecesHeroPriceCard` (dominant, conditionnel sur minPrice).
 *  - Tier 2 — Deux `PiecesHeroFactChip` (count références + compat. véhicule
 *    `verified`).
 *  - Tier 3 — `PiecesHeroMetaStrip` (3 claims SoT shipping/returns/payment).
 *
 * Refonte 2026-05-28 (direction "Confiance", canon `frontend-design`).
 * Remplace les 4 badges uniformes pré-existants : hiérarchie nette,
 * faits chiffrés au lieu de clichés ("Qualité garantie"/"Livraison rapide"),
 * 0 emoji, 0 hex hardcodé, motion-safe respecté.
 */
export interface PiecesHeroTrustStripProps {
  /** Nombre de références produit (count). */
  readonly count: number;
  /** Modèle véhicule pour le chip compatibilité (affiché en uppercase). */
  readonly vehicleModele: string;
  /** Motorisation véhicule pour le chip compatibilité. */
  readonly vehicleType: string;
  /** Prix minimum optionnel. Si absent ou ≤ 0, le PriceCard n'apparaît pas. */
  readonly minPrice?: number;
  /**
   * Métriques de perf RM-v2 — affichées **uniquement en non-production**
   * (debug observability). Le nom `debugPerformance` évite la collision
   * avec l'API native `window.performance`.
   */
  readonly debugPerformance?: {
    readonly source: string;
    readonly loadTime: number;
  };
}

export function PiecesHeroTrustStrip({
  count,
  vehicleModele,
  vehicleType,
  minPrice,
  debugPerformance,
}: PiecesHeroTrustStripProps) {
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <section
      aria-label="Tarifs et garanties"
      className="space-y-3"
    >
      {/* Tier 1 (price dominant) + Tier 2 (fact chips) */}
      <div className="flex flex-wrap items-stretch gap-3">
        <PiecesHeroPriceCard minPrice={minPrice} />

        <PiecesHeroFactChip
          icon={Package}
          srLabel="Nombre de références produit"
          label={
            <>
              <span className="font-bold">{count}</span>{' '}
              référence{count > 1 ? 's' : ''}
            </>
          }
        />

        <PiecesHeroFactChip
          icon={CheckCircle2}
          variant="verified"
          srLabel="Compatibilité véhicule confirmée"
          label={
            <>
              Compatible{' '}
              <span className="font-bold">
                {vehicleModele.toUpperCase()}
              </span>{' '}
              {vehicleType}
            </>
          }
        />
      </div>

      {/* Tier 3 — meta strip (claims SoT) */}
      <PiecesHeroMetaStrip />

      {/* Debug only — caché en production */}
      {isDev && debugPerformance && (
        <p className="font-body text-[11px] text-white/60">
          <span className="font-mono">{debugPerformance.source}</span> •{' '}
          {debugPerformance.loadTime}ms
        </p>
      )}
    </section>
  );
}
