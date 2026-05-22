import { normalizeSupplierReference } from '../normalize-supplier-reference';

describe('normalizeSupplierReference', () => {
  it.each([
    ['  bp 1234 ', 'BP1234'],
    ['bp-1234', 'BP1234'],
    ['B.P.1234', 'BP1234'],
    ['bp_1234', 'BP1234'],
    ['BP/1234', 'BP1234'],
    ['Réf-00é', 'REF00E'], // diacritics stripped
    ['0 986 478 853', '0986478853'],
  ])('normalizes %j → %j', (input, expected) => {
    expect(normalizeSupplierReference(input)).toBe(expected);
  });

  it('different formats of the same ref collapse to one key (no false-unmatched)', () => {
    const variants = ['BP 1234', 'bp-1234', 'B.P.1234', ' Bp1234 '];
    const keys = new Set(variants.map((v) => normalizeSupplierReference(v)));
    expect(keys.size).toBe(1);
  });

  it('returns empty string for nullish/empty', () => {
    expect(normalizeSupplierReference(null)).toBe('');
    expect(normalizeSupplierReference(undefined)).toBe('');
    expect(normalizeSupplierReference('   ')).toBe('');
  });

  it('applies alias map after normalization', () => {
    expect(normalizeSupplierReference('old-ref-1', { OLDREF1: 'NEWREF1' })).toBe('NEWREF1');
    expect(normalizeSupplierReference('keep-1', { OLDREF1: 'NEWREF1' })).toBe('KEEP1');
  });
});
