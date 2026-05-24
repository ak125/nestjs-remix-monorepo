#!/usr/bin/env node
/**
 * scripts/audit/check-automation-freshness.js
 *
 * Warns when entries in `.spec/00-canon/repository-registry/automation-reality.yaml`
 * have `last_verified_at` older than the given threshold (default 90 days).
 *
 * Warn-only by design — promotes operational hygiene. Used by
 * `.github/workflows/automation-registry-freshness.yml` (daily cron).
 *
 * Usage:
 *   node scripts/audit/check-automation-freshness.js [--threshold <days>]
 *
 * Exit codes :
 *   0 : no stale entries OR registry missing (graceful degrade)
 *   1 : ≥1 stale entry detected (intentional non-zero for CI WARN signal)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const args = process.argv.slice(2);
const thresholdIdx = args.indexOf("--threshold");
const thresholdDays =
  thresholdIdx >= 0 && args[thresholdIdx + 1] ? parseInt(args[thresholdIdx + 1], 10) : 90;

if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
  process.stderr.write(`[freshness] invalid --threshold value: ${args[thresholdIdx + 1]}\n`);
  process.exit(0); // graceful — never block on CLI typo
}

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const OVERLAY_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry",
  "automation-reality.yaml",
);

if (!fs.existsSync(OVERLAY_PATH)) {
  process.stderr.write("[freshness] overlay missing — graceful exit 0\n");
  process.exit(0);
}

let parsed;
try {
  parsed = yaml.load(fs.readFileSync(OVERLAY_PATH, "utf8"));
} catch (err) {
  process.stderr.write(`[freshness] parse error: ${err.message} — graceful exit 0\n`);
  process.exit(0);
}

const entries = parsed?.entries ?? [];
const now = Date.now();
const stale = [];

for (const entry of entries) {
  const ts = Date.parse(`${entry.last_verified_at}T00:00:00Z`);
  if (!Number.isFinite(ts)) continue;
  const ageDays = Math.floor((now - ts) / (1000 * 60 * 60 * 24));
  if (ageDays > thresholdDays) {
    stale.push({
      automation_id: entry.automation_id,
      last_verified_at: entry.last_verified_at,
      age_days: ageDays,
    });
  }
}

if (stale.length === 0) {
  process.stderr.write(
    `[freshness] OK — 0/${entries.length} entries stale (threshold ${thresholdDays}d)\n`,
  );
  process.exit(0);
}

process.stderr.write(
  `[freshness] WARN — ${stale.length}/${entries.length} entries stale (threshold ${thresholdDays}d):\n`,
);
for (const s of stale) {
  process.stderr.write(
    `  ${s.automation_id} — last_verified_at=${s.last_verified_at} (age ${s.age_days}d)\n`,
  );
}
process.exit(1);
