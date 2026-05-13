#!/usr/bin/env node
/**
 * scripts/registry/build-files-registry.js — Layer 1 producer (FileEntry[]).
 *
 * Reads `audit/cache/codebase-inventory.json` (produced by
 * `scripts/audit/build-deep-inventory.js`) and transforms each file into a
 * FileEntry conforming to `@repo/registry` Zod schema.
 *
 * Per ADR-058 invariant V1-3 :
 *   - `domain: 'UNKNOWN'` by default — PR-D overlay (`ownership.yaml`) will
 *     resolve to D1..D8 via glob match in PR-E canonical projection.
 *   - `owner: '__unassigned__'` by default — same cascade.
 *   - `sourceConfidence: 'medium'` (signal indirect : path + dep-cruiser).
 *   - `status: 'LIVE'` if the file is a runtime entrypoint, else `'UNKNOWN'`.
 *
 * Per ADR-058 invariant V1-2 : deterministic output, sorted by `id`.
 *
 * Usage:
 *   node scripts/registry/build-files-registry.js [--quiet]
 *
 * Output: audit/registry/files.json
 */
"use strict";

const path = require("path");
const {
  REGISTRY_DIR,
  SCHEMA_VERSION,
  DEFAULT_OWNER,
  DEFAULT_DOMAIN,
  writeDeterministicJson,
  loadInventoryCache,
  fileIdFromPath,
  sortById,
  makeLogger,
  readJsonSafe,
  AUDIT_DIR,
} = require("./lib/utils");

const log = makeLogger("files");

const KIND_MAP = {
  // map cache 'kind' (which is the build-deep-inventory taxonomy) to FileKindSchema
  service: "service",
  controller: "controller",
  route: "route",
  script: "script",
  test: "test",
  config: "config",
  migration: "migration",
  doc: "doc",
  module: "service",          // NestJS modules → service kind in registry
  guard: "service",
  pipe: "service",
  interceptor: "service",
  middleware: "service",
  decorator: "service",
  dto: "service",
  schema: "config",
  type: "config",
  util: "service",
  other: "service",
  uncategorized: "config",
};

function mapKind(cacheKind) {
  return KIND_MAP[cacheKind] || "config";
}

/**
 * A file is "runtime" if it appears in audit/runtime-entrypoints.json
 * (either as a direct entrypoint or transitively reachable).
 * V1 approximation : check direct entrypoints + NestJS reachable modules.
 */
function buildRuntimeSet() {
  const entrypoints = readJsonSafe(
    path.join(AUDIT_DIR, "runtime-entrypoints.json")
  );
  if (!entrypoints) return new Set();
  const set = new Set();
  const buckets = entrypoints.entrypoints || {};
  for (const bucketName of Object.keys(buckets)) {
    const bucket = buckets[bucketName];
    if (Array.isArray(bucket)) {
      for (const p of bucket) set.add(p);
    }
  }
  return set;
}

function main() {
  const cache = loadInventoryCache();
  const files = cache.files || [];
  const runtimeSet = buildRuntimeSet();

  log(`transforming ${files.length} files`);

  const entries = files.map((f) => {
    const isRuntime = runtimeSet.has(f.path);
    return {
      schemaVersion: SCHEMA_VERSION,
      id: fileIdFromPath(f.path),
      path: f.path,
      domain: DEFAULT_DOMAIN, // PR-D overlay resolves to D1..D8 via glob
      kind: mapKind(f.kind),
      status: isRuntime ? "LIVE" : "UNKNOWN",
      owner: DEFAULT_OWNER, // PR-D overlay resolves
      sourceConfidence: "medium", // dep-cruiser graph signal
      runtime: isRuntime,
      loc: typeof f.loc === "number" ? f.loc : 0,
      imports: Array.isArray(f.imports) ? [...f.imports].sort() : [],
      importedBy: Array.isArray(f.imported_by) ? [...f.imported_by].sort() : [],
      derivedFrom: ["depcruise"],
      deletePolicy: "FREE",
      risk: "low",
    };
  });

  const output = {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: "scripts/registry/build-files-registry.js",
    entries: sortById(entries),
  };

  const outPath = path.join(REGISTRY_DIR, "files.json");
  const sha = writeDeterministicJson(outPath, output);
  log(`wrote ${outPath} (${entries.length} entries, sha256:${sha.slice(0, 12)})`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/files] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { main };
