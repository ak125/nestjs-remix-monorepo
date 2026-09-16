import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  SCORING_VERSION,
  SCORING_PROFILES,
  scoringPageTypeToRoleId,
  PRIORITY_THRESHOLDS,
  DEPTH_THRESHOLDS,
  SEO_THRESHOLDS,
  FRESHNESS_THRESHOLDS,
  CONFIDENCE_SIGNALS,
  CONTINUOUS_SCORING,
  type ScoringPageType,
  type DimensionName,
  type ScoreStatus,
  type Priority,
  type ScoringProfile,
  // GateSeverity reserved for future gate enforcement
} from '../../../config/scoring-profiles.config';

// ── v2: Continuous scoring helpers ──

/** Linear score: partial credit proportional to actual/threshold */
function continuousScore(
  actual: number,
  threshold: number,
  maxPoints: number,
): number {
  if (!CONTINUOUS_SCORING) return actual >= threshold ? maxPoints : 0;
  if (actual >= threshold) return maxPoints;
  if (actual <= 0) return 0;
  return maxPoints * Math.min(1, actual / threshold);
}

/** Count-based score: linear interpolation */
function countScore(
  actual: number,
  threshold: number,
  maxPoints: number,
): number {
  if (!CONTINUOUS_SCORING) return actual >= threshold ? maxPoints : 0;
  if (actual >= threshold) return maxPoints;
  if (actual <= 0) return 0;
  return maxPoints * (actual / threshold);
}

/** Clamp to 1 decimal place without rounding to integer */
function decimalClamp(val: number, min = 0, max = 100): number {
  return parseFloat(Math.max(min, Math.min(max, val)).toFixed(1));
}

// ── Feature Row (from RPC get_page_quality_features) ──

export interface FeatureRow {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  // Purchase Guide
  guide_exists: boolean;
  guide_how_to_choose_length: number;
  guide_selection_criteria_length: number;
  guide_anti_mistakes_count: number;
  guide_decision_tree_length: number;
  guide_faq_count: number;
  guide_symptoms_count: number;
  guide_source_verified: boolean;
  guide_is_draft: boolean;
  guide_intro_role_length: number;
  guide_risk_explanation_length: number;
  guide_arg_count: number;
  guide_updated_at: string | null;
  // SEO
  seo_exists: boolean;
  seo_title_length: number;
  seo_desc_length: number;
  seo_h1_length: number;
  seo_content_length: number;
  // Reference
  ref_exists: boolean;
  ref_definition_length: number;
  ref_role_mecanique_length: number;
  ref_composition_count: number;
  ref_confusions_count: number;
  ref_symptomes_count: number;
  ref_content_html_length: number;
  ref_has_schema_json: boolean;
  ref_has_canonical: boolean;
  ref_related_refs_count: number;
  ref_blog_slugs_count: number;
  ref_regles_metier_count: number;
  ref_title_length: number;
  ref_meta_desc_length: number;
  ref_updated_at: string | null;
  // Conseil
  conseil_exists: boolean;
  conseil_total_sections: number;
  conseil_rich_sections: number;
  conseil_has_s1: boolean;
  conseil_has_s2: boolean;
  conseil_has_s3: boolean;
  conseil_has_s4_depose: boolean;
  conseil_has_s4_repose: boolean;
  conseil_has_s5: boolean;
  conseil_has_s6: boolean;
  conseil_has_s7: boolean;
  conseil_has_s8: boolean;
  conseil_total_content_length: number;
  // RAG
  rag_content_length: number;
  rag_truth_level: string | null;
  // Pipeline
  pipeline_quality_score: number;
  pipeline_hard_gate_results: unknown;
  pipeline_completed_at: string | null;
  // Media
  has_pg_img: boolean;
  has_pg_pic: boolean;
  has_pg_wall: boolean;
  // Blog
  has_blog_advice: boolean;
  blog_advice_content_length: number;
  // Sémantique R3_guide (D1/D2/D3 + GENERIC_WITHOUT_ACTION — portage
  // buying-guide-quality-gates, salvage pré-purge RAG 2026-06-11).
  // OPTIONNELS : absents tant que la migration
  // 20260611_quality_features_r3_guide_semantics n'est pas appliquée à la DB —
  // les penalties correspondantes sont alors skippées (dégradation propre,
  // aucune erreur ni distorsion de score avec l'ancienne RPC).
  guide_criteria_count?: number | null;
  guide_guidance_copies_label_count?: number | null;
  guide_positive_starter_count?: number | null;
  guide_use_cases_count?: number | null;
  guide_profile_marker_count?: number | null;
  guide_generic_phrase_count?: number | null;
  guide_action_marker_count?: number | null;
}

