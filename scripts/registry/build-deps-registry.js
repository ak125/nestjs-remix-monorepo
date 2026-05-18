#!/usr/bin/env node
/**
 * scripts/registry/build-deps-registry.js — Layer 1 producer (DepEntry[]).
 *
 * Aggregates package dependencies declared across all workspaces (root +
 * packages/*, backend/, frontend/). Each unique (name@version) pair becomes a
 * DepEntry capturing which workspaces import it.
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
  writeDeterministicJson,
  readJsonSafe,
  sortById,
  makeLogger,
} = require("./lib/utils");

const log = makeLogger("deps");

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

function classifySource(version) {
  if (!version) return "npm";
  if (version.startsWith("workspace:") || version === "*") return "workspace";
  if (version.startsWith("git+") || version.startsWith("git://")) return "git";
  if (version.startsWith("github:")) return "github";
  return "npm";
}

function depId(name, version) {
  return `${classifySource(version)}:${name}@${version}`;
}

function main() {
  const pkgPaths = workspacePackageJsons();
  log(`scanning ${pkgPaths.length} package.json files`);

  const byId = new Map(); // id → entry

  for (const pkgPath of pkgPaths) {
    const pkg = readJsonSafe(path.join(MONOREPO_ROOT, pkgPath));
    if (!pkg) continue;
    const workspaceName = pkg.name || pkgPath;

    const buckets = ["dependencies", "devDependencies", "peerDependencies"];
    for (const bucket of buckets) {
      const deps = pkg[bucket] || {};
      for (const [name, version] of Object.entries(deps)) {
        const id = depId(name, version);
        const existing = byId.get(id);
        if (existing) {
          if (!existing.workspaces.includes(workspaceName)) {
            existing.workspaces.push(workspaceName);
          }
          if (!existing.declaredIn.includes(pkgPath)) {
            existing.declaredIn.push(pkgPath);
          }
        } else {
          byId.set(id, {
            schemaVersion: SCHEMA_VERSION,
            id,
            name,
            version,
            source: classifySource(version),
            workspaces: [workspaceName],
            declaredIn: [pkgPath],
            status: "LIVE",
            owner: DEFAULT_OWNER,
            sourceConfidence: "high",
          });
        }
      }
    }
  }

  const entries = Array.from(byId.values()).map((e) => ({
    ...e,
    workspaces: [...e.workspaces].sort(),
    declaredIn: [...e.declaredIn].sort(),
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
