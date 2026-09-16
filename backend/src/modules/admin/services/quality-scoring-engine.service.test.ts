import {
  QualityScoringEngineService,
  FeatureRow,
} from './quality-scoring-engine.service';
import { SCORING_PROFILES } from '../../../config/scoring-profiles.config';

// No constructor, database client, network or persistence in these unit tests.
jest.mock('@database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {},
}));

function row(overrides: Partial<FeatureRow> = {}): FeatureRow {
  return {
    pg_id: 1,
    pg_alias: 'filtre-a-huile',
    pg_name: 'Filtre a huile',
    guide_exists: true,
    guide_how_to_choose_length: 5000,
    guide_selection_criteria_length: 5000,
    guide_anti_mistakes_count: 10,
    guide_decision_tree_length: 5000,
    guide_faq_count: 10,
    guide_symptoms_count: 10,
    guide_source_verified: true,
    guide_is_draft: false,
    guide_intro_role_length: 5000,
    guide_risk_explanation_length: 5000,
    guide_arg_count: 10,
    guide_updated_at: '2026-09-12T12:00:00Z',
    seo_exists: true,
    seo_title_length: 55,
    seo_desc_length: 150,
    seo_h1_length: 40,
    seo_content_length: 10000,
    ref_exists: true,
    ref_definition_length: 5000,
    ref_role_mecanique_length: 5000,
    ref_composition_count: 10,
    ref_confusions_count: 10,
    ref_symptomes_count: 10,
    ref_content_html_length: 10000,
    ref_has_schema_json: true,
    ref_has_canonical: true,
    ref_related_refs_count: 10,
    ref_blog_slugs_count: 10,
    ref_regles_metier_count: 10,
    ref_title_length: 55,
    ref_meta_desc_length: 150,
    ref_updated_at: '2026-09-12T12:00:00Z',
    conseil_exists: true,
    conseil_total_sections: 10,
    conseil_rich_sections: 10,
    conseil_has_s1: true,
    conseil_has_s2: true,
    conseil_has_s3: true,
    conseil_has_s4_depose: true,
    conseil_has_s4_repose: true,
    conseil_has_s5: true,
    conseil_has_s6: true,
    conseil_has_s7: true,
    conseil_has_s8: true,
    conseil_total_content_length: 10000,
    rag_content_length: 0,
    rag_truth_level: null,
    pipeline_quality_score: 0,
    pipeline_hard_gate_results: null,
    pipeline_completed_at: null,
    has_pg_img: true,
    has_pg_pic: true,
    has_pg_wall: true,
    has_blog_advice: true,
    blog_advice_content_length: 10000,
    ...overrides,
  };
}