// ── Scoring Result ──

interface PenaltyEntry {
  rule: string;
  points: number;
}

interface PageScoreResult {
  quality_score: number;
  confidence_score: number;
  subscores: Record<string, number>;
  penalties: PenaltyEntry[];
  hard_gate_status: 'PASS' | 'WARN' | 'BLOCKED';
  status: ScoreStatus;
  priority: Priority;
  reasons: string[];
  next_actions: string[];
  features: Record<string, unknown>;
}

@Injectable()
export class QualityScoringEngineService extends SupabaseBaseService {
  protected readonly logger = new Logger(QualityScoringEngineService.name);

  // ── Public API ──

  /**
   * Compute quality scores for ALL gammes (batch).
   * Called from admin endpoint or scheduled job.
   */
  async computeAllScores(): Promise<{
    pagesScored: number;
    gammesScored: number;
  }> {
    const features = await this.fetchFeatures();
    let pagesScored = 0;

    for (const row of features) {
      const pageTypes = this.detectScoringPageTypes(row);
      for (const pt of pageTypes) {
        const profile = SCORING_PROFILES[pt];
        if (!profile) continue;
        const result = this.scoreScoringPageType(row, profile);
        await this.upsertPageScore(row.pg_id, pt, result);
        pagesScored++;
      }
    }

    this.logger.log(
      `Scored ${pagesScored} pages for ${features.length} gammes`,
    );
    return { pagesScored, gammesScored: features.length };
  }

  /**
   * Compute quality scores for a single gamme (after refresh).
   */
  async computeScoreForGamme(pgId: number): Promise<void> {
    const { data, error } = await this.callRpc<FeatureRow[]>(
      'get_page_quality_features',
      {},
    );
    if (error) {
      this.logger.error(`Feature extraction failed: ${error.message}`);
      return;
    }
    const row = (data ?? []).find((r) => r.pg_id === pgId);
    if (!row) {
      this.logger.warn(`No features found for pg_id=${pgId}`);
      return;
    }
    const pageTypes = this.detectScoringPageTypes(row);
    for (const pt of pageTypes) {
      const profile = SCORING_PROFILES[pt];
      if (!profile) continue;
      const result = this.scoreScoringPageType(row, profile);
      await this.upsertPageScore(row.pg_id, pt, result);
    }
  }

  // ── Feature Extraction ──

  private async fetchFeatures(): Promise<FeatureRow[]> {
    const { data, error } = await this.callRpc<FeatureRow[]>(
      'get_page_quality_features',
      {},
    );
    if (error) {
      this.logger.error(`Feature extraction failed: ${error.message}`);
      return [];
    }
    return data ?? [];
  }

  // ── Page Type Detection ──

  private detectScoringPageTypes(row: FeatureRow): ScoringPageType[] {
    const types: ScoringPageType[] = [];
    // R1 is always present (every gamme has a pieces_gamme entry)
    types.push('R1_pieces');
    if (row.guide_exists) types.push('R3_guide');
    if (row.ref_exists) types.push('R4_reference');
    if (row.conseil_exists) types.push('R3_conseils');
    return types;
  }

  // ── Core Scoring ──

