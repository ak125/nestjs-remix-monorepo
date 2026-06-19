/**
 * Penalties sémantiques R3_guide (D1/D2/D3 + GENERIC_WITHOUT_ACTION)
 *
 * Portage des heuristiques du quality-gates legacy buying-guide
 * (buying-guide-quality-gates.service.ts, checkAntiWikiGate) vers le
 * QualityScoringEngineService v2.2 — salvage pré-purge RAG 2026-06-11.
 *
 * Invariant critique testé : DÉGRADATION PROPRE. Si la RPC
 * get_page_quality_features en DB ne renvoie pas encore les champs
 * sémantiques (migration 20260611_quality_features_r3_guide_semantics
 * non appliquée), les penalties sont skippées sans erreur ni distorsion
 * de score. Le code doit marcher avec l'ancienne ET la nouvelle RPC.
 *
 * @see backend/src/modules/admin/services/quality-scoring-engine.service.ts
 * @see backend/src/config/scoring-profiles.config.ts
 * @see backend/supabase/migrations/20260611_quality_features_r3_guide_semantics.sql
 */
import {
  QualityScoringEngineService,
  type FeatureRow,
} from '../../src/modules/admin/services/quality-scoring-engine.service';
import { SCORING_PROFILES } from '../../src/config/scoring-profiles.config';

// evaluatePenalty est une méthode privée PURE (switch sans `this`) — on
// l'invoque via le prototype sans instancier le service (pas de Supabase).
type EvaluatePenaltyFn = (check: string, row: FeatureRow) => boolean;
const evaluatePenalty: EvaluatePenaltyFn = (
  QualityScoringEngineService.prototype as unknown as {
    evaluatePenalty: EvaluatePenaltyFn;
  }
).evaluatePenalty;

/** FeatureRow complet tel que renvoyé par l'ANCIENNE RPC (sans champs sémantiques). */
function legacyRpcRow(overrides: Partial<FeatureRow> = {}): FeatureRow {
  return {
    pg_id: 1,
    pg_alias: 'plaquette-de-frein',
    pg_name: 'Plaquette de frein',
    guide_exists: true,
    guide_how_to_choose_length: 500,
    guide_selection_criteria_length: 400,
    guide_anti_mistakes_count: 4,
    guide_decision_tree_length: 200,
    guide_faq_count: 5,
    guide_symptoms_count: 4,
    guide_source_verified: true,
    guide_is_draft: false,
    guide_intro_role_length: 120,
    guide_risk_explanation_length: 150,
    guide_arg_count: 4,
    guide_updated_at: '2026-06-01T00:00:00Z',
    seo_exists: true,
    seo_title_length: 50,
    seo_desc_length: 140,
    seo_h1_length: 30,
    seo_content_length: 1200,
    ref_exists: false,
    ref_definition_length: 0,
    ref_role_mecanique_length: 0,
    ref_composition_count: 0,
    ref_confusions_count: 0,
    ref_symptomes_count: 0,
    ref_content_html_length: 0,
    ref_has_schema_json: false,
    ref_has_canonical: false,
    ref_related_refs_count: 0,
    ref_blog_slugs_count: 0,
    ref_regles_metier_count: 0,
    ref_title_length: 0,
    ref_meta_desc_length: 0,
    ref_updated_at: null,
    conseil_exists: false,
    conseil_total_sections: 0,
    conseil_rich_sections: 0,
    conseil_has_s1: false,
    conseil_has_s2: false,
    conseil_has_s3: false,
    conseil_has_s4_depose: false,
    conseil_has_s4_repose: false,
    conseil_has_s5: false,
    conseil_has_s6: false,
    conseil_has_s7: false,
    conseil_has_s8: false,
    conseil_total_content_length: 0,
    rag_content_length: 0,
    rag_truth_level: null,
    pipeline_quality_score: 80,
    pipeline_hard_gate_results: null,
    pipeline_completed_at: '2026-06-01T00:00:00Z',
    has_pg_img: true,
    has_pg_pic: true,
    has_pg_wall: false,
    has_blog_advice: false,
    blog_advice_content_length: 0,
    // PAS de champs sémantiques — comme l'ancienne RPC
    ...overrides,
  };
}

const SEMANTIC_CHECKS = [
  'checkGuideGuidanceCopiesLabel',
  'checkGuideAntiMistakesNotErrors',
  'checkGuideUseCasesNotProfiles',
  'checkGuideGenericWithoutAction',
] as const;

describe('Penalties sémantiques R3_guide — dégradation propre (ancienne RPC)', () => {
  it('skip (false) quand les champs sémantiques sont ABSENTS (undefined)', () => {
    const row = legacyRpcRow();
    for (const check of SEMANTIC_CHECKS) {
      expect(evaluatePenalty(check, row)).toBe(false);
    }
  });

  it('skip (false) quand les champs sémantiques sont null', () => {
    const row = legacyRpcRow({
      guide_criteria_count: null,
      guide_guidance_copies_label_count: null,
      guide_positive_starter_count: null,
      guide_use_cases_count: null,
      guide_profile_marker_count: null,
      guide_generic_phrase_count: null,
      guide_action_marker_count: null,
    });
    for (const check of SEMANTIC_CHECKS) {
      expect(evaluatePenalty(check, row)).toBe(false);
    }
  });
});

