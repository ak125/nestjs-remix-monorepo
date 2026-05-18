import { z } from "zod";

/**
 * Kind of source file tracked in the registry.
 *
 * Mirrors the buckets exposed by `scripts/audit/build-deep-inventory.js`
 * (extended : 'extension' for PG extension functions like `pgcrypto.*`,
 * `vault.*` that are detected by the RPC builder but not part of monorepo
 * runtime).
 */
export const FileKindSchema = z.enum([
  "service",
  "controller",
  "route",
  "script",
  "test",
  "config",
  "migration",
  "doc",
  "extension", // PG extension function (read-only, status=ARCHIVED côté monorepo)
]);

export type FileKind = z.infer<typeof FileKindSchema>;
