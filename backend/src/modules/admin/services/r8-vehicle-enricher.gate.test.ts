/**
 * Tests — R8 vehicle enricher: decision order and hard-gate precedence.
 *
 * Contract (config/r8-keyword-plan.constants.ts): the hard gates are a
 * "binary pass/fail before composite score". The gate used to return INDEX
 * whenever `diversityScore >= index_min`, demoting any hard-gate reason to a
 * `gate warning:` string: a high aggregate neutralised a blocking violation
 * and wrote `sitemap_included=true` / `robots_directive='index, follow'`.
 *
 * Order under test: metrics → meta-collision penalty → aggregate recomputed
 * → decision → persisted value. The penalty used to lower
 * `semanticSimilarityScore` after the aggregate had been computed, so the
 * decision and `__seo_r8_pages.diversity_score` read a pre-penalty score.
 *
 * The service is built with Object.create (bypasses the SupabaseBaseService
 * ctor, which needs env), as in r8-vehicle-enricher.tech-specs.test.ts.
 */

import {
  R8_DIVERSITY_FORMULA_WEIGHTS,
  R8_DIVERSITY_THRESHOLDS,
  R8_HARD_GATES,
  R8_SITEMAP_RULES,
} from '../../../config/r8-keyword-plan.constants';
import { R8VehicleEnricherService } from './r8-vehicle-enricher.service';

type Block = {
  id: string;
  type: string;
  title: string;
  renderedText: string;
  specificityWeight: number;
  boilerplateRisk: number;
  semanticPayload: string[];
};

type Metrics = {
  specificContentRatio: number;
  boilerplateRatio: number;
  diversityScore: number;
  blockSpecificityScore: number;
  semanticSimilarityScore: number;
  categoryOrderDiversityScore: number;
  faqReuseRiskScore: number;
  catalogDeltaScore: number;
  commercialIntentScore: number;
};

type Verdict = {
  decision: 'INDEX' | 'REVIEW_REQUIRED' | 'REGENERATE' | 'REJECT';
  reasons: string[];
  warnings: string[];
};

type EnricherInternals = {
  logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  computeMetrics: (
    blocks: Block[],
    neighbors: unknown[],
    families: unknown[],
  ) => Metrics;
  scoreDiversity: (metrics: Metrics) => number;
  gate: (metrics: Metrics, blocks: Block[]) => Verdict;
  scoreAndGate: (
    blocks: Block[],
    neighbors: unknown[],
    families: unknown[],
    variantSignature: {
      meta_title: string | null;
      meta_description: string | null;
    },
  ) => Verdict & { metrics: Metrics };
};

function makeEnricher(): EnricherInternals {
  const svc = Object.create(
    R8VehicleEnricherService.prototype,
  ) as EnricherInternals;
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return svc;
}

const block = (id: string, type: string): Block => ({
  id,
  type,
  title: id,
  renderedText: '',
  specificityWeight: 0.8,
  boilerplateRisk: 0.1,
  semanticPayload: [],
});

/** Every block type the gate checks for: no MISSING_* reason. */
const COMPLETE_BLOCKS: Block[] = [
  block('S_IDENTITY', 'vehicle_identity'),
  block('S_VARIANT_DIFFERENCE', 'variant_difference'),
  block('S_SELECTION_GUIDE', 'selection_help'),
  block('S_COMPAT_SCOPE', 'compatibility_scope'),
  block('S_CATALOG_ACCESS', 'dynamic_category_ranking'),
];

/** Every hard gate passes with margin. */
const PASSING: Metrics = {
  specificContentRatio: 0.8,
  boilerplateRatio: 0.1,
  diversityScore: 90,
  blockSpecificityScore: 80,
  semanticSimilarityScore: 90,
  categoryOrderDiversityScore: 70,
  faqReuseRiskScore: 0,
  catalogDeltaScore: 60,
  commercialIntentScore: 85,
};

const HARD_GATE_VIOLATIONS: Array<[string, Partial<Metrics>]> = [
  [
    'LOW_SPECIFIC_CONTENT',
    { specificContentRatio: R8_HARD_GATES.min_specific_content_ratio - 0.01 },
  ],
  [
    'HIGH_BOILERPLATE',
    { boilerplateRatio: R8_HARD_GATES.max_boilerplate_ratio + 0.01 },
  ],
  [
    'HIGH_FAQ_REUSE',
    { faqReuseRiskScore: R8_HARD_GATES.max_faq_reuse_risk + 1 },
  ],
  [
    'LOW_SEMANTIC_DIVERSITY',
    { semanticSimilarityScore: R8_HARD_GATES.min_semantic_diversity - 1 },
  ],
  [
    'LOW_COMMERCIAL_INTENT',
    { commercialIntentScore: R8_HARD_GATES.min_commercial_intent - 1 },
  ],
];

