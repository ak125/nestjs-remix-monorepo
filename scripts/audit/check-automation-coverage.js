#!/usr/bin/env node
/**
 * scripts/audit/check-automation-coverage.js
 *
 * Checks whether a newly-added file under .github/workflows/, scripts/cron/,
 * scripts/ops/, or a migration with `cron.schedule()` has a corresponding
 * entry in `.spec/00-canon/repository-registry/automation-reality.yaml`.
 *
 * Designed for both LOCAL repro (no PR push needed) and CI usage.
 *
 * Filter heuristic (strict, mirrors build-automation-inventory.js) :
 *   - workflows with `on.pull_request` only = CI gate, NOT automation → skipped
 *   - workflows with `on.schedule` / `workflow_dispatch` / `push` = candidate
 *   - migrations with `cron.schedule(` = candidate
 *   - scripts in scripts/cron/ or scripts/ops/ (matching sync|cron|rotate|prune) = candidate
 *
 * Usage:
 *   node scripts/audit/check-automation-coverage.js \
 *     --added-file .github/workflows/foo.yml \
 *     [--enforce]
 *
 * Exit codes :
 *   0 : not a candidate, OR has coverage, OR --enforce off and missing (warn)
 *   1 : --enforce set and missing coverage
 *   2 : internal error
 */
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const args = process.argv.slice(2);
const addedFile = argValue("--added-file");
const enforce = args.includes("--enforce");

if (!addedFile) {
  process.stderr.write("usage: check-automation-coverage.js --added-file <path> [--enforce]\n");
  process.exit(2);
}

function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const OVERLAY_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry",
  "automation-reality.yaml",
);

function isCandidate(filePath) {
  // workflows
  if (filePath.match(/^\.github\/workflows\/.+\.ya?ml$/)) {
    const abs = path.join(MONOREPO_ROOT, filePath);
    if (!fs.existsSync(abs)) {
      return { candidate: false, reason: "added file not present in checkout (build artifact?)" };
    }
    try {
      const parsed = yaml.load(fs.readFileSync(abs, "utf8"));
      const onField = parsed?.on ?? parsed?.[true];
      const triggers = normalizeTriggers(onField);
      if (
        triggers.includes("schedule") ||
        triggers.includes("workflow_dispatch") ||
        (triggers.includes("push") && triggers.length > 1)
      ) {
        return { candidate: true, reason: `triggers: ${triggers.join(",")}` };
      }
      if (triggers.length === 1 && triggers[0] === "pull_request") {
        return { candidate: false, reason: "PR-only = CI gate, not automation" };
      }
      return { candidate: false, reason: `triggers do not match automation pattern: ${triggers.join(",")}` };
    } catch (err) {
      return { candidate: false, reason: `parse error: ${err.message}` };
    }
  }
  // cron scripts
  if (filePath.match(/^scripts\/cron\//)) {
    return { candidate: true, reason: "script in scripts/cron/" };
  }
  if (filePath.match(/^scripts\/ops\/.*(sync|cron|rotate|prune)/i)) {
    return { candidate: true, reason: "operational sync/cron script" };
  }
  // migrations with cron.schedule
  if (filePath.match(/^backend\/supabase\/migrations\/.+\.sql$/)) {
    const abs = path.join(MONOREPO_ROOT, filePath);
    if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8").match(/cron\.schedule\s*\(/)) {
      return { candidate: true, reason: "migration with cron.schedule()" };
    }
    return { candidate: false, reason: "migration without cron.schedule()" };
  }
  return { candidate: false, reason: "out of scope (not workflow/cron/migration)" };
}

function normalizeTriggers(onField) {
  if (!onField) return [];
  if (typeof onField === "string") return [onField];
  if (Array.isArray(onField)) return onField.map(String);
  if (typeof onField === "object") return Object.keys(onField);
  return [];
}

function hasCoverage(filePath) {
  if (!fs.existsSync(OVERLAY_PATH)) return false;
  let parsed;
  try {
    parsed = yaml.load(fs.readFileSync(OVERLAY_PATH, "utf8"));
  } catch {
    return false;
  }
  const entries = parsed?.entries ?? [];
  return entries.some((e) =>
    (e.evidence ?? []).some((ev) => ev.path === filePath),
  );
}

const { candidate, reason } = isCandidate(addedFile);
if (!candidate) {
  process.stderr.write(`[coverage] SKIP "${addedFile}" — ${reason}\n`);
  process.exit(0);
}

if (hasCoverage(addedFile)) {
  process.stderr.write(`[coverage] OK "${addedFile}" — entry exists in automation-reality.yaml\n`);
  process.exit(0);
}

const msg = `[coverage] "${addedFile}" is an automation candidate (${reason}) but has NO entry in automation-reality.yaml`;
if (enforce) {
  process.stderr.write(`[coverage] FAIL ${msg}\n`);
  process.exit(1);
}
process.stderr.write(`[coverage] WARN ${msg} — Phase 1 warn-only\n`);
process.exit(0);
