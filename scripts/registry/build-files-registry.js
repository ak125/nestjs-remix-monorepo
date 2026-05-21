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
 *   - `status: 'LIVE'` if the file is a runtime entrypoint OR transitively
 *     reachable from one via the import graph, else `'UNKNOWN'`. Reachability
 *     is a deterministic, unambiguous signal — V1-3 forbids forcing LEGACY /
 *     ARCHIVED on weak signals, but a file pulled into the runtime graph is
 *     unambiguously live. Unreached files stay UNKNOWN (never auto-LEGACY).
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

/**
 * Transitive runtime reachability over the import graph.
 *
 * Seeds = the runtime entrypoints. Following each file's `imports` edges
 * (repo-relative paths; non-file specifiers like `@common/*` or npm packages
 * simply don't resolve to a node and are skipped), every file pulled into the
 * graph is unambiguously live. Pure + deterministic (BFS, insertion order
 * irrelevant to the resulting set). Exported for unit testing.
 *
 * @param {Array<{path:string, imports?:string[]}>} files
 * @param {Set<string>} runtimeSet  direct entrypoints (BFS seeds)
 * @returns {Set<string>} paths reachable from a runtime entrypoint (incl. seeds)
 */
function computeReachableSet(files, runtimeSet) {
  const importsByPath = new Map();
  for (const f of files) {
    importsByPath.set(f.path, Array.isArray(f.imports) ? f.imports : []);
  }
  const reachable = new Set();
  const queue = [];
  for (const f of files) {
    if (runtimeSet.has(f.path)) {
      reachable.add(f.path);
      queue.push(f.path);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift();
    for (const target of importsByPath.get(current) || []) {
      if (importsByPath.has(target) && !reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }
  return reachable;
}

function main() {
  const cache = loadInventoryCache();
  const files = cache.files || [];
  const runtimeSet = buildRuntimeSet();
  const reachable = computeReachableSet(files, runtimeSet);

  log(
    `transforming ${files.length} files (${runtimeSet.size} entrypoints → ${reachable.size} reachable/LIVE)`
  );

  const entries = files.map((f) => {
    const isRuntime = runtimeSet.has(f.path);
    const isReachable = reachable.has(f.path);
    return {
      schemaVersion: SCHEMA_VERSION,
      id: fileIdFromPath(f.path),
      path: f.path,
      domain: DEFAULT_DOMAIN, // PR-D overlay resolves to D1..D8 via glob
      kind: mapKind(f.kind),
      status: isReachable ? "LIVE" : "UNKNOWN",
      owner: DEFAULT_OWNER, // PR-D overlay resolves
      sourceConfidence: "medium", // dep-cruiser graph signal
      runtime: isRuntime,
      loc: typeof f.loc === "number" ? f.loc : 0,
      imports: Array.isArray(f.imports) ? [...f.imports].sort() : [],
      importedBy: Array.isArray(f.imported_by) ? [...f.imported_by].sort() : [],
      // Provenance: entrypoints + graph; reachability adds the transitive signal.
      derivedFrom:
        isReachable && !isRuntime ? ["depcruise", "reachability"] : ["depcruise"],
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

module.exports = { main, computeReachableSet };
