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

/**
 * Chemin repo-relatif TOUJOURS en `/`, jamais `path.sep`.
 *
 * `path.join()` produit `backend\package.json` sous Windows et
 * `backend/package.json` sous Linux. Ces chemins finissent tels quels dans
 * `entries[].declaredIn`, donc dans `deps.json`, donc dans `canonical.json` :
 * l'artefact devenait dépendant de l'OS qui l'avait généré.
 *
 * Mesuré le 2026-08-14 — une resync produite sous Windows portait **216** entrées
 * `declaredIn: ["backend\\package.json"]`, et `deps.json` sortait à
 * `0f3706d7d111b520` contre `6f667991be593e37` sur le runner Linux au même commit.
 * `canonical.json` divergeait par ricochet (il agrège `deps`).
 *
 * Même normalisation que `rel()` dans scripts/audit/build-deep-inventory.js.
 * Le tri de `readdirSync` est ajouté au passage : NTFS renvoie déjà l'ordre
 * alphabétique, ext4 non — l'ordre de découverte ne doit pas décider du contenu.
 */
const toPosix = (p) => p.split(path.sep).join("/");

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
        for (const entry of fs.readdirSync(fullDir).sort()) {
          const pkgPath = toPosix(path.join(dir, entry, "package.json"));
          if (fs.existsSync(path.join(MONOREPO_ROOT, pkgPath))) {
            paths.push(pkgPath);
          }
        }
      } catch (_e) {
        // ignore missing dirs
      }
    } else {
      const pkgPath = toPosix(path.join(pat, "package.json"));
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
