#!/usr/bin/env node
// Decompose each vendor + shared chunk into its source modules using
// rollup-plugin-visualizer raw-data JSON. Run 9 hypothesis checks for
// known bundle bloat patterns (dev runtime leaks, duplicate React,
// SSR fuites client, framer-motion, util duplications, manifest bloat).
//
// Prereqs: ANALYZE=true npm run build  (produces frontend/bundle-report.json)
// Output:  audit-reports/vendor-breakdown.json
//
// Usage: node scripts/perf/vendor-breakdown.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const REPORT_PATH = join(REPO_ROOT, 'frontend', 'bundle-report.json');
const ASSETS_DIR = join(REPO_ROOT, 'frontend', 'build', 'client', 'assets');
const NODE_MODULES = join(REPO_ROOT, 'node_modules');
const OUT_DIR = join(REPO_ROOT, 'audit-reports');
const OUT_PATH = join(OUT_DIR, 'vendor-breakdown.json');

if (!existsSync(REPORT_PATH)) {
  console.error(`ERROR: ${REPORT_PATH} not found.`);
  console.error('Run: ANALYZE=true npm -w frontend run build');
  process.exit(1);
}

const data = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
const { nodeMetas, nodeParts } = data;

// Group parts by chunk file via nodeMetas[].moduleParts → partUid → nodeParts.
// Structure: { 'react-vendor-XXX.js': [{ moduleId, size, gzip, brotli }, ...] }
const chunksToModules = {};
for (const [, meta] of Object.entries(nodeMetas)) {
  if (!meta.moduleParts) continue;
  for (const [chunkPath, partUid] of Object.entries(meta.moduleParts)) {
    // chunkPath examples: "assets/react-vendor-DqEHrgVY.js", "index.js"
    const chunkFile = chunkPath.replace(/^assets\//, '');
    if (!chunkFile.endsWith('.js')) continue;
    if (chunkFile.startsWith('server-build')) continue;
    const part = nodeParts[partUid];
    if (!part) continue;
    if (!chunksToModules[chunkFile]) chunksToModules[chunkFile] = [];
    chunksToModules[chunkFile].push({
      moduleId: meta.id,
      size: part.renderedLength || 0,
      gzip: part.gzipLength || 0,
      brotli: part.brotliLength || 0,
    });
  }
}

// Pick top vendor + shared chunks of interest.
const TARGETS = [
  /^react-vendor-/,
  /^app-core-/,
  /^radix-vendor-/,
  /^html-parser-vendor-/,
  /^lucide-vendor-/,
  /^carousel-vendor-/,
  /^cmdk-vendor-/,
  /^app-ui-primitives-/,
  /^app-shell-/,
  /^manifest-/,
];

function pickTargetChunks() {
  const matches = {};
  for (const chunkFile of Object.keys(chunksToModules)) {
    for (const re of TARGETS) {
      if (re.test(chunkFile)) {
        const niceName = chunkFile.replace(/-[A-Za-z0-9_-]{8}\.js$/, '');
        matches[niceName] = chunksToModules[chunkFile];
        break;
      }
    }
  }
  return matches;
}

const targetChunks = pickTargetChunks();

// For each target chunk, sort modules by size and keep top 10.
const breakdown = {};
for (const [chunk, modules] of Object.entries(targetChunks)) {
  modules.sort((a, b) => b.size - a.size);
  breakdown[chunk] = {
    total_modules: modules.length,
    total_size: modules.reduce((s, m) => s + m.size, 0),
    total_gzip: modules.reduce((s, m) => s + m.gzip, 0),
    top10: modules.slice(0, 10).map(({ moduleId, size, gzip }) => ({
      moduleId: moduleId.replace(REPO_ROOT, ''),
      size,
      gzip,
    })),
  };
}

// ─── 9 hypothesis checks ─────────────────────────────────────────────

const flags = {};

// Helper: search all built JS chunks for a literal string
function grepBundle(needle) {
  const hits = [];
  if (!existsSync(ASSETS_DIR)) return hits;
  for (const f of readdirSync(ASSETS_DIR)) {
    if (!f.endsWith('.js')) continue;
    const path = join(ASSETS_DIR, f);
    const content = readFileSync(path, 'utf8');
    if (content.includes(needle)) hits.push(f);
  }
  return hits;
}

// 1. React DevTools embarqué côté prod
flags.devtools_leak = grepBundle('__REACT_DEVTOOLS_GLOBAL_HOOK__').length > 0
  ? grepBundle('__REACT_DEVTOOLS_GLOBAL_HOOK__')
  : false;

// 2. Duplications versions React (multiple copies of the actual `react` package).
// Only counts dirs whose package.json `name` field is exactly "react"
// (filters out `@mdx-js/react`, `@remix-run/react`, etc., which are
// React consumers, not React copies).
const reactDirs = [];
function findReactDirs(dir, depth = 0) {
  if (depth > 4) return;
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (!st.isDirectory()) continue;
    if (entry === 'react' && existsSync(join(full, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(join(full, 'package.json'), 'utf8'));
        if (pkg.name === 'react') {
          reactDirs.push({ path: relative(REPO_ROOT, full), version: pkg.version });
        }
      } catch { /* skip */ }
    } else if (entry === 'node_modules' || depth === 0) {
      findReactDirs(full, depth + 1);
    }
  }
}
findReactDirs(NODE_MODULES, 0);
flags.duplicate_react_versions = reactDirs.length > 1 ? reactDirs : false;

// 3. react-dom-server fuites côté client (renderToString / renderToPipeableStream
//    appeared inside any client bundle is a leak — it's SSR-only)
const ssrLeak = grepBundle('renderToPipeableStream').filter((f) => !f.includes('server-build'));
flags.react_dom_server_leak = ssrLeak.length > 0 ? ssrLeak : false;