  private scoreScoringPageType(
    row: FeatureRow,
    profile: ScoringProfile,
  ): PageScoreResult {
    if (profile.dimensions.length === 0) {
      throw new Error(`Unimplemented scoring profile: ${profile.pageType}`);
    }
    const reasons: string[] = [
      'Diagnostic de structure uniquement : preuves factuelles, doublons et page rendue non verifies',
    ];
    const nextActions: string[] = [];
    const penalties: PenaltyEntry[] = [];

    // 1. Compute dimension subscores (0-100 each)
    const subscores: Record<string, number> = {};
    for (const dim of profile.dimensions) {
      subscores[dim.name] = this.computeDimension(
        dim.name,
        row,
        profile.pageType,
        reasons,
        nextActions,
      );
    }

    // 2. Weighted raw score
    let rawScore = 0;
    for (const dim of profile.dimensions) {
      rawScore += (subscores[dim.name] / 100) * dim.weight;
    }

    // 3. Hard gates
    let hardGateStatus: 'PASS' | 'WARN' | 'BLOCKED' = 'PASS';
    for (const gate of profile.hardGates) {
      const passed = this.evaluateHardGate(gate.check, row);
      if (!passed) {
        if (gate.severity === 'BLOCKED') {
          hardGateStatus = 'BLOCKED';
          reasons.unshift(gate.description);
        } else if (gate.severity === 'WARN' && hardGateStatus !== 'BLOCKED') {
          hardGateStatus = 'WARN';
          reasons.push(gate.description);
        }
      }
    }

    // 4. Soft penalties
    for (const penalty of profile.softPenalties) {
      const applies = this.evaluatePenalty(penalty.check, row);
      if (applies) {
        penalties.push({ rule: penalty.id, points: penalty.points });
        rawScore += penalty.points;
        reasons.push(penalty.description);
      }
    }

    // 5. Clamp score (v2: decimal precision)
    const qualityScore = decimalClamp(rawScore);

    // 6. Confidence score
    const confidenceScore = this.computeConfidence(row, profile.pageType);

    // 7. Data sufficiency check
    const featureCount = this.countPresentFeatures(row, profile.pageType);
    const isInsufficientData = featureCount < profile.minDataThreshold;

    // 8. Status determination
    let status: ScoreStatus;
    if (hardGateStatus === 'BLOCKED') {
      status = 'BLOCKED';
    } else if (isInsufficientData) {
      status = 'INSUFFICIENT_DATA';
    } else if (qualityScore >= 60) {
      // The RPC has no evidence tied to a rendered page revision. A structural
      // score cannot certify editorial health, regardless of its numeric value.
      status = 'REVIEW';
    } else {
      status = 'DEGRADED';
    }

    // 9. Priority
    const priority = this.derivePriority(qualityScore, hardGateStatus);

    // 10. Build feature snapshot
    const features = this.extractFeatureSnapshot(row, profile.pageType);

    return {
      quality_score: qualityScore,
      confidence_score: confidenceScore,
      subscores,
      penalties,
      hard_gate_status: hardGateStatus,
      status,
      priority,
      reasons: reasons.slice(0, 5),
      next_actions: this.deriveActions(row, profile.pageType, reasons).slice(
        0,
        5,
      ),
      features,
    };
  }

  // ── Dimension Scorers ──

  private computeDimension(
    dim: DimensionName,
    row: FeatureRow,
    pageType: ScoringPageType,
    reasons: string[],
    _nextActions: string[],
  ): number {
    switch (dim) {
      case 'content_depth':
        return this.scoreContentDepth(row, pageType, reasons);
      case 'seo_technical':
        return this.scoreSeoTechnical(row, pageType, reasons);
      case 'trust_evidence':
        return this.scoreTrustEvidence(row, pageType, reasons);
      case 'freshness':
        return this.scoreFreshness(row, pageType, reasons);
      default:
        throw new Error(`Unsupported scoring dimension: ${dim}`);
    }
  }

