import { z } from "zod";
import { SchemaVersionSchema } from "../shared/schema-version";
import { DomainIdSchema } from "../shared/domain";

/**
 * Layer 2 — Domain registry overlay (manuel).
 *
 * Lives in `.spec/00-canon/repository-registry/domains.yaml`. Sourced initially
 * from `.spec/00-canon/db-governance/domain-map.md` v1.4.2 (D1..D8 +
 * criticité).
 *
 * Each domain carries :
 *   - canonical name + description
 *   - criticality (P0..P8)
 *   - optional glob matchers (used as fallback when `ownership.yaml` entries
 *     don't carry their own `domain` field)
 *   - owner team (cascade to ownership entries lacking explicit owner)
 */
const DomainCriticalitySchema = z.enum([
  "P0",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
]);

export const DomainEntrySchema = z.object({
  id: DomainIdSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  criticality: DomainCriticalitySchema,
  globs: z.array(z.string()).default([]),
  owner: z.string().min(1),
});

export const DomainsRegistrySchema = z.object({
  schemaVersion: SchemaVersionSchema,
  entries: z.array(DomainEntrySchema).default([]),
});

export type DomainEntry = z.infer<typeof DomainEntrySchema>;
export type DomainsRegistry = z.infer<typeof DomainsRegistrySchema>;
export type DomainCriticality = z.infer<typeof DomainCriticalitySchema>;