// 4. JSX dev runtime (must NEVER appear in production build)
const devRuntime = grepBundle('jsx-dev-runtime');
flags.jsx_dev_runtime_leak = devRuntime.length > 0 ? devRuntime : false;

// 5. PropTypes runtime (legacy React, often dragged in by old deps)
const proptypesPath = join(NODE_MODULES, 'prop-types');
flags.proptypes_in_node_modules = existsSync(proptypesPath);

// 6. html-react-parser : how many ROUTES use it?
const routesDir = join(REPO_ROOT, 'frontend', 'app', 'routes');
let htmlParserRoutes = 0;
if (existsSync(routesDir)) {
  const grep = (p) => {
    if (!existsSync(p)) return;
    for (const e of readdirSync(p)) {
      const full = join(p, e);
      const st = statSync(full);
      if (st.isDirectory()) grep(full);
      else if (/\.tsx?$/.test(e)) {
        const c = readFileSync(full, 'utf8');
        if (c.includes('html-react-parser') || c.includes('parseHtml')) htmlParserRoutes++;
      }
    }
  };
  grep(routesDir);
}
flags.html_parser_consumer_count = htmlParserRoutes;

// 7. framer-motion presence
const fmPath = join(NODE_MODULES, 'framer-motion');
flags.framer_motion_in_node_modules = existsSync(fmPath);

// 8. Duplications utilitaires : multiple copies of actual lib package
//    (filtered by package.json `name` to ignore @types/* and namespaced cousins).
//    Note : a lib living under node_modules/<dev-tool>/node_modules/<lib>/
//    is dev-only (e.g. knip, bullmq) — flagged but not blocking for prod bundle.
const utilDups = {};
for (const lib of ['clsx', 'tailwind-merge', 'zod', 'nanoid', 'uuid']) {
  const dirs = [];
  function findLib(dir, depth = 0) {
    if (depth > 4) return;
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (!st.isDirectory()) continue;
      if (entry === lib && existsSync(join(full, 'package.json'))) {
        try {
          const pkg = JSON.parse(readFileSync(join(full, 'package.json'), 'utf8'));
          if (pkg.name === lib) {
            const path = relative(REPO_ROOT, full);
            const isDevToolNested = /node_modules\/[^/]+\/node_modules\//.test(path);
            dirs.push({ path, version: pkg.version, dev_only: isDevToolNested });
          }
        } catch { /* skip */ }
      } else if (entry === 'node_modules' || depth === 0) {
        findLib(full, depth + 1);
      }
    }
  }
  findLib(NODE_MODULES, 0);
  // Only flag if more than 1 NON-dev-only copy
  const prodDirs = dirs.filter((d) => !d.dev_only);
  if (prodDirs.length > 1) utilDups[lib] = dirs;
}
flags.duplicate_utilities = Object.keys(utilDups).length > 0 ? utilDups : false;

// 9. manifest bloat: with v3_lazyRouteDiscovery: true, manifest should be ~5 KB initial
const manifestChunk = breakdown.manifest;
flags.manifest_size_kb = manifestChunk
  ? Math.round(manifestChunk.total_size / 1024)
  : 'not_found';
flags.manifest_bloat = flags.manifest_size_kb > 20;

// ─── Output ─────────────────────────────────────────────────────────

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Note: rollup-plugin-visualizer captures only the chunks emitted in the
// rollup pass it observes. With Vite + Remix dual-build (server + client),
// some client vendor chunks (react-vendor, radix-vendor, lucide-vendor,
// html-parser-vendor, manifest) may be absent from `bundle-report.json`.
// File-based grep checks (devtools_leak, jsx_dev_runtime_leak,
// react_dom_server_leak) cover those chunks via the raw build/client/assets/
// directory regardless. Module-by-module breakdown of vendor chunks is
// best-effort — chunks not present in the visualizer output are listed as
// missing in the report.
const allCapturedChunks = new Set(Object.keys(chunksToModules));
const expectedVendors = [
  'react-vendor', 'radix-vendor', 'lucide-vendor', 'html-parser-vendor',
  'carousel-vendor', 'cmdk-vendor', 'manifest',
];
const missing = expectedVendors.filter(
  (v) => !Object.keys(breakdown).includes(v) &&
         ![...allCapturedChunks].some((c) => c.startsWith(v + '-')),
);

const out = {
  generated_at: new Date().toISOString(),
  source: 'frontend/bundle-report.json (rollup-plugin-visualizer raw-data)',
  visualizer_coverage: {
    captured: Object.keys(breakdown).sort(),
    missing_from_visualizer: missing,
    note: 'Missing chunks indicate visualizer plugin missed them in dual server/client rollup pass. File-based flag checks still cover them.',
  },
  flags,
  breakdown,
};
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');

// Human-readable summary
console.error('');
console.error('=== Vendor breakdown ===');
for (const [chunk, info] of Object.entries(breakdown)) {
  console.error(`\n${chunk} (${(info.total_size / 1024).toFixed(0)} KB / ${(info.total_gzip / 1024).toFixed(0)} KB gzip, ${info.total_modules} modules):`);
  for (const m of info.top10.slice(0, 5)) {
    console.error(`  ${(m.size / 1024).toFixed(1).padStart(6)} KB  ${m.moduleId}`);
  }
}
console.error('');
console.error('=== Flags ===');
for (const [k, v] of Object.entries(flags)) {
  if (v === false) {
    console.error(`  ✓ ${k}: clean`);
  } else if (typeof v === 'number') {
    console.error(`  ℹ ${k}: ${v}`);
  } else {
    console.error(`  ⚠ ${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : v}`);
  }
}
console.error('');
console.error(`Wrote ${OUT_PATH}`);
