/**
 * PR-E — KgShadowService pure-comparison tests.
 *
 * Targets the `compareTopN` exported helper. The service's I/O layer
 * (Supabase RPC + EventEmitter2) is exercised via inspection — the
 * function-under-test is the divergence verdict logic.
 */

import {
  compareTopN,
  TOP_N_DEFAULT,
  type CanonicalCauseRef,
} from './kg-shadow.service';

const canonical = (ids: string[]): CanonicalCauseRef[] =>
  ids.map((id, i) => ({ cause_id: id, confidence: 0.9 - i * 0.1 }));

const kg = (
  ids: string[],
): Array<{ fault_id: string; score: number; confidence: number }> =>
  ids.map((id, i) => ({
    fault_id: id,
    score: 0.9 - i * 0.1,
    confidence: 0.8 - i * 0.1,
  }));

describe('compareTopN (PR-E)', () => {
  test('identical top-N → reason "match", jaccard 1', () => {
    const verdict = compareTopN(
      canonical(['a', 'b', 'c']),
      kg(['a', 'b', 'c']),
      5,
    );
    expect(verdict.reason).toBe('match');
    expect(verdict.has_divergence).toBe(false);
    expect(verdict.jaccard_overlap).toBe(1);
  });

  test('same set different order → reason "set_diff" (top1 still matches)', () => {
    const verdict = compareTopN(
      canonical(['a', 'b', 'c']),
      kg(['a', 'c', 'b']),
      5,
    );
    expect(verdict.reason).toBe('match'); // sets equal
    expect(verdict.has_divergence).toBe(false);
  });

  test('top1 differs → reason "top1_diff"', () => {
    const verdict = compareTopN(
      canonical(['a', 'b', 'c']),
      kg(['z', 'a', 'b']),
      5,
    );
    expect(verdict.reason).toBe('top1_diff');
    expect(verdict.has_divergence).toBe(true);
    expect(verdict.canonical_top_id).toBe('a');
    expect(verdict.kg_top_id).toBe('z');
  });

  test('same top1 but sets differ → reason "set_diff"', () => {
    const verdict = compareTopN(
      canonical(['a', 'b', 'c']),
      kg(['a', 'x', 'y']),
      5,
    );
    expect(verdict.reason).toBe('set_diff');
    expect(verdict.has_divergence).toBe(true);
    expect(verdict.jaccard_overlap).toBeCloseTo(1 / 5); // |{a}| / |{a,b,c,x,y}|
  });

  test('empty KG result → reason "kg_empty"', () => {
    const verdict = compareTopN(canonical(['a', 'b']), [], 5);
    expect(verdict.reason).toBe('kg_empty');
    expect(verdict.has_divergence).toBe(true);
    expect(verdict.kg_top_id).toBeNull();
  });

  test('empty canonical AND empty KG → no divergence, kg_empty', () => {
    const verdict = compareTopN([], [], 5);
    expect(verdict.reason).toBe('kg_empty');
    expect(verdict.has_divergence).toBe(false);
  });

  test('top-N window is respected (extra results ignored)', () => {
    const verdict = compareTopN(
      canonical(['a', 'b', 'c', 'd', 'e', 'f']),
      kg(['a', 'b', 'c', 'd', 'e', 'EXTRA']),
      5,
    );
    expect(verdict.reason).toBe('match'); // EXTRA is outside top-5 window
    expect(verdict.compared_n).toBe(5);
  });

  test('TOP_N_DEFAULT is 5 (canon for V1)', () => {
    expect(TOP_N_DEFAULT).toBe(5);
  });

  test('jaccard 0 when no overlap', () => {
    const verdict = compareTopN(canonical(['a', 'b']), kg(['x', 'y']), 5);
    expect(verdict.jaccard_overlap).toBe(0);
    expect(verdict.reason).toBe('top1_diff');
  });

  test('partial overlap : 1 common out of 3+3 unique', () => {
    const verdict = compareTopN(
      canonical(['a', 'b', 'c']),
      kg(['a', 'x', 'y']),
      5,
    );
    expect(verdict.jaccard_overlap).toBeCloseTo(1 / 5);
  });
});
