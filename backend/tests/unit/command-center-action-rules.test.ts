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
  deriveUrlNextStep,
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

  it('PR2: normalises details to null when a rule provides none', () => {
    expect(finalizeAction(biz(90)).details).toBeNull();
  });

  it('PR2: preserves a provided details payload', () => {
    const withDetails: RawAction = {
      ...biz(90),
      details: [
        {
          url: 'u',
          page_kind: 'product',
          impressions: 10,
          clicks: 0,
          ctr: 0,
          position: 4,
          next_step: 'x',
        },
      ],
    };
    expect(finalizeAction(withDetails).details).toHaveLength(1);
  });

  it('PR2: strips details when a low-confidence action is downgraded to certification', () => {
    const lowWithDetails: RawAction = {
      ...biz(BUSINESS_CONFIDENCE_FLOOR - 1),
      details: [
        {
          url: 'u',
          page_kind: 'product',
          impressions: 10,
          clicks: 0,
          ctr: 0,
          position: 4,
          next_step: 'x',
        },
      ],
    };
    const a = finalizeAction(lowWithDetails);
    expect(a.action_type).toBe('certification'); // honesty cap fired
    expect(a.details).toBeNull(); // non-certified → no presentational drill-down
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

describe('repair coverage — canon-priority-driven (audit 2026-06-11 angle mort)', () => {
  it('an uncertified P0 department WITHOUT a curated playbook still gets a repair action (no silent skip)', () => {
    const out = buildCertificationActions(
      [
        {
          id: 'finance',
          label: 'Finance',
          certification: 'PARTIAL',
          kpi_primary: 'k',
          priority: 'P0',
        },
      ],
      [],
    ).map(finalizeAction);
    const fin = out.find((a) => a.id === 'repair:finance');
    expect(fin).toBeDefined(); // before the fix: finance was invisible
    expect(fin!.action_type).toBe('certification');
    expect(fin!.source).toBe('governance'); // catch-all source (enum-valid)
    expect(fin!.department).toBe('finance'); // real department shown in UI
    expect(fin!.next_step).toMatch(/verdict de fiabilité/i); // generic honest step
  });

  it('a curated P0 keeps its specific playbook weights/step (not the generic ones)', () => {
    const out = buildCertificationActions(
      [
        {
          id: 'sales',
          label: 'Ventes',
          certification: 'PARTIAL',
          kpi_primary: 'k',
          priority: 'P0',
        },
      ],
      [],
    ).map(finalizeAction);
    const sales = out.find((a) => a.id === 'repair:sales')!;
    expect(sales.impact).toBe(10); // curated, not generic 6
    expect(sales.next_step).toMatch(/funnel/i); // curated step preserved
  });

  it('a non-P0 department without a curated playbook is NOT covered (conservative scope)', () => {
    const out = buildCertificationActions(
      [
        {
          id: 'media',
          label: 'Média',
          certification: 'PARTIAL',
          kpi_primary: 'k',
          priority: 'P2',
        },
      ],
      [],
    );
    expect(out.find((a) => a.id === 'repair:media')).toBeUndefined();
  });

  it('a CERTIFIED P0 department gets no action even via the generic path', () => {
    const out = buildCertificationActions(
      [
        {
          id: 'finance',
          label: 'Finance',
          certification: 'CERTIFIED',
          kpi_primary: 'k',
          priority: 'P0',
        },
      ],
      [],
    );
    expect(out.find((a) => a.id === 'repair:finance')).toBeUndefined();
  });

  it('a generic P0 that is BROKEN escalates to a repair action', () => {
    const out = buildCertificationActions(
      [
        {
          id: 'support',
          label: 'Support',
          certification: 'BROKEN',
          kpi_primary: 'k',
          priority: 'P0',
        },
      ],
      [],
    ).map(finalizeAction);
    const sup = out.find((a) => a.id === 'repair:support')!;
    expect(sup.action_type).toBe('repair');
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

  it('empty input + fraîcheur/couverture vérifiées → rien (vraie bonne nouvelle)', () => {
    expect(
      buildSeoOpportunityActions([], {
        total_qualifying: 0,
        data_from: '2026-04-01',
        data_to: '2026-06-08',
        freshness: 'fresh',
      }),
    ).toEqual([]);
  });

  it('empty input SANS fraîcheur vérifiée → action certification data-gap, jamais un silence ambigu', () => {
    const out = buildSeoOpportunityActions([]).map(finalizeAction);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('seo:gsc-data-gap');
    expect(out[0].action_type).toBe('certification');
    expect(out[0].reason).toMatch(/ingestion/i);
  });

  it('PR2+PR3: per-URL details (sorted desc; ctr; position + advisory next_step)', () => {
    const out = buildSeoOpportunityActions([
      {
        page: 'https://x/pieces/a.html',
        impressions: 200,
        clicks: 0,
        position: 4,
      },
      {
        page: 'https://x/pieces/b.html',
        impressions: 50,
        clicks: 5,
        position: 30,
      },
    ]).map(finalizeAction);
    const product = out.find((a) => a.id === 'seo:opportunity:product')!;
    expect(product.details).toHaveLength(2);
    expect(product.details![0]).toEqual({
      url: 'https://x/pieces/a.html',
      page_kind: 'product',
      impressions: 200,
      clicks: 0,
      ctr: 0,
      position: 4,
      next_step: expect.stringMatching(/title\/meta/i), // pos 4 ranked → SERP appeal
    });
    expect(product.details![1].ctr).toBeCloseTo(0.1, 5); // 5/50
    expect(product.details![1].next_step).toMatch(/maillage/i); // pos 30 → authority
  });

  it('PR3: position=null + honest next_step when the RPC omits avg_position', () => {
    const product = buildSeoOpportunityActions([
      { page: 'https://x/pieces/a.html', impressions: 200, clicks: 0 },
    ])
      .map(finalizeAction)
      .find((a) => a.id === 'seo:opportunity:product')!;
    expect(product.details![0].position).toBeNull();
    expect(product.details![0].next_step).toMatch(/inconnue/i);
  });
});

describe('PR3: deriveUrlNextStep — deterministic, advisory, honest', () => {
  it('ranked (pos ≤ 15) → title/meta + intent (SERP appeal)', () => {
    expect(deriveUrlNextStep('product', 4)).toMatch(/title\/meta/i);
    expect(deriveUrlNextStep('product', 4)).toMatch(/ranke/i);
    expect(deriveUrlNextStep('content', 12)).toMatch(/title\/meta/i);
    expect(deriveUrlNextStep('other', 8)).toMatch(/title\/meta/i);
  });

  it('not ranked (pos > 15) → maillage / enrich + money link', () => {
    expect(deriveUrlNextStep('product', 40)).toMatch(/maillage/i);
    expect(deriveUrlNextStep('content', 40)).toMatch(/transactionnelle/i);
    expect(deriveUrlNextStep('content', 40)).toMatch(/enrichir/i);
  });

  it('honest fallback when position unknown — no fabricated SERP diagnosis', () => {
    for (const pos of [null, 0]) {
      const s = deriveUrlNextStep('product', pos);
      expect(s).toMatch(/inconnue/i);
      expect(s).not.toMatch(/ranke/i);
    }
  });
});

describe('PR4: GSC meta honnêteté — cap divulgué, couverture réelle, fraîcheur', () => {
  const rows = [
    {
      page: 'https://x/pieces/a.html',
      impressions: 200,
      clicks: 0,
      position: 4,
    },
    { page: 'https://x/blog-pieces-auto/conseils/c', impressions: 100, clicks: 0 },
  ];

  it('fresh + cap dépassé → confiance CERTIFIED (90), cap dans le titre, couverture réelle dans la raison', () => {
    const out = buildSeoOpportunityActions(rows, {
      total_qualifying: 147,
      data_from: '2026-04-01',
      data_to: '2026-06-08',
      freshness: 'fresh',
    }).map(finalizeAction);
    const product = out.find((a) => a.id === 'seo:opportunity:product')!;
    expect(product.data_confidence).toBe(90);
    expect(product.action_type).toBe('business');
    expect(product.title).toMatch(/top 2/); // 147 qualifiantes > 2 affichées → cap divulgué
    expect(product.reason).toMatch(/147 pages qualifiantes/);
    expect(product.reason).toMatch(/2026-04-01 au 2026-06-08/);
    expect(product.reason).not.toMatch(/120j/); // plus de claim de fenêtre non vérifiée
  });

  it('stale → PARTIAL (55) annoncé, l\'action business survit (≥ floor) marquée prudence', () => {
    const out = buildSeoOpportunityActions(rows, {
      total_qualifying: 2,
      data_from: '2026-04-01',
      data_to: '2026-05-01',
      freshness: 'stale',
    }).map(finalizeAction);
    const product = out.find((a) => a.id === 'seo:opportunity:product')!;
    expect(product.data_confidence).toBe(55);
    expect(product.action_type).toBe('business');
    expect(product.reason).toMatch(/fraîcheur GSC dégradée/i);
  });

  it('meta absente (fallback RPC v1) → PARTIAL + couverture et total annoncés inconnus', () => {
    const out = buildSeoOpportunityActions(rows).map(finalizeAction);
    const product = out.find((a) => a.id === 'seo:opportunity:product')!;
    expect(product.data_confidence).toBe(55);
    expect(product.reason).toMatch(/total qualifiant inconnu/i);
    expect(product.reason).toMatch(/Couverture réelle des données GSC inconnue/);
  });

  it('liste complète (total ≤ échantillon) → pas de cap dans le titre, « Liste complète » dans la raison', () => {
    const out = buildSeoOpportunityActions(rows, {
      total_qualifying: 2,
      data_from: '2026-04-01',
      data_to: '2026-06-08',
      freshness: 'fresh',
    }).map(finalizeAction);
    const product = out.find((a) => a.id === 'seo:opportunity:product')!;
    expect(product.title).not.toMatch(/top \d/);
    expect(product.reason).toMatch(/Liste complète \(2 pages qualifiantes/);
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
