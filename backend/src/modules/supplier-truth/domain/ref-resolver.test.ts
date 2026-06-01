import { normalizeRef, resolvePieceId } from './ref-resolver';

describe('normalizeRef (parity with normalizeOemRef)', () => {
  it('trims, uppercases, strips spaces and dashes', () => {
    expect(normalizeRef('77 01 206 343')).toBe('7701206343');
    expect(normalizeRef('  scl4123 ')).toBe('SCL4123');
    expect(normalizeRef('AB-12 34')).toBe('AB1234');
  });
  it('keeps dots (matches the original regex [\\s-] only)', () => {
    expect(normalizeRef('03.2123-2561.3')).toBe('03.21232561.3');
  });
});

describe('resolvePieceId', () => {
  it('resolves a unique match to its piece_id', async () => {
    const r = await resolvePieceId('77 01 206 343', async (n) => {
      expect(n).toBe('7701206343'); // normalized before lookup
      return [12345];
    });
    expect(r).toEqual({
      pieceId: 12345,
      reason: 'OK',
      normalizedRef: '7701206343',
    });
  });

  it('returns AMBIGUOUS when more than one piece matches', async () => {
    const r = await resolvePieceId('X', async () => [1, 2]);
    expect(r.pieceId).toBeNull();
    expect(r.reason).toBe('AMBIGUOUS');
  });

  it('dedups identical ids before deciding (same piece via two indexes is not ambiguous)', async () => {
    const r = await resolvePieceId('X', async () => [7, 7]);
    expect(r).toMatchObject({ pieceId: 7, reason: 'OK' });
  });

  it('returns UNRESOLVED when no match', async () => {
    const r = await resolvePieceId('NOPE', async () => []);
    expect(r.reason).toBe('UNRESOLVED');
    expect(r.pieceId).toBeNull();
  });

  it('returns UNRESOLVED for an empty/whitespace ref without calling lookup', async () => {
    const lookup = jest.fn(async () => [1]);
    const r = await resolvePieceId('   ', lookup);
    expect(r.reason).toBe('UNRESOLVED');
    expect(lookup).not.toHaveBeenCalled();
  });
});
