/**
 * Brand Role Map Schema — Zod validation for constructeur role_map.json sidecar files.
 *
 * Each brand RAG document ({alias}.md) has a sidecar ({alias}.role_map.json)
 * that maps sections to roles, purity thresholds, and chunk kinds.
 *
 * All sections are R7_ROUTER (safe router content, no diagnostic/howto).
 * Used by: r7-brand-rag-generator agent, future R7 retrieval pipeline.
 *
 * Source of truth: .spec/00-canon/brand-md-schema.md
 */

import { z } from 'zod';

// ── Section keys for brand RAG documents ────────────────

export const BRAND_RAG_SECTION_KEYS = [
  'S2_MICRO_SEO_ROUTER',
  'S3_SHORTCUTS_INTERNAL_LINKS',
  'S7_COMPATIBILITY_QUICK_GUIDE',
  'S8_SAFE_TABLE',
  'S9_FAQ_ROUTER',
  'S10_ABOUT_BRAND',
] as const;

export type BrandRagSectionKey = (typeof BRAND_RAG_SECTION_KEYS)[number];

// ── Chunk kinds ─────────────────────────────────────────

export const BRAND_CHUNK_KINDS = [
  'definition',
  'trust_proofs',
  'anchor_list',
  'selection_checks',
  'anti_mistakes',
  'table_row',
  'faq',
] as const;

export type BrandChunkKind = (typeof BRAND_CHUNK_KINDS)[number];

// ── Section entry schema ────────────────────────────────

export const BrandRoleMapSectionSchema = z.object({
  section_key: z.enum(BRAND_RAG_SECTION_KEYS),
  primary_role: z.literal('R7_ROUTER'),
  allowed_roles: z.array(z.string()).min(1),
  purity_min: z.number().int().min(0).max(100),
  chunk_kind: z.array(z.enum(BRAND_CHUNK_KINDS)).min(1),
});

export type BrandRoleMapSection = z.infer<typeof BrandRoleMapSectionSchema>;

// ── Top-level role_map.json schema ──────────────────────

export const BrandRoleMapSchema = z.object({
  doc_type: z.literal('CONSTRUCTEUR'),
  doc_id: z.string().min(3), // "{alias}-{brand_id}"
  sections: z.array(BrandRoleMapSectionSchema).min(4).max(6),
});

export type BrandRoleMap = z.infer<typeof BrandRoleMapSchema>;

// ── Default role map (used when generating new brands) ──

export const DEFAULT_BRAND_ROLE_MAP_SECTIONS: BrandRoleMapSection[] = [
  {
    section_key: 'S2_MICRO_SEO_ROUTER',
    primary_role: 'R7_ROUTER',
    allowed_roles: ['R7_ROUTER'],
    purity_min: 90,
    chunk_kind: ['definition', 'trust_proofs'],
  },
  {
    section_key: 'S3_SHORTCUTS_INTERNAL_LINKS',
    primary_role: 'R7_ROUTER',
    allowed_roles: ['R7_ROUTER'],
    purity_min: 95,
    chunk_kind: ['anchor_list'],
  },
  {
    section_key: 'S7_COMPATIBILITY_QUICK_GUIDE',
    primary_role: 'R7_ROUTER',
    allowed_roles: ['R7_ROUTER'],
    purity_min: 90,
    chunk_kind: ['selection_checks', 'anti_mistakes'],
  },
  {
    section_key: 'S8_SAFE_TABLE',
    primary_role: 'R7_ROUTER',
    allowed_roles: ['R7_ROUTER'],
    purity_min: 90,
    chunk_kind: ['table_row'],
  },
  {
    section_key: 'S9_FAQ_ROUTER',
    primary_role: 'R7_ROUTER',
    allowed_roles: ['R7_ROUTER'],
    purity_min: 90,
    chunk_kind: ['faq'],
  },
  {
    section_key: 'S10_ABOUT_BRAND',
    primary_role: 'R7_ROUTER',
    allowed_roles: ['R7_ROUTER'],
    purity_min: 85,
    chunk_kind: ['definition'],
  },
];

/**
 * Build a default role_map for a given brand.
 */
export function buildDefaultBrandRoleMap(
  alias: string,
  brandId: number,
): BrandRoleMap {
  return {
    doc_type: 'CONSTRUCTEUR',
    doc_id: `${alias}-${brandId}`,
    sections: DEFAULT_BRAND_ROLE_MAP_SECTIONS,
  };
}