  private scoreContentDepth(
    row: FeatureRow,
    pageType: ScoringPageType,
    reasons: string[],
  ): number {
    switch (pageType) {
      case 'R3_guide': {
        const t = DEPTH_THRESHOLDS.R3_guide;
        let score = 0;
        const checks = [
          {
            actual: row.guide_how_to_choose_length,
            threshold: t.how_to_choose_min,
            pts: 15,
            count: false,
            reason: 'Section "comment choisir" courte',
          },
          {
            actual: row.guide_selection_criteria_length,
            threshold: t.selection_criteria_min,
            pts: 12,
            count: false,
            reason: 'Criteres de selection insuffisants',
          },
          {
            actual: row.guide_anti_mistakes_count,
            threshold: t.anti_mistakes_min,
            pts: 12,
            count: true,
            reason: 'Erreurs a eviter insuffisantes',
          },
          {
            actual: row.guide_decision_tree_length,
            threshold: t.decision_tree_min,
            pts: 10,
            count: false,
            reason: 'Arbre de decision manquant',
          },
          {
            actual: row.guide_faq_count,
            threshold: t.faq_min,
            pts: 15,
            count: true,
            reason: 'Moins de 3 FAQ',
          },
          {
            actual: row.guide_symptoms_count,
            threshold: t.symptoms_min,
            pts: 12,
            count: true,
            reason: 'Moins de 3 symptomes',
          },
          {
            actual: row.guide_intro_role_length,
            threshold: t.intro_role_min,
            pts: 8,
            count: false,
            reason: 'Introduction trop courte',
          },
          {
            actual: row.guide_risk_explanation_length,
            threshold: t.risk_explanation_min,
            pts: 8,
            count: false,
            reason: 'Explication des risques absente',
          },
          {
            actual: row.guide_arg_count,
            threshold: t.arg_count_min,
            pts: 8,
            count: true,
            reason: 'Moins de 3 arguments',
          },
        ];
        for (const c of checks) {
          const pts = c.count
            ? countScore(c.actual, c.threshold, c.pts)
            : continuousScore(c.actual, c.threshold, c.pts);
          score += pts;
          if (pts < c.pts * 0.5) reasons.push(c.reason);
        }
        return decimalClamp(score);
      }

      case 'R4_reference': {
        const t = DEPTH_THRESHOLDS.R4_reference;
        let score = 0;
        const checks = [
          {
            actual: row.ref_definition_length,
            threshold: t.definition_min,
            pts: 25,
            count: false,
            reason: 'Definition trop courte',
          },
          {
            actual: row.ref_role_mecanique_length,
            threshold: t.role_mecanique_min,
            pts: 15,
            count: false,
            reason: 'Role mecanique non decrit',
          },
          {
            actual: row.ref_composition_count,
            threshold: t.composition_min,
            pts: 15,
            count: true,
            reason: 'Composition non detaillee',
          },
          {
            actual: row.ref_confusions_count,
            threshold: t.confusions_min,
            pts: 10,
            count: true,
            reason: 'Confusions courantes absentes',
          },
          {
            actual: row.ref_symptomes_count,
            threshold: t.symptomes_min,
            pts: 10,
            count: true,
            reason: 'Symptomes associes absents',
          },
          {
            actual: row.ref_content_html_length,
            threshold: t.content_html_min,
            pts: 15,
            count: false,
            reason: 'Contenu HTML trop court',
          },
          {
            actual: row.ref_regles_metier_count,
            threshold: t.regles_metier_min,
            pts: 10,
            count: true,
            reason: 'Regles metier absentes',
          },
        ];
        for (const c of checks) {
          const pts = c.count
            ? countScore(c.actual, c.threshold, c.pts)
            : continuousScore(c.actual, c.threshold, c.pts);
          score += pts;
          if (pts < c.pts * 0.5) reasons.push(c.reason);
        }
        return decimalClamp(score);
      }

      case 'R3_conseils': {
        const t = DEPTH_THRESHOLDS.R3_conseils;
        let score = 0;
        // Section coverage (8 sections expected, each worth ~8pts)
        const sectionPct = Math.min(
          100,
          (row.conseil_total_sections / t.sections_expected) * 100,
        );
        score += sectionPct * 0.35; // up to 35
        // Rich sections quality (v2.1: cap at 50% if < 3 sections)
        const richPct =
          row.conseil_total_sections > 0
            ? (row.conseil_rich_sections / row.conseil_total_sections) * 100
            : 0;
        const richCap = row.conseil_total_sections < 3 ? 0.5 : 1;
        score += richPct * 0.35 * richCap; // up to 35 (capped if few sections)
        // Total content length — continuous curve
        score += continuousScore(
          row.conseil_total_content_length,
          t.total_content_min,
          30,
        );
        if (row.conseil_total_content_length < t.total_content_min / 2)
          reasons.push('Contenu conseil trop court (< 1250 chars)');
        return decimalClamp(score);
      }

      case 'R1_pieces': {
        let score = 20; // v2.1: base reduit de 40 → 20
        if (row.has_pg_img) score += 15;
        else reasons.push('Image produit (pg_img) manquante');
        if (row.has_pg_pic) score += 15;
        else reasons.push('Image hero (pg_pic) manquante');
        if (row.has_pg_wall) score += 10;
        if (row.has_blog_advice) score += 10;
        // v2.2: contenu RÉEL (sg_content). Absorbe les 10 pts de l'ex-signal RAG
        // (retiré : RAG = chatbot only). 20+15+15+10+10+30 = 100.
        score += continuousScore(row.seo_content_length, 800, 30);
        return decimalClamp(score);
      }

      default:
        return 50;
    }
  }

