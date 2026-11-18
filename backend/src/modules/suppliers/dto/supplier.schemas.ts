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
