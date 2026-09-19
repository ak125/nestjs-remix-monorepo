#!/usr/bin/env node
/**
 * scripts/registry/build-runtime-registry.js — Layer 1 producer (RuntimeEntry[]).
 *
 * Reads `audit/runtime-entrypoints.json` (produced by
 * `scripts/audit/build-deep-inventory.js`) and emits one RuntimeEntry per
 * detected entrypoint. `dependsOn[]` is the cached import graph restricted to
 * emitted nodes, not proof of actual startup order or job execution.
 *
 * Per ADR-058 invariant V1-3 :
 *   - `status: 'LIVE'` for structurally declared entrypoints (not runtime activity)
 *   - decorator-only processors without DI wiring stay UNKNOWN / low confidence
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
  bull_processors: "worker",
  cron: "cron",
  migrations: "migration",
  // Last: specific module/controller/processor kinds take precedence.
  di_live_files: "other",
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
  const diLiveFiles = new Set(buckets.di_live_files || []);
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
      const unwiredProcessor = bucketName === "bull_processors" && !diLiveFiles.has(filePath);
      const confidence = bucketName === "app_entries" ? "high" : unwiredProcessor ? "low" : "medium";

      const entry = {
        schemaVersion: SCHEMA_VERSION,
        id: entryId(filePath),
        path: filePath,
        kind,
        status: unwiredProcessor ? "UNKNOWN" : "LIVE",
        sourceConfidence: confidence,
        dependsOn: [],
      };

      // Optional fields for Remix routes
      if (kind === "remix-route") {
        // V1 : we don't reverse-engineer the URL from the file path here ; V1.5
        // can add this via Remix flat-routes parser.
      }

      entries.push(entry);
    }
  }

  // Only emitted paths can become internal references. Other producer buckets
  // contain class names, workflows, etc. and are not runtime graph nodes.
  for (const entry of entries) {
    const node = importGraph.get(entry.path);
    const allImports = node && Array.isArray(node.imports) ? node.imports : [];
    entry.dependsOn = [...new Set(allImports.filter((p) => seenPaths.has(p)))]
      .map(entryId)
      .sort();
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
