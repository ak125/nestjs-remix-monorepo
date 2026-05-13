#!/usr/bin/env node
/**
 * scripts/registry/build-runtime-registry.js — Layer 1 producer (RuntimeEntry[]).
 *
 * Reads `audit/runtime-entrypoints.json` (produced by
 * `scripts/audit/build-deep-inventory.js`) and emits one RuntimeEntry per
 * entrypoint. The startup-order DAG (`dependsOn[]`) is derived from the cache
 * `imports[]` graph restricted to runtime-reachable paths.
 *
 * Per ADR-058 invariant V1-3 :
 *   - `status: 'LIVE'` for confirmed entrypoints
 *   - `sourceConfidence: 'high'` for app_entries (direct startup) ; `'medium'`
 *     for derived (remix routes, NestJS reachable modules)
 *
 * Usage:
 *   node scripts/registry/build-runtime-registry.js [--quiet]
 *
 * Output: audit/registry/runtime.json
 */
"use strict";

const path = require("path");
const {
  AUDIT_DIR,
  REGISTRY_DIR,
  SCHEMA_VERSION,
  writeDeterministicJson,
  readJsonSafe,
  sortById,
  makeLogger,
  loadInventoryCache,
} = require("./lib/utils");

const log = makeLogger("runtime");

// Map runtime-entrypoints bucket → RuntimeKindSchema value
const BUCKET_TO_KIND = {
  app_entries: "other",
  remix_routes: "remix-route",
  nestjs_modules: "nestjs-module",
  nestjs_controllers: "nestjs-controller",
  nestjs_services: "nestjs-service",
  workers: "worker",
  cron: "cron",
  migrations: "migration",
};

function inferKindFromPath(filePath) {
  if (/\.module\.ts$/.test(filePath)) return "nestjs-module";
  if (/\.controller\.ts$/.test(filePath)) return "nestjs-controller";
  if (/\.service\.ts$/.test(filePath)) return "nestjs-service";
  if (filePath.startsWith("frontend/app/routes/")) return "remix-route";
  if (filePath.includes("/workers/")) return "worker";
  if (filePath.includes("/migrations/")) return "migration";
  return "other";
}

function buildImportGraph(cache) {
  const byPath = new Map();
  for (const f of cache.files || []) {
    byPath.set(f.path, f);
  }
  return byPath;
}

function entryId(filePath) {
  return `runtime:${filePath}`;
}

function main() {
  const ep = readJsonSafe(path.join(AUDIT_DIR, "runtime-entrypoints.json"));
  if (!ep) {
    throw new Error(
      `audit/runtime-entrypoints.json absent. Run \`npm run audit:inventory\` first.`
    );
  }
  const cache = loadInventoryCache();
  const importGraph = buildImportGraph(cache);

  const buckets = ep.entrypoints || {};
  const seenPaths = new Set();
  const entries = [];

  for (const [bucketName, bucketKind] of Object.entries(BUCKET_TO_KIND)) {
    const bucket = buckets[bucketName];
    if (!Array.isArray(bucket)) continue;
    for (const filePath of bucket) {
      if (seenPaths.has(filePath)) continue;
      seenPaths.add(filePath);

      const kind = bucketKind === "other"
        ? inferKindFromPath(filePath)
        : bucketKind;
      const confidence = bucketName === "app_entries" ? "high" : "medium";

      // dependsOn = imports restricted to other entrypoints (runtime-only DAG)
      const node = importGraph.get(filePath);
      const allImports = node && Array.isArray(node.imports) ? node.imports : [];
      const dependsOn = allImports
        .filter((p) => {
          // Keep only imports that are themselves entrypoints (runtime DAG)
          for (const otherBucket of Object.values(buckets)) {
            if (Array.isArray(otherBucket) && otherBucket.includes(p)) {
              return true;
            }
          }
          return false;
        })
        .map((p) => entryId(p))
        .sort();

      const entry = {
        schemaVersion: SCHEMA_VERSION,
        id: entryId(filePath),
        path: filePath,
        kind,
        status: "LIVE",
        sourceConfidence: confidence,
        dependsOn,
      };

      // Optional fields for Remix routes
      if (kind === "remix-route") {
        // V1 : we don't reverse-engineer the URL from the file path here ; V1.5
        // can add this via Remix flat-routes parser.
      }

      entries.push(entry);
    }
  }

  log(`detected ${entries.length} runtime entrypoints`);

  const output = {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: "scripts/registry/build-runtime-registry.js",
    entries: sortById(entries),
  };

  const outPath = path.join(REGISTRY_DIR, "runtime.json");
  const sha = writeDeterministicJson(outPath, output);
  log(`wrote ${outPath} (${entries.length} entries, sha256:${sha.slice(0, 12)})`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/runtime] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { main };
