import { z } from "zod";
import { SchemaVersionSchema } from "../shared/schema-version";
import { SourceConfidenceSchema } from "../shared/source-confidence";
import { DomainIdSchema } from "../shared/domain";
import { RiskSchema } from "../shared/risk";

/**
 * Layer 2 — Ownership overlay entry (manuel, humain édite).
 *
 * Lives in `.spec/00-canon/repository-registry/ownership.yaml`. Auto-derived
 * initially by `scripts/registry/seed-ownership.js` from CODEOWNERS +
 * `agents/{slug}/AGENTS.md` + `@repo/seo-roles` RoleId mapping.
 *
 * Per ADR-058 / plan §PR-D, `domain` field is REQUIRED (consommé par la gate
 * `registry-new-file-gate.yml` en PR-G qui exige owner + domain résolus).
 *
 * `sourceConfidence` reflète l'origine de l'entry :
 *   - `high`   : entry humaine explicite ou dérivée d'une entrée CODEOWNERS exacte
 *   - `medium` : dérivée d'un AGENTS.md role ou d'un préfixe de path consensuel
 *   - `low`    : dérivée d'une heuristique (nommage uniquement) — à reviewer
 */
const SlaSchema = z.object({
  responseTimeHours: z.number().int().positive().optional(),
  uptimeTarget: z.number().min(0).max(100).optional(),
});

export const OwnershipEntrySchema = z.object({
  glob: z.string().min(1), // micromatch glob, e.g. "backend/src/modules/payments/**"
  domain: DomainIdSchema, // required since plan PR-G expects owner+domain
  owner: z.string().min(1), // team slug (e.g. "@ak125/payments-team") or "__unassigned__"
  sourceConfidence: SourceConfidenceSchema,
  sla: SlaSchema.optional(),
  risk: RiskSchema.default("low"),
  statusHint: z
    .enum(["LIVE", "LEGACY", "DEPRECATED", "ARCHIVED", "UNKNOWN"])
    .optional(),
});

export const OwnershipRegistrySchema = z.object({
  schemaVersion: SchemaVersionSchema,
  entries: z.array(OwnershipEntrySchema).default([]),
});

export type OwnershipEntry = z.infer<typeof OwnershipEntrySchema>;
export type OwnershipRegistry = z.infer<typeof OwnershipRegistrySchema>;
