#!/usr/bin/env node
// scripts/audit/impeccable-baseline-write.mjs
//
// Generate/update audit/impeccable/baseline.json from a fresh impeccable JSON
// report. Intended to be called by maintainers in fixing PRs after a category
// has been brought down, to ratchet the baseline DOWN (never up).
//
// Usage:
//   npm --workspace=@fafa/frontend run design:detect:json > /tmp/cur.json
//   node scripts/audit/impeccable-baseline-write.mjs --from /tmp/cur.json
//
// Refuses to write if the new baseline would INCREASE any dimension compared
// to the existing baseline (use --allow-increase to override — only meant for
// the initial bootstrap PR).
//
// Output: writes audit/impeccable/baseline.json with stable key ordering.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { argv, cwd, exit, stderr, stdout } from "node:process";
import { relative, sep } from "node:path";
import { execSync } from "node:child_process";

const BASELINE_PATH = "audit/impeccable/baseline.json";

function repoRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return cwd();
  }
}

const ROOT = repoRoot();

function toRepoRelative(file) {
  if (!file || typeof file !== "string") return "unknown";
  if (!file.startsWith("/")) return file.split(sep).join("/");
  const rel = relative(ROOT, file);
  return rel.split(sep).join("/");
}

function parseArgs(args) {
  const out = { from: null, allowIncrease: false, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) {
      out.from = args[++i];
    } else if (args[i] === "--allow-increase") {
      out.allowIncrease = true;
    } else if (args[i] === "-h" || args[i] === "--help") {
      out.help = true;
    }
  }
  return out;
}

function loadJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    stderr.write(`✘ cannot read/parse ${label} (${path}): ${err.message}\n`);
    exit(2);
  }
}

function aggregate(report) {
  const issues = Array.isArray(report)
    ? report
    : Array.isArray(report?.issues)
      ? report.issues
      : null;
  if (!issues) {
    stderr.write(
      "✘ unrecognized impeccable JSON shape (expected array or { issues: [...] })\n",
    );
    exit(2);
  }
  const byCategory = Object.create(null);
  const byFile = Object.create(null);
  for (const it of issues) {
    const cat = it.antipattern ?? it.category ?? it.rule ?? "unknown";
    const file = toRepoRelative(it.file ?? it.path);
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    byFile[file] = (byFile[file] ?? 0) + 1;
  }
  // stable key ordering
  const sortedByCategory = Object.fromEntries(
    Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)),
  );
  const sortedByFile = Object.fromEntries(
    Object.entries(byFile).sort(([a], [b]) => a.localeCompare(b)),
  );
  return { total: issues.length, byCategory: sortedByCategory, byFile: sortedByFile };
}

function computedFrom() {
  try {
    const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    return `git@${sha}`;
  } catch {
    return "unknown";
  }
}

function refusesIncrease(existing, next) {
  if (next.total > existing.total) {
    return `total ${existing.total} → ${next.total} (+${next.total - existing.total})`;
  }
  for (const [cat, c] of Object.entries(next.byCategory)) {
    const e = existing.byCategory?.[cat] ?? 0;
    if (c > e) return `category ${cat}: ${e} → ${c} (+${c - e})`;
  }
  return null;
}

function main() {
  const args = parseArgs(argv.slice(2));
  if (args.help || !args.from) {
    stdout.write(
      "Usage: impeccable-baseline-write.mjs --from <json-report> [--allow-increase]\n",
    );
    exit(args.help ? 0 : 2);
  }
  const report = loadJson(args.from, "report");
  const next = aggregate(report);

  if (existsSync(BASELINE_PATH) && !args.allowIncrease) {
    const existing = loadJson(BASELINE_PATH, "existing baseline");
    const increase = refusesIncrease(existing, next);
    if (increase) {
      stderr.write(
        `✘ refusing to write: would increase ${increase}.\n` +
          "  Use --allow-increase only for the initial bootstrap PR.\n",
      );
      exit(1);
    }
  }

  const payload = {
    $schema: "https://raw.githubusercontent.com/ak125/nestjs-remix-monorepo/main/audit/impeccable/baseline.schema.json",
    note: "Decremental baseline for impeccable design anti-pattern ratchet (see audit/impeccable/README.md). Regenerate via scripts/audit/impeccable-baseline-write.mjs.",
    generatedAt: new Date().toISOString(),
    computedFrom: computedFrom(),
    total: next.total,
    byCategory: next.byCategory,
    byFile: next.byFile,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
  stdout.write(
    `✓ wrote ${BASELINE_PATH} — total=${next.total}, categories=${Object.keys(next.byCategory).length}\n`,
  );
}

main();
