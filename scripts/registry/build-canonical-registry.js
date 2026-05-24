#!/usr/bin/env node
/**
 * scripts/registry/build-canonical-registry.js — Layer 3 producer.
 *
 * Reads Layer 1 (audit/registry/{files,db,rpc,deps,runtime}.json) + Layer 2
 * (.spec/00-canon/repository-registry/*.yaml) and emits the canonical
 * projection : `audit/registry/canonical.json`.
 *
 * Per ADR-058 §SoT clarification :
 *   - SoT = couple Layer 1 (auto) + Layer 2 (overlay manuel)
 *   - Layer 3 = projection canonique générée, JAMAIS SoT primaire
 *   - Si elle diverge des sources amont, on rebuild ; on ne l'édite jamais
 *
 * Merge algorithm (per file/entry) :
 *   1. Start from Layer 1 entry as base
 *   2. Find best ownership match in ownership.yaml (longest matching glob wins)
 *      → apply domain, owner, risk, statusHint (if present)
 *   3. Check status-overrides.yaml — if glob match, force `status` from override
 *   4. Check delete-policy.yaml — if glob match, set deletePolicy
 *   5. If no overlay match : keep Layer 1 default (domain=UNKNOWN,
 *      owner=__unassigned__, sourceConfidence as builder set it)
 *
 * Per ADR-058 invariant V1-2 :
 *   - Output is deterministic (sorted keys + entries by `id`, no timestamps in
 *     entry bodies, only in meta.generatedAt)
 *   - Hash sha256 stable across 2 runs on same checkout
 *
 * Usage:
 *   node scripts/registry/build-canonical-registry.js [--quiet]
 *
 * Output: audit/registry/canonical.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const yaml = require("js-yaml");
const micromatch = require("micromatch");

const {
  MONOREPO_ROOT,
  AUDIT_DIR,
  REGISTRY_DIR,
  SCHEMA_VERSION,
  writeDeterministicJson,
  readJsonSafe,
  sortById,
  makeLogger,
} = require("./lib/utils");

const log = makeLogger("canonical");

const OVERLAY_DIR = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry"
);
const GENERATOR_VERSION = "1.0.0";

function loadYamlSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return yaml.load(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new Error(`YAML parse failure in ${filePath}: ${err.message}`);
  }
}

function sha256OfFile(filePath) {
  if (!fs.existsSync(filePath)) return "";
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

/**
 * Find the best ownership match for a file path.
 * "Best" = longest glob (most specific) ; ties broken by lexicographic order.
 * Returns null if no glob matches.
 */
function findBestOwnershipMatch(filePath, ownershipEntries) {
  let best = null;
  let bestGlobLen = -1;
  for (const entry of ownershipEntries) {
    if (micromatch.isMatch(filePath, entry.glob)) {
      const len = entry.glob.length;
      if (
        len > bestGlobLen ||
        (len === bestGlobLen && best && entry.glob < best.glob)
      ) {
        best = entry;
        bestGlobLen = len;
      }
    }
  }
  return best;
}

function findStatusOverride(filePath, overrides) {
  for (const o of overrides) {
    if (micromatch.isMatch(filePath, o.glob)) {
      return o;
    }
  }
  return null;
}

function findDeletePolicy(filePath, policies) {
  // LOCKED takes precedence over ADR_REQUIRED if multiple match
  let result = null;
  for (const p of policies) {
    if (micromatch.isMatch(filePath, p.glob)) {
      if (!result || (p.policy === "LOCKED" && result.policy !== "LOCKED")) {
        result = p;
      }
    }
  }
  return result;
}

