#!/usr/bin/env node
/**
 * scripts/audit/build-automation-inventory.js — Layer 1 producer for the
 * automation reality registry.
 *
 * Scans the repo for automation CANDIDATES (not all workflows — strict
 * filtering to avoid 50+ noise entries) :
 *
 *   - .github/workflows/*.yml with `on.schedule` or `on.workflow_dispatch`
 *     OR `on.push` (to main) WITHOUT `pull_request` as sole trigger
 *     → workflows triggered by PR only are CI gates, not automations
 *   - backend/supabase/migrations/*.sql with `cron.schedule(`
 *   - scripts/cron/*.sh
 *   - scripts/ops/*sync*.sh / *cron*.sh (operational scripts)
 *   - .github/dependabot.yml entries (each `package-ecosystem` block)
 *
 * Output : audit/registry/automation.json (gitignored, degraded-graceful).
 *
 * L1 is INFORMATIONAL ONLY — it PROPOSES candidates ; the human curates the
 * L2 overlay (.spec/00-canon/repository-registry/automation-reality.yaml)
 * by hand. No auto-merge L1 → L2 (defense against governance gravity).
 *
 * Usage:
 *   node scripts/audit/build-automation-inventory.js [--quiet]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_PATH = path.join(
  MONOREPO_ROOT,
  "audit",
  "registry",
  "automation.json",
);
const QUIET = process.argv.includes("--quiet");

function log(msg) {
  if (!QUIET) process.stderr.write(`[build-automation-inventory] ${msg}\n`);
}

function safeListFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => pattern.test(f));
}

function scanGithubWorkflows() {
  const dir = path.join(MONOREPO_ROOT, ".github", "workflows");
  const files = safeListFiles(dir, /\.ya?ml$/);
  const candidates = [];

  for (const file of files) {
    const full = path.join(dir, file);
    let parsed;
    try {
      parsed = yaml.load(fs.readFileSync(full, "utf8"));
    } catch (err) {
      candidates.push({
        kind: "github-workflow",
        path: `.github/workflows/${file}`,
        triggers: ["__parse_error__"],
        candidate: false,
        reason: `YAML parse error: ${err.message}`,
      });
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;

    // `on` is parsed by js-yaml as boolean `true` when written as `on: ...` shorthand
    // Handle both string, array, object cases
    const onField = parsed.on ?? parsed[true];
    const triggers = normalizeTriggers(onField);

    // Filter heuristic (strict, per plan §risks) :
    //   keep if : schedule | workflow_dispatch | (push without only pull_request)
    //   drop if : pull_request only (CI gate, not automation)
    const isCandidate =
      triggers.includes("schedule") ||
      triggers.includes("workflow_dispatch") ||
      (triggers.includes("push") && !arraysEqual(triggers.sort(), ["pull_request"]));

    candidates.push({
      kind: "github-workflow",
      path: `.github/workflows/${file}`,
      triggers,
      candidate: isCandidate,
      reason: isCandidate
        ? "has schedule/workflow_dispatch/push trigger"
        : "PR-only trigger → CI gate, not automation",
    });
  }
  return candidates;
}

function normalizeTriggers(onField) {
  if (!onField) return [];
  if (typeof onField === "string") return [onField];
  if (Array.isArray(onField)) return onField.map(String);
  if (typeof onField === "object") return Object.keys(onField);
  return [];
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function scanMigrations() {
  const dir = path.join(MONOREPO_ROOT, "backend", "supabase", "migrations");
  const files = safeListFiles(dir, /\.sql$/);
  const candidates = [];
  for (const file of files) {
    const full = path.join(dir, file);
    let content;
    try {
      content = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const match = content.match(/cron\.schedule\s*\(\s*'([^']+)'/);
    if (match) {
      // Find line number of match
      const before = content.slice(0, content.indexOf(match[0]));
      const line = before.split("\n").length;
      candidates.push({
        kind: "pg-cron",
        path: `backend/supabase/migrations/${file}`,
        line,
        job_name: match[1],
        candidate: true,
        reason: "pg_cron schedule call",
      });
    }
  }
  return candidates;
}

function scanCronScripts() {
  const out = [];
  for (const sub of ["scripts/cron", "scripts/ops"]) {
    const dir = path.join(MONOREPO_ROOT, sub);
    const files = safeListFiles(dir, /\.(sh|js|ts)$/);
    for (const file of files) {
      // Conservative filter for ops/
      if (sub === "scripts/ops") {
        if (!/sync|cron|rotate|prune/i.test(file)) continue;
      }
      out.push({
        kind: "cron-script",
        path: `${sub}/${file}`,
        candidate: true,
        reason: `script in ${sub}/`,
      });
    }
  }
  return out;
}

function scanDependabotConfig() {
  const p = path.join(MONOREPO_ROOT, ".github", "dependabot.yml");
  if (!fs.existsSync(p)) return [];
  let parsed;
  try {
    parsed = yaml.load(fs.readFileSync(p, "utf8"));
  } catch {
    return [];
  }
  if (!parsed || !Array.isArray(parsed.updates)) return [];
  return parsed.updates.map((u, idx) => ({
    kind: "dependabot",
    path: ".github/dependabot.yml",
    package_ecosystem: u["package-ecosystem"],
    schedule_interval: u.schedule?.interval,
    candidate: true,
    reason: `dependabot updates[${idx}] : ${u["package-ecosystem"]} / ${u.schedule?.interval}`,
  }));
}

function main() {
  log("starting scan");
  const ghWorkflows = scanGithubWorkflows();
  const pgCron = scanMigrations();
  const cronScripts = scanCronScripts();
  const dependabot = scanDependabotConfig();

  const filteredWorkflows = ghWorkflows.filter((c) => c.candidate);
  const droppedWorkflows = ghWorkflows.filter((c) => !c.candidate);

  log(
    `workflows scanned: ${ghWorkflows.length}, candidates: ${filteredWorkflows.length}, dropped (PR-only gates): ${droppedWorkflows.length}`,
  );
  log(`pg_cron entries: ${pgCron.length}`);
  log(`cron scripts: ${cronScripts.length}`);
  log(`dependabot entries: ${dependabot.length}`);

  const candidates = [...filteredWorkflows, ...pgCron, ...cronScripts, ...dependabot];
  const out = {
    schemaVersion: "1.0.0",
    meta: {
      generator: "build-automation-inventory.js",
      generator_version: "1.0.0",
      generated_at: new Date().toISOString(),
      total_candidates: candidates.length,
      dropped_pr_only_workflows: droppedWorkflows.length,
      degraded: false,
    },
    candidates,
  };

  // Sort deterministically
  out.candidates.sort((a, b) => {
    const aKey = `${a.kind}::${a.path}`;
    const bKey = `${b.kind}::${b.path}`;
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2) + "\n");
  log(`✓ wrote ${candidates.length} candidates to ${path.relative(MONOREPO_ROOT, OUTPUT_PATH)}`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`[build-automation-inventory] FAILED: ${err.message}\n`);
  process.exit(2);
}
