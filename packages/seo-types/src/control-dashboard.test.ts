/**
 * PR-SBD-1 Task 2 — Contract Zod tests.
 *
 * Uses Node test runner (cf. package.json `test`: tsx --test).
 *
 * Verifies invariants critical for runtime safety :
 *   - Bounded array limits (max 20 / 50)
 *   - payload_minimal max 3 keys
 *   - decision_rule_ids non-empty + max 5
 *   - snapshot_hash sha256 hex (64 chars)
 *   - Unknown surface_key / operational_domain rejected
 *   - impact_score_version literal 'v1'
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  ConversionGapSchema,
  DECISION_RULE_IDS,
  DecisionsSchema,
  LowCtrOpportunitySchema,
  RangeSchema,
  SEO_CONTROL_DECISION_RULES_V1,
  SeoControlSnapshotSchema,
  TechnicalAlertSchema,
  TopLoserSchema,
  TrafficWindowSchema,
} from './control-dashboard.js';

const validDecisions = {
  suspected_causes: ['ranking_drop'],
  recommended_actions: ['audit_canonical'],
  decision_rule_ids: ['LOSER_RANK_DROP_V1'],
  role_id: 'seo-content',
};

const validTopLoser = {
  page: '/pieces/freinage/peugeot/308/1.6-hdi.html',
  surface_key: 'R8',
  clicks_current: 5,
  clicks_previous: 50,
  delta_clicks: -45,
  delta_pct: -90.0,
  impressions_current: 800,
  position_current: 12.4,
  position_delta: 3.2,
  business_impact_score: 42.5,
  impact_score_version: 'v1',
  severity: 'high',
  top_queries_sample: [
    { query: 'plaquette frein 308', clicks_delta: -20, position_current: 15.2 },
  ],
  decisions: validDecisions,
};

const validAlert = {
  source: 'audit_findings',
  alert_type: 'canonical_conflict',
  entity_url: '/pieces/x',
  surface_key: 'R1',
  operational_domain: 'seo',
  severity: 'critical',
  detected_at: '2026-05-18T10:00:00Z',
  payload_minimal: { reason: 'self-canonical missing' },
  business_impact_score: 10.0,
  impact_score_version: 'v1',
  decisions: {
    ...validDecisions,
    decision_rule_ids: ['ALERT_CANONICAL_DRIFT_V1'],
    role_id: 'seo-qa',
  },
};

const validTraffic = {
  impact_score_version: 'v1',
  clicks: 1234,
  impressions: 56789,
  ctr: 2.17,
  avg_position: 14.3,
  pages_count: 521,
  delta_vs_previous: {
    clicks_pct: -5.2,
    impressions_pct: -3.1,
    direction: 'down',
    change_severity: 'info',
  },
};

const validSnapshot = {
  snapshot_id: '550e8400-e29b-41d4-a716-446655440000',
  snapshot_hash:
    'a'.repeat(64), // valid sha256 hex pattern
  generated_at: '2026-05-18T10:00:00Z',
  generated_from: {
    rpc_versions: {
      traffic: 'v1',
      losers: 'v1',
      low_ctr: 'v1',
      alerts: 'v1',
      conversion: 'v1',
    },
    decision_service_version: 'v1',
    impact_score_version: 'v1',
    rules_catalog_version: 'v1',
  },
  range: '7d',
  window_days: 7,
  trafficWindow: validTraffic,
  topLosers: [validTopLoser],
  lowCtrOpportunities: [],
  technicalAlerts: [validAlert],
  conversionGap: null,
};

describe('RangeSchema', () => {
  it('accepts 7d and 28d', () => {
    assert.equal(RangeSchema.parse('7d'), '7d');
    assert.equal(RangeSchema.parse('28d'), '28d');
  });
  it('rejects unknown ranges', () => {
    assert.throws(() => RangeSchema.parse('30d'));
    assert.throws(() => RangeSchema.parse('1d'));
  });
});

describe('DecisionsSchema', () => {
  it('accepts valid decisions', () => {
    DecisionsSchema.parse(validDecisions);
  });
  it('rejects empty decision_rule_ids', () => {
    assert.throws(() =>
      DecisionsSchema.parse({ ...validDecisions, decision_rule_ids: [] }),
    );
  });
  it('rejects unknown rule_id', () => {
    assert.throws(() =>
      DecisionsSchema.parse({
        ...validDecisions,
        decision_rule_ids: ['FAKE_RULE_V1'],
      }),
    );
  });
  it('rejects unknown role_id', () => {
    assert.throws(() =>
      DecisionsSchema.parse({ ...validDecisions, role_id: 'unknown-role' }),
    );
  });
  it('rejects > 5 causes/actions', () => {
    assert.throws(() =>
      DecisionsSchema.parse({
        ...validDecisions,
        suspected_causes: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    );
  });
});

describe('TrafficWindowSchema', () => {
  it('accepts valid traffic', () => {
    TrafficWindowSchema.parse(validTraffic);
  });
  it('rejects non-v1 impact_score_version', () => {
    assert.throws(() =>
      TrafficWindowSchema.parse({ ...validTraffic, impact_score_version: 'v2' }),
    );
  });
  it('rejects unknown direction', () => {
    assert.throws(() =>
      TrafficWindowSchema.parse({
        ...validTraffic,
        delta_vs_previous: { ...validTraffic.delta_vs_previous, direction: 'sideways' },
      }),
    );
  });
});

describe('TopLoserSchema', () => {
  it('accepts valid loser', () => {
    TopLoserSchema.parse(validTopLoser);
  });
  it('rejects top_queries_sample > 3', () => {
    assert.throws(() =>
      TopLoserSchema.parse({
        ...validTopLoser,
        top_queries_sample: Array(4).fill({
          query: 'q',
          clicks_delta: 0,
          position_current: 1,
        }),
      }),
    );
  });
  it('rejects unknown surface_key', () => {
    assert.throws(() =>
      TopLoserSchema.parse({ ...validTopLoser, surface_key: 'R99' }),
    );
  });
});

describe('TechnicalAlertSchema', () => {
  it('accepts valid alert with payload_minimal ≤ 3 keys', () => {
    TechnicalAlertSchema.parse(validAlert);
  });
  it('rejects payload_minimal with > 3 keys', () => {
    assert.throws(() =>
      TechnicalAlertSchema.parse({
        ...validAlert,
        payload_minimal: { a: 1, b: 2, c: 3, d: 4 },
      }),
    );
  });
  it('rejects unknown operational_domain', () => {
    assert.throws(() =>
      TechnicalAlertSchema.parse({
        ...validAlert,
        operational_domain: 'cybersecurity',
      }),
    );
  });
});

describe('LowCtrOpportunitySchema', () => {
  it('accepts top5 band', () => {
    LowCtrOpportunitySchema.parse({
      page: '/x',
      surface_key: 'R1',
      impressions: 1000,
      clicks: 3,
      ctr: 0.003,
      avg_position: 3.5,
      position_band: 'top5',
      business_impact_score: 47,
      impact_score_version: 'v1',
      severity: 'critical',
      decisions: {
        ...validDecisions,
        decision_rule_ids: ['LOWCTR_TOP5_META_MISMATCH_V1'],
      },
    });
  });
  it('rejects unknown position_band', () => {
    assert.throws(() =>
      LowCtrOpportunitySchema.parse({
        page: '/x',
        surface_key: 'R1',
        impressions: 100,
        clicks: 1,
        ctr: 0.01,
        avg_position: 5,
        position_band: 'top1',
        business_impact_score: 1,
        impact_score_version: 'v1',
        severity: 'high',
        decisions: validDecisions,
      }),
    );
  });
});

describe('ConversionGapSchema', () => {
  it('accepts conversion row', () => {
    ConversionGapSchema.parse({
      page: '/pieces/x',
      surface_key: 'R8',
      sessions: 250,
      orders_count: 0,
      conversion_rate: 0,
      revenue: 0,
      business_impact_score: 2.5,
      impact_score_version: 'v1',
      severity: 'critical',
      decisions: {
        ...validDecisions,
        decision_rule_ids: ['CONV_CRITICAL_FUNNEL_BLOCK_V1'],
        role_id: 'cmo',
      },
    });
  });
});

describe('SeoControlSnapshotSchema', () => {
  it('accepts minimal valid snapshot', () => {
    SeoControlSnapshotSchema.parse(validSnapshot);
  });
  it('rejects topLosers length > 20', () => {
    assert.throws(() =>
      SeoControlSnapshotSchema.parse({
        ...validSnapshot,
        topLosers: Array(21).fill(validTopLoser),
      }),
    );
  });
  it('rejects lowCtrOpportunities length > 50', () => {
    assert.throws(() =>
      SeoControlSnapshotSchema.parse({
        ...validSnapshot,
        lowCtrOpportunities: Array(51).fill({
          page: '/x',
          surface_key: 'R1',
          impressions: 100,
          clicks: 0,
          ctr: 0,
          avg_position: 5,
          position_band: 'top5',
          business_impact_score: 1,
          impact_score_version: 'v1',
          severity: 'high',
          decisions: validDecisions,
        }),
      }),
    );
  });
  it('rejects technicalAlerts length > 50', () => {
    assert.throws(() =>
      SeoControlSnapshotSchema.parse({
        ...validSnapshot,
        technicalAlerts: Array(51).fill(validAlert),
      }),
    );
  });
  it('rejects snapshot_hash not sha256 hex', () => {
    assert.throws(() =>
      SeoControlSnapshotSchema.parse({
        ...validSnapshot,
        snapshot_hash: 'not-sha256',
      }),
    );
  });
  it('rejects snapshot_id not UUID', () => {
    assert.throws(() =>
      SeoControlSnapshotSchema.parse({
        ...validSnapshot,
        snapshot_id: 'not-uuid',
      }),
    );
  });
  it('accepts conversionGap null (Phase A masking)', () => {
    SeoControlSnapshotSchema.parse({ ...validSnapshot, conversionGap: null });
  });
});

describe('Rules catalogue invariants', () => {
  it('every rule has domain + role_default', () => {
    for (const id of DECISION_RULE_IDS) {
      const rule = SEO_CONTROL_DECISION_RULES_V1[id];
      assert.ok(rule.domain, `${id} missing domain`);
      assert.ok(rule.role_default, `${id} missing role_default`);
    }
  });
  it('all rule_ids end with _V1', () => {
    for (const id of DECISION_RULE_IDS) {
      assert.match(id, /_V1$/, `${id} must end with _V1`);
    }
  });
});