function mergeFileEntries(layer1Files, overlay) {
  const ownership = overlay.ownership || [];
  const statusOverrides = overlay.statusOverrides || [];
  const deletePolicies = overlay.deletePolicy || [];

  return layer1Files.map((file) => {
    const merged = { ...file };
    const own = findBestOwnershipMatch(file.path, ownership);
    if (own) {
      merged.domain = own.domain;
      merged.owner = own.owner;
      merged.risk = own.risk || merged.risk;
      // If overlay confidence is higher than builder confidence, upgrade.
      const conf = ["low", "medium", "high"];
      if (
        conf.indexOf(own.sourceConfidence) >
        conf.indexOf(merged.sourceConfidence)
      ) {
        merged.sourceConfidence = own.sourceConfidence;
      }
      if (!merged.derivedFrom.includes("manual")) {
        merged.derivedFrom = [...merged.derivedFrom, "manual"].sort();
      }
      // statusHint : suggest, but do not override builder runtime detection unless
      // explicitly status-overrides.yaml says otherwise (next step).
      if (own.statusHint && merged.status === "UNKNOWN") {
        merged.status = own.statusHint;
      }
    }

    const statusOverride = findStatusOverride(file.path, statusOverrides);
    if (statusOverride) {
      merged.status = statusOverride.status;
    }

    const policy = findDeletePolicy(file.path, deletePolicies);
    if (policy) {
      merged.deletePolicy = policy.policy;
    }

    return merged;
  });
}

function mergeDbTables(layer1Tables, overlay) {
  // Tables use prefix-based delete policy (e.g. `__seo_*` → ADR_REQUIRED).
  // For domain/owner we keep builder defaults (DB tables don't have a path
  // to glob-match against ; PR-D ownership.yaml is path-based).
  const deletePolicies = overlay.deletePolicy || [];
  return layer1Tables.map((table) => {
    const merged = { ...table };
    // Match policy globs against the table name (e.g. `__seo_*`)
    const policy = findDeletePolicy(table.name, deletePolicies);
    if (policy) {
      merged.deletePolicy = policy.policy;
    }
    return merged;
  });
}

function mergeRpcEntries(layer1Rpc, _overlay) {
  // RPCs don't have an obvious path-glob match in ownership.yaml ;
  // they're SQL functions. Keep builder classification as-is.
  return layer1Rpc;
}

function mergeDeps(layer1Deps, _overlay) {
  // Deps have no overlay (they're external/workspace npm packages).
  // V1.5+ could add allowlists in overlay.
  return layer1Deps;
}

function mergeRuntime(layer1Runtime, overlay) {
  // Runtime entries carry `path`, so apply ownership glob match too.
  const ownership = overlay.ownership || [];
  return layer1Runtime.map((entry) => {
    const merged = { ...entry };
    const own = findBestOwnershipMatch(entry.path, ownership);
    if (own && own.statusHint && merged.status === "UNKNOWN") {
      merged.status = own.statusHint;
    }
    return merged;
  });
}

function loadLayer1() {
  const files = readJsonSafe(path.join(REGISTRY_DIR, "files.json"));
  const db = readJsonSafe(path.join(REGISTRY_DIR, "db.json"));
  const rpc = readJsonSafe(path.join(REGISTRY_DIR, "rpc.json"));
  const deps = readJsonSafe(path.join(REGISTRY_DIR, "deps.json"));
  const runtime = readJsonSafe(path.join(REGISTRY_DIR, "runtime.json"));
  if (!files || !db || !rpc || !deps || !runtime) {
    throw new Error(
      "Layer 1 incomplete in audit/registry/. Run `npm run registry:build` first."
    );
  }
  return {
    files: files.entries || [],
    db: db.entries || [],
    rpc: rpc.entries || [],
    deps: deps.entries || [],
    runtime: runtime.entries || [],
  };
}

function loadLayer2() {
  const ownership = loadYamlSafe(path.join(OVERLAY_DIR, "ownership.yaml"));
  const domains = loadYamlSafe(path.join(OVERLAY_DIR, "domains.yaml"));
  const statusOverrides = loadYamlSafe(
    path.join(OVERLAY_DIR, "status-overrides.yaml")
  );
  const deletePolicy = loadYamlSafe(path.join(OVERLAY_DIR, "delete-policy.yaml"));
  if (!ownership || !domains || !statusOverrides || !deletePolicy) {
    throw new Error(
      "Layer 2 incomplete in .spec/00-canon/repository-registry/. PR-D required."
    );
  }
  const automation = loadYamlSafe(path.join(OVERLAY_DIR, "automation-reality.yaml")) || {
    entries: [],
  };

  return {
    ownership: ownership.entries || [],
    domains: domains.entries || [],
    statusOverrides: statusOverrides.entries || [],
    deletePolicy: deletePolicy.entries || [],
    automation: automation.entries || [],
  };
}