  private pageSeoFeatures(row: FeatureRow, pageType: ScoringPageType) {
    // seo_* comes from __seo_gamme (R1), ref_* from __seo_reference (R4).
    // The RPC exposes no guide/conseil page metadata or R4 H1.
    if (pageType === 'R1_pieces')
      return {
        title_length: row.seo_title_length,
        description_length: row.seo_desc_length,
        h1_length: row.seo_h1_length,
        content_length: row.seo_content_length,
      };
    if (pageType === 'R4_reference')
      return {
        title_length: row.ref_title_length,
        description_length: row.ref_meta_desc_length,
        h1_length: null,
        content_length: row.ref_content_html_length,
      };
    return null;
  }

  private scoreSeoTechnical(
    row: FeatureRow,
    pageType: ScoringPageType,
    reasons: string[],
  ): number {
    const pageSeo = this.pageSeoFeatures(row, pageType);
    if (!pageSeo) {
      reasons.push('Metadonnees SEO propres a cette page non disponibles');
      return 0;
    }
    const t = SEO_THRESHOLDS;
    let score = 0;
    const titleLen = pageSeo.title_length;
    if (titleLen >= t.title_min && titleLen <= t.title_max) score += 25;
    else if (titleLen > 0) {
      score += 5; // v2.1: partial credit reduit de 10 → 5
      reasons.push(
        `Titre SEO hors plage (${titleLen} chars, ideal ${t.title_min}-${t.title_max})`,
      );
    } else reasons.push('Titre SEO absent');

    // Meta description
    const descLen = pageSeo.description_length;
    if (descLen >= t.desc_min && descLen <= t.desc_max) score += 25;
    else if (descLen > 0) {
      score += 5; // v2.1: partial credit reduit de 10 → 5
      reasons.push(`Meta description hors plage (${descLen} chars)`);
    } else reasons.push('Meta description absente');

    // H1
    const h1Len = pageSeo.h1_length;
    if (h1Len !== null && h1Len >= t.h1_min) score += 15;
    else
      reasons.push(
        h1Len === null
          ? 'H1 de cette page non verifie'
          : 'H1 absent ou trop court',
      );

    const contentLen = pageSeo.content_length;
    if (contentLen >= t.content_min) score += 35;
    else if (contentLen > 0) {
      score += 14;
      reasons.push(
        `Contenu page trop court (${contentLen} chars, min ${t.content_min})`,
      );
    } else reasons.push('Contenu page absent');

    return decimalClamp(score);
  }

  private scoreTrustEvidence(
    row: FeatureRow,
    pageType: ScoringPageType,
    reasons: string[],
  ): number {
    // The RPC's pipeline_* fields come from __rag_content_refresh_log, selected
    // by gamme, without a page role or content revision. They are not evidence
    // for this page. Neither a canonical URL nor an empty gate array is a source.
    if (pageType === 'R3_guide' && row.guide_source_verified === true) {
      return 40; // Guide metadata only; no claim-level verification is available.
    }
    reasons.push('Provenance verifiee pour cette page non disponible');
    return 0;
  }

  private scoreFreshness(
    row: FeatureRow,
    pageType: ScoringPageType,
    reasons: string[],
  ): number {
    const thresholds = FRESHNESS_THRESHOLDS[pageType];
    const now = Date.now();

    // Pick the most relevant date for this page type
    let dateStr: string | null = null;
    switch (pageType) {
      case 'R3_guide':
        dateStr = row.guide_updated_at;
        break;
      case 'R4_reference':
        dateStr = row.ref_updated_at;
        break;
      case 'R3_conseils':
        dateStr = null;
        break;
      case 'R1_pieces':
        dateStr = null;
        break;
    }

    if (!dateStr) {
      reasons.push('Date de mise a jour inconnue');
      return 0; // No credit for missing page-specific evidence.
    }

    const timestamp = new Date(dateStr).getTime();
    if (!Number.isFinite(timestamp) || timestamp > now) {
      reasons.push('Date de mise a jour invalide ou future');
      return 0;
    }
    const daysSince = Math.floor((now - timestamp) / 86400000);

    if (daysSince <= thresholds.good) return 100;
    if (daysSince <= thresholds.acceptable) {
      // Linear interpolation: 100 → 70 over [good, acceptable]
      const ratio =
        (daysSince - thresholds.good) /
        (thresholds.acceptable - thresholds.good);
      return decimalClamp(100 - ratio * 30);
    }
    if (daysSince <= thresholds.stale) {
      reasons.push(`Contenu ancien (${daysSince} jours)`);
      // Linear interpolation: 70 → 40 over [acceptable, stale]
      const ratio =
        (daysSince - thresholds.acceptable) /
        (thresholds.stale - thresholds.acceptable);
      return decimalClamp(70 - ratio * 30);
    }
    reasons.push(`Contenu obsolete (${daysSince} jours)`);
    return 15;
  }

