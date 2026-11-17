/**
 * Vérification véhicule d'une commande (mandat BN, 2026-11-17).
 *
 * Le client peut laisser, à l'étape livraison du tunnel, une immatriculation,
 * un VIN ou une référence de pièce (champ FACULTATIF). On l'enregistre avec la
 * commande, avec le véhicule de la page d'achat, pour que l'équipe vérifie la
 * compatibilité AVANT l'envoi. Aucune vérification automatique ici : on valide
 * la forme, on n'interprète pas la valeur (pas de devinette immat/VIN/réf).
 *
 * Stockage : colonne jsonb `___xtr_order.ord_vehicle_check`, écrite par
 * `create_order_atomic` (migration 20261117_order_vehicle_check.sql, préparée,
 * appliquée par l'owner). Tant que la migration n'est pas appliquée, l'ancienne
 * RPC ignore cette clé de p_order : la commande se crée comme avant.
 */
import { z } from 'zod';

export const CUSTOMER_REFERENCE_MAX_LENGTH = 40;

/** Lettres, chiffres, espace, point, tiret, barre oblique ; commence par un alphanumérique. */
const CUSTOMER_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./-]*$/;

const shortLabel = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v ? v : null));

export const customerReferenceSchema = z
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

export const purchaseVehicleSchema = z.object({
  typeId: z.coerce.number().int().positive(),
  brand: shortLabel,
  model: shortLabel,
  engine: shortLabel,
});

export const orderVehicleCheckInputSchema = z.object({
  customerReference: customerReferenceSchema,
  purchaseVehicle: purchaseVehicleSchema.nullable().optional(),
});

export type OrderVehicleCheckInput = z.input<
  typeof orderVehicleCheckInputSchema
>;

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
  captured_at: string;
}

export class OrderVehicleCheckValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderVehicleCheckValidationError';
  }
}

/**
 * Valide l'entrée et construit la valeur à stocker.
 * Renvoie null quand il n'y a rien à enregistrer (champ vide, pas de véhicule,
 * aucune ligne rattachée à un véhicule). Lève une erreur de validation sinon.
 */
export function buildOrderVehicleCheck(
  input: OrderVehicleCheckInput | null | undefined,
  lineTypeIds: Array<number | string | null | undefined>,
  now: Date = new Date(),
): OrderVehicleCheck | null {
  const parsed = orderVehicleCheckInputSchema.safeParse(input ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new OrderVehicleCheckValidationError(
      `Immatriculation, VIN ou référence invalide : ${issue?.message ?? 'format refusé'}`,
    );
  }

  const typeIds = Array.from(
    new Set(
      lineTypeIds
        .map((v) =>
          v === null || v === undefined || v === '' ? NaN : Number(v),
        )
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
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
    captured_at: now.toISOString(),
  };
}