const NOINDEX = { sitemap: false, robots: 'noindex, nofollow' };

describe('R8VehicleEnricherService.gate — hard gates precede the aggregate', () => {
  it.each(HARD_GATE_VIOLATIONS)(
    '%s with an aggregate of 95 → REVIEW_REQUIRED, noindex, reason kept',
    (reason, violation) => {
      const verdict = makeEnricher().gate(
        { ...PASSING, ...violation, diversityScore: 95 },
        COMPLETE_BLOCKS,
      );
      expect(verdict.decision).toBe('REVIEW_REQUIRED');
      expect(verdict.reasons).toEqual([reason]);
      expect(verdict.warnings).not.toContain(`gate warning: ${reason}`);
      expect(R8_SITEMAP_RULES[verdict.decision]).toEqual(NOINDEX);
    },
  );

  it('control: every hard gate passed, aggregate ≥ clean → INDEX without warning', () => {
    const verdict = makeEnricher().gate(PASSING, COMPLETE_BLOCKS);
    expect(verdict).toEqual({ decision: 'INDEX', reasons: [], warnings: [] });
    expect(R8_SITEMAP_RULES.INDEX).toEqual({
      sitemap: true,
      robots: 'index, follow',
    });
  });

  it('a single missing block is a non-blocking warning: INDEX is kept', () => {
    const blocks = COMPLETE_BLOCKS.filter(
      (b) => b.type !== 'compatibility_scope',
    );
    const verdict = makeEnricher().gate(PASSING, blocks);
    expect(verdict.decision).toBe('INDEX');
    expect(verdict.reasons).toEqual(['MISSING_COMPAT_BLOCK']);
    expect(verdict.warnings).toEqual(['gate warning: MISSING_COMPAT_BLOCK']);
  });

  it('aggregate between index_min and clean_threshold: INDEX with the clean warning, also next to a missing block', () => {
    const svc = makeEnricher();
    const score = R8_DIVERSITY_THRESHOLDS.index_min + 5;
    expect(
      svc.gate({ ...PASSING, diversityScore: score }, COMPLETE_BLOCKS),
    ).toEqual({
      decision: 'INDEX',
      reasons: [],
      warnings: [
        `diversityScore ${score.toFixed(1)} < clean_threshold ${R8_DIVERSITY_THRESHOLDS.clean_threshold}`,
      ],
    });
    const verdict = svc.gate(
      { ...PASSING, diversityScore: score },
      COMPLETE_BLOCKS.filter((b) => b.type !== 'compatibility_scope'),
    );
    expect(verdict.decision).toBe('INDEX');
    expect(verdict.warnings).toEqual([
      'gate warning: MISSING_COMPAT_BLOCK',
      `diversityScore ${score.toFixed(1)} < clean_threshold ${R8_DIVERSITY_THRESHOLDS.clean_threshold}`,
    ]);
  });

  it('aggregate just under index_min, no reason → REVIEW_REQUIRED', () => {
    const verdict = makeEnricher().gate(
      {
        ...PASSING,
        diversityScore: R8_DIVERSITY_THRESHOLDS.index_min - 0.01,
      },
      COMPLETE_BLOCKS,
    );
    expect(verdict.decision).toBe('REVIEW_REQUIRED');
    expect(verdict.reasons).toEqual([]);
  });

  it('structural errors keep priority: < 4 blocks → REJECT even with a hard-gate failure', () => {
    const verdict = makeEnricher().gate(
      { ...PASSING, boilerplateRatio: 0.9 },
      COMPLETE_BLOCKS.slice(0, 3),
    );
    expect(verdict).toEqual({
      decision: 'REJECT',
      reasons: ['CONTENT_BROKEN'],
      warnings: ['too few blocks'],
    });
  });

  it('≥ 2 missing blocks → REGENERATE even with a hard-gate failure and a high aggregate', () => {
    const blocks = [
      block('S_IDENTITY', 'vehicle_identity'),
      block('S_VARIANT_DIFFERENCE', 'variant_difference'),
      block('S_SELECTION_GUIDE', 'selection_help'),
      block('S_TRUST', 'trust_and_support'),
    ];
    const verdict = makeEnricher().gate(
      { ...PASSING, commercialIntentScore: 0 },
      blocks,
    );
    expect(verdict.decision).toBe('REGENERATE');
    expect(verdict.reasons).toEqual([
      'LOW_COMMERCIAL_INTENT',
      'MISSING_COMPAT_BLOCK',
      'MISSING_CATALOG_DYNAMIC_BLOCK',
    ]);
    expect(R8_SITEMAP_RULES[verdict.decision]).toEqual(NOINDEX);
  });
});

