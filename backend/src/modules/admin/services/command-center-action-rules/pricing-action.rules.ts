/**
 * Pricing rules — CAUTIOUS (source pricing is PARTIAL).
 * Only UNAMBIGUOUS facts become risk actions:
 *   - sell-at-loss (vente_ht < achat_ht) — should be blocked at import → if present, a real bug
 *   - missing purchase price (achat null/0 but sold) — can't know the margin
 * Nuanced "low margin" is NOT guessed here: the canonical thresholds live in
 * MARGE_NEW_2021 (owner SoT) → a certification action to wire them, never a fake %.
 * Pure function (no I/O) — the service supplies the counted stats.
 */
import { type RawAction } from './score-action';

export interface PricingStats {
  available_total: number;
  sell_at_loss: number;
  missing_purchase: number;
  sell_at_loss_samples: string[]; // piece ids
  missing_samples: string[];
}

export function buildPricingRiskActions(s: PricingStats): RawAction[] {
  const out: RawAction[] = [];

  if (s.sell_at_loss > 0) {
    out.push({
      id: 'pricing:sell-at-loss',
      title: `${s.sell_at_loss} référence(s) vendable(s) à perte (vente < achat)`,
      department: 'pricing',
      source: 'pricing',
      action_type: 'risk',
      impact: 10, // marge directe
      urgency: 9,
      data_confidence: 72, // fait non ambigu, même si la source pricing est PARTIAL
      effort: 3,
      risk: 2,
      reason:
        "vente_ht < achat_ht alors que l'invariant VENTE_BELOW_ACHAT bloque ça à l'import — donc bug de données legacy.",
      evidence: s.sell_at_loss_samples
        .slice(0, 5)
        .map((id) => `pieces_price pri_piece_id=${id}`),
      next_step:
        "Contrôle pricing : corriger le prix de vente ou d'achat, ou geler la référence.",
    });
  }

  if (s.missing_purchase > 0) {
    out.push({
      id: 'pricing:missing-purchase',
      title: `${s.missing_purchase} référence(s) vendue(s) sans prix d'achat`,
      department: 'pricing',
      source: 'pricing',
      action_type: 'risk',
      impact: 8,
      urgency: 7,
      data_confidence: 65,
      effort: 3,
      risk: 2,
      reason:
        'pri_achat_ht absent/0 mais vente > 0 → marge inconnue, risque de vente à perte invisible.',
      evidence: s.missing_samples
        .slice(0, 5)
        .map((id) => `pieces_price pri_piece_id=${id}`),
      next_step:
        "Charger le prix d'achat (procédure supplier price-load) pour ces références.",
    });
  }

  // Nuanced "marge faible" needs the canonical thresholds (not guessable) → certification.
  out.push({
    id: 'pricing:wire-margin-thresholds',
    title:
      'Câbler les seuils de marge canon (MARGE_NEW_2021) pour la détection "marge faible"',
    department: 'pricing',
    source: 'pricing',
    action_type: 'certification',
    impact: 6,
    urgency: 5,
    data_confidence: 90, // gap connu de façon certaine
    effort: 4,
    risk: 1,
    reason:
      `${s.available_total} références dispo, ${s.missing_purchase} sans prix d'achat. ` +
      "Vente-à-perte : bloquée à l'import (invariant VENTE_BELOW_ACHAT) — détection runtime (comparaison colonnes) à câbler via RPC. " +
      'La « marge faible » par sous-famille dépend des seuils MARGE_NEW_2021 (SoT owner), non câblés au runtime.',
    evidence: ['reference_pricing_canon_xls_archive (MARGE_NEW_2021.xls)'],
    next_step:
      'Définir les seuils de marge par sous-famille (SoT MARGE_NEW_2021) + RPC vente-à-perte → activer la règle "marge faible".',
  });

  return out;
}
