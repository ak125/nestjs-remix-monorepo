#!/usr/bin/env node
// scripts/audit/impeccable-ratchet-check.mjs
//
// Compare the current impeccable detection output against the committed
// baseline at audit/impeccable/baseline.json and fail (exit 1) if:
//   - total count grew
//   - any category count grew
//   - a file that had 0 issues in baseline now has ≥1 issue
//
// Decremental ratcheting: when a fixing PR lowers a category to N,
// future PRs cannot regress above N. The baseline.json itself is committed
// in each fixing PR.
//
// Inputs:
//   - audit/impeccable/baseline.json (committed SoT)
//   - stdin or --json-file <path>: a fresh `design:detect:json` output
//
// Usage:
//   npm --workspace=@fafa/frontend run design:detect:json \
//     | node scripts/audit/impeccable-ratchet-check.mjs
//
//   node scripts/audit/impeccable-ratchet-check.mjs --json-file /tmp/current.json
//
// Exit codes:
//   0  ratchet OK (current ≤ baseline in every dimension)
//   1  regression detected (printed diff to stderr)
//   2  bad inputs (missing baseline, malformed JSON)

import { readFileSync } from "node:fs";
import { argv, cwd, exit, stderr, stdin, stdout } from "node:process";
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

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => (buf += chunk));
    stdin.on("end", () => resolve(buf));
    stdin.on("error", reject);
  });
}

function parseArgs(args) {
  const out = { jsonFile: null, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json-file" && args[i + 1]) {
      out.jsonFile = args[++i];
    } else if (args[i] === "--help" || args[i] === "-h") {
      out.help = true;
    }
  }
  return out;
}

function loadJson(path, label) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    stderr.write(`✘ cannot read ${label} at ${path}: ${err.message}\n`);
    exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    stderr.write(`✘ malformed JSON in ${label} (${path}): ${err.message}\n`);
    exit(2);
  }
}

function aggregate(report) {
  // impeccable --json emits { issues: [{ category, file, ... }, ...], ... }
  // We tolerate either shape: top-level array OR { issues: [...] }.
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
  return { total: issues.length, byCategory, byFile };
}

function diff(baseline, current) {
  const regressions = [];
  if (current.total > baseline.total) {
    regressions.push({
      kind: "total",
      baseline: baseline.total,
      current: current.total,
      delta: current.total - baseline.total,
    });
  }
  const cats = new Set([
    ...Object.keys(baseline.byCategory ?? {}),
    ...Object.keys(current.byCategory),
  ]);
  for (const cat of cats) {
    const b = baseline.byCategory?.[cat] ?? 0;
    const c = current.byCategory[cat] ?? 0;
    if (c > b) {
      regressions.push({
        kind: "category",
        category: cat,
        baseline: b,
        current: c,
        delta: c - b,
      });
    }
  }
  const newFileRegressions = [];
  for (const [file, count] of Object.entries(current.byFile)) {
    const baseCount = baseline.byFile?.[file] ?? 0;
    if (baseCount === 0 && count > 0) {
      newFileRegressions.push({ file, count });
    }
  }
  return { regressions, newFileRegressions };
}

function fmtCount(c) {
  return c.toString().padStart(4);
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (args.help) {
    stdout.write(
      "Usage: design:detect:json | impeccable-ratchet-check.mjs [--json-file <path>]\n",
    );
    exit(0);
  }

  const baseline = loadJson(BASELINE_PATH, "baseline");
  if (typeof baseline.total !== "number" || !baseline.byCategory) {
    stderr.write(
      "✘ baseline.json missing required fields (.total, .byCategory)\n",
    );
    exit(2);
  }

  const currentRaw = args.jsonFile
    ? loadJson(args.jsonFile, "current")
    : JSON.parse(await readStdin());
  const current = aggregate(currentRaw);

  const { regressions, newFileRegressions } = diff(baseline, current);

  if (regressions.length === 0 && newFileRegressions.length === 0) {
    stdout.write(
      `✓ impeccable ratchet OK — total ${current.total} ≤ baseline ${baseline.total}\n`,
    );
    for (const cat of Object.keys(baseline.byCategory).sort()) {
      const b = baseline.byCategory[cat] ?? 0;
      const c = current.byCategory[cat] ?? 0;
      stdout.write(`  ${cat}: ${fmtCount(c)} ≤ ${fmtCount(b)}\n`);
    }
    exit(0);
  }

  stderr.write("✘ impeccable ratchet regression detected:\n");
  for (const r of regressions) {
    if (r.kind === "total") {
      stderr.write(
        `  total: ${r.baseline} → ${r.current} (+${r.delta})\n`,
      );
    } else {
      stderr.write(
        `  category ${r.category}: ${r.baseline} → ${r.current} (+${r.delta})\n`,
      );
    }
  }
  for (const f of newFileRegressions) {
    stderr.write(`  new offending file: ${f.file} (${f.count} issues)\n`);
  }
  stderr.write(
    "\nTo fix: either eliminate the new issues, or (if intentional)\n" +
      "regenerate the baseline:\n" +
      "  npm --workspace=@fafa/frontend run design:detect:json > /tmp/cur.json\n" +
      "  node scripts/audit/impeccable-baseline-write.mjs --from /tmp/cur.json\n",
  );
  exit(1);
}

main().catch((err) => {
  stderr.write(`✘ unexpected: ${err.stack ?? err.message}\n`);
  exit(2);
});
