import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ACCESS_STATES,
  CreatePriceRuleSchema,
  CreateSupplierCardSchema,
  ORDER_MODES,
  SUPPLIER_CARD_FIELD_TO_COLUMN,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  SUPPLY_MODES,
  UpdateSupplierCardSchema,
} from './supplier.schemas';
import { SUPPLIER_CARD_COLUMNS } from '../../supplier-truth';

const MIGRATION = readFileSync(
  join(
    __dirname,
    '../../../../supabase/migrations/20261118_xtr_supplier_fiche_columns.sql',
  ),
  'utf8',
);

/** Valeurs du CHECK `IN (...)` d'une colonne dans la migration. */
function sqlEnum(column: string): string[] {
  const re = new RegExp(`CHECK \\(${column} IN \\(([^)]*)\\)`);
  const m = MIGRATION.match(re);
  if (!m) throw new Error(`CHECK IN introuvable pour ${column}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

describe('alignement schémas ↔ migration', () => {
  it.each([
    ['spl_type', SUPPLIER_TYPES],
    ['spl_status', SUPPLIER_STATUSES],
    ['spl_supply_mode', SUPPLY_MODES],
    ['spl_order_mode', ORDER_MODES],
    ['spl_access_state', ACCESS_STATES],
  ])('%s : mêmes valeurs que le CHECK SQL', (column, values) => {
    expect(sqlEnum(column)).toEqual([...values]);
  });

  it('chaque champ saisi a sa colonne lue par le dépôt et créée par la migration', () => {
    for (const column of Object.values(SUPPLIER_CARD_FIELD_TO_COLUMN)) {
      expect(SUPPLIER_CARD_COLUMNS).toContain(column);
      if (!['spl_name', 'spl_alias'].includes(column)) {
        expect(MIGRATION).toContain(`ADD COLUMN IF NOT EXISTS ${column} `);
      }
    }
  });
});

describe('CreateSupplierCardSchema', () => {
  it('accepte une fiche complète et normalise les vides', () => {
    const v = CreateSupplierCardSchema.parse({
      name: '  DCA ',
      type: 'plateforme',
      email: 'contact@example.test',
      website: '',
      country: 'fr',
      supplyMode: 'flux_tendu',
      francoHtCents: '15000',
      deliveryDelayDays: 1,
      orderMode: 'portail',
      portalUrl: 'https://portail.example.test',
      secretName: 'SUPPLIER_DCA_PASSWORD',
    });
    expect(v).toMatchObject({
      name: 'DCA',
      website: null,
      country: 'FR',
      francoHtCents: 15000,
      secretName: 'SUPPLIER_DCA_PASSWORD',
    });
  });

  it('exige un nom', () => {
    expect(CreateSupplierCardSchema.safeParse({ name: ' ' }).success).toBe(
      false,
    );
  });

  it.each([
    ['clé inconnue (valeur de secret)', { secretValue: 'hunter2' }],
    ['état d’accès (connecteur seul)', { accessState: 'verifie' }],
    [
      'validation de localisation (action dédiée)',
      { locationValidatedBy: 'x' },
    ],
    ['valeur à la place du nom de secret', { secretName: 'p@ssw0rd!' }],
    ['nom de secret en minuscules', { secretName: 'supplier_dca' }],
    ['URL javascript:', { website: 'javascript:alert(1)' }],
    ['pays sur 3 lettres', { country: 'FRA' }],
    ['franco négatif', { francoHtCents: -1 }],
    ['franco décimal', { francoHtCents: 12.5 }],
    ['délai au-delà d’un an', { deliveryDelayDays: 400 }],
    ['statut à la création', { status: 'actif' }],
    ['type hors liste', { type: 'grossiste' }],
    ['mode hors liste', { supplyMode: 'express' }],
  ])('refuse : %s', (_label, extra) => {
    expect(
      CreateSupplierCardSchema.safeParse({ name: 'X', ...extra }).success,
    ).toBe(false);
  });
});

describe('UpdateSupplierCardSchema', () => {
  it('mise à jour partielle : seules les clés présentes ressortent', () => {
    expect(UpdateSupplierCardSchema.parse({ city: 'Gennevilliers' })).toEqual({
      city: 'Gennevilliers',
    });
  });

  it('une chaîne vide efface la colonne (null)', () => {
    expect(UpdateSupplierCardSchema.parse({ phone: '' })).toEqual({
      phone: null,
    });
  });

  it('refuse le passage à archive (retrait dédié)', () => {
    expect(
      UpdateSupplierCardSchema.safeParse({ status: 'archive' }).success,
    ).toBe(false);
    expect(UpdateSupplierCardSchema.parse({ status: 'occasionnel' })).toEqual({
      status: 'occasionnel',
    });
  });

  it('refuse un corps vide', () => {
    expect(UpdateSupplierCardSchema.safeParse({}).success).toBe(false);
  });
});

describe('CreatePriceRuleSchema (complément CH-2)', () => {
  const PROFILES_TABLE = readFileSync(
    join(
      __dirname,
      '../../../../supabase/migrations/20260522_pricing_control_plane_v1.sql',
    ),
    'utf8',
  );
  const levels = [
    ...(
      PROFILES_TABLE.match(/scope_level\s+TEXT[^\n]*IN \(([^)]*)\)/)?.[1] ?? ''
    ).matchAll(/'([^']+)'/g),
  ].map((m) => m[1]);
  const ok = (v: unknown) => CreatePriceRuleSchema.safeParse(v);
  const issues = (v: unknown) => {
    const r = ok(v);
    return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
  };

  it('accepte chaque niveau du CHECK SQL de scope_level', () => {
    expect(levels).toEqual(['SUPPLIER', 'BRAND', 'FAMILY', 'SUBFAMILY']);
    const sample: Record<string, object> = {
      SUPPLIER: {},
      BRAND: { brandPmId: '1200' },
      FAMILY: { scopeCode: 'NU17' },
      SUBFAMILY: { brandPmId: '1200', scopeCode: '1738' },
    };
    for (const scopeLevel of levels) {
      expect(
        ok({ scopeLevel, remisePct: 10, ...sample[scopeLevel] }).success,
      ).toBe(true);
    }
  });

  it('SEIM × câbles : code mis en majuscules, pourcentage à virgule', () => {
    const r = ok({
      scopeLevel: 'FAMILY',
      brandPmId: 1200,
      scopeCode: ' nu17 ',
      remisePct: '32,5',
      margePct: '',
      effectiveFrom: '2026-12-01',
      effectiveTo: '2027-01-01',
    });
    expect(r.success && r.data).toEqual({
      scopeLevel: 'FAMILY',
      brandPmId: '1200',
      scopeCode: 'NU17',
      remisePct: 32.5,
      margePct: null,
      effectiveFrom: '2026-12-01',
      effectiveTo: '2027-01-01',
    });
  });

  it.each([
    [
      'fournisseur avec marque',
      { scopeLevel: 'SUPPLIER', brandPmId: '10' },
      'brandPmId',
    ],
    ['marque sans marque', { scopeLevel: 'BRAND' }, 'brandPmId'],
    [
      'marque avec code',
      { scopeLevel: 'BRAND', brandPmId: '10', scopeCode: 'NU17' },
      'scopeCode',
    ],
    [
      'fournisseur avec code',
      { scopeLevel: 'SUPPLIER', scopeCode: 'NU17' },
      'scopeCode',
    ],
    ['famille sans code', { scopeLevel: 'FAMILY' }, 'scopeCode'],
    [
      'marque donnée par son nom',
      { scopeLevel: 'BRAND', brandPmId: 'SEIM' },
      'brandPmId',
    ],
    [
      'code avec espace interne',
      { scopeLevel: 'FAMILY', scopeCode: 'NU 17' },
      'scopeCode',
    ],
    ['remise > 100', { scopeLevel: 'SUPPLIER', remisePct: 120 }, 'remisePct'],
    ['remise négative', { scopeLevel: 'SUPPLIER', remisePct: -1 }, 'remisePct'],
    [
      'trois décimales',
      { scopeLevel: 'SUPPLIER', remisePct: 1.234 },
      'remisePct',
    ],
    [
      'période inversée',
      {
        scopeLevel: 'SUPPLIER',
        effectiveFrom: '2026-12-31',
        effectiveTo: '2026-12-01',
      },
      'effectiveTo',
    ],
    [
      'période vide',
      {
        scopeLevel: 'SUPPLIER',
        effectiveFrom: '2026-12-01',
        effectiveTo: '2026-12-01',
      },
      'effectiveTo',
    ],
    [
      'date inexistante',
      { scopeLevel: 'SUPPLIER', effectiveFrom: '2026-02-30' },
      'effectiveFrom',
    ],
    ['clé inconnue', { scopeLevel: 'SUPPLIER', active: false }, ''],
  ])('refuse : %s', (_label, input, path) => {
    expect(issues({ remisePct: 10, ...input })).toContain(path);
  });

  it('exige une remise ou une marge', () => {
    expect(issues({ scopeLevel: 'SUPPLIER' })).toEqual(['remisePct']);
    expect(ok({ scopeLevel: 'SUPPLIER', margePct: '35' }).success).toBe(true);
  });
});