function main() {
  log("loading Layer 1 + Layer 2");
  const l1 = loadLayer1();
  const overlay = loadLayer2();

  log(
    `merging ${l1.files.length} files, ${l1.db.length} tables, ${l1.rpc.length} rpc, ${l1.deps.length} deps, ${l1.runtime.length} runtime entries`
  );

  const mergedFiles = mergeFileEntries(l1.files, overlay);
  const mergedDb = mergeDbTables(l1.db, overlay);
  const mergedRpc = mergeRpcEntries(l1.rpc, overlay);
  const mergedDeps = mergeDeps(l1.deps, overlay);
  const mergedRuntime = mergeRuntime(l1.runtime, overlay);

  // Provenance meta : hash inputs to make canonical re-derivable from sources
  const inputHashes = {
    "audit/registry/files.json": sha256OfFile(path.join(REGISTRY_DIR, "files.json")),
    "audit/registry/db.json": sha256OfFile(path.join(REGISTRY_DIR, "db.json")),
    "audit/registry/rpc.json": sha256OfFile(path.join(REGISTRY_DIR, "rpc.json")),
    "audit/registry/deps.json": sha256OfFile(path.join(REGISTRY_DIR, "deps.json")),
    "audit/registry/runtime.json": sha256OfFile(path.join(REGISTRY_DIR, "runtime.json")),
    ".spec/00-canon/repository-registry/ownership.yaml": sha256OfFile(
      path.join(OVERLAY_DIR, "ownership.yaml")
    ),
    ".spec/00-canon/repository-registry/domains.yaml": sha256OfFile(
      path.join(OVERLAY_DIR, "domains.yaml")
    ),
    ".spec/00-canon/repository-registry/status-overrides.yaml": sha256OfFile(
      path.join(OVERLAY_DIR, "status-overrides.yaml")
    ),
    ".spec/00-canon/repository-registry/delete-policy.yaml": sha256OfFile(
      path.join(OVERLAY_DIR, "delete-policy.yaml")
    ),
    ".spec/00-canon/repository-registry/automation-reality.yaml": sha256OfFile(
      path.join(OVERLAY_DIR, "automation-reality.yaml")
    ),
  };

  // generatedAt is derived from the SoT input hashes (deterministic anchor),
  // not Date.now() — keeps output reproducible per V1-2 invariant.
  // The "time" semantically = "version of the source set", not wall-clock.
  const sotAggregateHash = crypto
    .createHash("sha256")
    .update(Object.entries(inputHashes).sort().map(([k, v]) => `${k}:${v}`).join("\n"))
    .digest("hex")
    .slice(0, 12);

  // Automation reality is a flat list (no merge — overlay IS the SoT).
  // Sort by automation_id for deterministic output.
  const automationEntries = [...(overlay.automation || [])].sort((a, b) =>
    a.automation_id < b.automation_id ? -1 : a.automation_id > b.automation_id ? 1 : 0,
  );

  const output = {
    schemaVersion: SCHEMA_VERSION,
    files: sortById(mergedFiles),
    db: {
      tables: sortById(mergedDb),
      rpc: sortById(mergedRpc),
    },
    deps: sortById(mergedDeps),
    runtime: sortById(mergedRuntime),
    automation: automationEntries,
    meta: {
      generatedAt: `1970-01-01T00:00:00.000Z`, // V1-2 deterministic placeholder
      generatorVersion: GENERATOR_VERSION,
      inputHashes,
      // Discriminator that bumps when SoT changes (for visibility) :
      sotFingerprint: sotAggregateHash,
    },
  };

  const outPath = path.join(REGISTRY_DIR, "canonical.json");
  const sha = writeDeterministicJson(outPath, output);
  log(
    `wrote ${outPath} (files=${mergedFiles.length}, tables=${mergedDb.length}, rpc=${mergedRpc.length}, deps=${mergedDeps.length}, runtime=${mergedRuntime.length}, sha256:${sha.slice(0, 12)}, sotFp:${sotAggregateHash})`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/canonical] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  main,
  mergeFileEntries,
  mergeDbTables,
  findBestOwnershipMatch,
  findStatusOverride,
  findDeletePolicy,
};
