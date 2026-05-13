import { z } from "zod";
import { SchemaVersionSchema } from "../shared/schema-version";
import { StatusSchema } from "../shared/status";
import { SourceConfidenceSchema } from "../shared/source-confidence";
import { DomainIdSchema } from "../shared/domain";

/**
 * RPC parse mode — classification du builder SQL (jamais throw).
 *
 * Mapping vers `sourceConfidence` :
 *   - `parsed`             → `sourceConfidence: 'high'`
 *   - `partially_parsed`   → `sourceConfidence: 'medium'`
 *   - `unknown_signature`  → `sourceConfidence: 'low'` + `status: 'UNKNOWN'`
 *
 * Edge cases gérés explicitement (cf. ADR-058 + plan PR-C) :
 *   - `CREATE OR REPLACE FUNCTION`
 *   - `SECURITY DEFINER` / `INVOKER`
 *   - Fonctions overloadées (disambiguator hash sur signature)
 *   - `SET search_path = ...`
 *   - Identifiers quotés (`"my_func"`)
 *   - Fonctions d'extension (`pgcrypto.*`, `vault.*` → kind=extension, status=ARCHIVED)
 *   - `DROP FUNCTION` → entry retirée
 */
export const RpcParseModeSchema = z.enum([
  "parsed",
  "partially_parsed",
  "unknown_signature",
]);

const RpcArgumentSchema = z.object({
  name: z.string(), // may be empty for positional unnamed
  type: z.string().min(1),
  mode: z.enum(["IN", "OUT", "INOUT", "VARIADIC"]).default("IN"),
});

export const RpcEntrySchema = z.object({
  schemaVersion: SchemaVersionSchema,
  id: z.string().min(1), // canonical id, e.g. "public.get_piece_detail#sig:abc123"
  name: z.string().min(1),
  schema: z.string().default("public"),
  domain: DomainIdSchema,
  status: StatusSchema,
  owner: z.string().min(1),
  sourceConfidence: SourceConfidenceSchema,
  parseMode: RpcParseModeSchema,
  // Filled when parseMode in {'parsed', 'partially_parsed'} — empty for unknown
  args: z.array(RpcArgumentSchema).default([]),
  returnType: z.string().default(""), // empty if unknown
  language: z.string().default(""), // "plpgsql", "sql", etc. — empty if unknown
  securityDefiner: z.boolean().default(false),
  searchPath: z.array(z.string()).default([]), // SET search_path = ... values
  definedInMigrations: z.array(z.string()).default([]),
  usedBy: z.array(z.string()).default([]), // callsites supabase.rpc('name', ...)
  parseWarnings: z.array(z.string()).default([]), // populated when partially_parsed
  parseError: z.string().optional(), // populated when unknown_signature
});

export type RpcEntry = z.infer<typeof RpcEntrySchema>;
export type RpcParseMode = z.infer<typeof RpcParseModeSchema>;
