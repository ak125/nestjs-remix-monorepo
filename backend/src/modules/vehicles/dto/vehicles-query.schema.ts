import { z } from 'zod';

import { PositiveIntParamSchema } from '../../../common/schemas/numeric-param.schema';

/**
 * Schéma Zod canonique des **query params** du controller `vehicles`.
 *
 * Couvre les 4 endpoints qui appelaient l'ancien `parseQueryParams()` :
 *   - GET /api/vehicles/brands
 *   - GET /api/vehicles/brands/:brandId/models
 *   - GET /api/vehicles/brands/:brandId/years
 *   - GET /api/vehicles/models/:modelId/types
 *
 * Anti-bricolage strict : tout query param non-conforme (NaN, string vide,
 * format invalide, hors borne) → BadRequestException 400. Aucun coalesce
 * silencieux ni keep-original-on-NaN.
 *
 * Incident racine : Sentry 2026-05-23, `GET /api/vehicles/brands/:brandId/models`
 * crashait en `invalid input syntax for type smallint: "NaN"` (PROD) parce que
 * `parseInt(query.year, 10)` propageait `NaN` au SQL (cast `marque_id::SMALLINT`
 * en migration `20260421_vehicle_page_cache_inline_and_drop_legacy.sql`). Le
 * path param `:brandId` était déjà protégé par `PositiveIntParamPipe` ; seul le
 * trou côté query restait à fermer.
 *
 * Conventions :
 *   - `z.strictObject` → rejette tout champ inconnu (anti-bricolage)
 *   - Chaque champ string traite `""` comme absent (préprocesseur)
 *   - `limit`/`page` réutilisent `PositiveIntParamSchema` (borne int4 canon)
 *   - `year` borné 1900-2100 (range humain raisonnable, suffisamment large)
 *
 * Sortie typée = `VehiclesQueryDto`, compatible runtime avec l'interface
 * `VehiclePaginationDto` ([./vehicles.dto.ts](./vehicles.dto.ts)).
 */

const optionalString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().min(1).max(200).optional(),
);

const optionalPositiveIntFromString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  PositiveIntParamSchema.optional(),
);

const yearSchema = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .regex(/^[1-9]\d{3}$/, {
      message: 'year must be a 4-digit positive integer',
    })
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(1900, { message: 'year must be >= 1900' })
        .max(2100, { message: 'year must be <= 2100' }),
    )
    .optional(),
);

const booleanFromStringEnum = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
);

export const VehiclesQuerySchema = z
  .strictObject({
    search: optionalString,
    brandId: optionalString,
    modelId: optionalString,
    typeId: optionalString,
    year: yearSchema,
    limit: optionalPositiveIntFromString,
    page: optionalPositiveIntFromString,
    includeAll: booleanFromStringEnum,
  })
  .transform((parsed) => ({
    search: parsed.search,
    brandId: parsed.brandId,
    modelId: parsed.modelId,
    typeId: parsed.typeId,
    year: parsed.year,
    limit: parsed.limit,
    page: parsed.page,
    includeAll: parsed.includeAll ?? false,
  }));

export type VehiclesQueryDto = z.infer<typeof VehiclesQuerySchema>;
