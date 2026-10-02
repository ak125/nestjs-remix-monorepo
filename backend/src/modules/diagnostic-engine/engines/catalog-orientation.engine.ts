/**
 * CatalogOrientationEngine
 *
 * CatalogGuard — decide si et comment orienter vers le catalogue.
 * Bloque si confiance insuffisante. Respecte le principe de prudence.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { ScoredHypothesis } from './hypothesis-scoring.engine';
import type { RiskAssessment } from './risk-safety.engine';
import type { VehicleContextInput } from '../types/diagnostic-input.schema';
import { CAUSE_GAMME_MAP } from '../constants/gamme-map.constants';

export interface CatalogGuardResult {
  ready_for_catalog: boolean;
  confidence_before_purchase: 'high' | 'medium' | 'low' | 'insufficient';
  allowed_output_mode:
    | 'catalog_reference_with_caution'
    | 'catalog_family_with_caution'
    | 'catalog_family_only'
    | 'none';
  reason: string;
  suggested_gammes: SuggestedGamme[];
}

export interface SuggestedGamme {
  gamme_slug: string;
  gamme_label: string;
  pg_id: number;
  confidence: 'high' | 'medium' | 'low';
  from_hypothesis: string;
}

@Injectable()
export class CatalogOrientationEngine {
  private readonly logger = new Logger(CatalogOrientationEngine.name);

  evaluate(
    hypotheses: ScoredHypothesis[],
    risk: RiskAssessment,
    vehicle?: VehicleContextInput,
  ): CatalogGuardResult {
    const hasVehicle = !!(vehicle?.brand && vehicle?.model);
    const topHypothesis = hypotheses[0];

    // ── Gate 1: No hypotheses → block ───────────────────
    if (!topHypothesis || hypotheses.length === 0) {
      return {
        ready_for_catalog: false,
        confidence_before_purchase: 'insufficient',
        allowed_output_mode: 'none',
        reason:
          "Aucune hypothèse identifiée — impossible d'orienter vers un produit.",
        suggested_gammes: [],
      };
    }

    // ── Gate 2: Critical risk → block catalog, show safety ─
    if (risk.blocks_catalog || risk.requires_immediate_action) {
      return {
        ready_for_catalog: false,
        confidence_before_purchase: 'low',
        allowed_output_mode: 'none',
        reason: `Alerte sécurité active — contrôle professionnel requis avant tout achat.`,
        suggested_gammes: [],
      };
    }

    // ── Gate 3: Evaluate confidence ─────────────────────
    const confidence = this.evaluateConfidence(
      topHypothesis,
      hypotheses,
      hasVehicle,
    );

    // ── Gate 4: Incoherence guard ───────────────────────
    // ready_for_catalog + low confidence = force block
    if (confidence === 'low' || confidence === 'insufficient') {
      return {
        ready_for_catalog: false,
        confidence_before_purchase: confidence,
        allowed_output_mode:
          confidence === 'insufficient' ? 'none' : 'catalog_family_only',
        reason:
          'Confiance insuffisante — vérification recommandée avant achat.',
        suggested_gammes: this.buildSuggestedGammes(hypotheses, confidence),
      };
    }

    // ── Gate 5: Dominant hypothesis without a part family ─
    // Readiness rests on the dominant hypothesis. When it names no catalogue
    // family, every listed family belongs to a lower-ranked hypothesis.
    if (!CAUSE_GAMME_MAP[topHypothesis.hypothesis_id]?.length) {
      return {
        ready_for_catalog: false,
        confidence_before_purchase: 'low',
        allowed_output_mode: 'catalog_family_only',
        reason:
          "La cause la plus probable ne correspond à aucune famille de pièces : les familles listées concernent d'autres hypothèses. Vérification recommandée avant achat.",
        suggested_gammes: this.buildSuggestedGammes(hypotheses, 'low'),
      };
    }

    // ── Gate 6: Medium+ confidence ──────────────────────
    const readyForCatalog =
      confidence === 'high' || (confidence === 'medium' && hasVehicle);
    const outputMode = readyForCatalog
      ? confidence === 'high'
        ? 'catalog_reference_with_caution'
        : 'catalog_family_with_caution'
      : 'catalog_family_only';

    return {
      ready_for_catalog: readyForCatalog,
      confidence_before_purchase: confidence,
      allowed_output_mode: outputMode,
      reason: readyForCatalog
        ? 'Hypothèse dominante identifiée — orientation avec prudence.'
        : 'Vérification recommandée avant achat.',
      suggested_gammes: this.buildSuggestedGammes(hypotheses, confidence),
    };
  }

  /**
   * Keep only the families that have their own catalogue page. A result is
   * ready for the catalogue only while at least one such family remains.
   * `null` means the catalogue could not be checked: nothing is suggested.
   */
  restrictToCataloguePages(
    result: CatalogGuardResult,
    cataloguePageIds: ReadonlySet<number> | null,
  ): CatalogGuardResult {
    const suggested = result.suggested_gammes.filter(
      (g) => cataloguePageIds?.has(g.pg_id) === true,
    );
    if (suggested.length > 0) {
      return { ...result, suggested_gammes: suggested };
    }

    let reason = result.reason;
    if (cataloguePageIds === null && result.suggested_gammes.length > 0) {
      reason =
        'Orientation catalogue indisponible — les familles de pièces ne peuvent pas être vérifiées.';
    } else if (result.ready_for_catalog) {
      reason =
        'Aucune famille de pièces du catalogue ne correspond à ces hypothèses — vérification recommandée avant achat.';
    }
    return {
      ...result,
      ready_for_catalog: false,
      allowed_output_mode: 'none',
      reason,
      suggested_gammes: [],
    };
  }

  /**
   * Multi-factor confidence evaluation
   */
  private evaluateConfidence(
    top: ScoredHypothesis,
    all: ScoredHypothesis[],
    hasVehicle: boolean,
  ): 'high' | 'medium' | 'low' | 'insufficient' {
    // Score thresholds (from plan: 70+ = forte, 45-69 = probable, 25-44 = possible, <25 = faible)
    if (top.total_score < 25) return 'insufficient';

    // Check dominance: is there a clear winner?
    const second = all[1];
    const gap = second ? top.total_score - second.total_score : top.total_score;
    const isDominant = gap >= 15;

    if (top.total_score >= 70 && isDominant && hasVehicle) return 'high';
    if (top.total_score >= 45 && isDominant) return 'medium';
    if (top.total_score >= 25) return 'low';

    return 'insufficient';
  }

  /**
   * Build suggested gammes from hypotheses.
   * A family never claims more confidence than the diagnosis as a whole: a
   * high score without a dominant hypothesis or without a vehicle is not a
   * strong purchase lead.
   */
  private buildSuggestedGammes(
    hypotheses: ScoredHypothesis[],
    overallConfidence: CatalogGuardResult['confidence_before_purchase'],
  ): SuggestedGamme[] {
    const gammes: SuggestedGamme[] = [];
    const seen = new Set<string>();
    const levels = ['low', 'medium', 'high'] as const;
    const ceiling = levels.indexOf(
      overallConfidence === 'insufficient' ? 'low' : overallConfidence,
    );

    for (const h of hypotheses) {
      if (h.total_score < 15) continue;

      const causeGammes = CAUSE_GAMME_MAP[h.hypothesis_id] || [];
      for (const g of causeGammes) {
        if (seen.has(g.slug)) continue;
        seen.add(g.slug);

        const scoreLevel =
          h.total_score >= 75 ? 2 : h.total_score >= 60 ? 1 : 0;
        const confidence = levels[Math.min(scoreLevel, ceiling)];

        gammes.push({
          gamme_slug: g.slug,
          gamme_label: g.label,
          pg_id: g.pg_id,
          confidence,
          from_hypothesis: h.hypothesis_id,
        });
      }
    }

    return gammes;
  }
}