  // ── Hard Gate Evaluators ──

  private evaluateHardGate(check: string, row: FeatureRow): boolean {
    switch (check) {
      case 'checkGuideNotDraft':
        return row.guide_is_draft === false;
      case 'checkGuideHasContent':
        return (
          row.guide_how_to_choose_length > 0 ||
          row.guide_faq_count > 0 ||
          row.guide_selection_criteria_length > 0
        );
      case 'checkRefHasDefinition':
        return row.ref_definition_length > 50;
      case 'checkConseilHasSections':
        return row.conseil_total_sections > 0;
      default:
        throw new Error(`Unsupported hard gate: ${check}`);
    }
  }

  // ── Penalty Evaluators ──

  private evaluatePenalty(check: string, row: FeatureRow): boolean {
    switch (check) {
      case 'checkGuideNoHowToChoose':
        return row.guide_how_to_choose_length < 200;
      case 'checkGuideFewFaq':
        return row.guide_faq_count < 3;
      case 'checkGuideNoSource':
        return !row.guide_source_verified;
      case 'checkRefNoSchema':
        return !row.ref_has_schema_json;
      case 'checkRefNoConfusions':
        return row.ref_confusions_count === 0;
      case 'checkRefShortDefinition':
        return row.ref_definition_length > 0 && row.ref_definition_length < 200;
      case 'checkConseilMissingCore':
        return !row.conseil_has_s1 || !row.conseil_has_s2;
      case 'checkConseilThinContent':
        return row.conseil_total_content_length < 2500;
      case 'checkConseilFewRich':
        return row.conseil_rich_sections < 3;
      case 'checkR1NoImage':
        return !row.has_pg_img;
      case 'checkR1NoHero':
        return !row.has_pg_pic;
      // ── Penalties sémantiques R3_guide (D1/D2/D3 + GENERIC_WITHOUT_ACTION,
      //    portage buying-guide-quality-gates — salvage pré-purge RAG 2026-06-11).
      //    Dégradation propre : si la RPC en DB ne renvoie pas encore ces
      //    features (migration non appliquée), `== null` couvre undefined ET
      //    null → skip sans erreur ni distorsion de score. ──
      case 'checkGuideGuidanceCopiesLabel': {
        // Legacy D1 : copies > criteria.length / 2
        const total = row.guide_criteria_count;
        const copies = row.guide_guidance_copies_label_count;
        if (total == null || copies == null) return false;
        return total > 0 && copies > total / 2;
      }
      case 'checkGuideAntiMistakesNotErrors': {
        // Legacy D2 : positiveItems > antiMistakes.length / 2
        const positive = row.guide_positive_starter_count;
        const total = row.guide_anti_mistakes_count;
        if (positive == null || total == null) return false;
        return total > 0 && positive > total / 2;
      }
      case 'checkGuideUseCasesNotProfiles': {
        // Legacy D3 : use_cases >= 2 ET aucun marqueur de profil conducteur
        const useCases = row.guide_use_cases_count;
        const profiles = row.guide_profile_marker_count;
        if (useCases == null || profiles == null) return false;
        return useCases >= 2 && profiles === 0;
      }
      case 'checkGuideGenericWithoutAction': {
        // Legacy GENERIC_WITHOUT_ACTION : phrase générique présente ET aucun verbe d'action
        const generic = row.guide_generic_phrase_count;
        const action = row.guide_action_marker_count;
        if (generic == null || action == null) return false;
        return generic > 0 && action === 0;
      }
      default:
        throw new Error(`Unsupported penalty: ${check}`);
    }
  }

