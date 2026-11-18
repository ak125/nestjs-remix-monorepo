/**
 * Vérification véhicule d'une commande (mandat BN, 2026-11-17).
 *
 * Le client peut laisser, à l'étape livraison du tunnel, une immatriculation,
 * un VIN ou une référence de pièce (champ FACULTATIF). On l'enregistre avec la
 * commande, avec le véhicule de la page d'achat, pour que l'équipe vérifie la
 * compatibilité AVANT l'envoi. Aucune vérification automatique ici : on valide
 * la forme, on n'interprète pas la valeur (pas de devinette immat/VIN/réf).
 *
 * Mandat CK (2026-11-18) : chaque ligne garde aussi son véhicule (`lines`),
 * avec sa provenance : `page` = véhicule de la page d'où la pièce a été
 * ajoutée ; `selected_vehicle` = véhicule choisi par le client et actif au
 * moment de l'ajout, quand la page n'en portait pas (recherche, fiche
 * produit) ; `null` = aucun véhicule connu pour la ligne. L'URL de la page
 * d'ajout reste dans `___xtr_order_line.orl_website_url`.
 *
 * Stockage : colonne jsonb `___xtr_order.ord_vehicle_check`, écrite par
 * `create_order_atomic` (migration 20261117_order_vehicle_check.sql, préparée,
 * appliquée par l'owner). Tant que la migration n'est pas appliquée, l'ancienne
 * RPC ignore cette clé de p_order : la commande se crée comme avant.
 */
import { z } from 'zod';

const CUSTOMER_REFERENCE_MAX_LENGTH = 40;

/** Lettres, chiffres, espace, point, tiret, barre oblique ; commence par un alphanumérique. */
const CUSTOMER_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./-]*$/;

const shortLabel = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v ? v : null));

const customerReferenceSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ?? '').trim().replace(/\s+/g, ' '))
  .pipe(
    z.union([
      z.literal(''),
      z
        .string()
        .max(
          CUSTOMER_REFERENCE_MAX_LENGTH,
          `${CUSTOMER_REFERENCE_MAX_LENGTH} caractères maximum`,
        )
        .regex(
          CUSTOMER_REFERENCE_PATTERN,
          'Lettres, chiffres, espaces, points, tirets ou barres obliques uniquement',
        ),
    ]),
  );

const purchaseVehicleSchema = z.object({
  typeId: z.coerce.number().int().positive(),
  brand: shortLabel,
  model: shortLabel,
  engine: shortLabel,
});

const orderVehicleCheckInputSchema = z.object({
  customerReference: customerReferenceSchema,
  purchaseVehicle: purchaseVehicleSchema.nullable().optional(),
});

export type OrderVehicleCheckInput = z.input<
  typeof orderVehicleCheckInputSchema
>;

/** Provenance du véhicule d'une ligne (mandat CK). */
export const LINE_VEHICLE_SOURCES = ['page', 'selected_vehicle'] as const;
export type LineVehicleSource = (typeof LINE_VEHICLE_SOURCES)[number];

/** Véhicule d'une ligne tel que transmis par le tunnel (contexte panier). */
export interface OrderLineVehicleInput {
  productId?: string | number | null;
  type_id?: number | string | null;
  vehicle_source?: string | null;
}

/** Véhicule d'une ligne, stocké. `position` = rang de la ligne (suffixe Lnnn de orl_id). */
export interface OrderLineVehicle {
  position: number;
  product_id: string | null;
  type_id: number | null;
  source: LineVehicleSource | null;
}

/** Forme stockée dans `ord_vehicle_check` (version 1). */
export interface OrderVehicleCheck {
  version: 1;
  customer_reference: string | null;
  purchase_vehicle: {
    type_id: number;
    brand: string | null;
    model: string | null;
    engine: string | null;
    source: 'vehicle_context';
  } | null;
  line_type_ids: number[];
  lines: OrderLineVehicle[];
  captured_at: string;
}

export class OrderVehicleCheckValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderVehicleCheckValidationError';
  }
}

function toPositiveInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Véhicule d'une ligne. Une provenance inconnue avec un type_id vaut `page` :
 * c'est le seul cas que connaissaient les clients antérieurs au mandat CK
 * (type_id transmis par la page véhicule). Sans type_id, aucune provenance.
 */
function toLineVehicle(
  line: OrderLineVehicleInput | null | undefined,
  index: number,
): OrderLineVehicle {
  const typeId = toPositiveInt(line?.type_id);
  const declared = line?.vehicle_source;
  const source: LineVehicleSource | null = typeId
    ? (LINE_VEHICLE_SOURCES as readonly string[]).includes(declared ?? '')
      ? (declared as LineVehicleSource)
      : 'page'
    : null;
  const productId =
    line?.productId === null || line?.productId === undefined
      ? null
      : String(line.productId);
  return {
    position: index + 1,
    product_id: productId,
    type_id: typeId,
    source,
  };
}

/**
 * Valide l'entrée et construit la valeur à stocker.
 * Renvoie null quand il n'y a rien à enregistrer (champ vide, pas de véhicule,
 * aucune ligne rattachée à un véhicule). Lève une erreur de validation sinon.
 */
export function buildOrderVehicleCheck(
  input: OrderVehicleCheckInput | null | undefined,
  orderLines: Array<OrderLineVehicleInput | null | undefined>,
  now: Date = new Date(),
): OrderVehicleCheck | null {
  const parsed = orderVehicleCheckInputSchema.safeParse(input ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new OrderVehicleCheckValidationError(
      `Immatriculation, VIN ou référence invalide : ${issue?.message ?? 'format refusé'}`,
    );
  }

  const lines = orderLines.map(toLineVehicle);
  const typeIds = Array.from(
    new Set(lines.map((l) => l.type_id).filter((n): n is number => n !== null)),
  ).sort((a, b) => a - b);

  const reference = parsed.data.customerReference || null;
  const vehicle = parsed.data.purchaseVehicle ?? null;

  if (!reference && !vehicle && typeIds.length === 0) return null;

  return {
    version: 1,
    customer_reference: reference,
    purchase_vehicle: vehicle
      ? {
          type_id: vehicle.typeId,
          brand: vehicle.brand,
          model: vehicle.model,
          engine: vehicle.engine,
          source: 'vehicle_context',
        }
      : null,
    line_type_ids: typeIds,
    lines,
    captured_at: now.toISOString(),
  };
}