describe('quality scoring: evidence belongs to a page, not a gamme', () => {
  let engine: QualityScoringEngineService;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-13T12:00:00Z'));
    engine = Object.create(QualityScoringEngineService.prototype);
  });
  afterEach(() => jest.useRealTimers());

  it.each(['R1_pieces', 'R3_conseils', 'R4_reference'] as const)(
    '%s cannot borrow guide source verification',
    (pageType) => {
      const score = (verified: boolean) =>
        engine['scoreScoringPageType'](
          row({ guide_source_verified: verified }),
          SCORING_PROFILES[pageType],
        );
      expect(score(true)).toEqual(score(false));
      expect(score(true).subscores.trust_evidence).toBe(0);
    },
  );

  it.each([null, [], [{}], [{ verdict: 'PASS' }], [{ verdict: 'FAIL' }]])(
    'legacy pipeline gates %j cannot improve any implemented page score',
    (gates) => {
      for (const pageType of [
        'R1_pieces',
        'R3_guide',
        'R3_conseils',
        'R4_reference',
      ] as const) {
        const base = engine['scoreScoringPageType'](
          row(),
          SCORING_PROFILES[pageType],
        );
        const legacy = engine['scoreScoringPageType'](
          row({
            rag_content_length: 999999,
            rag_truth_level: 'high',
            pipeline_quality_score: 100,
            pipeline_hard_gate_results: gates,
            pipeline_completed_at: '2026-09-13T12:00:00Z',
          }),
          SCORING_PROFILES[pageType],
        );
        expect(legacy).toEqual(base);
      }
    },
  );

  it('a full, recent guide remains REVIEW without page-level proof', () => {
    const result = engine['scoreScoringPageType'](row(), {
      ...SCORING_PROFILES.R3_guide,
      dimensions: [{ name: 'content_depth', weight: 100 }],
    });
    expect(result.quality_score).toBeGreaterThanOrEqual(80);
    expect(result.confidence_score).toBeGreaterThanOrEqual(60);
    expect(result.status).toBe('REVIEW');
    expect(result.features.publication_assessment).toBe('NOT_EVALUATED');
    expect(result.features.evidence_gaps).toContain('claim_source_links');
  });

  it('an actual blocking gate prevails over populated content', () => {
    expect(
      engine['scoreScoringPageType'](
        row({ guide_is_draft: true }),
        SCORING_PROFILES.R3_guide,
      ).status,
    ).toBe('BLOCKED');
  });

  it.each([null, 'invalid', '2027-01-01T00:00:00Z'])(
    'missing or invalid page date %j earns no freshness credit',
    (date) => {
      expect(
        engine['scoreFreshness'](
          row({ guide_updated_at: date }),
          'R3_guide',
          [],
        ),
      ).toBe(0);
    },
  );

  it('a guide update cannot refresh R3 or R1', () => {
    expect(engine['scoreFreshness'](row(), 'R3_conseils', [])).toBe(0);
    expect(engine['scoreFreshness'](row(), 'R1_pieces', [])).toBe(0);
  });

  it('a reference canonical is not a trust signal for a guide', () => {
    expect(
      engine['scoreScoringPageType'](
        row({ ref_has_canonical: false }),
        SCORING_PROFILES.R3_guide,
      ),
    ).toEqual(engine['scoreScoringPageType'](row(), SCORING_PROFILES.R3_guide));
  });

  it.each(['R3_guide', 'R3_conseils', 'R4_reference'] as const)(
    '%s cannot borrow R1 SEO metadata or content',
    (pageType) => {
      expect(
        engine['scoreScoringPageType'](
          row({
            seo_title_length: 0,
            seo_desc_length: 0,
            seo_h1_length: 0,
            seo_content_length: 0,
          }),
          SCORING_PROFILES[pageType],
        ),
      ).toEqual(
        engine['scoreScoringPageType'](row(), SCORING_PROFILES[pageType]),
      );
    },
  );

  it('a reference completeness uses its own title and description', () => {
    const base = engine['computeConfidence'](row(), 'R4_reference');
    expect(
      engine['computeConfidence'](
        row({ seo_title_length: 0, seo_desc_length: 0, seo_h1_length: 0 }),
        'R4_reference',
      ),
    ).toBe(base);
    expect(
      engine['computeConfidence'](
        row({ ref_title_length: 0, ref_meta_desc_length: 0 }),
        'R4_reference',
      ),
    ).toBeLessThan(base);
  });

  it('unknown gates and penalties cannot silently pass', () => {
    expect(() => engine['evaluateHardGate']('typo', row())).toThrow(
      'Unsupported hard gate',
    );
    expect(() => engine['evaluatePenalty']('typo', row())).toThrow(
      'Unsupported penalty',
    );
  });

  it.each(['R2_product', 'R5_diagnostic', 'R7_brand', 'R8_vehicle'] as const)(
    '%s is explicitly unimplemented, not a evaluated zero',
    (pageType) => {
      expect(() =>
        engine['scoreScoringPageType'](row(), SCORING_PROFILES[pageType]),
      ).toThrow('Unimplemented scoring profile');
    },
  );

  it('actions never prescribe filler quotas', () => {
    for (const pageType of [
      'R3_guide',
      'R3_conseils',
      'R4_reference',
    ] as const) {
      const actions = engine['deriveActions'](
        row({
          guide_how_to_choose_length: 0,
          guide_faq_count: 0,
          guide_anti_mistakes_count: 0,
          ref_definition_length: 0,
          conseil_rich_sections: 0,
        }),
        pageType,
        [],
      );
      expect(actions.join(' ')).not.toMatch(
        /min 3|>\d+ chars|\d+ chars chacune/,
      );
      expect(actions[0]).toContain('sources');
    }
  });
});
