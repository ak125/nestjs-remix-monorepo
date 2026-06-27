import { splatToPath } from './splat-path.util';

describe('splatToPath', () => {
  it('returns "" for undefined (root match)', () => {
    expect(splatToPath(undefined)).toBe('');
  });

  it('returns "" for null', () => {
    expect(splatToPath(null)).toBe('');
  });

  it('returns "" for an empty array', () => {
    expect(splatToPath([])).toBe('');
  });

  it('returns a single segment unchanged', () => {
    expect(splatToPath(['pieces'])).toBe('pieces');
  });

  it('joins multiple segments with "/"', () => {
    expect(splatToPath(['pieces', 'freinage'])).toBe('pieces/freinage');
  });

  it('does NOT decode already-decoded segments (no double-decode)', () => {
    // v8 router already decoded once; a residual "%2F" stays literal.
    expect(splatToPath(['a%2Fb'])).toBe('a%2Fb');
    expect(splatToPath(['café'])).toBe('café');
    expect(splatToPath(['a b'])).toBe('a b');
  });

  it('passes a plain string through unchanged (legacy v6 param shape)', () => {
    expect(splatToPath('pieces/freinage')).toBe('pieces/freinage');
    expect(splatToPath('')).toBe('');
  });
});
