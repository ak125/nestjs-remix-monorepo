import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ACCESS_STATES,
  CreateSupplierCardSchema,
  ORDER_MODES,
  SUPPLIER_CARD_FIELD_TO_COLUMN,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  SUPPLY_MODES,
  UpdateSupplierCardSchema,
} from './supplier.schemas';
import { SUPPLIER_CARD_COLUMNS } from '../../supplier-truth/supplier-card.repository';

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
