#!/usr/bin/env node
/**
 * scripts/registry/lib/utils.js — shared utilities for the 5 Layer 1 builders.
 *
 * Per ADR-058 invariant V1-2 "Déterminisme strict" :
 *   - All JSON outputs are sorted (object keys + array elements by `id`)
 *   - JSON.stringify with 2-space indent + trailing newline
 *   - Hash SHA-256 stable between 2 runs on the same checkout
 *
 * Per ADR-058 invariant V1-3 "Classification jamais forcée" :
 *   - Builders MUST never throw on ambiguous input — classify as
 *     status='UNKNOWN' + sourceConfidence='low' and log reason.
 *
 * Per plan §Layer 1 + memory feedback_generated_artifact_is_projection_not_sot.md :
 *   - Layer 1 JSON files are SoT data (auto-generated, never SoT primary
 *     — that's Layer 1 auto + Layer 2 overlay couplé). Never edit by hand.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const AUDIT_DIR = path.join(MONOREPO_ROOT, "audit");
const REGISTRY_DIR = path.join(AUDIT_DIR, "registry");
const CACHE_DIR = path.join(REGISTRY_DIR, "cache");

const SCHEMA_VERSION = "1.0.0";
const DEFAULT_OWNER = "__unassigned__";
const DEFAULT_DOMAIN = "UNKNOWN";

/**
 * The three governed dependency buckets scanned across every workspace
 * `package.json`. Shared SoT so the L1 builder, the independent semantic
 * fidelity validator, and the modernization inventory can never disagree on
 * *which* declaration classes are in scope. `optionalDependencies` is
 * deliberately out of scope (never scanned historically — keep behaviour).
 */
const DEPENDENCY_BUCKETS = ["dependencies", "devDependencies", "peerDependencies"];

/**
 * Classify a dependency specifier into its source kind.
 * Shared with the fidelity validator so `id` formatting can never drift.
 */
function classifySource(version) {
  if (!version) return "npm";
  if (version.startsWith("workspace:") || version === "*") return "workspace";
  if (version.startsWith("git+") || version.startsWith("git://")) return "git";
  if (version.startsWith("github:")) return "github";
  return "npm";
}

/**
 * Canonical dependency id : `<source>:<name>@<specifier>`.
 * Single SoT for the id string so L1 (`build-deps-registry.js`), the fidelity
 * validator (invariant `entry.id == depId(entry.name, occurrence.specifier)`),
 * and any L2 cross-contract check produce byte-identical ids.
 */
function depId(name, version) {
  return `${classifySource(version)}:${name}@${version}`;
}

/**
 * Sort object keys recursively for deterministic JSON.
 * Arrays are NOT reordered here (caller must sort by stable key).
 */
function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object" && value.constructor === Object) {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Write a JSON file deterministically.
 *
 * Invariant V1-2 :
 *   - Keys sorted recursively
 *   - 2-space indent
 *   - Trailing newline
 *   - SHA-256 stable across 2 runs on same checkout
 */
function writeDeterministicJson(filePath, data) {
  const sorted = sortKeysDeep(data);
  const json = JSON.stringify(sorted, null, 2) + "\n";
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, json, "utf8");
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * Read a JSON file ; return null if missing or unparseable.
 * Never throws — Layer 1 builders must degrade gracefully (V1-3).
 */
function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_err) {
    return null;
  }
}

/**
 * Ensure `audit/cache/codebase-inventory.json` exists. If absent, instruct caller
 * to run the inventory builder first — but do NOT auto-run it (orchestration
 * lives in the top-level `registry:build` npm script).
 */
function loadInventoryCache() {
  const cachePath = path.join(AUDIT_DIR, "cache", "codebase-inventory.json");
  const data = readJsonSafe(cachePath);
  if (!data) {
    throw new Error(
      `[registry] audit/cache/codebase-inventory.json absent. Run \`npm run audit:inventory\` first.`
    );
  }
  return data;
}

/**
 * Stable id from a file path : we use the path itself as the canonical id.
 * V1.5 will promote to RefId URN format (`kind:domain:slug`).
 */
function fileIdFromPath(filePath) {
  return filePath;
}

/**
 * Sort an array of entries by their `id` (stable string compare).
 */
function sortById(entries) {
  return [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Quiet logger : prefixed, respects `--quiet` flag.
 */
function makeLogger(prefix) {
  const QUIET = process.argv.includes("--quiet");
  return (msg) => {
    if (!QUIET) {
      process.stderr.write(`[registry/${prefix}] ${msg}\n`);
    }
  };
}

module.exports = {
  MONOREPO_ROOT,
  AUDIT_DIR,
  REGISTRY_DIR,
  CACHE_DIR,
  SCHEMA_VERSION,
  DEFAULT_OWNER,
  DEFAULT_DOMAIN,
  DEPENDENCY_BUCKETS,
  classifySource,
  depId,
  sortKeysDeep,
  writeDeterministicJson,
  readJsonSafe,
  loadInventoryCache,
  fileIdFromPath,
  sortById,
  makeLogger,
};
