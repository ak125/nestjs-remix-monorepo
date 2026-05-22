/**
 * L0.5 — Import Profile tests (the `pricing:profiles` contract).
 *
 * Proves the central guarantee: heterogeneous supplier conventions (net /
 * brut+remise / public+remise) all converge to identical canonical inputs.
 */
import {
  ProfileError,
  resolveCanonicalInputs,
  resolveProfile,
  validateProfile,
  type SupplierPriceProfile,
} from '../supplier-profile.service';

const base: Omit<SupplierPriceProfile, 'derivation' | 'priceBasis' | 'columnMapping'> = {
  id: 1,
  supplierId: 'SUP1',
  scopeLevel: 'SUPPLIER',
  scopeCode: null,
  keyField: 'REF',
  version: 1,
  active: true,
};

describe('SupplierProfile — L0.5 (pricing:profiles)', () => {
  it('SAME achat (12.15 €) from 3 different conventions → identical canonical inputs', () => {
    const direct: SupplierPriceProfile = {
      ...base,
      priceBasis: 'NET',
      derivation: 'DIRECT_NET',
      columnMapping: { ref: { column: 'REF' }, achatHt: { column: 'NET' } },
    };
    const brut: SupplierPriceProfile = {
      ...base,
      priceBasis: 'BRUT',
      derivation: 'REMISE_ON_BRUT',
      columnMapping: { ref: { column: 'REF' }, grosHt: { column: 'GROS' }, remise: { column: 'REM' } },
    };
    const pub: SupplierPriceProfile = {
      ...base,
      priceBasis: 'PUBLIC',
      derivation: 'REMISE_ON_PUBLIC',
      columnMapping: { ref: { column: 'REF' }, publicHt: { column: 'PUB' }, remise: { column: 'REM' } },
    };

    const a = resolveCanonicalInputs({ REF: 'bp-1', NET: '12.15' }, direct);
    const b = resolveCanonicalInputs({ REF: 'bp-1', GROS: '30.38', REM: '60' }, brut);
    const c = resolveCanonicalInputs({ REF: 'bp-1', PUB: '30.38', REM: '60' }, pub);

    expect(a.achatHtCents).toBe(1215);
    expect(b.achatHtCents).toBe(1215);
    expect(c.achatHtCents).toBe(1215);
    expect(a.ref).toBe('BP1'); // normalized
    expect(b.confidence).toBe('HIGH_CONFIDENCE');
  });

  it('decimalComma transform handles "30,38"', () => {
    const p: SupplierPriceProfile = {
      ...base,
      priceBasis: 'BRUT',
      derivation: 'REMISE_ON_BRUT',
      columnMapping: {
        ref: { column: 'REF' },
        grosHt: { column: 'GROS', transform: 'decimalComma' },
        remise: { column: 'REM', transform: 'percent' },
      },
    };
    expect(resolveCanonicalInputs({ REF: 'x', GROS: '30,38', REM: '60%' }, p).achatHtCents).toBe(1215);
  });

  it('MARGE_ON_NET passes marge through', () => {
    const p: SupplierPriceProfile = {
      ...base,
      priceBasis: 'NET',
      derivation: 'MARGE_ON_NET',
      columnMapping: { ref: { column: 'REF' }, achatHt: { column: 'NET' }, marge: { column: 'MRG' } },
    };
    const r = resolveCanonicalInputs({ REF: 'x', NET: '12.15', MRG: '54.6' }, p);
    expect(r.achatHtCents).toBe(1215);
    expect(r.margePct).toBe(54.6);
  });

  it('EAN fallback confidence when ref is empty', () => {
    const p: SupplierPriceProfile = {
      ...base,
      priceBasis: 'NET',
      derivation: 'DIRECT_NET',
      columnMapping: { ref: { column: 'REF' }, ean: { column: 'EAN' }, achatHt: { column: 'NET' } },
    };
    expect(resolveCanonicalInputs({ REF: '', EAN: '3401234567890', NET: '12.15' }, p).confidence).toBe(
      'EAN_FALLBACK',
    );
  });

  it('rejects missing required column (explicit, no guess)', () => {
    const p: SupplierPriceProfile = {
      ...base,
      priceBasis: 'BRUT',
      derivation: 'REMISE_ON_BRUT',
      columnMapping: { ref: { column: 'REF' }, grosHt: { column: 'GROS' }, remise: { column: 'REM' } },
    };
    expect(() => resolveCanonicalInputs({ REF: 'x', GROS: '30.38' }, p)).toThrow(ProfileError);
  });

  it('validateProfile rejects a non-whitelisted transform (anti-DSL)', () => {
    const bad = {
      ...base,
      priceBasis: 'NET' as const,
      derivation: 'DIRECT_NET' as const,
      columnMapping: { achatHt: { column: 'NET', transform: 'eval(x*2)' as never } },
    };
    expect(() => validateProfile(bad)).toThrow(/anti-DSL/);
  });

  describe('resolveProfile precedence', () => {
    const profiles: SupplierPriceProfile[] = [
      { ...base, id: 1, scopeLevel: 'SUPPLIER', scopeCode: null, priceBasis: 'NET', derivation: 'DIRECT_NET', columnMapping: {} },
      { ...base, id: 2, scopeLevel: 'FAMILY', scopeCode: 'F10', priceBasis: 'BRUT', derivation: 'REMISE_ON_BRUT', columnMapping: {} },
      { ...base, id: 3, scopeLevel: 'SUBFAMILY', scopeCode: 'S99', priceBasis: 'PUBLIC', derivation: 'REMISE_ON_PUBLIC', columnMapping: {} },
    ];
    it('SUBFAMILY beats FAMILY beats SUPPLIER', () => {
      expect(resolveProfile(profiles, { supplierId: 'SUP1', famCode: 'F10', sfamCode: 'S99' })?.id).toBe(3);
      expect(resolveProfile(profiles, { supplierId: 'SUP1', famCode: 'F10', sfamCode: 'OTHER' })?.id).toBe(2);
      expect(resolveProfile(profiles, { supplierId: 'SUP1', famCode: 'X', sfamCode: 'Y' })?.id).toBe(1);
    });
    it('returns null for an unknown supplier', () => {
      expect(resolveProfile(profiles, { supplierId: 'NOPE' })).toBeNull();
    });
  });
});
