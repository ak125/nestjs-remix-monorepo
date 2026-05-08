import { z } from 'zod';

export const GapStatusSchema = z.enum(['✅', '⚠️', '❌']);
export type GapStatus = z.infer<typeof GapStatusSchema>;

export const PrioritySchema = z.enum(['P0', 'P1', 'P2']);
export type Priority = z.infer<typeof PrioritySchema>;

export const GapMatrixRowSchema = z.object({
  php_file: z.string().min(1),
  monorepo_equivalent: z.string(),
  status: GapStatusSchema,
  gap: z.string(),
  priority: PrioritySchema,
  proof_link: z.string(),
});
export type GapMatrixRow = z.infer<typeof GapMatrixRowSchema>;

export const ServiceInventoryEntrySchema = z.object({
  path: z.string(),
  public_methods: z.array(z.string()),
  tables_read: z.array(z.string()),
  consumers: z.array(z.string()),
  status: z.enum(['production', 'draft', 'deprecated', 'unknown']),
  maps_to_target_service: z.string().nullable(),
  coverage_percent: z.number().min(0).max(100),
});
export type ServiceInventoryEntry = z.infer<typeof ServiceInventoryEntrySchema>;

export const DiffSampleSchema = z.object({
  url: z.string().url(),
  surface_key: z.string(),
  current_fingerprint: z.object({
    title_hash: z.string(),
    h1_hash: z.string(),
    content_hash: z.string(),
    canonical: z.string(),
    robots: z.string(),
  }),
  v4_fingerprint: z
    .object({
      title_hash: z.string(),
      h1_hash: z.string(),
      content_hash: z.string(),
      canonical: z.string(),
      robots: z.string(),
    })
    .nullable(),
  diff_verdict: z.enum(['exact_match', 'similar', 'divergent', 'v4_unavailable']),
});
export type DiffSample = z.infer<typeof DiffSampleSchema>;

export const R2RouteAuditSchema = z.object({
  found: z.boolean(),
  evidence: z.array(z.object({
    path: z.string(),
    pattern: z.string(),
  })),
});
export type R2RouteAudit = z.infer<typeof R2RouteAuditSchema>;

export const R2VolumeStatsSchema = z.object({
  total_pieces: z.number().int().nonnegative(),
  indexable_estimate: z.number().int().nonnegative(),
  // null = "non mesuré dans cette itération" ; 0 = "mesuré, vide". Distinction explicite.
  breakdown: z
    .object({
      with_price: z.number().int().nonnegative().nullable(),
      with_stock: z.number().int().nonnegative().nullable(),
      with_image: z.number().int().nonnegative().nullable(),
      with_oem_ref: z.number().int().nonnegative().nullable(),
    })
    .optional(),
  // Erreurs Supabase exposées dans le rapport (vs silent fail trompeur dans console.warn).
  errors: z.array(z.object({ source: z.string(), message: z.string() })).optional().default([]),
  complete: z.boolean().optional().default(true),
});
export type R2VolumeStats = z.infer<typeof R2VolumeStatsSchema>;

export const PhpVsRemixComparisonSchema = z.object({
  available: z.boolean(),
  samples: z.array(
    z.object({
      url: z.string(),
      php_snapshot_present: z.boolean(),
      remix_diff: z.string().nullable(),
    }),
  ),
});
export type PhpVsRemixComparison = z.infer<typeof PhpVsRemixComparisonSchema>;

export const AuditReportSchema = z.object({
  generated_at: z.string().datetime(),
  gap_matrix: z.array(GapMatrixRowSchema),
  service_inventory: z.array(ServiceInventoryEntrySchema),
  diff_samples: z.array(DiffSampleSchema),
  r2_routes_audit: R2RouteAuditSchema,
  r2_volume_stats: R2VolumeStatsSchema,
  php_vs_remix_comparison: PhpVsRemixComparisonSchema,
});
export type AuditReport = z.infer<typeof AuditReportSchema>;
