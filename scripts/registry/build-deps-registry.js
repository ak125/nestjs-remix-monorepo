#!/usr/bin/env node
/**
 * scripts/registry/build-deps-registry.js — Layer 1 producer (DepEntry[]).
 *
 * Aggregates package dependencies declared across all workspaces (root +
 * packages/*, backend/, frontend/). Each unique (name@specifier) pair becomes a
 * DepEntry whose provenance is carried by an atomic `occurrences[]` array —
 * each element a full `(workspace, declaredIn, bucket, specifier)` tuple
 * captured AT READ TIME. The tuple is never decomposed into parallel
 * `workspaces[]` / `declaredIn[]` arrays and re-zipped by index downstream
 * (that lost the pairing and shipped 7/9 false `zod` occurrences).
 *
 * Per ADR-058 invariant V1-3 :
 *   - `status: 'LIVE'` (declared dep = LIVE by default)
 *   - `sourceConfidence: 'high'` for explicit declarations (package.json)
 *   - `owner: '__unassigned__'` (PR-D overlay can refine)
 *
 * Usage:
 *   node scripts/registry/build-deps-registry.js [--quiet]
 *
 * Output: audit/registry/deps.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const {
  MONOREPO_ROOT,
  REGISTRY_DIR,
  SCHEMA_VERSION,
  DEFAULT_OWNER,
  DEPENDENCY_BUCKETS,
  classifySource,
  depId,
  writeDeterministicJson,
  readJsonSafe,
  sortById,
  makeLogger,
} = require("./lib/utils");

const log = makeLogger("deps");

/** Stable order for the atomic provenance tuple (workspace ▸ declaredIn ▸ bucket). */
function occurrenceKey(o) {
  return `${o.workspace} ${o.declaredIn} ${o.bucket} ${o.specifier}`;
}

function compareOccurrences(a, b) {
  const ka = occurrenceKey(a);
  const kb = occurrenceKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function workspacePackageJsons() {
  const root = readJsonSafe(path.join(MONOREPO_ROOT, "package.json"));
  if (!root) return [];
  const patterns = root.workspaces || [];
  const paths = ["package.json"];

  for (const pat of patterns) {
    if (pat.endsWith("/*")) {
      const dir = pat.slice(0, -2);
      const fullDir = path.join(MONOREPO_ROOT, dir);
      try {
        for (const entry of fs.readdirSync(fullDir)) {
          const pkgPath = path.join(dir, entry, "package.json");
          if (fs.existsSync(path.join(MONOREPO_ROOT, pkgPath))) {
            paths.push(pkgPath);
          }
        }
      } catch (_e) {
        // ignore missing dirs
      }
    } else {
      const pkgPath = path.join(pat, "package.json");
      if (fs.existsSync(path.join(MONOREPO_ROOT, pkgPath))) {
        paths.push(pkgPath);
      }
    }
  }
  return paths;
}

function main() {
  const pkgPaths = workspacePackageJsons();
  log(`scanning ${pkgPaths.length} package.json files`);

  const byId = new Map(); // id → entry (occurrences accumulated atomically)

  for (const pkgPath of pkgPaths) {
    const pkg = readJsonSafe(path.join(MONOREPO_ROOT, pkgPath));
    if (!pkg) continue;
    const workspaceName = pkg.name || pkgPath;

    for (const bucket of DEPENDENCY_BUCKETS) {
      const deps = pkg[bucket] || {};
      for (const [name, version] of Object.entries(deps)) {
        const id = depId(name, version);
        // Capture the full provenance tuple AT READ TIME — never split.
        const occurrence = {
          workspace: workspaceName,
          declaredIn: pkgPath,
          bucket,
          specifier: version,
        };
        let entry = byId.get(id);
        if (!entry) {
          entry = {
            schemaVersion: SCHEMA_VERSION,
            id,
            name,
            version,
            source: classifySource(version),
            occurrences: [],
            _seen: new Set(),
            status: "LIVE",
            owner: DEFAULT_OWNER,
            sourceConfidence: "high",
          };
          byId.set(id, entry);
        }
        // Dedup on the FULL tuple (a package listed in two buckets of the same
        // manifest is two distinct occurrences; an exact repeat is one).
        const dedupKey = occurrenceKey(occurrence);
        if (!entry._seen.has(dedupKey)) {
          entry._seen.add(dedupKey);
          entry.occurrences.push(occurrence);
        }
      }
    }
  }

  const entries = Array.from(byId.values()).map(({ _seen, ...e }) => ({
    ...e,
    occurrences: [...e.occurrences].sort(compareOccurrences),
  }));

  log(`detected ${entries.length} unique deps`);

  const output = {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: "scripts/registry/build-deps-registry.js",
    entries: sortById(entries),
  };

  const outPath = path.join(REGISTRY_DIR, "deps.json");
  const sha = writeDeterministicJson(outPath, output);
  log(`wrote ${outPath} (${entries.length} entries, sha256:${sha.slice(0, 12)})`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/deps] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { main };
