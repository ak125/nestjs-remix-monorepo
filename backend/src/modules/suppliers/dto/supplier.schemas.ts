/**
 * Schémas Zod du module Suppliers, alignés sur les colonnes RÉELLES de
 * `___xtr_supplier` (mandat CH ; modele-fiche.md §a du mandat CD).
 *
 * Migration : backend/supabase/migrations/20261118_xtr_supplier_fiche_columns.sql.
 * Chaque champ ci-dessous a sa colonne (SUPPLIER_CARD_COLUMNS) ; les anciens
 * champs sans colonne (code, siret, fax, notes…) sont retirés.
 *
 * Ce qui n'est PAS saisissable ici, par construction (`z.strictObject` refuse
 * toute clé inconnue) :
 *  - une valeur de secret : la fiche ne porte que le NOM de la variable
 *    (`secretName`, même format que le CHECK SQL) ;
 *  - `accessState` / `accessCheckedAt` : écrits par le connecteur ;
 *  - la validation de localisation : action dédiée, jamais un champ du formulaire ;
 *  - le statut `archive` : posé par le retrait (`deactivateSupplier`), qui
 *    met aussi `spl_display = '0'`.
 */

import { z } from 'zod';
import { BRAND_SOURCE_STOCK_KINDS } from '../supplier-brand-source';

export const SUPPLIER_TYPES = ['plateforme', 'marque_directe'] as const;
export const SUPPLIER_STATUSES = [
  'actif',
  'occasionnel',
  'a_confirmer',
  'archive',
] as const;
export const SUPPLY_MODES = [
  'flux_tendu',
  'livraison_france',
  'import',
] as const;
/**
 * Repli quand la pièce n'est pas au dépôt (mandat DQ, migration
 * 20261119_xtr_supplier_link_pm_sources.sql) : MGA, RCA, PROCODIS sont en
 * flux tendu, sinon transporteur ; 'aucun' = pas de repli.
 */
export const FALLBACK_MODES = ['transporteur', 'aucun'] as const;
export const ORDER_MODES = [
  'portail',
  'email',
  'telephone',
  'edi',
  'api',
] as const;
export const ACCESS_STATES = [
  'non_configure',
  'configure_non_verifie',
  'verifie',
  'echec',
  'revoque',
] as const;

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

/** Même motif que le CHECK SQL `___xtr_supplier_spl_secret_name_check`. */
const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
/** Même motif que le CHECK SQL `___xtr_supplier_spl_country_check`. */
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const HTTP_URL_PATTERN = /^https?:\/\/\S+$/;
const PHONE_PATTERN = /^\+?[0-9 ().-]{6,30}$/;

/** '' et blancs → null (champ vidé) ; undefined reste undefined (champ absent). */
function blankToNull(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().max(max).nullable()).optional();
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blankToNull, z.enum(values).nullable()).optional();
const optionalMatch = (pattern: RegExp, max: number, message: string) =>
  z
    .preprocess(
      blankToNull,
      z.string().max(max).regex(pattern, message).nullable(),
    )
    .optional();
const optionalCount = (max: number) =>
  z
    .preprocess(blankToNull, z.coerce.number().int().min(0).max(max).nullable())
    .optional();

/** Champs saisissables de la fiche (hors nom), tous facultatifs et effaçables. */
const cardFields = {
  alias: optionalText(100),
  type: optionalEnum(SUPPLIER_TYPES),
  contactName: optionalText(120),
  email: z.preprocess(blankToNull, z.email().max(254).nullable()).optional(),
  phone: optionalMatch(PHONE_PATTERN, 30, 'Téléphone invalide'),
  website: optionalMatch(HTTP_URL_PATTERN, 300, 'URL http(s) attendue'),
  address: optionalText(300),
  postcode: optionalText(20),
  city: optionalText(120),
  country: z
    .preprocess((v) => {
      const b = blankToNull(v);
      return typeof b === 'string' ? b.toUpperCase() : b;
    }, z.string().regex(COUNTRY_PATTERN, 'Code pays ISO à 2 lettres').nullable())
    .optional(),
  supplyMode: optionalEnum(SUPPLY_MODES),
  fallbackMode: optionalEnum(FALLBACK_MODES),
  paymentTerms: optionalText(300),
  /** Franco de port HT en centimes (l'écran saisit des euros et convertit). */
  francoHtCents: optionalCount(100_000_000),
  deliveryDelayDays: optionalCount(365),
  orderMode: optionalEnum(ORDER_MODES),
  portalUrl: optionalMatch(HTTP_URL_PATTERN, 300, 'URL http(s) attendue'),
  /** Nom (ou préfixe) de la variable d'environnement, JAMAIS la valeur. */
  secretName: optionalMatch(
    SECRET_NAME_PATTERN,
    64,
    'Nom de variable attendu (majuscules, chiffres, _), jamais une valeur',
  ),
};

const name = z.preprocess(
  blankToNull,
  z.string({ error: 'Le nom du fournisseur est requis' }).min(1).max(100),
);