  // ── Confidence Score ──

  private computeConfidence(
    row: FeatureRow,
    _pageType: ScoringPageType,
  ): number {
    let score = 0;

    for (const signal of CONFIDENCE_SIGNALS) {
      switch (signal.id) {
        case 'source_verified':
          if (_pageType === 'R3_guide' && row.guide_source_verified === true)
            score += signal.weight;
          break;
        case 'pipeline_recent':
          // Reserved weight, deliberately not redistributed: the legacy RAG
          // timestamp cannot attest the freshness of this page's evidence.
          break;
        // v2.2: cases 'rag_available' + 'truth_level_high' RETIRÉES (RAG = chatbot only).
        case 'data_completeness': {
          const featuresPct = this.countPresentFeatures(row, _pageType);
          score += (featuresPct / 100) * signal.weight;
          break;
        }
      }
    }

    return decimalClamp(score);
  }

  // ── Helpers ──

  private countPresentFeatures(
    row: FeatureRow,
    pageType: ScoringPageType,
  ): number {
    // Returns % of features that are non-default for this page type
    let present = 0;
    let total = 0;

    const check = (val: unknown, defaultVal: unknown) => {
      total++;
      if (val !== defaultVal && val !== null && val !== undefined) present++;
    };

    const pageSeo = this.pageSeoFeatures(row, pageType);
    if (pageSeo) {
      check(pageSeo.title_length, 0);
      check(pageSeo.description_length, 0);
      if (pageSeo.h1_length !== null) check(pageSeo.h1_length, 0);
    }

    switch (pageType) {
      case 'R3_guide':
        check(row.guide_how_to_choose_length, 0);
        check(row.guide_selection_criteria_length, 0);
        check(row.guide_anti_mistakes_count, 0);
        check(row.guide_faq_count, 0);
        check(row.guide_symptoms_count, 0);
        check(row.guide_source_verified, false);
        break;
      case 'R4_reference':
        check(row.ref_definition_length, 0);
        check(row.ref_role_mecanique_length, 0);
        check(row.ref_content_html_length, 0);
        check(row.ref_has_schema_json, false);
        check(row.ref_confusions_count, 0);
        break;
      case 'R3_conseils':
        check(row.conseil_total_sections, 0);
        check(row.conseil_rich_sections, 0);
        check(row.conseil_total_content_length, 0);
        break;
      case 'R1_pieces':
        check(row.has_pg_img, false);
        check(row.has_pg_pic, false);
        break;
    }

    return total > 0 ? Math.round((present / total) * 100) : 0;
  }

  private derivePriority(score: number, gateStatus: string): Priority {
    if (gateStatus === 'BLOCKED') return 'CRITICAL';
    for (const t of PRIORITY_THRESHOLDS) {
      if (score >= t.min) return t.priority;
    }
    return 'CRITICAL';
  }

  private deriveActions(
    row: FeatureRow,
    pageType: ScoringPageType,
    _reasons: string[],
  ): string[] {
    const actions: string[] = [
      'Relier les affirmations aux sources et verifier la version rendue, le role et les doublons avant validation editoriale',
    ];

    // Priority actions based on page type and issues
    if (pageType === 'R3_guide') {
      if (row.guide_how_to_choose_length < 200)
        actions.push(
          'Expliquer les criteres de choix utiles et leurs limites avec des faits sources',
        );
      if (!row.guide_source_verified)
        actions.push('Verifier et documenter la source');
      if (row.guide_faq_count < 3)
        actions.push(
          'Verifier les questions de choix restant sans reponse ; ajouter seulement des reponses utiles et sourcees',
        );
      if (row.guide_anti_mistakes_count < 3)
        actions.push(
          'Documenter les erreurs de choix pertinentes et leur consequence verifiable',
        );
    }

    if (pageType === 'R4_reference') {
      if (row.ref_definition_length < 200)
        actions.push(
          'Clarifier la definition, le role et les limites a partir de sources identifiees',
        );
      if (!row.ref_has_schema_json)
        actions.push(
          'Verifier le balisage applicable et sa concordance avec le contenu visible',
        );
      if (row.ref_confusions_count === 0)
        actions.push('Documenter les confusions courantes');
    }

    if (pageType === 'R3_conseils') {
      if (!row.conseil_has_s1) actions.push('Creer section S1 (introduction)');
      if (!row.conseil_has_s2)
        actions.push(
          'Expliquer quand cette intervention est indiquee et renvoyer au diagnostic R5 si necessaire',
        );
      if (row.conseil_rich_sections < 3)
        actions.push(
          'Verifier outils, etapes, precautions et controle final ; completer les faits manquants',
        );
    }

    const pageSeo = this.pageSeoFeatures(row, pageType);
    if (!pageSeo) {
      actions.push(
        'Examiner le titre, la description et le H1 de la page rendue',
      );
    } else {
      if (pageSeo.title_length === 0)
        actions.push('Ajouter un titre SEO pertinent pour cette page');
      if (pageSeo.description_length === 0)
        actions.push('Decrire precisement la reponse apportee par cette page');
      if (pageSeo.content_length === 0)
        actions.push(
          'Verifier le contenu visible et les questions sans reponse avant collecte RAW→WIKI',
        );
    }

    return actions;
  }

