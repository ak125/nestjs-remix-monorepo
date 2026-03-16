/**
 * surface-metrics.schema.ts
 *
 * Métriques obligatoires pour toutes les surfaces R0-R8.
 * Chaque surface générée ou rafraîchie doit produire ces métriques.
 */
import { z } from 'zod';
import { RoleId } from './role-ids';

export const SurfaceMetricsSchema = z.object({
  canonical_role: z.nativeEnum(RoleId),
  pg_id: z.number().int().nullable().optional(),
  slug: z.string().min(1),

  // Volume
  word_count: z.number().int().min(0),
  char_count: z.number().int().min(0),
  char_count_no_spaces: z.number().int().min(0),

  // Structure
  section_count: z.number().int().min(0),
  heading_count: z.number().int().min(0),
  internal_link_count: z.number().int().min(0),

  // Quality
  qa_score: z.number().min(0).max(100).nullable().optional(),

  // Timestamps
  updated_at: z.string().datetime(),
});

export type SurfaceMetrics = z.infer<typeof SurfaceMetricsSchema>;

/**
 * Compute surface metrics from HTML content string.
 */
export function computeSurfaceMetrics(
  content: string,
  role: RoleId,
  slug: string,
  pgId?: number | null,
): SurfaceMetrics {
  const textOnly = content.replace(/<[^>]*>/g, '');
  const words = textOnly.split(/\s+/).filter(Boolean);
  const headings = (content.match(/<h[1-6][^>]*>/gi) || []).length;
  const links = (content.match(/<a\s+[^>]*href/gi) || []).length;
  const sections = (content.match(/<h2[^>]*>/gi) || []).length;

  return {
    canonical_role: role,
    pg_id: pgId ?? null,
    slug,
    word_count: words.length,
    char_count: textOnly.length,
    char_count_no_spaces: textOnly.replace(/\s/g, '').length,
    section_count: sections,
    heading_count: headings,
    internal_link_count: links,
    qa_score: null,
    updated_at: new Date().toISOString(),
  };
}
