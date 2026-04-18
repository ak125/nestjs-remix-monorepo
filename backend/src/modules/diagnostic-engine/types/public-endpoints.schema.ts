/**
 * Zod schemas pour les endpoints publics du DiagnosticEngine (plan breezy-eagle).
 * Valident query strings / path params avant de descendre dans data-service.
 */
import { z } from 'zod';

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  limit: z
    .string()
    .optional()
    .transform((v) =>
      v ? Math.min(Math.max(parseInt(v, 10) || 10, 1), 15) : 10,
    ),
});

export const DtcCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[PCBU]\d{4}$/i, 'Format DTC invalide (ex: P0300, C0035)'),
});

export const MaintenanceListQuerySchema = z.object({
  system: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{2,40}$/)
    .optional(),
  popular: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  limit: z
    .string()
    .optional()
    .transform((v) =>
      v ? Math.min(Math.max(parseInt(v, 10) || 20, 1), 100) : 20,
    ),
});

export const SlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{2,80}$/),
});

export const PopularQuerySchema = z.object({
  kind: z.enum(['symptom', 'maintenance']).default('symptom'),
  limit: z
    .string()
    .optional()
    .transform((v) =>
      v ? Math.min(Math.max(parseInt(v, 10) || 6, 1), 20) : 6,
    ),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type DtcCode = z.infer<typeof DtcCodeSchema>;
export type MaintenanceListQuery = z.infer<typeof MaintenanceListQuerySchema>;
export type SlugParam = z.infer<typeof SlugParamSchema>;
export type PopularQuery = z.infer<typeof PopularQuerySchema>;
