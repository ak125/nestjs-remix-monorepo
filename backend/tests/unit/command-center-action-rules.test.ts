import {
  finalizeAction,
  computeScore,
  sortActions,
  BUSINESS_CONFIDENCE_FLOOR,
  type RawAction,
} from '../../src/modules/admin/services/command-center-action-rules/score-action';
import { buildCertificationActions } from '../../src/modules/admin/services/command-center-action-rules/certification-action.rules';
import {
  buildSeoOpportunityActions,
  pageKindFromUrl,
} from '../../src/modules/admin/services/command-center-action-rules/seo-action.rules';
import { buildPricingRiskActions } from '../../src/modules/admin/services/command-center-action-rules/pricing-action.rules';

function biz(confidence: number): RawAction {
  return {
    id: 'x',
    title: 't',
    department: 'sales',
    source: 'orders',
    action_type: 'business',
    impact: 8,
    urgency: 7,
    data_confidence: confidence,
    effort: 3,
    risk: 2,
    reason: 'r',
    evidence: [],
    next_step: 'n',
  };
}

describe('score caps — honesty invariant', () => {
  it('CONVERTS a business action on low-confidence data into a certification action', () => {
    const a = finalizeAction(biz(BUSINESS_CONFIDENCE_FLOOR - 1));
    expect(a.action_type).toBe('certification'); // NEVER a fake business insight on broken data
    expect(a.title).toMatch(/Fiabiliser la source/);
  });

  it('keeps a business action when the source is certified (confidence high)', () => {
    const a = finalizeAction(biz(90));
    expect(a.action_type).toBe('business');
  });

  it('also gates "risk" actions below the floor', () => {
    const a = finalizeAction({ ...biz(20), action_type: 'risk' });
    expect(a.action_type).toBe('certification');
  });

  it('computeScore = impact + urgency + data_confidence/10 - effort - risk', () => {
    // 8 + 7 + 90/10 - 3 - 2 = 19
    expect(computeScore(biz(90))).toBe(19);
  });

  it('does NOT convert at the exact floor (data_confidence === FLOOR stays business)', () => {
    // boundary is `< FLOOR`; === FLOOR must remain a real business action
    expect(finalizeAction(biz(BUSINESS_CONFIDENCE_FLOOR)).action_type).toBe(
      'business',
    );
  });

  it('sorts by score descending', () => {
    const lo = finalizeAction({ ...biz(90), id: 'lo', impact: 1, urgency: 1 });
    const hi = finalizeAction({ ...biz(90), id: 'hi', impact: 9, urgency: 9 });
    expect(sortActions([lo, hi]).map((a) => a.id)).toEqual(['hi', 'lo']);
  });

  it('breaks score ties by action_type rank (repair<certification<risk<business)', () => {
    // identical impact/urgency/confidence/effort/risk → identical score → rank decides
    const base = { ...biz(90), impact: 5, urgency: 5, effort: 1, risk: 1 };
    const acts = (['business', 'risk', 'certification', 'repair'] as const).map(
      (t, i) => finalizeAction({ ...base, id: `id${i}`, action_type: t }),
    );
    expect(sortActions(acts).map((a) => a.action_type)).toEqual([
      'repair',
      'certification',
      'risk',
      'business',
    ]);
  });

  it('breaks equal score+type ties by ascending id (deterministic)', () => {
    const base = {
      ...biz(90),
      impact: 5,
      urgency: 5,
      effort: 1,
      risk: 1,
      action_type: 'certification' as const,
    };
    const a = finalizeAction({ ...base, id: 'b' });
    const b = finalizeAction({ ...base, id: 'a' });
    expect(sortActions([a, b]).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('certification rules — broken/partial sources → repair/certify, NOT business', () => {
  const depts = [
    {
      id: 'sales',
      label: 'Ventes',
      certification: 'PARTIAL',
      kpi_primary: 'k',
    },
    {
      id: 'supplier',
      label: 'Achats',
      certification: 'PARTIAL',
      kpi_primary: 'k',
    },
    { id: 'seo', label: 'SEO', certification: 'CERTIFIED', kpi_primary: 'k' }, // certified → no action
  ];
  const chains = [
    {
      id: 'data-to-sales',
      from: 'data',
      to: 'sales',
      state: 'PARTIAL',
      incomplete: true,
    },
  ];

  it('emits a non-business action for each non-certified critical department', () => {
    const out = buildCertificationActions(depts, chains).map(finalizeAction);
    const sales = out.find((a) => a.id === 'repair:sales');
    expect(sales).toBeDefined();
    expect(['certification', 'repair']).toContain(sales!.action_type);
    expect(sales!.action_type).not.toBe('business');
    expect(sales!.next_step).toMatch(/funnel/i);
  });

  it('does NOT emit an action for a CERTIFIED department', () => {
    const out = buildCertificationActions(depts, chains);
    expect(
      out.find((a) => a.department === 'seo' && a.id.startsWith('repair:')),
    ).toBeUndefined();
  });

  it('emits a "wire contract" action for an incomplete handoff feeding sales', () => {
    const out = buildCertificationActions(depts, chains);
    expect(out.find((a) => a.id === 'wire:data-to-sales')).toBeDefined();
  });

  it('a BROKEN critical department yields a repair action (not certification)', () => {
    const out = buildCertificationActions(
      [
        {
          id: 'supplier',
          label: 'Achats',
          certification: 'BROKEN',
          kpi_primary: 'k',
        },
      ],
      [],
    ).map(finalizeAction);
    const sup = out.find((a) => a.id === 'repair:supplier');
    expect(sup).toBeDefined();
    expect(sup!.action_type).toBe('repair'); // BROKEN → repair, not certification
  });
});

describe('SEO opportunity rules — real business actions (certified source)', () => {
  it('classifies URLs by page kind', () => {
    expect(pageKindFromUrl('https://x/pieces/filtre/a/b.html')).toBe('product');
    expect(pageKindFromUrl('https://x/blog-pieces-auto/conseils/foo')).toBe(
      'content',
    );
    expect(pageKindFromUrl('https://x/autre')).toBe('other');
  });

  it('produces business opportunity actions aggregated by page kind', () => {
    const rows = [
      { page: 'https://x/pieces/a.html', impressions: 2277, clicks: 0 },
      { page: 'https://x/pieces/b.html', impressions: 300, clicks: 0 },
      {
        page: 'https://x/blog-pieces-auto/conseils/c',
        impressions: 1000,
        clicks: 0,
      },
    ];
    const out = buildSeoOpportunityActions(rows).map(finalizeAction);
    const product = out.find((a) => a.id === 'seo:opportunity:product');
    expect(product).toBeDefined();
    expect(product!.action_type).toBe('business'); // SEO certified → stays business
    expect(product!.title).toMatch(/2 fiches produit/);
    expect(out.find((a) => a.id === 'seo:opportunity:content')).toBeDefined();
  });

  it('returns nothing on empty input', () => {
    expect(buildSeoOpportunityActions([])).toEqual([]);
  });
});

describe('pricing rules — cautious; thresholds → certification, not a guessed %', () => {
  it('emits only a certification action when no unambiguous risk exists', () => {
    const out = buildPricingRiskActions({
      available_total: 409625,
      sell_at_loss: 0,
      missing_purchase: 0,
      sell_at_loss_samples: [],
      missing_samples: [],
    }).map(finalizeAction);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('pricing:wire-margin-thresholds');
    expect(out[0].action_type).toBe('certification');
  });

  it('emits a risk action when purchase price is missing', () => {
    const out = buildPricingRiskActions({
      available_total: 100,
      sell_at_loss: 0,
      missing_purchase: 3,
      sell_at_loss_samples: [],
      missing_samples: ['p1', 'p2', 'p3'],
    }).map(finalizeAction);
    const risk = out.find((a) => a.id === 'pricing:missing-purchase');
    expect(risk).toBeDefined();
    expect(risk!.action_type).toBe('risk'); // confidence 65 ≥ floor → stays risk
  });

  it('emits a sell-at-loss RISK action (highest impact) when sell_at_loss > 0', () => {
    const out = buildPricingRiskActions({
      available_total: 100,
      sell_at_loss: 3,
      missing_purchase: 0,
      sell_at_loss_samples: ['a', 'b', 'c'],
      missing_samples: [],
    }).map(finalizeAction);
    const sal = out.find((a) => a.id === 'pricing:sell-at-loss');
    expect(sal).toBeDefined();
    expect(sal!.action_type).toBe('risk'); // confidence 72 ≥ floor → stays risk
    expect(sal!.impact).toBe(10);
  });
});
