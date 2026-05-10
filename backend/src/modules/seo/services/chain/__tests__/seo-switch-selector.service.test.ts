import {
  SeoSwitchError,
  SeoSwitchSelector,
} from '../seo-switch-selector.service';
import { SeoVariantFamilyRegistry } from '../../../registries/seo-variant-family.registry';

describe('SeoSwitchSelector', () => {
  let selector: SeoSwitchSelector;

  beforeEach(() => {
    selector = new SeoSwitchSelector(new SeoVariantFamilyRegistry());
  });

  describe('computeSeedIndex (pure)', () => {
    it('retourne un index dans [0, length)', () => {
      for (let len = 1; len < 50; len += 7) {
        const idx = selector.computeSeedIndex(
          { surfaceKey: 'R8_VEHICLE', pgId: 124, vehicleId: 12345, alias: 1 },
          len,
        );
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(len);
      }
    });

    it('est déterministe sur les mêmes inputs', () => {
      const a = selector.computeSeedIndex(
        {
          surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
          pgId: 7,
          vehicleId: 42,
          alias: 2,
        },
        20,
      );
      const b = selector.computeSeedIndex(
        {
          surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
          pgId: 7,
          vehicleId: 42,
          alias: 2,
        },
        20,
      );
      expect(a).toBe(b);
    });

    it('change si une dimension du seed change', () => {
      const base = {
        surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        pgId: 7,
        vehicleId: 42,
        alias: 2,
      };
      const v0 = selector.computeSeedIndex(base, 100);
      const v1 = selector.computeSeedIndex({ ...base, pgId: 8 }, 100);
      const v2 = selector.computeSeedIndex({ ...base, vehicleId: 43 }, 100);
      const v3 = selector.computeSeedIndex({ ...base, alias: 3 }, 100);
      const v4 = selector.computeSeedIndex(
        { ...base, surfaceKey: 'R8_VEHICLE' },
        100,
      );

      // Au moins 3 des 4 variations doivent différer du baseline (la collision
      // accidentelle modulo 100 reste possible ponctuellement).
      const distinctCount = new Set([v0, v1, v2, v3, v4]).size;
      expect(distinctCount).toBeGreaterThanOrEqual(4);
    });

    it('vehicleId/alias optionnels → seed stable même sans ces champs', () => {
      const a = selector.computeSeedIndex(
        { surfaceKey: 'R0_HOME', pgId: 0 },
        10,
      );
      const b = selector.computeSeedIndex(
        { surfaceKey: 'R0_HOME', pgId: 0, vehicleId: null, alias: null },
        10,
      );
      expect(a).toBe(b);
    });

    it('throw si length <= 0', () => {
      expect(() =>
        selector.computeSeedIndex({ surfaceKey: 'R0_HOME', pgId: 0 }, 0),
      ).toThrow(SeoSwitchError);
      expect(() =>
        selector.computeSeedIndex({ surfaceKey: 'R0_HOME', pgId: 0 }, -1),
      ).toThrow(SeoSwitchError);
    });

    it('distribution raisonnable sur 10000 seeds', () => {
      const length = 10;
      const buckets = new Array<number>(length).fill(0);
      for (let i = 0; i < 10_000; i++) {
        const idx = selector.computeSeedIndex(
          { surfaceKey: 'R8_VEHICLE', pgId: i, vehicleId: i * 31, alias: 1 },
          length,
        );
        buckets[idx]++;
      }
      // Avec sha256 + 10 buckets sur 10k tirages, écart-type attendu ~30
      // (espérance 1000 par bucket). Tolérance large : 700 ≤ b ≤ 1300.
      for (const count of buckets) {
        expect(count).toBeGreaterThanOrEqual(700);
        expect(count).toBeLessThanOrEqual(1300);
      }
    });
  });
});
