/**
 * L1 — Canon Formula Engine golden tests.
 *
 * Golden values are taken verbatim from the real `pieces_price` table
 * (reverse-engineering session). Each must reproduce to the cent.
 */
import {
  DEFAULT_TVA_RATE,
  PricingFormulaService,
  centsToEur,
  computeAchatHtCents,
  computeMargePct,
  computePriceChain,
  computeVenteHtCents,
  computeVenteTtcCents,
  eurToCents,
} from '../pricing-formula.service';

describe('PricingFormulaService — L1 canon formula (golden, real data)', () => {
  describe('eur <-> cents', () => {
    it('converts without float drift', () => {
      expect(eurToCents(12.15)).toBe(1215);
      expect(eurToCents(274.51)).toBe(27451);
      expect(eurToCents(0.1)).toBe(10);
      expect(centsToEur(1878)).toBe(18.78);
    });
  });

  describe('computeAchatHtCents — achat = gros × (1 − remise/100)', () => {
    it.each([
      // [gros €, remise %, expected achat €]
      [30.38, 60, 12.15],
      [99.42, 73, 26.84],
      [25.81, 71, 7.48],
      [357, 50, 178.5],
      [32.21, 0, 32.21], // remise 0
    ])(
      'gros %s €, remise %s%% → achat %s €',
      (grosEur, remise, expectedEur) => {
        expect(computeAchatHtCents(eurToCents(grosEur), remise)).toBe(
          eurToCents(expectedEur),
        );
      },
    );
  });

  describe('computeVenteHtCents — vente_HT = round(achat × (1 + marge/100))', () => {
    it.each([
      // [achat €, marge %, expected vente_HT €]
      [12.15, 54.6, 18.78],
      [26.84, 51.8, 40.74],
      [274.51, 28.15, 351.78],
      [32.21, 50.6, 48.51],
      [7.48, 61.95, 12.11],
      [178.5, 31.27, 234.32],
      [50, 0, 50], // marge 0
    ])(
      'achat %s €, marge %s%% → vente_HT %s €',
      (achatEur, marge, expectedEur) => {
        expect(computeVenteHtCents(eurToCents(achatEur), marge)).toBe(
          eurToCents(expectedEur),
        );
      },
    );
  });

  describe('computeVenteTtcCents — (vente_HT + frais) × (1 + tva)', () => {
    it.each([
      // [vente_HT €, frais_port €, frais_supp €, tva, expected TTC €]
      [90.97, 1.45, 0, 0.2, 110.9],
      [18.17, 1.34, 0, 0.2, 23.41],
      [155.46, 1.34, 0, 0.2, 188.16],
      [72.33, 1.45, 0, 0.2, 88.54],
    ])(
      'vente_HT %s € + frais %s € (tva %s) → TTC %s €',
      (venteHtEur, fraisPortEur, fraisSuppEur, tva, expectedEur) => {
        expect(
          computeVenteTtcCents(
            eurToCents(venteHtEur),
            eurToCents(fraisPortEur),
            eurToCents(fraisSuppEur),
            tva,
          ),
        ).toBe(eurToCents(expectedEur));
      },
    );

    it('defaults tva to 0.2', () => {
      expect(computeVenteTtcCents(eurToCents(90.97), eurToCents(1.45))).toBe(
        eurToCents(110.9),
      );
      expect(DEFAULT_TVA_RATE).toBe(0.2);
    });
  });

  describe('computeMargePct — taux de marge (markup on cost)', () => {
    it('recomputes markup-on-cost from the rounded chain', () => {
      // achat 12.15 → vente_HT 18.78 ⇒ (663/1215)*100 ≈ 54.57 (input marge was 54.6)
      expect(computeMargePct(1215, 1878)).toBeCloseTo(54.57, 2);
    });
    it('is markup-on-cost, NOT margin-on-sale', () => {
      // markup = (1878-1215)/1215 ≈ 54.57% ; marque = (1878-1215)/1878 ≈ 35.30%
      expect(computeMargePct(1215, 1878)).toBeGreaterThan(50);
    });
    it('returns 0 when achat ≤ 0 (no division by zero)', () => {
      expect(computeMargePct(0, 1878)).toBe(0);
      expect(computeMargePct(-100, 1878)).toBe(0);
    });
  });

  describe('computePriceChain — full chain end to end (real row)', () => {
    it('achat 12.15 €, marge 54.6, frais_port 1.34 € → vente_HT 18.78 €, recomputes markup', () => {
      const chain = computePriceChain({
        achatHtCents: eurToCents(12.15),
        margePct: 54.6,
        fraisPortHtCents: eurToCents(1.34),
      });
      expect(chain.venteHtCents).toBe(eurToCents(18.78));
      expect(chain.venteTtcCents).toBe(
        computeVenteTtcCents(eurToCents(18.78), eurToCents(1.34)),
      );
      expect(chain.margePct).toBeCloseTo(54.57, 2);
    });
  });

  describe('PricingFormulaService DI wrapper delegates to pure fns', () => {
    const svc = new PricingFormulaService();
    it('exposes the same computation', () => {
      expect(svc.computeVenteHtCents(eurToCents(274.51), 28.15)).toBe(
        eurToCents(351.78),
      );
      expect(svc.defaultTvaRate).toBe(0.2);
    });
  });
});
