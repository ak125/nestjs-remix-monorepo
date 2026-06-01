import { SITE_TRUST_CLAIMS } from './site-trust-claims';

/**
 * `PiecesHeroMetaStrip` — Tier 3 du `PiecesHeroTrustStrip`.
 *
 * Ligne de garanties commerciales/légales : Expédition / Retour / Paiement.
 *
 * **Source unique** : `SITE_TRUST_CLAIMS` (3 entrées canon). Le composant
 * ne hardcode jamais ces labels — un test anti-drift le vérifie.
 *
 * Bullets séparateurs : `<span aria-hidden="true">•</span>` (markup minimal,
 * pas le `Separator` Shadcn qui ajouterait inutilement du DOM pour un point
 * purement décoratif).
 */
export function PiecesHeroMetaStrip() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 font-body text-xs font-medium text-white/85">
      {SITE_TRUST_CLAIMS.map((claim, idx) => {
        const Icon = claim.icon;
        const isLast = idx === SITE_TRUST_CLAIMS.length - 1;
        return (
          <li
            key={claim.id}
            className="flex items-center gap-3 motion-safe:transition-opacity"
          >
            <span className="flex items-center gap-1.5">
              <Icon
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              {claim.label}
            </span>
            {!isLast && (
              <span className="text-white/30" aria-hidden="true">
                •
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
