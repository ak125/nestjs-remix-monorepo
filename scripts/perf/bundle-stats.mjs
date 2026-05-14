#!/usr/bin/env node
// Bundle stats gate — calcule des budgets structurels sur frontend/build/client/assets/
// après `npm run -w frontend build`. Déterministe (mêmes octets = mêmes mesures),
// ne dépend ni de Chrome ni d'un serveur ni de mocks. Remplace l'ancienne mesure
// Lighthouse synthétique sur localhost (variance >10x sur runner partagé, cf. ADR-XXX
// CrUX field monitoring + frontend/bundle-stats.README.md).
//
// Usage:
//   node scripts/perf/bundle-stats.mjs
//
// Exit codes:
//   0 — tous les budgets respectés
//   1 — au moins une violation
//   2 — output build manquant (oubli de `npm run -w frontend build`)
//
// Sortie : log lisible + GITHUB_STEP_SUMMARY si en CI.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ASSETS_DIR = path.join(REPO_ROOT, "frontend/build/client/assets");
const CONFIG_PATH = path.join(REPO_ROOT, "frontend/bundle-stats.config.json");

if (!fs.existsSync(ASSETS_DIR)) {
  console.error(`✘ Build output missing : ${ASSETS_DIR}`);
  console.error("  Run `npm run -w frontend build` first.");
  process.exit(2);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const budgets = config.budgets;

const files = fs.readdirSync(ASSETS_DIR);
const stat = (f) => fs.statSync(path.join(ASSETS_DIR, f)).size;
const jsFiles = files.filter((f) => f.endsWith(".js"));
const cssFiles = files.filter((f) => f.endsWith(".css"));

const totalJsBytes = jsFiles.reduce((s, f) => s + stat(f), 0);
const totalCssBytes = cssFiles.reduce((s, f) => s + stat(f), 0);
const jsSizes = jsFiles.map((f) => ({ file: f, bytes: stat(f) }));
const largest = jsSizes.reduce((a, b) => (b.bytes > a.bytes ? b : a), { file: "", bytes: 0 });
const appCore = jsFiles.find((f) => f.startsWith("app-core"));
const appCoreBytes = appCore ? stat(appCore) : 0;

const kb = (b) => Math.round(b / 1024);
const checks = [
  { name: "totalJsSizeKB", value: kb(totalJsBytes), budget: budgets.totalJsSizeKB },
  { name: "totalCssSizeKB", value: kb(totalCssBytes), budget: budgets.totalCssSizeKB },
  { name: "totalJsFiles", value: jsFiles.length, budget: budgets.totalJsFiles },
  { name: "totalCssFiles", value: cssFiles.length, budget: budgets.totalCssFiles },
  { name: "maxChunkSizeKB", value: kb(largest.bytes), budget: budgets.maxChunkSizeKB, hint: largest.file },
  { name: "appCoreSizeKB", value: kb(appCoreBytes), budget: budgets.appCoreSizeKB, hint: appCore || "(app-core chunk not found)" },
];

console.log("# 📦 Bundle stats — frontend/build/client/assets");
console.log("");
let failed = 0;
for (const c of checks) {
  const ok = c.value <= c.budget;
  const sign = ok ? "✓" : "✘";
  const pct = c.budget ? Math.round((c.value / c.budget) * 100) : 0;
  const extra = c.hint ? `  ${c.hint}` : "";
  console.log(`${sign} ${c.name.padEnd(20)}: ${String(c.value).padStart(5)} / ${String(c.budget).padStart(5)} (${pct}%)${extra}`);
  if (!ok) failed++;
}
console.log("");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## 📦 Bundle stats",
    "",
    "Déterministe, mesuré directement sur `frontend/build/client/assets/` — pas de Lighthouse, pas de Chrome, pas de mocks.",
    "",
    "| Metric | Measured | Budget | Use % | Status |",
    "|--|--:|--:|--:|:--:|",
  ];
  for (const c of checks) {
    const pct = c.budget ? Math.round((c.value / c.budget) * 100) : 0;
    const status = c.value <= c.budget ? "✓" : "✘";
    lines.push(`| \`${c.name}\` | ${c.value} | ${c.budget} | ${pct}% | ${status} |`);
  }
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

if (failed) {
  console.log(`✘ ${failed} budget violation(s) — bundle regression detected.`);
  console.log("  Optimize the bloating change, or adjust frontend/bundle-stats.config.json with written justification in the README.");
  process.exit(1);
}
console.log("✓ All bundle budgets respected.");
