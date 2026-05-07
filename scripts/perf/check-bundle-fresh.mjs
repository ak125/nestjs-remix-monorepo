#!/usr/bin/env node
// Verify audit-reports/bundle-top10.json is fresh relative to the current
// frontend build. CI gate: fail if the report is missing, or if its
// generated_at is older than the most recent file in frontend/build/client/assets/.
//
// This prevents PRs from drifting bundle stats out of sync with code.

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const ASSETS_DIR = join(REPO_ROOT, 'frontend', 'build', 'client', 'assets');
const REPORT_PATH = join(REPO_ROOT, 'audit-reports', 'bundle-top10.json');

if (!existsSync(REPORT_PATH)) {
  console.error(`FAIL: ${REPORT_PATH} missing. Run "npm -w frontend run bundle:report".`);
  process.exit(1);
}

if (!existsSync(ASSETS_DIR)) {
  console.error(`SKIP: ${ASSETS_DIR} missing — no build to compare against.`);
  process.exit(0);
}

const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
const reportTime = new Date(report.generated_at).getTime();

const newestAssetTime = readdirSync(ASSETS_DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => statSync(join(ASSETS_DIR, f)).mtimeMs)
  .reduce((a, b) => Math.max(a, b), 0);

if (newestAssetTime > reportTime) {
  console.error(`FAIL: bundle-top10.json (${report.generated_at}) is older than build assets (${new Date(newestAssetTime).toISOString()}). Re-run "npm -w frontend run bundle:report" and commit.`);
  process.exit(1);
}

console.log(`OK: bundle-top10.json fresh (generated ${report.generated_at}).`);
