// backend/src/modules/rm/dto/alternatives-v2.dto.ts
import { z } from 'zod';

export const AlternativesV2QuerySchema = z.object({
  gamme_id: z.coerce.number().int().positive(),
  type_id: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});
export type AlternativesV2Query = z.infer<typeof AlternativesV2QuerySchema>;

export const TrackSoft404BodySchema = z.object({
  pg_id: z.number().int().positive(),
  type_id: z.number().int().positive(),
});
export type TrackSoft404Body = z.infer<typeof TrackSoft404BodySchema>;

export const AlternativeVehicleSchema = z.object({
  type_id: z.string(),
  type_name: z.string(),
  type_alias: z.string().nullable(),
  type_fuel: z.string(),
  type_power_ps: z.string(),
  type_year_from: z.string(),
  type_year_to: z.string(),
  modele_id: z.number().int(),
  modele_name: z.string(),
  modele_alias: z.string(),
  marque_id: z.number().int(),
  marque_name: z.string(),
  marque_alias: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type AlternativeVehicle = z.infer<typeof AlternativeVehicleSchema>;

export const AlternativeGammeSchema = z.object({
  pg_id: z.number().int(),
  pg_name: z.string(),
  pg_alias: z.string(),
  pg_pic: z.string().nullable(),
  piece_count: z.number().int().nonnegative(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type AlternativeGamme = z.infer<typeof AlternativeGammeSchema>;

export const RelatedModelSchema = z.object({
  modele_id: z.number().int(),
  modele_name: z.string(),
  modele_alias: z.string(),
  marque_id: z.number().int(),
  marque_name: z.string(),
  marque_alias: z.string(),
  representative_type_id: z.string(),
  representative_type_alias: z.string(),
});
export type RelatedModel = z.infer<typeof RelatedModelSchema>;

export const AlternativesV2ResponseSchema = z.object({
  success: z.literal(true),
  version: z.literal('v2'),
  etag: z.string(),
  alternativeVehicles: z.array(AlternativeVehicleSchema),
  alternativeGammes: z.array(AlternativeGammeSchema),
  relatedModels: z.array(RelatedModelSchema),
});
export type AlternativesV2Response = z.infer<typeof AlternativesV2ResponseSchema>;
