import { z } from "zod";
import { SchemaVersionSchema } from "../shared/schema-version";
import { FileEntrySchema } from "../entries/file-entry";
import { DbTableEntrySchema } from "../entries/db-table-entry";
import { RpcEntrySchema } from "../entries/rpc-entry";
import { DepEntrySchema } from "../entries/dep-entry";
import { RuntimeEntrySchema } from "../entries/runtime-entry";

/**
 * Layer 3 — Canonical registry projection (générée).
 *
 * Output : `audit/registry/canonical.json`.
 *
 * **Règle invariante** (ADR-058 §SoT clarification) :
 * - Source de vérité = couple Layer 1 (auto) + Layer 2 (overlay manuel).
 * - Layer 3 est une **projection canonique générée** — JAMAIS SoT primaire.
 * - Si elle diverge des sources amont, on rebuild ; on ne l'édite jamais.
 *
 * Hooks pre-commit refusent toute modification manuelle de ce fichier sauf
 * preuve de reproductibilité (cf. memory
 * `feedback_hook_reproducibility_proof_over_env_marker.md`).
 *
 * Builder : `scripts/registry/build-canonical-registry.js` (livré PR-E).
 */
export const CanonicalMetaSchema = z.object({
  generatedAt: z.string().datetime(),
  generatorVersion: z.string().min(1), // builder version, e.g. "1.0.0"
  inputHashes: z.record(z.string(), z.string()), // path → sha256
});

export const CanonicalRegistrySchema = z.object({
  schemaVersion: SchemaVersionSchema,
  files: z.array(FileEntrySchema).default([]),
  db: z
    .object({
      tables: z.array(DbTableEntrySchema).default([]),
      rpc: z.array(RpcEntrySchema).default([]),
    })
    .default({ tables: [], rpc: [] }),
  deps: z.array(DepEntrySchema).default([]),
  runtime: z.array(RuntimeEntrySchema).default([]),
  meta: CanonicalMetaSchema,
});

export type CanonicalRegistry = z.infer<typeof CanonicalRegistrySchema>;
export type CanonicalMeta = z.infer<typeof CanonicalMetaSchema>;
