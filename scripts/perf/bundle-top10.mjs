#!/usr/bin/env node
// Parse frontend/build/client/assets/*.js, classify chunks, emit
// audit-reports/bundle-top10.json (signal-proven baseline for ADR-051).
//
// Usage: node scripts/perf/bundle-top10.mjs [--baseline]
//   --baseline : also write audit-reports/bundle-top10.baseline.json (frozen reference)

import { readdirSync, statSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const ASSETS_DIR = join(REPO_ROOT, 'frontend', 'build', 'client', 'assets');
const REPORTS_DIR = join(REPO_ROOT, 'audit-reports');
const OUT_PATH = join(REPORTS_DIR, 'bundle-top10.json');
const BASELINE_PATH = join(REPORTS_DIR, 'bundle-top10.baseline.json');

const VENDOR_PATTERNS = [
  'react-vendor', 'radix-vendor', 'lucide-vendor', 'html-parser-vendor',
  'carousel-vendor', 'cmdk-vendor', 'query-vendor', 'schema-vendor',
];
const SHARED_PATTERNS = ['app-core', 'app-ui-primitives', 'app-shell'];

// Vite content hashes are usually 8 chars but can contain `-` (base64url-ish),
// so a strict alphanum strip misses chunks like `radix-vendor-Dt-o3bp4.js`.
// Strategy: prefix-match against known vendor/shared/entry/manifest names
// first, fall back to lenient hash strip for route chunks.
function classify(file) {
  if (file.startsWith('manifest-')) return { category: 'manifest', name: 'manifest' };
  if (file.startsWith('root-')) return { category: 'entry', name: 'root' };
  if (file.startsWith('entry.client-')) return { category: 'entry', name: 'entry.client' };
  for (const v of VENDOR_PATTERNS) {
    if (file.startsWith(v + '-')) return { category: 'vendor', name: v };
  }
  for (const s of SHARED_PATTERNS) {
    if (file.startsWith(s + '-')) return { category: 'shared', name: s };
  }
  // Route chunk: strip exactly 8-char hash (Vite default), allowing `-`/`_`
  // in the hash itself (base64url-ish encoding).
  const name = file.replace(/-[A-Za-z0-9_-]{8}\.js$/, '');
  return { category: 'route', name };
}

function readChunks() {
  if (!existsSync(ASSETS_DIR)) {
    console.error(`ERROR: ${ASSETS_DIR} not found. Run "npm -w frontend run build" first.`);
    process.exit(1);
  }
  const files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.js'));
  const chunks = files.map((file) => {
    const path = join(ASSETS_DIR, file);
    const raw = readFileSync(path);
    const { category, name } = classify(file);
    return {
      file,
      name,
      category,
      size: raw.length,
      gzip: gzipSync(raw).length,
      brotli: brotliCompressSync(raw).length,
    };
  });
  chunks.sort((a, b) => b.size - a.size);
  return chunks;
}

function summary(chunks) {
  const byCategory = {};
  for (const c of chunks) {
    if (!byCategory[c.category]) byCategory[c.category] = { count: 0, size: 0, gzip: 0, brotli: 0 };
    byCategory[c.category].count += 1;
    byCategory[c.category].size += c.size;
    byCategory[c.category].gzip += c.gzip;
    byCategory[c.category].brotli += c.brotli;
  }
  return byCategory;
}

function build() {
  const chunks = readChunks();
  const total = {
    count: chunks.length,
    size: chunks.reduce((s, c) => s + c.size, 0),
    gzip: chunks.reduce((s, c) => s + c.gzip, 0),
    brotli: chunks.reduce((s, c) => s + c.brotli, 0),
  };
  return {
    generated_at: new Date().toISOString(),
    total,
    by_category: summary(chunks),
    top10: chunks.slice(0, 10).map(({ file, name, category, size, gzip, brotli }) => ({
      file, name, category, size, gzip, brotli,
    })),
    chunks: chunks.map(({ file, name, category, size, gzip, brotli }) => ({
      file, name, category, size, gzip, brotli,
    })),
  };
}

function main() {
  const args = process.argv.slice(2);
  const writeBaseline = args.includes('--baseline');

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  const report = build();
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote ${OUT_PATH}`);

  if (writeBaseline) {
    writeFileSync(BASELINE_PATH, JSON.stringify(report, null, 2) + '\n');
    console.log(`Wrote ${BASELINE_PATH} (frozen baseline)`);
  }

  // Human-readable summary on stderr
  console.error('');
  console.error('=== Bundle summary ===');
  console.error(`Total: ${report.total.count} chunks, ${(report.total.size / 1024).toFixed(0)} KB raw / ${(report.total.gzip / 1024).toFixed(0)} KB gzip / ${(report.total.brotli / 1024).toFixed(0)} KB brotli`);
  console.error('');
  console.error('By category:');
  for (const [cat, s] of Object.entries(report.by_category)) {
    console.error(`  ${cat.padEnd(12)} ${String(s.count).padStart(4)} chunks  ${(s.size / 1024).toFixed(0).padStart(6)} KB raw  ${(s.gzip / 1024).toFixed(0).padStart(5)} KB gzip`);
  }
  console.error('');
  console.error('Top 10:');
  for (const c of report.top10) {
    console.error(`  ${c.name.padEnd(32)} ${(c.size / 1024).toFixed(0).padStart(5)} KB raw  ${(c.gzip / 1024).toFixed(0).padStart(4)} KB gzip  [${c.category}]`);
  }
}

main();
