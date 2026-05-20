#!/usr/bin/env tsx
/**
 * sample-smoke-urls — déterministe par seed, lit le sitemap PROD, stratifie
 * et émet sur stdout 150 URLs (50 pieces + 50 constructeurs + 50 long-tail
 * rotatif). Une URL par ligne. Stderr pour logs.
 *
 * Pourquoi : le workflow prod-smoke-tests.yml v1 ne testait que 12 URLs
 * hardcodées. v2 étend à 150 URLs stratifiées avec seed = date du jour
 * (`YYYYMMDD`), reproductible toute la journée mais rotatif quotidiennement.
 *
 * Usage :
 *   tsx scripts/ci/sample-smoke-urls.ts [--seed=YYYYMMDD] [--total=150]
 *
 * Exemple :
 *   tsx scripts/ci/sample-smoke-urls.ts --seed=20260514
 *   # → 150 lignes URL stdout, manifest JSON dans audit-reports/prod-smoke/...
 */

import * as fs from 'fs';
import * as path from 'path';

const PROD_BASE = 'https://www.automecanik.com';
const UA = 'AutoMecanikSmokeSampler/1.0 (+CI)';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v ?? 'true';
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const SEED = parseInt(args.seed ?? new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10);
const TOTAL = parseInt(args.total ?? '150', 10);
const PIECES_TARGET = Math.floor(TOTAL / 3);
const CONSTRUCTEURS_TARGET = Math.floor(TOTAL / 3);
const LONGTAIL_TARGET = TOTAL - PIECES_TARGET - CONSTRUCTEURS_TARGET;

function log(msg: string): void {
  process.stderr.write(`[sample-smoke-urls] ${msg}\n`);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function fetchXml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) out.push(m[1]);
  return out;
}

async function main(): Promise<void> {
  log(`seed=${SEED} total=${TOTAL} pieces=${PIECES_TARGET} constructeurs=${CONSTRUCTEURS_TARGET} longtail=${LONGTAIL_TARGET}`);

  const indexXml = await fetchXml(`${PROD_BASE}/sitemap.xml`);
  const subs = extractLocs(indexXml);
  log(`${subs.length} sub-sitemaps in index`);

  const allUrls: string[] = [];
  for (const sub of subs) {
    try {
      const subXml = await fetchXml(sub);
      allUrls.push(...extractLocs(subXml));
    } catch (e) {
      log(`  warn: failed ${sub}: ${(e as Error).message}`);
    }
  }
  log(`${allUrls.length} URLs in sitemap`);

  const pieces = allUrls.filter((u) => /\/pieces\/.+\.html$/.test(u));
  const constructeurs = allUrls.filter((u) => /\/constructeurs\/.+\.html$/.test(u));
  const longtail = allUrls.filter((u) => !/\/pieces\/.+\.html$/.test(u) && !/\/constructeurs\/.+\.html$/.test(u));

  log(`pieces=${pieces.length} constructeurs=${constructeurs.length} longtail=${longtail.length}`);

  const rng = mulberry32(SEED);
  const sample = [
    ...shuffleSeeded(pieces, rng).slice(0, PIECES_TARGET),
    ...shuffleSeeded(constructeurs, rng).slice(0, CONSTRUCTEURS_TARGET),
    ...shuffleSeeded(longtail, rng).slice(0, LONGTAIL_TARGET),
  ];

  for (const u of sample) {
    process.stdout.write(u + '\n');
  }

  // Audit-trail manifest
  const date = new Date().toISOString().slice(0, 10);
  const runId = process.env.GITHUB_RUN_ID ?? 'local';
  const dir = path.join('audit-reports', 'prod-smoke', date);
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, `run-${runId}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    seed: SEED,
    total: TOTAL,
    pieces_target: PIECES_TARGET,
    constructeurs_target: CONSTRUCTEURS_TARGET,
    longtail_target: LONGTAIL_TARGET,
    sample_count: sample.length,
    sitemap_subs: subs.length,
    sitemap_urls: allUrls.length,
    urls: sample,
    generated_at: new Date().toISOString(),
    github_run_id: runId,
  }, null, 2));
  log(`manifest written to ${manifestPath}`);
}

main().catch((e) => {
  log(`FATAL: ${(e as Error).stack ?? e}`);
  process.exit(2);
});
