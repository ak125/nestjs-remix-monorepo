import {
  DEFAULT_MAX_MARGE_PCT,
  PricingInvariantError,
  assertValidPriceChain,
  validatePriceChain,
  type PriceChainForValidation,
} from '../pricing-invariants.service';

const validChain: PriceChainForValidation = {
  achatHtCents: 1215,
  venteHtCents: 1878,
  venteTtcCents: 2414,
  margePct: 54.57,
  tvaRate: 0.2,
};

describe('PricingInvariants — L2', () => {
  it('accepts a valid legacy chain', () => {
    expect(validatePriceChain(validChain)).toEqual([]);
    expect(() => assertValidPriceChain(validChain)).not.toThrow();
  });

  it('accepts the calibrated reality: 500% markup on cheap parts (MAX_MARGE ≥ 600)', () => {
    expect(DEFAULT_MAX_MARGE_PCT).toBeGreaterThanOrEqual(600);
    const cheap: PriceChainForValidation = {
      achatHtCents: 200,
      venteHtCents: 1200, // +500%
      venteTtcCents: 1440,
      margePct: 500,
      tvaRate: 0.2,
    };
    expect(validatePriceChain(cheap)).toEqual([]);
  });

  it.each<[string, PriceChainForValidation, string]>([
    ['negative price', { ...validChain, venteHtCents: -1 }, 'NON_FINITE_OR_NEGATIVE'],
    ['non-finite', { ...validChain, venteTtcCents: NaN }, 'NON_FINITE_OR_NEGATIVE'],
    ['achat ≤ 0', { ...validChain, achatHtCents: 0 }, 'ACHAT_NOT_POSITIVE'],
    ['vente < achat', { ...validChain, achatHtCents: 2000 }, 'VENTE_BELOW_ACHAT'],
    ['marge ×10 absurd', { ...validChain, margePct: 1200 }, 'MARGE_EXCEEDS_MAX'],
    ['tva not whitelisted', { ...validChain, tvaRate: 0.33 }, 'TVA_NOT_WHITELISTED'],
  ])('rejects %s → %s', (_label, chain, expectedCode) => {
    const codes = validatePriceChain(chain).map((v) => v.code);
    expect(codes).toContain(expectedCode);
  });

  describe('delta guard', () => {
    it('rejects a >30% jump vs current price', () => {
      const codes = validatePriceChain({ ...validChain, currentVenteHtCents: 1000 }).map((v) => v.code);
      expect(codes).toContain('DELTA_EXCEEDS_MAX'); // 1878 vs 1000 = +87.8%
    });
    it('allows a deliberate grid shift via override', () => {
      const codes = validatePriceChain(
        { ...validChain, currentVenteHtCents: 1000 },
        { allowDeltaOverride: true },
      ).map((v) => v.code);
      expect(codes).not.toContain('DELTA_EXCEEDS_MAX');
    });
    it('passes a small delta', () => {
      expect(validatePriceChain({ ...validChain, currentVenteHtCents: 1850 })).toEqual([]);
    });
  });

  it('assertValidPriceChain throws PricingInvariantError carrying all violations', () => {
    try {
      assertValidPriceChain({ achatHtCents: 0, venteHtCents: 100, venteTtcCents: 120, margePct: 5, tvaRate: 0.99 });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PricingInvariantError);
      const codes = (e as PricingInvariantError).violations.map((v) => v.code);
      expect(codes).toEqual(expect.arrayContaining(['ACHAT_NOT_POSITIVE', 'TVA_NOT_WHITELISTED']));
    }
  });
});
