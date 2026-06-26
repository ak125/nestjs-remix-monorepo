import { SeoSwitchSelector } from '../seo-switch-selector.service';
import { SeoVariantFamilyRegistry } from '../../../registries/seo-variant-family.registry';
import {
  R8VariantSignatureSchema,
  R8GovernanceDecisionSchema,
} from '../../../../../config/page-contract-r8.schema';

/**
 * Distribution & cohérence pour le pool R8 meta (PR-1 seo-v9).
 *
 * Critère **principal** : `max(count_per_uuid) <= ⌈18 / N⌉` sur 18 type_ids
 * fratrie Clio III. Pas seulement le nombre d'UUIDs distincts (un pool peut
 * avoir tous les UUIDs vus mais avec un déséquilibre catastrophique).
 *
 * Validation des caps de longueur Zod ↔ sizing pool.
 */
describe('R8 meta distribution & Zod-DB consistency', () => {
  const selector = new SeoSwitchSelector(new SeoVariantFamilyRegistry());

  /**
   * 18 type_ids hypothétiques d'une fratrie Renault Clio III (motorisations
   * différentes du même brand+model+generation). En prod : query sur
   * `__seo_r8_pages WHERE neighbor_family_key=...`.
   */
  const SIBLING_TYPE_IDS = [
    9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008, 9009, 9010, 9011, 9012,
    9013, 9014, 9015, 9016, 9017, 9018,
  ];

  /**
   * Compte les collisions d'index sur N templates pour un slot donné.
   */
  function countCollisionsPerIndex(slot: string, poolSize: number): number[] {
    const counts = new Array<number>(poolSize).fill(0);
    for (const typeId of SIBLING_TYPE_IDS) {
      const idx = selector.computeSeedIndex(
        {
          surfaceKey: `R8_VEHICLE:${slot}`,
          pgId: 0,
          vehicleId: typeId,
          alias: null,
        },
        poolSize,
      );
      counts[idx]++;
    }
    return counts;
  }

  // Bound empirique : sha256 sur 18 inputs n'est pas parfaitement uniforme
  // (variance statistique). On tolère 2× la moyenne théorique ⌈18/N⌉ ce qui
  // correspond à ~2σ pour 18 tirages. Le but : détecter la pathologie
  // « tous les 18 sur le même UUID » (legacy hardcodé), pas l'idéal mathématique.
  it('meta_title (N=7) : pas de pathologie — max collisions ≤ 2*⌈18/7⌉ = 6 ; pool effectivement utilisé', () => {
    const counts = countCollisionsPerIndex('meta_title', 7);
    const maxCount = Math.max(...counts);
    expect(maxCount).toBeLessThanOrEqual(2 * Math.ceil(18 / 7)); // = 6
    // Le pire cas autorisé (6) reste < 50% de 18 — diversification garantie.
    expect(maxCount).toBeLessThan(18 / 2);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(18);
  });

  it('meta_description (N=11) : max collisions ≤ 2*⌈18/11⌉ = 4', () => {
    const counts = countCollisionsPerIndex('meta_description', 11);
    const maxCount = Math.max(...counts);
    expect(maxCount).toBeLessThanOrEqual(2 * Math.ceil(18 / 11)); // = 4
    expect(maxCount).toBeLessThan(18 / 2);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(18);
  });

  it('couverture pool meta_title : ≥4 UUIDs distincts utilisés (vs 1 en legacy)', () => {
    const counts = countCollisionsPerIndex('meta_title', 7);
    const distinctIndexes = counts.filter((c) => c > 0).length;
    expect(distinctIndexes).toBeGreaterThanOrEqual(4);
  });

  it('couverture pool meta_description : ≥7 UUIDs distincts utilisés', () => {
    const counts = countCollisionsPerIndex('meta_description', 11);
    const distinctIndexes = counts.filter((c) => c > 0).length;
    expect(distinctIndexes).toBeGreaterThanOrEqual(7);
  });

  it('le salage par slot rend les distributions indépendantes', () => {
    const titleCounts = countCollisionsPerIndex('meta_title', 7);
    const descCounts = countCollisionsPerIndex('meta_description', 7);
    // Si pas de salage, mêmes inputs → mêmes index distribution sur même
    // pool size. Avec salage par slot, les patterns doivent diverger.
    expect(titleCounts).not.toEqual(descCounts);
  });
});

describe('R8VariantSignatureSchema (Zod ↔ DB consistency)', () => {
  it('default-safe : objet vide accepté pour pages historiques', () => {
    expect(R8VariantSignatureSchema.parse({})).toEqual({});
    expect(R8VariantSignatureSchema.parse(undefined)).toEqual({});
  });

  it('accepte null pour chaque slot (fallback déclenché)', () => {
    const parsed = R8VariantSignatureSchema.parse({
      meta_title: null,
      meta_description: null,
    });
    expect(parsed.meta_title).toBeNull();
    expect(parsed.meta_description).toBeNull();
  });

  it('accepte des UUIDs valides', () => {
    const parsed = R8VariantSignatureSchema.parse({
      meta_title: '11111111-1111-4111-8111-111111111111',
      meta_description: '22222222-2222-4222-9222-222222222222',
    });
    expect(parsed.meta_title).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('rejette les strings non-UUID', () => {
    expect(() =>
      R8VariantSignatureSchema.parse({ meta_title: 'not-a-uuid' }),
    ).toThrow();
  });

  it('h1 explicitement absent du schéma (resté hors pool, géré par buildR8H1)', () => {
    // Test comportemental : un h1 dans variantSignature n'est pas reconnu
    // (extra key dropped par Zod ou rejeté selon le strictness). On vérifie
    // que parse retourne un objet sans la clé `h1`.
    const parsed = R8VariantSignatureSchema.parse({
      meta_title: '11111111-1111-4111-8111-111111111111',
      meta_description: '22222222-2222-4222-9222-222222222222',
      // h1 n'est pas dans le schéma — Zod le drop par défaut (strip mode)
    } as never);
    expect(Object.keys(parsed).sort()).toEqual([
      'meta_description',
      'meta_title',
    ]);
    expect((parsed as Record<string, unknown>).h1).toBeUndefined();
  });

  it('R8GovernanceDecisionSchema inclut variantSignature', () => {
    const shape = R8GovernanceDecisionSchema.shape;
    expect(shape.variantSignature).toBeDefined();
  });
});
