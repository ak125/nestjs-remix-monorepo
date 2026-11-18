/**
 * Non-régression de l'import tarifaire (complément CH-2).
 *
 * Les règles de remise saisies sur la fiche vivent dans supplier_price_profiles,
 * que l'import lit via `resolveProfile(profiles, { supplierId })` (PricingModule,
 * non modifié). Ce test écrit des règles par le vrai service de la fiche, puis
 * passe toutes les lignes au vrai `resolveProfile` : quelle que soit la ligne
 * retenue, les paramètres de lecture du fichier (base de prix, dérivation, clé,
 * colonnes) restent ceux du profil d'import de base.
 */
import {
  resolveProfile,
  type SupplierPriceProfile,
} from '../../src/modules/pricing/services/supplier-profile.service';
import { SupplierCardService } from '../../src/modules/suppliers/supplier-card.service';
import type {
  SupplierCardRepository,
  SupplierPriceProfileRow,
} from '../../src/modules/supplier-truth';

const BASE: SupplierPriceProfileRow = {
  id: 4,
  supplier_id: '71',
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
};

function toEngine(r: SupplierPriceProfileRow): SupplierPriceProfile {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    scopeLevel: r.scope_level as SupplierPriceProfile['scopeLevel'],
    scopeCode: r.scope_code,
    priceBasis: r.price_basis as SupplierPriceProfile['priceBasis'],
    derivation: r.derivation as SupplierPriceProfile['derivation'],
    columnMapping: r.column_mapping as SupplierPriceProfile['columnMapping'],
    keyField: r.key_field as SupplierPriceProfile['keyField'],
    version: Number(r.version),
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    active: r.active,
  };
}

const importParams = (p: SupplierPriceProfile | null) =>
  p && {
    priceBasis: p.priceBasis,
    derivation: p.derivation,
    keyField: p.keyField,
    columnMapping: p.columnMapping,
  };

it('les règles de la fiche ne changent pas les paramètres lus par l’import', async () => {
  const rows: SupplierPriceProfileRow[] = [BASE];
  const repo = {
    getCard: jest.fn().mockResolvedValue({ spl_id: '71' }),
    getLinkedBrands: jest
      .fn()
      .mockResolvedValue([
        { linkId: '1', pmId: 1200, brandName: 'SEIM', linkDisplayed: true },
      ]),
    getPriceProfiles: jest.fn(async () => rows.map((r) => ({ ...r }))),
    setPriceProfileActive: jest.fn(
      async (_s: string, id: number, active: boolean) => {
        const r = rows.find((x) => x.id === id);
        if (r) r.active = active;
        return Boolean(r);
      },
    ),
    insertPriceProfile: jest.fn(
      async (
        r: Omit<SupplierPriceProfileRow, 'id' | 'created_at' | 'active'>,
      ) => {
        const created = {
          ...r,
          id: 100 + rows.length,
          active: true,
          created_at: '2026-11-18T00:00:00Z',
        };
        rows.push(created);
        return created;
      },
    ),
  };
  const service = new SupplierCardService(
    repo as unknown as SupplierCardRepository,
  );

  await service.createPriceRule(
    '71',
    { scopeLevel: 'SUPPLIER', remisePct: 10 },
    'u',
  );
  await service.createPriceRule(
    '71',
    { scopeLevel: 'BRAND', brandPmId: '1200', remisePct: 25 },
    'u',
  );
  await service.createPriceRule(
    '71',
    {
      scopeLevel: 'BRAND',
      brandPmId: '1200',
      remisePct: 35,
      effectiveFrom: '2026-12-01',
      effectiveTo: '2027-01-01',
    },
    'u',
  );
  await service.createPriceRule(
    '71',
    {
      scopeLevel: 'FAMILY',
      brandPmId: '1200',
      scopeCode: 'NU17',
      remisePct: 50,
    },
    'u',
  );

  // Le profil de base a été versionné (remise posée), jamais laissé sans
  // remplaçant actif.
  expect(rows.filter((r) => r.active).map((r) => r.scope_level)).toEqual([
    'SUPPLIER',
    'BRAND',
    'BRAND',
    'FAMILY',
  ]);

  const engine = rows.map(toEngine);
  for (const at of [
    new Date('2026-11-18T12:00:00Z'),
    new Date('2026-12-10T12:00:00Z'),
    new Date('2027-02-01T12:00:00Z'),
  ]) {
    const chosen = resolveProfile(engine, { supplierId: '71', at });
    expect(chosen).not.toBeNull();
    expect(importParams(chosen)).toEqual(importParams(toEngine(BASE)));
  }
});