describe('D1 — checkGuideGuidanceCopiesLabel (copies > criteria/2, seuil legacy)', () => {
  it('pénalise quand >50% des guidances copient le label (4/6)', () => {
    const row = legacyRpcRow({
      guide_criteria_count: 6,
      guide_guidance_copies_label_count: 4,
    });
    expect(evaluatePenalty('checkGuideGuidanceCopiesLabel', row)).toBe(true);
  });

  it('ne pénalise pas à exactement 50% (3/6 — legacy strictement >)', () => {
    const row = legacyRpcRow({
      guide_criteria_count: 6,
      guide_guidance_copies_label_count: 3,
    });
    expect(evaluatePenalty('checkGuideGuidanceCopiesLabel', row)).toBe(false);
  });

  it('ne pénalise pas quand il n y a aucun critère', () => {
    const row = legacyRpcRow({
      guide_criteria_count: 0,
      guide_guidance_copies_label_count: 0,
    });
    expect(evaluatePenalty('checkGuideGuidanceCopiesLabel', row)).toBe(false);
  });
});

describe('D2 — checkGuideAntiMistakesNotErrors (positifs > antiMistakes/2, seuil legacy)', () => {
  it('pénalise quand >50% des anti-erreurs sont des actions positives (3/4)', () => {
    const row = legacyRpcRow({
      guide_anti_mistakes_count: 4,
      guide_positive_starter_count: 3,
    });
    expect(evaluatePenalty('checkGuideAntiMistakesNotErrors', row)).toBe(true);
  });

  it('ne pénalise pas à exactement 50% (2/4)', () => {
    const row = legacyRpcRow({
      guide_anti_mistakes_count: 4,
      guide_positive_starter_count: 2,
    });
    expect(evaluatePenalty('checkGuideAntiMistakesNotErrors', row)).toBe(false);
  });

  it('skip quand positive_starter_count absent (ancienne RPC)', () => {
    const row = legacyRpcRow({ guide_anti_mistakes_count: 4 });
    expect(evaluatePenalty('checkGuideAntiMistakesNotErrors', row)).toBe(false);
  });
});

describe('D3 — checkGuideUseCasesNotProfiles (>=2 use_cases, 0 marqueur profil, seuil legacy)', () => {
  it('pénalise quand 3 use_cases sans aucun marqueur de profil conducteur', () => {
    const row = legacyRpcRow({
      guide_use_cases_count: 3,
      guide_profile_marker_count: 0,
    });
    expect(evaluatePenalty('checkGuideUseCasesNotProfiles', row)).toBe(true);
  });

  it('ne pénalise pas avec moins de 2 use_cases (legacy : check inactif)', () => {
    const row = legacyRpcRow({
      guide_use_cases_count: 1,
      guide_profile_marker_count: 0,
    });
    expect(evaluatePenalty('checkGuideUseCasesNotProfiles', row)).toBe(false);
  });

  it('ne pénalise pas dès qu un marqueur de profil est présent', () => {
    const row = legacyRpcRow({
      guide_use_cases_count: 3,
      guide_profile_marker_count: 1,
    });
    expect(evaluatePenalty('checkGuideUseCasesNotProfiles', row)).toBe(false);
  });
});

describe('GWA — checkGuideGenericWithoutAction (générique présent ET 0 verbe action, legacy)', () => {
  it('pénalise quand phrases génériques sans aucun verbe d action', () => {
    const row = legacyRpcRow({
      guide_generic_phrase_count: 2,
      guide_action_marker_count: 0,
    });
    expect(evaluatePenalty('checkGuideGenericWithoutAction', row)).toBe(true);
  });

  it('ne pénalise pas quand un verbe d action accompagne le générique', () => {
    const row = legacyRpcRow({
      guide_generic_phrase_count: 2,
      guide_action_marker_count: 1,
    });
    expect(evaluatePenalty('checkGuideGenericWithoutAction', row)).toBe(false);
  });

  it('ne pénalise pas sans phrase générique', () => {
    const row = legacyRpcRow({
      guide_generic_phrase_count: 0,
      guide_action_marker_count: 0,
    });
    expect(evaluatePenalty('checkGuideGenericWithoutAction', row)).toBe(false);
  });
});

describe('Profil R3_guide — câblage config des 4 penalties sémantiques', () => {
  it('expose les 4 rules avec leurs checks (et garde les 3 rules historiques)', () => {
    const penalties = SCORING_PROFILES.R3_guide.softPenalties;
    const byId = Object.fromEntries(penalties.map((p) => [p.id, p.check]));
    expect(byId['guide_guidance_copies_label']).toBe(
      'checkGuideGuidanceCopiesLabel',
    );
    expect(byId['guide_anti_mistakes_not_errors']).toBe(
      'checkGuideAntiMistakesNotErrors',
    );
    expect(byId['guide_use_cases_not_profiles']).toBe(
      'checkGuideUseCasesNotProfiles',
    );
    expect(byId['guide_generic_without_action']).toBe(
      'checkGuideGenericWithoutAction',
    );
    // Rétro-compat : les penalties historiques restent en place
    expect(byId['guide_no_how_to_choose']).toBe('checkGuideNoHowToChoose');
    expect(byId['guide_few_faq']).toBe('checkGuideFewFaq');
    expect(byId['guide_no_source']).toBe('checkGuideNoSource');
  });

  it('toutes les penalties sémantiques sont négatives (soft, jamais bonus)', () => {
    const semanticIds = [
      'guide_guidance_copies_label',
      'guide_anti_mistakes_not_errors',
      'guide_use_cases_not_profiles',
      'guide_generic_without_action',
    ];
    for (const p of SCORING_PROFILES.R3_guide.softPenalties) {
      if (semanticIds.includes(p.id)) {
        expect(p.points).toBeLessThan(0);
      }
    }
  });
});
