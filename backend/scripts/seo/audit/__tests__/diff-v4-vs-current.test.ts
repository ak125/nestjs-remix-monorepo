import { describe, it, expect } from 'vitest';
import { computeDiffVerdict, normalizeForHash, hashContent } from '../diff-v4-vs-current';

describe('Volet 2 — diff fingerprint helpers', () => {
  it('hashContent is deterministic', () => {
    expect(hashContent('hello world')).toBe(hashContent('hello world'));
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('normalizeForHash strips whitespace and casing', () => {
    expect(normalizeForHash('  Hello   World  ')).toBe('hello world');
    expect(normalizeForHash('FOO\nBAR')).toBe('foo bar');
  });

  it('computeDiffVerdict exact_match when fingerprints identical', () => {
    const fp = { title_hash: 'a', h1_hash: 'b', content_hash: 'c', canonical: 'u', robots: 'r' };
    expect(computeDiffVerdict(fp, fp)).toBe('exact_match');
  });

  it('computeDiffVerdict v4_unavailable when v4 null', () => {
    const fp = { title_hash: 'a', h1_hash: 'b', content_hash: 'c', canonical: 'u', robots: 'r' };
    expect(computeDiffVerdict(fp, null)).toBe('v4_unavailable');
  });

  it('computeDiffVerdict divergent when 2+ hashes differ', () => {
    const a = { title_hash: 'a', h1_hash: 'b', content_hash: 'c', canonical: 'u', robots: 'r' };
    const b = { title_hash: 'X', h1_hash: 'Y', content_hash: 'c', canonical: 'u', robots: 'r' };
    expect(computeDiffVerdict(a, b)).toBe('divergent');
  });

  it('computeDiffVerdict similar when only 1 hash differs', () => {
    const a = { title_hash: 'a', h1_hash: 'b', content_hash: 'c', canonical: 'u', robots: 'r' };
    const b = { title_hash: 'X', h1_hash: 'b', content_hash: 'c', canonical: 'u', robots: 'r' };
    expect(computeDiffVerdict(a, b)).toBe('similar');
  });
});
