/**
 * Non-régression de l'import tarifaire (compléments CH-2 et CH-3).
 *
 * Les conditions de remise de la fiche vivent dans supplier_price_profiles
 * avec profile_kind = 'condition', sans paramètre d'import. L'import lit les
 * profils par `PricingRepository.fetchProfiles` puis `resolveProfile`
 * (PricingModule). Ce test écrit des conditions par le vrai service de la
 * fiche, puis lit la même table par le vrai `fetchProfiles` (client Supabase
 * simulé qui applique les filtres) et le vrai `resolveProfile` : la ligne
 * retenue est toujours le profil d'import, jamais une condition.
 */
import { ConfigService } from '@nestjs/config';
import { PricingRepository } from '../../src/modules/pricing/services/pricing.repository';
import { resolveProfile } from '../../src/modules/pricing/services/supplier-profile.service';
import { SupplierCardService } from '../../src/modules/suppliers/supplier-card.service';
import type {
  SupplierCardRepository,
  SupplierPriceConditionPut,
  SupplierPriceProfileRow,
} from '../../src/modules/supplier-truth';

const IMPORT: SupplierPriceProfileRow = {
  id: 4,
  supplier_id: '71',
  profile_kind: 'import',
  scope_level: 'SUPPLIER',
  scope_code: null,
  brand_pm_id: null,
  price_basis: 'BRUT',
  derivation: 'REMISE_ON_BRUT',
  key_field: 'REF',
  column_mapping: { ref: { column: 'A' }, brut: { column: 'C' } },
  version: 3,
  effective_from: null,
  effective_to: null,
  active: true,
  created_by: 'import',
  change_reason: 'profil initial',
  created_at: '2026-11-01T00:00:00Z',
  default_remise_pct: null,
  default_marge_pct: null,
  retired_at: null,
  retired_by: null,
};

/** Client Supabase en mémoire : from(table).select().eq(...)… → lignes filtrées. */
function fakeSupabase(rows: SupplierPriceProfileRow[]) {
  return {
    from: (table: string) => {
      expect(table).toBe('supplier_price_profiles');
      const filters: Array<[string, unknown]> = [];
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          return chain;
        },
        then: (
          ok: (r: { data: unknown[]; error: null }) => unknown,
          ko?: (e: unknown) => unknown,
        ) =>
          Promise.resolve({
            data: rows
              .filter((r) =>
                filters.every(
                  ([c, v]) =>
                    (r as unknown as Record<string, unknown>)[c] === v,
                ),
              )
              .map((r) => ({ ...r })),
            error: null,
          }).then(ok, ko),
      };
      return chain;
    },
  };
}

const cfgStub = {
  get: (k: string) =>
    (
      ({
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      }) as Record<string, string>
    )[k],
} as unknown as ConfigService;

it('une condition de la fiche n’est jamais prise pour un profil d’import', async () => {
  const rows: SupplierPriceProfileRow[] = [{ ...IMPORT }];
  // Écriture d'une condition, avec la sémantique de supplier_price_condition_put
  // (même clé : l'ancienne version est retirée, la nouvelle insérée).
  const putPriceCondition = jest.fn(async (c: SupplierPriceConditionPut) => {
    const same = (r: SupplierPriceProfileRow) =>
      r.profile_kind === 'condition' &&
      r.brand_pm_id === c.brandPmId &&
      r.scope_level === c.scopeLevel &&
      r.scope_code === c.scopeCode &&
      r.effective_from === c.effectiveFrom &&
      r.effective_to === c.effectiveTo;
    const replaced = rows.find((r) => same(r) && r.active) ?? null;
    if (replaced) {
      replaced.active = false;
      replaced.retired_at = '2026-11-18T12:00:00Z';
      replaced.retired_by = c.by;
    }
    const version = 1 + Math.max(0, ...rows.filter(same).map((r) => r.version));
    const id = 100 + rows.length;
    rows.push({
      id,
      supplier_id: c.supplierId,
      profile_kind: 'condition',
      scope_level: c.scopeLevel,
      scope_code: c.scopeCode,
      brand_pm_id: c.brandPmId,
      price_basis: null,
      derivation: null,
      key_field: null,
      column_mapping: null,
      version,
      effective_from: c.effectiveFrom,
      effective_to: c.effectiveTo,
      active: true,
      created_by: c.by,
      change_reason: c.changeReason,
      created_at: '2026-11-18T00:00:00Z',
      default_remise_pct: c.remisePct,
      default_marge_pct: c.margePct,
      retired_at: null,
      retired_by: null,
    });
    return { id, version, replacedId: replaced?.id ?? null };
  });
  const cards = {
    getCard: jest.fn().mockResolvedValue({ spl_id: '71' }),
    getLinkedBrands: jest
      .fn()
      .mockResolvedValue([
        { linkId: '1', pmId: 1200, brandName: 'SEIM', linkDisplayed: true },
      ]),
    putPriceCondition,
  };
  const service = new SupplierCardService(
    cards as unknown as SupplierCardRepository,
  );

  for (const dto of [
    { scopeLevel: 'SUPPLIER' as const, remisePct: 10 },
    { scopeLevel: 'SUPPLIER' as const, remisePct: 12 },
    { scopeLevel: 'BRAND' as const, brandPmId: '1200', remisePct: 25 },
    {
      scopeLevel: 'BRAND' as const,
      brandPmId: '1200',
      remisePct: 35,
      effectiveFrom: '2026-12-01',
      effectiveTo: '2027-01-01',
    },
    {
      scopeLevel: 'FAMILY' as const,
      brandPmId: '1200',
      scopeCode: 'NU17',
      remisePct: 50,
    },
    { scopeLevel: 'SUBFAMILY' as const, scopeCode: '1738', margePct: 20 },
  ])
    await service.createPriceRule('71', dto, 'u');

  // Cinq conditions actives à côté du profil d'import, qui n'a pas bougé.
  expect(
    rows.filter((r) => r.active && r.profile_kind === 'condition'),
  ).toHaveLength(5);
  expect(rows[0]).toEqual(IMPORT);

  const pricing = new PricingRepository(cfgStub);
  Object.defineProperty(pricing, 'supabase', {
    get: () => fakeSupabase(rows),
    configurable: true,
  });
  const profiles = await pricing.fetchProfiles('71');
  expect(profiles.map((p) => p.id)).toEqual([IMPORT.id]);

  for (const at of [
    new Date('2026-11-18T12:00:00Z'),
    new Date('2026-12-10T12:00:00Z'),
    new Date('2027-02-01T12:00:00Z'),
  ]) {
    for (const ctx of [
      {},
      { famCode: 'NU17' },
      { famCode: 'NU17', sfamCode: '1738' },
    ]) {
      const chosen = resolveProfile(profiles, { supplierId: '71', at, ...ctx });
      expect(chosen).toMatchObject({
        id: IMPORT.id,
        priceBasis: 'BRUT',
        derivation: 'REMISE_ON_BRUT',
        keyField: 'REF',
        columnMapping: IMPORT.column_mapping,
      });
    }
  }
});