/** Création : nom requis, statut initial imposé par le service (a_confirmer). */
export const CreateSupplierCardSchema = z.strictObject({
  name,
  ...cardFields,
});

/**
 * Mise à jour partielle : seules les clés présentes sont écrites ; une clé
 * vidée ('' ou null) efface la colonne. Le statut ne peut pas passer à
 * `archive` ici (retrait dédié).
 */
export const UpdateSupplierCardSchema = z
  .strictObject({
    name: name.optional(),
    status: optionalEnum(
      SUPPLIER_STATUSES.filter((s) => s !== 'archive') as [
        Exclude<SupplierStatus, 'archive'>,
        ...Exclude<SupplierStatus, 'archive'>[],
      ],
    ),
    ...cardFields,
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Aucun champ à mettre à jour',
  });

export type CreateSupplierCardDto = z.infer<typeof CreateSupplierCardSchema>;
export type UpdateSupplierCardDto = z.infer<typeof UpdateSupplierCardSchema>;
/** Champs écrits par la fiche (création ou mise à jour), en camelCase. */
export type SupplierCardField = keyof UpdateSupplierCardDto;

// ===== RÈGLES DE REMISE (complément CH-2) =====
// Alignées sur les CHECK de 20261118_supplier_price_profiles_default_pct.sql
// (test d'alignement dans supplier.schemas.test.ts).

const PRICE_RULE_LEVELS = ['SUPPLIER', 'BRAND', 'FAMILY', 'SUBFAMILY'] as const;
const BRAND_PM_ID_PATTERN = /^[0-9]{1,10}$/;
/** Codes relevés dans pieces_price : NU17 (famille), 1738 (sous-famille). */
const SCOPE_CODE_PATTERN = /^[A-Z0-9]{1,20}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isCalendarDate = (d: string): boolean => {
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};

const optionalPct = z
  .preprocess((v) => {
    const b = blankToNull(v);
    return typeof b === 'string' ? Number(b.replace(',', '.')) : b;
  }, z.number().min(0).max(100).multipleOf(0.01).nullable())
  .optional();

/**
 * Règle de remise et/ou de marge pour une portée. `effectiveFrom` inclus,
 * `effectiveTo` exclu, à 00:00 UTC ; une règle datée est une promotion.
 */
export const CreatePriceRuleSchema = z
  .strictObject({
    scopeLevel: z.enum(PRICE_RULE_LEVELS),
    brandPmId: z
      .preprocess(
        (v) => (typeof v === 'number' ? String(v) : blankToNull(v)),
        z
          .string()
          .regex(BRAND_PM_ID_PATTERN, 'pm_id numérique attendu')
          .nullable(),
      )
      .optional(),
    scopeCode: z
      .preprocess((v) => {
        const b = blankToNull(v);
        return typeof b === 'string' ? b.toUpperCase() : b;
      }, z.string().regex(SCOPE_CODE_PATTERN, 'Code attendu : lettres et chiffres (ex. NU17, 1738)').nullable())
      .optional(),
    remisePct: optionalPct,
    margePct: optionalPct,
    effectiveFrom: optionalMatch(DATE_PATTERN, 10, 'Date AAAA-MM-JJ attendue'),
    effectiveTo: optionalMatch(DATE_PATTERN, 10, 'Date AAAA-MM-JJ attendue'),
    changeReason: optionalText(200),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const brand = v.brandPmId ?? null;
    const code = v.scopeCode ?? null;
    if (v.scopeLevel === 'SUPPLIER' && brand !== null)
      issue('brandPmId', 'Portée fournisseur : pas de marque');
    if (v.scopeLevel === 'BRAND' && brand === null)
      issue('brandPmId', 'Portée marque : marque requise');
    if ((v.scopeLevel === 'SUPPLIER' || v.scopeLevel === 'BRAND') && code)
      issue('scopeCode', 'Code réservé aux portées famille et sous-famille');
    if ((v.scopeLevel === 'FAMILY' || v.scopeLevel === 'SUBFAMILY') && !code)
      issue('scopeCode', 'Code de famille ou de sous-famille requis');
    if ((v.remisePct ?? null) === null && (v.margePct ?? null) === null)
      issue('remisePct', 'Remise ou marge requise');
    for (const key of ['effectiveFrom', 'effectiveTo'] as const) {
      const d = v[key];
      if (d && !isCalendarDate(d)) issue(key, 'Date inexistante');
    }
    if (v.effectiveFrom && v.effectiveTo && v.effectiveTo <= v.effectiveFrom)
      issue('effectiveTo', 'La fin doit suivre le début');
  });

export type CreatePriceRuleDto = z.infer<typeof CreatePriceRuleSchema>;

// ===== SOURCES D'ACHAT PAR MARQUE (mandat DQ) =====
// Alignées sur 20261119_xtr_supplier_link_pm_sources.sql (CHECK et contrôles
// de supplier_brand_sources_put ; test d'alignement dans supplier.schemas.test.ts).

