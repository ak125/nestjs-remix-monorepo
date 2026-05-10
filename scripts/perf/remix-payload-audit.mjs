#!/usr/bin/env node
// Fetch each target URL, extract window.__remixContext from the SSR HTML,
// measure loader data sizes, detect duplicated entities across nested
// route loaders, and write audit-reports/remix-payload-report.json.
//
// Usage:
//   node scripts/perf/remix-payload-audit.mjs <base_url> [path1] [path2] ...
//   node scripts/perf/remix-payload-audit.mjs https://automecanik.com /
//
// If no paths are given, defaults to the 3 Lighthouse-cible URLs from
// perf-gates.yml (cf. lighthouse-budget.README.md):
//   /, /pieces/embrayage-303-1.html, /constructeurs/renault-140.html

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const OUT_DIR = join(REPO_ROOT, 'audit-reports');
const OUT_PATH = join(OUT_DIR, 'remix-payload-report.json');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/perf/remix-payload-audit.mjs <base_url> [path...]');
  console.error('Example: node scripts/perf/remix-payload-audit.mjs http://localhost:3000');
  process.exit(2);
}

const baseUrl = args[0].replace(/\/$/, '');
const paths = args.slice(1).length > 0
  ? args.slice(1)
  : ['/', '/pieces/embrayage-303-1.html', '/constructeurs/renault-140.html'];

// Extract `window.__remixContext = {...};` from HTML.
// The Remix SSR injects a single line setting this global.
function extractRemixContext(html) {
  const match = html.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return null;
  try {
    // The injected JSON-like value can include unquoted keys + JS values
    // (undefined, RegExp, etc.). Remix uses a custom serializer; for
    // measurement-only we accept that direct JSON.parse may fail and fall
    // back to raw byte-length measurement of the captured string.
    return { raw: match[1], parsed: JSON.parse(match[1]) };
  } catch {
    return { raw: match[1], parsed: null };
  }
}

// Detect duplicated entities (same JSON sub-object appearing in ≥ 2 routes).
// Uses serialized JSON as identity key, threshold 500 octets to ignore
// trivial primitives.
function findDuplicates(loaderData) {
  if (!loaderData || typeof loaderData !== 'object') return [];
  const counts = new Map();
  for (const [routeId, data] of Object.entries(loaderData)) {
    walkAndIndex(data, routeId, counts);
  }
  const dups = [];
  for (const [key, occurrences] of counts.entries()) {
    if (occurrences.length < 2) continue;
    if (key.length < 500) continue;
    dups.push({
      bytes: key.length,
      preview: key.slice(0, 120),
      seen_in_routes: occurrences,
    });
  }
  return dups.sort((a, b) => b.bytes - a.bytes).slice(0, 10);
}

function walkAndIndex(value, routeId, counts) {
  if (!value || typeof value !== 'object') return;
  // Index this object node
  let key;
  try { key = JSON.stringify(value); } catch { return; }
  if (key && key.length >= 500) {
    if (!counts.has(key)) counts.set(key, []);
    if (!counts.get(key).includes(routeId)) counts.get(key).push(routeId);
  }
  if (Array.isArray(value)) {
    for (const v of value) walkAndIndex(v, routeId, counts);
  } else {
    for (const v of Object.values(value)) walkAndIndex(v, routeId, counts);
  }
}

// Sort loader data by serialized size, top 5.
function topLoaders(loaderData) {
  if (!loaderData || typeof loaderData !== 'object') return [];
  return Object.entries(loaderData)
    .map(([routeId, data]) => {
      const json = data == null ? 'null' : JSON.stringify(data);
      return { routeId, bytes: Buffer.byteLength(json) };
    })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);
}

async function auditPath(p) {
  const url = baseUrl + p;
  let html;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'AutoMecanik-RemixPayloadAudit/1.0' },
    });
    if (!res.ok) {
      return { url: p, error: `HTTP ${res.status}` };
    }
    html = await res.text();
  } catch (err) {
    return { url: p, error: `Fetch failed: ${err.message}` };
  }
  const ctx = extractRemixContext(html);
  if (!ctx) {
    return {
      url: p,
      error: 'window.__remixContext not found in HTML',
      html_size: Buffer.byteLength(html),
    };
  }
  const rawBytes = Buffer.byteLength(ctx.raw);
  const loaderData = ctx.parsed?.state?.loaderData ?? null;
  const top5 = topLoaders(loaderData);
  const dups = findDuplicates(loaderData);
  return {
    url: p,
    fetched: url,
    html_size: Buffer.byteLength(html),
    html_gzip: gzipSync(html).length,
    html_brotli: brotliCompressSync(html).length,
    remix_context_size_raw: rawBytes,
    remix_context_parseable: ctx.parsed !== null,
    loader_routes: loaderData ? Object.keys(loaderData).length : 0,
    loader_top5: top5,
    duplicates: dups,
  };
}

const results = [];
for (const p of paths) {
  // eslint-disable-next-line no-await-in-loop
  const r = await auditPath(p);
  results.push(r);
}

const flags = {
  any_unparseable_context: results.some((r) => r.remix_context_parseable === false),
  duplicated_entities: results.some((r) => r.duplicates && r.duplicates.length > 0),
  oversized_context: results.some(
    (r) => typeof r.remix_context_size_raw === 'number' && r.remix_context_size_raw > 120000,
  ),
  any_fetch_error: results.some((r) => r.error),
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const out = {
  generated_at: new Date().toISOString(),
  base_url: baseUrl,
  flags,
  urls: results,
};
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');

// Human-readable summary
console.error('');
console.error('=== Remix payload audit ===');
console.error(`Base URL: ${baseUrl}`);
for (const r of results) {
  console.error('');
  console.error(`URL: ${r.url}`);
  if (r.error) {
    console.error(`  ERROR: ${r.error}`);
    continue;
  }
  console.error(`  HTML: ${(r.html_size / 1024).toFixed(0)} KB raw / ${(r.html_gzip / 1024).toFixed(0)} KB gzip`);
  console.error(`  __remixContext: ${(r.remix_context_size_raw / 1024).toFixed(0)} KB raw (parseable: ${r.remix_context_parseable})`);
  console.error(`  Loader routes: ${r.loader_routes}`);
  if (r.loader_top5.length) {
    console.error('  Top 5 loaders:');
    for (const l of r.loader_top5) {
      console.error(`    ${(l.bytes / 1024).toFixed(1).padStart(6)} KB  ${l.routeId}`);
    }
  }
  if (r.duplicates.length) {
    console.error(`  Duplicates detected: ${r.duplicates.length}`);
    for (const d of r.duplicates.slice(0, 3)) {
      console.error(`    ${(d.bytes / 1024).toFixed(1)} KB seen in: ${d.seen_in_routes.join(', ')}`);
    }
  } else {
    console.error('  Duplicates: none ≥ 500 octets');
  }
}
console.error('');
console.error('=== Flags ===');
for (const [k, v] of Object.entries(flags)) {
  console.error(`  ${v ? '⚠' : '✓'} ${k}: ${v}`);
}
console.error('');
console.error(`Wrote ${OUT_PATH}`);