describe('R8VehicleEnricherService.scoreDiversity — single formula', () => {
  it('matches the weighted formula of R8_DIVERSITY_FORMULA_WEIGHTS', () => {
    const w = R8_DIVERSITY_FORMULA_WEIGHTS;
    const m = PASSING;
    const expected =
      m.specificContentRatio * 100 * w.specificContentRatioScore +
      m.blockSpecificityScore * w.blockSpecificityScore +
      m.semanticSimilarityScore * w.semanticSimilarityScore +
      m.categoryOrderDiversityScore * w.categoryOrderDiversityScore +
      m.catalogDeltaScore * w.catalogDeltaScore +
      m.commercialIntentScore * w.commercialIntentScore +
      (100 - m.faqReuseRiskScore) * w.faqReuseRiskInverted +
      m.boilerplateRatio * 100 * w.boilerplatePenalty;
    expect(makeEnricher().scoreDiversity(m)).toBeCloseTo(expected, 10);
  });

  it('computeMetrics returns the same aggregate as scoreDiversity on its own metrics', () => {
    const svc = makeEnricher();
    const metrics = svc.computeMetrics(COMPLETE_BLOCKS, [], []);
    expect(metrics.blockSpecificityScore).toBeCloseTo(80, 10);
    expect(metrics.diversityScore).toBe(svc.scoreDiversity(metrics));
  });
});

describe('R8VehicleEnricherService.scoreAndGate — metrics → penalty → aggregate → decision', () => {
  /**
   * Aggregate 70.5 before the penalty, 68.5 after two meta collisions
   * (semantic 75 → 65, still ≥ min_semantic_diversity): the penalty alone
   * crosses index_min without emitting a hard-gate reason.
   */
  const NEAR_THRESHOLD: Metrics = {
    specificContentRatio: 0.8,
    boilerplateRatio: 0.2,
    diversityScore: 0,
    blockSpecificityScore: 80,
    semanticSimilarityScore: 75,
    categoryOrderDiversityScore: 70,
    faqReuseRiskScore: 0,
    catalogDeltaScore: 50,
    commercialIntentScore: 70,
  };
  const SIGNATURE = {
    meta_title: 'tpl-title-1',
    meta_description: 'tpl-desc-1',
  };
  const colliding = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `n${i}`,
      page_key: `r8_vehicle_${1000 + i}`,
      content_main: '',
      faq_signature: '',
      category_signature: '',
      diversity_score: 0,
      variant_signature: { ...SIGNATURE },
    }));

  function withMetrics(metrics: Metrics): EnricherInternals {
    const svc = makeEnricher();
    const seeded = { ...metrics };
    seeded.diversityScore = svc.scoreDiversity(seeded);
    svc.computeMetrics = jest.fn().mockReturnValue(seeded);
    return svc;
  }

  it('fixture sanity: 70.5 before the penalty', () => {
    expect(makeEnricher().scoreDiversity(NEAR_THRESHOLD)).toBeCloseTo(70.5, 10);
  });

  it('a penalty that crosses index_min changes INDEX into REVIEW_REQUIRED', () => {
    const svc = withMetrics(NEAR_THRESHOLD);
    const control = svc.scoreAndGate(
      COMPLETE_BLOCKS,
      colliding(1),
      [],
      SIGNATURE,
    );
    expect(control.decision).toBe('INDEX');
    expect(control.metrics.diversityScore).toBeCloseTo(70.5, 10);

    const res = withMetrics(NEAR_THRESHOLD).scoreAndGate(
      COMPLETE_BLOCKS,
      colliding(2),
      [],
      SIGNATURE,
    );
    expect(res.metrics.semanticSimilarityScore).toBe(65);
    expect(res.metrics.diversityScore).toBeCloseTo(68.5, 10);
    expect(res.decision).toBe('REVIEW_REQUIRED');
    expect(res.reasons).toEqual([]);
    expect(res.warnings).toEqual([
      'META_TITLE_COLLISION_IN_FAMILY count=2',
      'META_DESCRIPTION_COLLISION_IN_FAMILY count=2',
    ]);
  });

  it('a meta-collision warning alone does not forbid INDEX', () => {
    const res = withMetrics(PASSING).scoreAndGate(
      COMPLETE_BLOCKS,
      colliding(2),
      [],
      { meta_title: SIGNATURE.meta_title, meta_description: null },
    );
    expect(res.decision).toBe('INDEX');
    expect(res.reasons).toEqual([]);
    expect(res.warnings).toContain('META_TITLE_COLLISION_IN_FAMILY count=2');
  });

  it('returned aggregate = formula on the post-penalty metrics (the value the gate read)', () => {
    const svc = withMetrics(NEAR_THRESHOLD);
    const res = svc.scoreAndGate(COMPLETE_BLOCKS, colliding(3), [], SIGNATURE);
    expect(res.metrics.diversityScore).toBe(svc.scoreDiversity(res.metrics));
  });
});
