import {
  enrichTypeNameForHeadings,
  isTypeNameAmbiguousForSeo,
  type VehicleLabelInput,
} from '../vehicle-aware-label.composer';

describe('vehicle-aware-label.composer', () => {
  describe('FIXTURES audit 2026-05-26 (audit/seo-h1-meta-empirical-verification-2026-05-26.md)', () => {
    it('FIXTURE #1 EXACT — C5 III 2.0 HDi 140 ch vs 163 ch (lev=0, jaccard=1)', () => {
      const a = enrichTypeNameForHeadings({
        typeName: '2.0 HDi',
        powerPs: '140',
        fuel: 'Diesel',
      });
      const b = enrichTypeNameForHeadings({
        typeName: '2.0 HDi',
        powerPs: '163',
        fuel: 'Diesel',
      });
      expect(a.value).not.toEqual(b.value);
      expect(a.value).toBe('2.0 HDi 140 ch');
      expect(b.value).toBe('2.0 HDi 163 ch');
      expect(a.isEnriched).toBe(true);
      expect(b.isEnriched).toBe(true);
    });

    it('FIXTURE #2 — 1.4 HDI Diesel 69 ch (fuel implicite HDI, no Diesel duplication)', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '1.4 HDI',
        powerPs: '69',
        fuel: 'Diesel',
      });
      expect(r.value).toBe('1.4 HDI 69 ch'); // fuel "Diesel" non-ajouté car HDI implicite
      expect(r.isEnriched).toBe(true);
    });

    it('FIXTURE #2 bis — 1.4 Essence 75 ch (fuel explicite ajouté)', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '1.4',
        powerPs: '75',
        fuel: 'Essence',
      });
      expect(r.value).toBe('1.4 Essence 75 ch');
      expect(r.isEnriched).toBe(true);
    });

    it('FIXTURE #3 — 206 1.1 60 ch vs 1.4 75 ch (displacement disambiguation)', () => {
      const a = enrichTypeNameForHeadings({
        typeName: '1.1',
        powerPs: '60',
        fuel: 'Essence',
      });
      const b = enrichTypeNameForHeadings({
        typeName: '1.4',
        powerPs: '75',
        fuel: 'Essence',
      });
      expect(a.value).not.toEqual(b.value);
      expect(a.value).toBe('1.1 Essence 60 ch');
      expect(b.value).toBe('1.4 Essence 75 ch');
    });
  });

  describe('Sport trim & extended fuel coverage', () => {
    it('enriches short sport trims such as "2.0 RC" with power_ps', () => {
      // Deux 2.0 RC à puissances ≠ peuvent coexister (ex. PEUGEOT 207 RC)
      const r = enrichTypeNameForHeadings({
        typeName: '2.0 RC',
        powerPs: '177',
      });
      expect(r.value).toBe('2.0 RC 177 ch');
      expect(r.isEnriched).toBe(true);
    });

    it('enriches TDCI (Ford) with power_ps without adding fuel', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '1.4 TDCI',
        powerPs: '90',
        fuel: 'Diesel',
      });
      expect(r.value).toBe('1.4 TDCI 90 ch');
      expect(r.isEnriched).toBe(true);
    });

    it('enriches CRDI (Hyundai/Kia) with power_ps without adding fuel', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '1.6 CRDI',
        powerPs: '115',
        fuel: 'Diesel',
      });
      expect(r.value).toBe('1.6 CRDI 115 ch');
      expect(r.isEnriched).toBe(true);
    });
  });

  describe('Idempotency & normalization', () => {
    it('is idempotent when type_name already contains power_ps " ch"', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '2.0 HDi 140 ch',
        powerPs: '140',
      });
      expect(r).toEqual({ value: '2.0 HDi 140 ch', isEnriched: false });
    });

    it('normalizes powerPs when input includes " ch" suffix (no "ch ch")', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '2.0 HDi',
        powerPs: '140 ch',
      });
      expect(r.value).toBe('2.0 HDi 140 ch');
      expect(r.isEnriched).toBe(true);
    });

    it('handles whitespace-only powerPs as absent', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '2.0 HDi',
        powerPs: '   ',
      });
      expect(r).toEqual({ value: '2.0 HDi', isEnriched: false });
    });
  });

  describe('No-op cases (zero-regression guarantee)', () => {
    it('returns baseline when powerPs is undefined', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '2.0 HDi',
      });
      expect(r).toEqual({ value: '2.0 HDi', isEnriched: false });
    });

    it('returns empty when typeName is empty', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '',
        powerPs: '140',
      });
      expect(r).toEqual({ value: '', isEnriched: false });
    });

    it('returns empty when input is fully empty', () => {
      const r = enrichTypeNameForHeadings({});
      expect(r).toEqual({ value: '', isEnriched: false });
    });

    it('does not enrich non-displacement labels (GTI, Hybrid Touring, 4x4 Limited)', () => {
      expect(
        enrichTypeNameForHeadings({ typeName: 'GTI', powerPs: '180' }),
      ).toEqual({ value: 'GTI', isEnriched: false });
      expect(
        enrichTypeNameForHeadings({ typeName: 'Hybrid Touring', powerPs: '180' }),
      ).toEqual({ value: 'Hybrid Touring', isEnriched: false });
      expect(
        enrichTypeNameForHeadings({ typeName: '4x4 Limited', powerPs: '180' }),
      ).toEqual({ value: '4x4 Limited', isEnriched: false });
    });

    it('does not enrich "1.4 HDI 16V" (3 parts) — fallback safe', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '1.4 HDI 16V',
        powerPs: '90',
      });
      expect(r).toEqual({ value: '1.4 HDI 16V', isEnriched: false });
    });

    it('does not enrich "2.0i" (no space before abbrev) — fallback safe', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '2.0i',
        powerPs: '140',
      });
      expect(r).toEqual({ value: '2.0i', isEnriched: false });
    });
  });

  describe('Determinism', () => {
    it('produces same output for same input across multiple calls', () => {
      const input: VehicleLabelInput = {
        typeName: '2.0 HDi',
        powerPs: '140',
        fuel: 'Diesel',
      };
      const a = enrichTypeNameForHeadings(input);
      const b = enrichTypeNameForHeadings(input);
      const c = enrichTypeNameForHeadings(input);
      expect(a).toEqual(b);
      expect(b).toEqual(c);
    });
  });

  describe('Pattern regex coverage (matches)', () => {
    it.each([
      '2.0',
      '1.4',
      '2,0', // virgule décimale FR
      '3.0 V6',
      '1.6 TDI',
      '2.0 RC',
      '1.0',
      '5.0 V10',
    ])('matches "%s" as ambiguous when power_ps is present', (typeName) => {
      expect(isTypeNameAmbiguousForSeo(typeName, '100')).toBe(true);
    });

    it('matches "2,0 HDi" (FR comma + abbrev) and enriches correctly', () => {
      const r = enrichTypeNameForHeadings({
        typeName: '2,0 HDi',
        powerPs: '140',
      });
      expect(r.value).toBe('2,0 HDi 140 ch');
      expect(r.isEnriched).toBe(true);
    });
  });

  describe('Pattern regex coverage (non-matches)', () => {
    it.each([
      'GTI',
      'Hybrid Touring',
      '4x4 Limited',
      '1.4 HDI 16V',
      '2.0i',
      'Dynamique Cuir',
      '',
    ])('does not match "%s" as ambiguous', (typeName) => {
      expect(isTypeNameAmbiguousForSeo(typeName, '100')).toBe(false);
    });
  });
});
