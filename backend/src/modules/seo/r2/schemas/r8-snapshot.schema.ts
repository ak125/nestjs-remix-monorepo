/**
 * ADR-072 — R8 Snapshot schemas (Zod versioned contracts)
 *
 * R8 Vehicle Domain bounded context (canon Round 8 §2 DDD bounded contexts).
 * SoT table : __seo_r8_snapshot_store (immutable, content-addressed, versioned).
 *
 * R2 consumes via R8SnapshotReaderService.getLatestSnapshot(typeId) — persisted-only,
 * jamais d'attente live. Si absent → R2 retourne review_required reason
 * r8_snapshot_unavailable + enqueue async r8-enrichment (non-blocking).
 *
 * Schema Registry mirror Repository Contract Series (ADR-062 conformity criteria 9/9).
 * Breaking changes → Architecture Contract gate observed → ratchet → enforce.
 */

import { z } from 'zod';

// ── R8 enrichment status enum (canon Round 2 status enum strict) ─────────────
//
// Round 2 correction : retire 'unenriched' et 'snapshoted' ambigus. 4 valeurs canon :
//   - minimal  : DB-only seed (auto_type + siblings basiques, pas de WIKI evidence)
//   - enriched : full snapshot (DB + WIKI validated evidence)
//   - stale    : snapshot existe mais auto_type.updated_at > snapshot.created_at
//                OU TTL expiré (job nightly détecte, R2 compose continue avec stale +
//                enqueue async re-enrichment)
//   - failed   : enrichment tenté mais échoué (LLM timeout, data corruption, source ban)
//                R2 retourne review_required reason r8_enrichment_failed (NE bloque pas)

export const R8EnrichmentStatusEnum = z.enum([
  'minimal',
  'enriched',
  'stale',
  'failed',
]);

export type R8EnrichmentStatus = z.infer<typeof R8EnrichmentStatusEnum>;

// ── R8 disambiguation signature (canon Round 5 CADRE véhicule) ───────────────
//
// Produit par R8ParentEnrichmentService (PR 2D-2 séparée). Représente la
// signature désambiguïsée parent d'un type_id : puissance + années + carrosserie
// + code moteur + norme Euro + liste sibling type_ids partageant le label moteur.
//
// Cf ADR-070 §C Disambiguation active : H1 mandatory power + body + years,
// 3 sections obligatoires S_VARIANT_DISAMBIGUATION + S_SIBLING_TABLE + S_COMPAT_DIFFERENCES,
// internal links sibling OK, canonical sibling INTERDIT.

export const R8SiblingEntrySchema = z.object({
  typeId: z.number().int().positive(),
  powerHp: z.number().int().nonnegative().nullable(),
  yearsFrom: z.number().int().nullable(),
  yearsTo: z.number().int().nullable(),
  bodyType: z.string().nullable(),
  engineCode: z.string().nullable(),
});

export type R8SiblingEntry = z.infer<typeof R8SiblingEntrySchema>;

export const R8DisambiguationSignatureSchema = z.object({
  typeId: z.number().int().positive(),
  brandSlug: z.string(),
  modelSlug: z.string(),
  // CADRE véhicule détaillé (canon ADR-070 §C disambiguation active)
  powerHp: z.number().int().nonnegative().nullable(),
  yearsFrom: z.number().int().nullable(),
  yearsTo: z.number().int().nullable(),
  bodyType: z.string().nullable(),         // "3/5 portes", "Break", etc.
  fuelType: z.string().nullable(),
  engineCode: z.string().nullable(),       // ex: "K9K 770"
  euroNorm: z.string().nullable(),         // ex: "Euro5"
  literage: z.string().nullable(),
  // Sibling list (R2 S_SIBLING_TABLE + S_COMPAT_DIFFERENCES source)
  siblings: z.array(R8SiblingEntrySchema).default([]),
  // Lineage provenance
  sourceLineage: z
    .object({
      autoTypeUpdatedAt: z.string().datetime().optional(),
      wikiEvidenceIds: z.array(z.number().int().positive()).default([]),
      llmModel: z.string().optional(),
    })
    .optional(),
});

export type R8DisambiguationSignature = z.infer<
  typeof R8DisambiguationSignatureSchema
>;

// ── R8 snapshot row (DB representation) ──────────────────────────────────────

export const R8SnapshotRowSchema = z.object({
  id: z.number().int().positive(),
  typeId: z.number().int().positive(),
  versionSha: z.string().regex(/^[0-9a-f]{64}$/, 'must be sha256 hex 64 chars'),
  disambiguationSignature: R8DisambiguationSignatureSchema,
  enrichmentStatus: R8EnrichmentStatusEnum,
  sourceLineage: z
    .object({
      autoTypeUpdatedAt: z.string().datetime().optional(),
      wikiEvidenceIds: z.array(z.number().int().positive()).default([]),
      llmModel: z.string().optional(),
    })
    .nullable()
    .optional(),
  createdAt: z.string().datetime(),
});

export type R8SnapshotRow = z.infer<typeof R8SnapshotRowSchema>;

// ── R8 snapshot read result (R2-facing API) ──────────────────────────────────
//
// Retourné par R8SnapshotReaderService.getLatestSnapshot(typeId).
// `null` = snapshot absent → R2 retourne review_required reason r8_snapshot_unavailable.

/**
 * Discriminated union TypeScript explicite — pas de Zod schema pour ce type
 * car z.discriminatedUnion infère des fields optionals (`?`) qui empêchent le
 * narrowing TS via `if (result.found)` côté consumer (R2DataLoaderService).
 *
 * Validation runtime du payload réservée aux fields R8SnapshotRowSchema (déjà Zod).
 */
export type R8SnapshotReadResult =
  | { found: true; snapshot: R8SnapshotRow }
  | {
      found: false;
      reason: 'r8_snapshot_unavailable' | 'r8_enrichment_failed';
    };
