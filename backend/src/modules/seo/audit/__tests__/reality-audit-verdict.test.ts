/**
 * Reality Audit Verdict — TDD tests (Phase 0.5 du plan)
 * Couvre les 5 cas verdict canon + fallback unknown + edge cases priorité.
 */

import { computeVerdict, VerdictInputs } from '../reality-audit-verdict';

const baseHealthy: VerdictInputs = {
  pages_noindex_involuntary: 1000,
  canonical_correct_pct: 95,
  intent_sample_size: 21,
  intent_match_count: 20,
  organic_sessions_28d: 5000,
  organic_orders_28d: 30,
  business_viability_tier: 'high',
};

describe('computeVerdict', () => {
  it('returns business_unviable when tier=unviable (highest priority)', () => {
    const result = computeVerdict({ ...baseHealthy, business_viability_tier: 'unviable' });
    expect(result.dominant_problem).toBe('business_unviable');
    expect(result.notes).toContain('unviable');
  });

  it('returns indexation when pages_noindex_involuntary > threshold', () => {
    const result = computeVerdict({ ...baseHealthy, pages_noindex_involuntary: 100_000 });
    expect(result.dominant_problem).toBe('indexation');
    expect(result.notes).toContain('100000');
  });

  it('returns indexation when canonical_correct_pct < 50', () => {
    const result = computeVerdict({
      ...baseHealthy,
      pages_noindex_involuntary: 0,
      canonical_correct_pct: 30,
    });
    expect(result.dominant_problem).toBe('indexation');
    expect(result.notes).toContain('canonical');
  });

  it('returns intent_mismatch when intent_match_count / intent_sample_size < 0.7', () => {
    const result = computeVerdict({
      ...baseHealthy,
      intent_sample_size: 21,
      intent_match_count: 10, // 47% < 70%
    });
    expect(result.dominant_problem).toBe('intent_mismatch');
    expect(result.notes).toContain('intent_match_ratio');
  });

  it('returns conversion_funnel when sessions > 100 AND orders = 0', () => {
    const result = computeVerdict({
      ...baseHealthy,
      organic_sessions_28d: 5000,
      organic_orders_28d: 0,
    });
    expect(result.dominant_problem).toBe('conversion_funnel');
    expect(result.notes).toContain('Commerce-Loop');
  });

  it('returns content_quality by default when all signals healthy + orders > 0', () => {
    const result = computeVerdict(baseHealthy);
    expect(result.dominant_problem).toBe('content_quality');
    expect(result.notes).toContain('Evidence Guard');
  });

  it('returns unknown when critical data missing (intent + funnel both null)', () => {
    const result = computeVerdict({
      ...baseHealthy,
      intent_sample_size: null,
      intent_match_count: null,
      organic_sessions_28d: null,
      organic_orders_28d: null,
    });
    expect(result.dominant_problem).toBe('unknown');
    expect(result.notes).toContain('Données insuffisantes');
  });

  it('returns unknown when orders == 0 but sessions also 0 (no traffic, cannot conclude funnel)', () => {
    const result = computeVerdict({
      ...baseHealthy,
      organic_sessions_28d: 50, // below threshold
      organic_orders_28d: 0,
    });
    // Sessions too low for funnel verdict, orders=0 fails content_quality default
    expect(result.dominant_problem).toBe('unknown');
  });

  it('priority order: business_unviable beats indexation even if both flagged', () => {
    const result = computeVerdict({
      ...baseHealthy,
      business_viability_tier: 'unviable',
      pages_noindex_involuntary: 200_000,
    });
    expect(result.dominant_problem).toBe('business_unviable');
  });

  it('priority order: indexation beats intent_mismatch even if both flagged', () => {
    const result = computeVerdict({
      ...baseHealthy,
      pages_noindex_involuntary: 100_000,
      intent_match_count: 5, // intent_mismatch aussi
    });
    expect(result.dominant_problem).toBe('indexation');
  });

  it('priority order: intent_mismatch beats conversion_funnel even if both flagged', () => {
    const result = computeVerdict({
      ...baseHealthy,
      intent_match_count: 5, // intent_mismatch
      organic_orders_28d: 0, // conversion_funnel aussi
    });
    expect(result.dominant_problem).toBe('intent_mismatch');
  });

  it('intent_match_ratio exactly at threshold (0.7) is NOT flagged as mismatch', () => {
    const result = computeVerdict({
      ...baseHealthy,
      intent_sample_size: 10,
      intent_match_count: 7, // exactly 0.7
    });
    expect(result.dominant_problem).not.toBe('intent_mismatch');
  });
});