const SUPPLIER_ID_PATTERN = /^[0-9]{1,10}$/;
export const BRAND_PM_ID_PARAM_PATTERN = /^[0-9]{1,9}$/;
/** Plafond du CHECK `slpm_surcharge_cents` (1 000 €). */
export const BRAND_SOURCE_MAX_SURCHARGE_CENTS = 100_000;
/** Plafond du CHECK `slpm_rank` : une liste de 50 sources au plus. */
export const BRAND_SOURCE_MAX_COUNT = 50;

const supplierIdField = z.preprocess(
  (v) => (typeof v === 'number' ? String(v) : blankToNull(v)),
  z.string().regex(SUPPLIER_ID_PATTERN, 'Identifiant fournisseur attendu'),
);

const BrandSourceItemSchema = z.strictObject({
  splId: supplierIdField,
  /** Lien existant à classer ; absent = lien affiché réutilisé ou créé. */
  linkId: z
    .preprocess(
      (v) => (typeof v === 'number' ? String(v) : blankToNull(v)),
      z
        .string()
        .regex(SUPPLIER_ID_PATTERN, 'Identifiant de lien attendu')
        .nullable(),
    )
    .optional(),
  /** Fiche où la pièce arrive (ex. CS) ; absent = la source elle-même. */
  deliverySplId: z
    .preprocess(
      (v) => (typeof v === 'number' ? String(v) : blankToNull(v)),
      z
        .string()
        .regex(SUPPLIER_ID_PATTERN, 'Identifiant fournisseur attendu')
        .nullable(),
    )
    .optional(),
  stockKind: z.enum(BRAND_SOURCE_STOCK_KINDS),
  /** Surcoût fixe en centimes (300 = 3 €), entier ≥ 0. */
  surchargeCents: z.coerce
    .number()
    .int('Surcoût en centimes entiers')
    .min(0, 'Surcoût ≥ 0')
    .max(BRAND_SOURCE_MAX_SURCHARGE_CENTS),
});

/**
 * Liste ordonnée des sources d'une marque : rang = position (1, 2, …), donc
 * unique par construction. Une liste vide déclasse toutes les sources.
 * Une même fiche peut figurer deux fois avec deux points de livraison
 * distincts (SASIC : stock chez BG et chez DCA), jamais deux fois à
 * l'identique.
 */
export const PutBrandSourcesSchema = z
  .strictObject({
    sources: z.array(BrandSourceItemSchema).max(BRAND_SOURCE_MAX_COUNT),
  })
  .superRefine((v, ctx) => {
    const seenPairs = new Set<string>();
    const seenLinks = new Set<string>();
    v.sources.forEach((s, i) => {
      const delivery =
        s.deliverySplId && s.deliverySplId !== s.splId ? s.deliverySplId : '';
      const pair = `${s.splId}>${delivery}`;
      if (seenPairs.has(pair))
        ctx.addIssue({
          code: 'custom',
          path: ['sources', i],
          message: 'Même fournisseur et même point de livraison déjà classés',
        });
      seenPairs.add(pair);
      if (s.linkId) {
        if (seenLinks.has(s.linkId))
          ctx.addIssue({
            code: 'custom',
            path: ['sources', i, 'linkId'],
            message: 'Lien déjà classé dans cette liste',
          });
        seenLinks.add(s.linkId);
      }
    });
  });

export type PutBrandSourcesDto = z.infer<typeof PutBrandSourcesSchema>;

/**
 * Correspondance champ → colonne. Une seule table : le dépôt ne connaît que
 * les colonnes, l'API que les champs.
 */
export const SUPPLIER_CARD_FIELD_TO_COLUMN = {
  name: 'spl_name',
  alias: 'spl_alias',
  status: 'spl_status',
  type: 'spl_type',
  contactName: 'spl_contact_name',
  email: 'spl_email',
  phone: 'spl_phone',
  website: 'spl_website',
  address: 'spl_address',
  postcode: 'spl_postcode',
  city: 'spl_city',
  country: 'spl_country',
  supplyMode: 'spl_supply_mode',
  fallbackMode: 'spl_fallback_mode',
  paymentTerms: 'spl_payment_terms',
  francoHtCents: 'spl_franco_ht_cents',
  deliveryDelayDays: 'spl_delivery_delay_days',
  orderMode: 'spl_order_mode',
  portalUrl: 'spl_portal_url',
  secretName: 'spl_secret_name',
} as const satisfies Record<SupplierCardField, `spl_${string}`>;

/** Champs dont un changement invalide la validation de localisation. */
export const LOCATION_FIELDS = [
  'address',
  'postcode',
  'city',
  'country',
  'supplyMode',
] as const satisfies readonly SupplierCardField[];

// Filtres de la liste (consommés par SuppliersModernController) — inchangés.
export const SupplierFiltersSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  country: z.string().optional(),
  hasEmail: z.boolean().optional(),
  hasWebsite: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export type SupplierFilters = z.infer<typeof SupplierFiltersSchema>;

export const validateSupplierFilters = (data: unknown) =>
  SupplierFiltersSchema.parse(data);
