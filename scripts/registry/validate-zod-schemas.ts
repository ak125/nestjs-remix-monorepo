#!/usr/bin/env tsx
/**
 * scripts/registry/validate-zod-schemas.ts — Layer 1 JSON ⇔ Zod schema gate.
 *
 * Validates each entry of `audit/registry/{files,runtime,deps,db,rpc}.json`
 * against the corresponding Zod schema from `@repo/registry`. Used by
 * `.github/workflows/registry-build.yml` (Phase 1 freshness gate, ADR-058
 * §Acceptance V1) and runnable locally via `npm run registry:validate:zod`.
 *
 * Imports schemas via the `@repo/registry` alias. The workspace is
 * source-only (no `dist/` build) — its `package.json` exports point at
 * `src/index.ts` directly, and tsx resolves TypeScript on the fly. No
 * `npm run -w @repo/registry build` step is needed in CI or locally.
 *
 * Exit codes :
 *   0 — every entry across all 5 registries passes its schema
 *   1 — at least one validation failure (first 5 reported, rest truncated)
 *   2 — input file missing or unreadable
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ZodTypeAny } from "zod";

import {
  FileEntrySchema,
  RuntimeEntrySchema,
  DepEntrySchema,
  DbTableEntrySchema,
  RpcEntrySchema,
} from "../../packages/registry/src/index";

const REGISTRY_DIR = resolve(__dirname, "../../audit/registry");

const CHECKS: Array<{ path: string; schema: ZodTypeAny }> = [
  { path: "files.json", schema: FileEntrySchema },
  { path: "runtime.json", schema: RuntimeEntrySchema },
  { path: "deps.json", schema: DepEntrySchema },
  { path: "db.json", schema: DbTableEntrySchema },
  { path: "rpc.json", schema: RpcEntrySchema },
];

const MAX_REPORTED_FAILURES = 5;

let totalFailures = 0;

for (const { path, schema } of CHECKS) {
  const fullPath = resolve(REGISTRY_DIR, path);
  if (!existsSync(fullPath)) {
    console.error(`MISSING: ${fullPath}`);
    process.exit(2);
  }

  const doc = JSON.parse(readFileSync(fullPath, "utf8")) as {
    entries: unknown[];
  };

  for (let i = 0; i < doc.entries.length; i++) {
    const entry = doc.entries[i] as { id?: string };
    const result = schema.safeParse(entry);
    if (!result.success) {
      console.error(
        `FAIL ${path}[${i}] id=${entry.id ?? "<no-id>"}`,
        JSON.stringify(result.error.format(), null, 2),
      );
      totalFailures++;
      if (totalFailures >= MAX_REPORTED_FAILURES) {
        console.error("... (more failures truncated)");
        break;
      }
    }
  }
  if (totalFailures >= MAX_REPORTED_FAILURES) break;
}

if (totalFailures > 0) {
  console.error(
    `::warning::${totalFailures} Zod validation failures across registries`,
  );
  process.exit(1);
}

console.log("✓ All entries validate against @repo/registry schemas");