  private extractFeatureSnapshot(
    row: FeatureRow,
    pageType: ScoringPageType,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      entity: {
        pg_id: row.pg_id,
        pg_alias: row.pg_alias,
        role_id: scoringPageTypeToRoleId(pageType),
      },
      page_seo_features: this.pageSeoFeatures(row, pageType),
      evaluation_scope: 'page_structure_proxy',
      publication_assessment: 'NOT_EVALUATED',
      evidence_gaps: [
        'rendered_page_revision',
        'claim_source_links',
        'role_contract_validation',
        'duplicate_content_validation',
      ],
      legacy_pipeline_evidence_used: false,
    };

    switch (pageType) {
      case 'R3_guide':
        return {
          ...base,
          how_to_choose_length: row.guide_how_to_choose_length,
          faq_count: row.guide_faq_count,
          symptoms_count: row.guide_symptoms_count,
          anti_mistakes_count: row.guide_anti_mistakes_count,
          source_verified: row.guide_source_verified,
          arg_count: row.guide_arg_count,
          // Sémantique D1/D2/D3 + GWA (null tant que la migration
          // 20260611_quality_features_r3_guide_semantics n'est pas appliquée)
          criteria_count: row.guide_criteria_count ?? null,
          guidance_copies_label_count:
            row.guide_guidance_copies_label_count ?? null,
          positive_starter_count: row.guide_positive_starter_count ?? null,
          use_cases_count: row.guide_use_cases_count ?? null,
          profile_marker_count: row.guide_profile_marker_count ?? null,
          generic_phrase_count: row.guide_generic_phrase_count ?? null,
          action_marker_count: row.guide_action_marker_count ?? null,
        };
      case 'R4_reference':
        return {
          ...base,
          definition_length: row.ref_definition_length,
          content_html_length: row.ref_content_html_length,
          has_schema_json: row.ref_has_schema_json,
          confusions_count: row.ref_confusions_count,
          regles_metier_count: row.ref_regles_metier_count,
        };
      case 'R3_conseils':
        return {
          ...base,
          total_sections: row.conseil_total_sections,
          rich_sections: row.conseil_rich_sections,
          total_content_length: row.conseil_total_content_length,
        };
      case 'R1_pieces':
        return {
          ...base,
          has_pg_img: row.has_pg_img,
          has_pg_pic: row.has_pg_pic,
          has_pg_wall: row.has_pg_wall,
          has_blog_advice: row.has_blog_advice,
        };
      default:
        return base;
    }
  }

  // ── Persistence ──

  private async upsertPageScore(
    pgId: number,
    pageType: ScoringPageType,
    result: PageScoreResult,
  ): Promise<void> {
    const { error } = await this.client.from('__quality_page_scores').upsert(
      {
        pg_id: pgId,
        page_type: pageType,
        features: result.features,
        quality_score: result.quality_score,
        confidence_score: result.confidence_score,
        subscores: result.subscores,
        penalties: result.penalties,
        hard_gate_status: result.hard_gate_status,
        status: result.status,
        priority: result.priority,
        reasons: result.reasons,
        next_actions: result.next_actions,
        score_version: SCORING_VERSION,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'pg_id,page_type' },
    );

    if (error) {
      this.logger.error(
        `Upsert page score failed pg_id=${pgId} ${pageType}: ${error.message}`,
      );
    }
  }
}
