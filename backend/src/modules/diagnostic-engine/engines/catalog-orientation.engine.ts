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
    if (risk.requires_immediate_action) {
      return {
        ready_for_catalog: false,
        confidence_before_purchase: 'low',
        allowed_output_mode: 'catalog_family_only',
        reason: `Alerte sécurité active — contrôle professionnel requis avant tout achat.`,
        suggested_gammes: this.buildSuggestedGammes(hypotheses, 'low'),
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

    // ── Gate 5: Medium+ confidence ──────────────────────
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
   * Build suggested gammes from hypotheses
   */
  private buildSuggestedGammes(
    hypotheses: ScoredHypothesis[],
    overallConfidence: string,
  ): SuggestedGamme[] {
    const gammes: SuggestedGamme[] = [];
    const seen = new Set<string>();

    for (const h of hypotheses) {
      if (h.total_score < 15) continue;

      const causeGammes = CAUSE_GAMME_MAP[h.hypothesis_id] || [];
      for (const g of causeGammes) {
        if (seen.has(g.slug)) continue;
        seen.add(g.slug);

        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (h.total_score >= 60 && overallConfidence !== 'low')
          confidence = 'medium';
        if (h.total_score >= 75) confidence = 'high';

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
