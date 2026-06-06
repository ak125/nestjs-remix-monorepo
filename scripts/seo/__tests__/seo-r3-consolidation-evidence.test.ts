/**
 * Tests for the pure decision logic of the R3 consolidation evidence matrix.
 * Run: npx tsx --test scripts/seo/__tests__/seo-r3-consolidation-evidence.test.ts
 *
 * No I/O — fixtures only. Verifies the 4 owner guardrails + schema validity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GammeRowSchema, MatrixSchema, type GammeRow, type RoleSignalsT } from '../seo-r3-consolidation-evidence.schema';
import {
  decide,
  jaccard,
  overlapBand,
  tokenizeFr,
  windowFromEnd,
  renderMatrixMd,
} from '../seo-r3-consolidation-evidence.logic';

function role(r: 'R3' | 'R4' | 'R6', o: Partial<RoleSignalsT> = {}): RoleSignalsT {
  return {
    role: r,
    url: `https://www.automecanik.com/${r}`,
    live: 'PRESENT_RICH',
    gsc_28d: { clicks: 0, impressions: 0, position: null },
    gsc_90d: { clicks: 0, impressions: 0, position: null },
    index_follow: 'INDEX_FOLLOW',
    inbound_links: 0,
    ...o,
  };
}

type Base = Parameters<typeof decide>[0];
function base(o: Partial<Base> = {}): Base {
  return {
    gamme: 'filtre-a-air',
    pg_id: 8,
    pg_alias: 'filtre-a-air',
    intent_targets: ['diagnostic', 'achat'],
    roles: { R3: role('R3'), R4: role('R4'), R6: role('R6') },
    overlaps: [
      { pair: 'R3_R4', jaccard: 0.5, band: 'HIGH' },
      { pair: 'R3_R6', jaccard: 0.5, band: 'HIGH' },
    ],
    user_intent_gap: [],
    ...o,
  };
}

test('schema: decide() output is GammeRowSchema-valid', () => {
  const row = decide(base());
  assert.doesNotThrow(() => GammeRowSchema.parse(row));
});

test('adj1: incomplete evidence (R4 GSC null while live) ⇒ recommendation & url_* = OBSERVE', () => {
  const row = decide(base({ roles: { R3: role('R3'), R4: role('R4', { gsc_28d: null }), R6: role('R6') } }));
  assert.equal(row.evidence_complete, false);
  assert.ok(row.missing_signals.includes('R4.gsc'));
  assert.equal(row.recommendation, 'OBSERVE');
  assert.equal(row.url_R4, 'OBSERVE');
  assert.equal(row.url_R6, 'OBSERVE');
});

test('adj1: absent R4/R6 page needs no GSC → evidence can still be complete', () => {
  const row = decide(base({ roles: { R3: role('R3'), R4: role('R4', { live: 'ABSENT', gsc_28d: null, index_follow: 'OBSERVE', inbound_links: null }), R6: role('R6', { live: 'ABSENT', gsc_28d: null, index_follow: 'OBSERVE', inbound_links: null }) } }));
  assert.equal(row.evidence_complete, true);
  assert.equal(row.recommendation, 'NO_ACTION'); // R3 only, nothing to consolidate
});

test('url KEEP when role has GSC clicks (distinct demand)', () => {
  const row = decide(base({ roles: { R3: role('R3'), R4: role('R4', { gsc_28d: { clicks: 12, impressions: 300, position: 8 } }), R6: role('R6') } }));
  assert.equal(row.url_R4, 'KEEP');
  assert.equal(row.recommendation, 'R3_PLUS_R4'); // R4 kept, R6 not
});

test('adj4: MERGE+301 only on near-dup (HIGH overlap + 0 clicks + 0 meaningful impr + R3 rich)', () => {
  const row = decide(base({
    roles: {
      R3: role('R3', { live: 'PRESENT_RICH' }),
      R4: role('R4', { gsc_28d: { clicks: 0, impressions: 3, position: null } }),
      R6: role('R6', { gsc_28d: { clicks: 0, impressions: 1, position: null } }),
    },
    overlaps: [
      { pair: 'R3_R4', jaccard: 0.6, band: 'HIGH' },
      { pair: 'R3_R6', jaccard: 0.6, band: 'HIGH' },
    ],
  }));
  assert.equal(row.url_R4, 'MERGE+301');
  assert.equal(row.url_R6, 'MERGE+301');
  assert.equal(row.recommendation, 'R3_ONLY'); // neither kept
});

test('adj4: HIGH overlap + 0 clicks but R3 NOT rich ⇒ CANONICAL (never auto MERGE+301)', () => {
  const row = decide(base({
    roles: {
      R3: role('R3', { live: 'PRESENT_THIN' }),
      R4: role('R4', { gsc_28d: { clicks: 0, impressions: 2, position: null } }),
      R6: role('R6', { live: 'ABSENT', gsc_28d: null, index_follow: 'OBSERVE', inbound_links: null }),
    },
  }));
  assert.equal(row.url_R4, 'CANONICAL');
});

test('adj4: LOW overlap + no GSC demand ⇒ OBSERVE (overlap never KEEPs alone)', () => {
  const row = decide(base({
    roles: { R3: role('R3'), R4: role('R4'), R6: role('R6') },
    overlaps: [
      { pair: 'R3_R4', jaccard: 0.05, band: 'LOW' },
      { pair: 'R3_R6', jaccard: 0.5, band: 'HIGH' },
    ],
  }));
  assert.equal(row.url_R4, 'OBSERVE'); // low overlap + no demand → insufficient, NOT keep
  assert.equal(row.url_R6, 'MERGE+301'); // high overlap + no demand + R3 rich → fold candidate
  assert.equal(row.recommendation, 'OBSERVE'); // R4 undetermined blocks a final architecture call
});

test('KEEP via meaningful 90d impressions on an index/follow page', () => {
  const row = decide(base({
    roles: {
      R3: role('R3'),
      R4: role('R4', { gsc_90d: { clicks: 0, impressions: 250, position: 60 } }),
      R6: role('R6', { live: 'ABSENT', gsc_28d: null, gsc_90d: null, index_follow: 'OBSERVE', inbound_links: null }),
    },
  }));
  assert.equal(row.url_R4, 'KEEP'); // real search demand justifies autonomy
  assert.equal(row.recommendation, 'R3_PLUS_R4'); // R4 kept, R6 absent
});

test('adj2: recommendation separate from url — R3_PLUS_R4_R6 when both KEEP', () => {
  const row = decide(base({
    roles: {
      R3: role('R3'),
      R4: role('R4', { gsc_28d: { clicks: 5, impressions: 200, position: 6 } }),
      R6: role('R6', { gsc_28d: { clicks: 8, impressions: 400, position: 5 } }),
    },
  }));
  assert.equal(row.url_R4, 'KEEP');
  assert.equal(row.url_R6, 'KEEP');
  assert.equal(row.recommendation, 'R3_PLUS_R4_R6');
});

test('recommendation OBSERVE when R3 absent', () => {
  const row = decide(base({ roles: { R3: role('R3', { live: 'ABSENT', gsc_28d: { clicks: 0, impressions: 0, position: null } }), R4: role('R4', { live: 'ABSENT', gsc_28d: null, index_follow: 'OBSERVE', inbound_links: null }), R6: role('R6', { live: 'ABSENT', gsc_28d: null, index_follow: 'OBSERVE', inbound_links: null }) } }));
  assert.equal(row.recommendation, 'OBSERVE');
});

test('adj3: risk HIGH when a fold candidate has clicks', () => {
  const row = decide(base({ roles: { R3: role('R3'), R4: role('R4', { gsc_28d: { clicks: 3, impressions: 100, position: 9 } }), R6: role('R6') } }));
  assert.equal(row.risk_level, 'HIGH');
  assert.ok(row.risk_reasons.some((r) => /clics GSC/.test(r)));
});

test('adj3: risk LOW on clean near-duplicate vs rich R3', () => {
  const row = decide(base({
    roles: {
      R3: role('R3', { live: 'PRESENT_RICH' }),
      R4: role('R4', { gsc_28d: { clicks: 0, impressions: 0, position: null } }),
      R6: role('R6', { live: 'ABSENT', gsc_28d: null, index_follow: 'OBSERVE', inbound_links: null }),
    },
    overlaps: [{ pair: 'R3_R4', jaccard: 0.7, band: 'HIGH' }, { pair: 'R3_R6', jaccard: null, band: 'OBSERVE' }],
  }));
  assert.equal(row.risk_level, 'LOW');
});

test('jaccard + overlapBand + tokenizeFr', () => {
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3);
  assert.equal(overlapBand(null), 'OBSERVE');
  assert.equal(overlapBand(0.05), 'LOW');
  assert.equal(overlapBand(0.25), 'MED');
  assert.equal(overlapBand(0.5), 'HIGH');
  const toks = tokenizeFr('Le filtre à air protège le moteur');
  assert.ok(toks.has('filtre'));
  assert.ok(toks.has('moteur'));
  assert.ok(!toks.has('air')); // < 4 chars dropped
});

test('windowFromEnd computes 28d/90d deterministically from --end', () => {
  const w = windowFromEnd('2026-06-03');
  assert.equal(w.end, '2026-06-03');
  assert.equal(w.d28.start, '2026-05-07');
  assert.equal(w.d90.start, '2026-03-06');
});

test('renderMatrixMd separates Architecture recommendation from URL posture + is MatrixSchema-valid', () => {
  const rows: GammeRow[] = [decide(base({ roles: { R3: role('R3'), R4: role('R4', { gsc_28d: { clicks: 9, impressions: 500, position: 4 } }), R6: role('R6') } }))];
  const matrix = {
    schema_version: 'r3-consolidation-evidence.v1' as const,
    site: 'sc-domain:automecanik.com',
    window: windowFromEnd('2026-06-03'),
    live_robots: true,
    rows,
  };
  assert.doesNotThrow(() => MatrixSchema.parse(matrix));
  const md = renderMatrixMd(matrix);
  assert.match(md, /Architecture recommendation/);
  assert.match(md, /URL posture/);
  assert.match(md, /signal faible/); // Jaccard caveat documented
});
