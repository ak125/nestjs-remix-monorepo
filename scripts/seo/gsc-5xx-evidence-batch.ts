/**
 * gsc-5xx-evidence-batch — Phase A evidence pack pour incident GSC 5xx.
 *
 * Audit empirique HTTP des URLs SEO critiques (pieces/* et constructeurs/*),
 * stratifié par pattern + type_id range + gamme. Reproductible via seed.
 *
 * Usage:
 *   npx tsx scripts/seo/gsc-5xx-evidence-batch.ts [options]
 *
 * Options:
 *   --sample-size=N      Total URLs à tester (default 5000)
 *   --seed=N             Seed du sample (default = unix time)
 *   --concurrency=N      Pool parallel GET (default 10)
 *   --timeout-ms=N       Timeout par requête (default 15000)
 *   --output-dir=PATH    Dossier output (default audit-reports/seo-smoke/$(date +%F))
 *   --help               Show this help
 *
 * Output:
 *   <output-dir>/gsc-5xx-evidence-final.json
 *   <output-dir>/gsc-5xx-evidence-final.md
 *
 * Le JSON contient meta.seed + meta.source_lists + meta.sitemap_revision_hash +
 * meta.script_git_sha pour reproductibilité.
 *
 * Critère de sortie : taux 5xx < 0.5% sur sample >= 5000 → poursuivre Phase B/C.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../backend/.env'), quiet: true } as dotenv.DotenvConfigOptions);

// ── Constants ────────────────────────────────────────────────────────────────

const PROD_BASE = 'https://www.automecanik.com';
const UA_GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const STRATA = {
  pieces_legacy: { pattern: '/pieces/', range: [0, 60000], weight: 0.30 },
  pieces_remapped: { pattern: '/pieces/', range: [60000, 83456], weight: 0.10 },
  pieces_high: { pattern: '/pieces/', range: [83456, Infinity], weight: 0.10 },
  constructeurs_legacy: { pattern: '/constructeurs/', range: [0, 60000], weight: 0.30 },
  constructeurs_remapped: { pattern: '/constructeurs/', range: [60000, 83456], weight: 0.10 },
  constructeurs_high: { pattern: '/constructeurs/', range: [83456, Infinity], weight: 0.10 },
} as const;

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (const a of argv.slice(2)) {
    if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      args[k] = v ?? true;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
if (args.help) {
  process.stdout.write(`Usage: tsx scripts/seo/gsc-5xx-evidence-batch.ts [--sample-size=5000] [--seed=N] [--concurrency=10] [--timeout-ms=15000] [--output-dir=PATH]\n`);
  process.exit(0);
}

const SAMPLE_SIZE = parseInt(String(args['sample-size'] ?? '5000'), 10);
const SEED = parseInt(String(args.seed ?? Date.now()), 10);
const CONCURRENCY = parseInt(String(args.concurrency ?? '10'), 10);
const TIMEOUT_MS = parseInt(String(args['timeout-ms'] ?? '15000'), 10);
const TODAY = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = String(args['output-dir'] ?? path.join('audit-reports', 'seo-smoke', TODAY));

// ── Logging ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

// ── Seeded PRNG (mulberry32, deterministic) ──────────────────────────────────

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

// ── Types ────────────────────────────────────────────────────────────────────

interface UrlCandidate {
  url: string;
  pattern: 'pieces' | 'constructeurs';
  type_id: number | null;
  stratum: keyof typeof STRATA;
  source: 'sitemap_v10' | 'gsc_example';
}

interface ProbeResult {
  url: string;
  pattern: 'pieces' | 'constructeurs';
  type_id: number | null;
  stratum: keyof typeof STRATA;
  http_code: number | null;
  cf_cache_status: string | null;
  cf_ray: string | null;
  age: string | null;
  cache_control: string | null;
  ttfb_ms: number | null;
  content_length: number | null;
  error: string | null;
}

interface EvidencePack {
  meta: {
    generated_at: string;
    seed: number;
    sample_size_requested: number;
    sample_size_effective: number;
    concurrency: number;
    timeout_ms: number;
    source_lists: string[];
    sitemap_revision_hash: string | null;
    script_git_sha: string;
    user_agent: string;
    prod_base: string;
  };
  totals: {
    total_probed: number;
    http_2xx: number;
    http_3xx: number;
    http_4xx: number;
    http_5xx: number;
    error: number;
    rate_5xx: number;
  };
  by_stratum: Record<string, { probed: number; rate_5xx: number; rate_cf_hit: number }>;
  top_5xx: ProbeResult[];
  full_results_path: string;
}

// ── Sitemap source ───────────────────────────────────────────────────────────

async function fetchSitemapIndex(): Promise<string[]> {
  const indexUrl = `${PROD_BASE}/sitemap.xml`;
  log(`📥 Fetching sitemap index ${indexUrl}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(indexUrl, { signal: ctrl.signal, headers: { 'User-Agent': UA_GOOGLEBOT } });
    const xml = await res.text();
    const subs: string[] = [];
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (m[1].includes('/pieces') || m[1].includes('/constructeurs')) subs.push(m[1]);
    }
    return subs;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSitemapUrls(subUrl: string): Promise<string[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(subUrl, { signal: ctrl.signal, headers: { 'User-Agent': UA_GOOGLEBOT } });
    const xml = await res.text();
    const urls: string[] = [];
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      urls.push(m[1]);
    }
    return urls;
  } catch (e) {
    log(`  ⚠ failed to fetch ${subUrl}: ${(e as Error).message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function classify(url: string): UrlCandidate | null {
  const pattern = url.includes('/pieces/') ? 'pieces' : url.includes('/constructeurs/') ? 'constructeurs' : null;
  if (!pattern) return null;
  const m = url.match(/-(\d+)\.html$/);
  const type_id = m ? parseInt(m[1], 10) : null;
  let stratum: keyof typeof STRATA;
  if (pattern === 'pieces') {
    stratum = type_id == null || type_id < 60000 ? 'pieces_legacy' : type_id < 83456 ? 'pieces_remapped' : 'pieces_high';
  } else {
    stratum = type_id == null || type_id < 60000 ? 'constructeurs_legacy' : type_id < 83456 ? 'constructeurs_remapped' : 'constructeurs_high';
  }
  return { url, pattern, type_id, stratum, source: 'sitemap_v10' };
}

function stratifiedSample(candidates: UrlCandidate[], rng: () => number, total: number): UrlCandidate[] {
  const byStratum: Record<string, UrlCandidate[]> = {};
  for (const c of candidates) {
    (byStratum[c.stratum] ??= []).push(c);
  }
  const out: UrlCandidate[] = [];
  for (const [k, weight] of Object.entries(STRATA).map(([k, v]) => [k, v.weight] as const)) {
    const want = Math.max(1, Math.floor(total * weight));
    const pool = byStratum[k] ?? [];
    const shuffled = shuffleSeeded(pool, rng);
    out.push(...shuffled.slice(0, want));
  }
  return out;
}

// ── HTTP probe ───────────────────────────────────────────────────────────────

async function probe(url: string, cand: UrlCandidate): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA_GOOGLEBOT },
      redirect: 'manual',
    });
    const ttfb = Date.now() - t0;
    const body = await res.text();
    return {
      url,
      pattern: cand.pattern,
      type_id: cand.type_id,
      stratum: cand.stratum,
      http_code: res.status,
      cf_cache_status: res.headers.get('cf-cache-status'),
      cf_ray: res.headers.get('cf-ray'),
      age: res.headers.get('age'),
      cache_control: res.headers.get('cache-control'),
      ttfb_ms: ttfb,
      content_length: body.length,
      error: null,
    };
  } catch (e) {
    return {
      url,
      pattern: cand.pattern,
      type_id: cand.type_id,
      stratum: cand.stratum,
      http_code: null,
      cf_cache_status: null,
      cf_ray: null,
      age: null,
      cache_control: null,
      ttfb_ms: Date.now() - t0,
      content_length: null,
      error: (e as Error).message ?? 'unknown',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probeAll(cands: UrlCandidate[]): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  let i = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (i < cands.length) {
      const idx = i++;
      const c = cands[idx];
      results[idx] = await probe(c.url, c);
      done++;
      if (done % 100 === 0) log(`  probed ${done}/${cands.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const t0 = Date.now();
  log(`🌱 seed=${SEED} sample=${SAMPLE_SIZE} concurrency=${CONCURRENCY}`);
  const rng = mulberry32(SEED);

  // 1) Collect candidates from sitemap
  const subSitemaps = await fetchSitemapIndex();
  log(`📑 ${subSitemaps.length} sub-sitemaps`);
  const allUrls: string[] = [];
  for (const sub of subSitemaps) {
    const urls = await fetchSitemapUrls(sub);
    allUrls.push(...urls);
  }
  log(`📦 ${allUrls.length} URLs in sitemap`);

  const candidates = allUrls.map(classify).filter((c): c is UrlCandidate => c !== null);
  log(`🎯 ${candidates.length} eligible (pieces/constructeurs)`);

  const sample = stratifiedSample(candidates, rng, SAMPLE_SIZE);
  log(`🎲 ${sample.length} sampled (seeded)`);

  // 2) Probe
  const results = await probeAll(sample);

  // 3) Aggregate
  const totals = {
    total_probed: results.length,
    http_2xx: 0,
    http_3xx: 0,
    http_4xx: 0,
    http_5xx: 0,
    error: 0,
    rate_5xx: 0,
  };
  const byStratum: Record<string, { probed: number; rate_5xx: number; rate_cf_hit: number }> = {};
  for (const k of Object.keys(STRATA)) {
    byStratum[k] = { probed: 0, rate_5xx: 0, rate_cf_hit: 0 };
  }
  for (const r of results) {
    if (r.error != null) totals.error++;
    else if (r.http_code == null) totals.error++;
    else if (r.http_code >= 500) totals.http_5xx++;
    else if (r.http_code >= 400) totals.http_4xx++;
    else if (r.http_code >= 300) totals.http_3xx++;
    else if (r.http_code >= 200) totals.http_2xx++;
    const bs = byStratum[r.stratum];
    bs.probed++;
    if (r.http_code != null && r.http_code >= 500) bs.rate_5xx++;
    if (r.cf_cache_status === 'HIT') bs.rate_cf_hit++;
  }
  totals.rate_5xx = totals.total_probed > 0 ? totals.http_5xx / totals.total_probed : 0;
  for (const k of Object.keys(byStratum)) {
    const bs = byStratum[k];
    bs.rate_5xx = bs.probed > 0 ? bs.rate_5xx / bs.probed : 0;
    bs.rate_cf_hit = bs.probed > 0 ? bs.rate_cf_hit / bs.probed : 0;
  }

  const top5xx = results
    .filter((r) => r.http_code != null && r.http_code >= 500)
    .slice(0, 30);

  // 4) Build evidence
  let gitSha = 'unknown';
  try {
    gitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch { /* not a git repo */ }

  const sitemapRevHash = crypto.createHash('sha256').update(allUrls.join('\n')).digest('hex').slice(0, 16);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const fullResultsPath = path.join(OUTPUT_DIR, 'gsc-5xx-evidence-full.json');
  fs.writeFileSync(fullResultsPath, JSON.stringify(results, null, 2));

  const pack: EvidencePack = {
    meta: {
      generated_at: new Date().toISOString(),
      seed: SEED,
      sample_size_requested: SAMPLE_SIZE,
      sample_size_effective: results.length,
      concurrency: CONCURRENCY,
      timeout_ms: TIMEOUT_MS,
      source_lists: ['sitemap_v10'],
      sitemap_revision_hash: sitemapRevHash,
      script_git_sha: gitSha,
      user_agent: UA_GOOGLEBOT,
      prod_base: PROD_BASE,
    },
    totals,
    by_stratum: byStratum,
    top_5xx: top5xx,
    full_results_path: fullResultsPath,
  };

  const finalJsonPath = path.join(OUTPUT_DIR, 'gsc-5xx-evidence-final.json');
  fs.writeFileSync(finalJsonPath, JSON.stringify(pack, null, 2));

  // Markdown summary
  const md: string[] = [];
  md.push(`# Evidence pack — Phase A GSC 5xx audit`);
  md.push('');
  md.push(`**Generated** : ${pack.meta.generated_at}`);
  md.push(`**Seed (reproductible)** : \`${pack.meta.seed}\``);
  md.push(`**Script git sha** : \`${pack.meta.script_git_sha}\``);
  md.push(`**Sitemap revision hash** : \`${pack.meta.sitemap_revision_hash}\``);
  md.push(`**Sample** : ${pack.meta.sample_size_effective} / ${pack.meta.sample_size_requested} requested`);
  md.push('');
  md.push(`## Totaux`);
  md.push('');
  md.push(`| Code | Count | Rate |`);
  md.push(`|---|---|---|`);
  md.push(`| 2xx | ${totals.http_2xx} | ${((totals.http_2xx / totals.total_probed) * 100).toFixed(2)}% |`);
  md.push(`| 3xx | ${totals.http_3xx} | ${((totals.http_3xx / totals.total_probed) * 100).toFixed(2)}% |`);
  md.push(`| 4xx | ${totals.http_4xx} | ${((totals.http_4xx / totals.total_probed) * 100).toFixed(2)}% |`);
  md.push(`| **5xx** | **${totals.http_5xx}** | **${(totals.rate_5xx * 100).toFixed(3)}%** |`);
  md.push(`| error | ${totals.error} | ${((totals.error / totals.total_probed) * 100).toFixed(2)}% |`);
  md.push('');
  md.push(`## Par stratum`);
  md.push('');
  md.push(`| Stratum | Probed | 5xx rate | CF HIT rate |`);
  md.push(`|---|---|---|---|`);
  for (const [k, v] of Object.entries(byStratum)) {
    md.push(`| ${k} | ${v.probed} | ${(v.rate_5xx * 100).toFixed(3)}% | ${(v.rate_cf_hit * 100).toFixed(1)}% |`);
  }
  md.push('');
  md.push(`## Critère de sortie Phase A`);
  md.push('');
  if (totals.rate_5xx < 0.005) {
    md.push(`✅ **PASS** : rate_5xx = ${(totals.rate_5xx * 100).toFixed(3)}% < 0.5%. Poursuivre Phase B/C.`);
  } else {
    md.push(`⛔ **FAIL** : rate_5xx = ${(totals.rate_5xx * 100).toFixed(3)}% >= 0.5%. Fork investigation root-cause séparée.`);
  }
  md.push('');
  if (top5xx.length > 0) {
    md.push(`## Top ${top5xx.length} URLs en 5xx`);
    md.push('');
    md.push(`| URL | code | cf-cache-status | age | ttfb_ms |`);
    md.push(`|---|---|---|---|---|`);
    for (const r of top5xx.slice(0, 30)) {
      md.push(`| \`${r.url}\` | ${r.http_code} | ${r.cf_cache_status ?? '-'} | ${r.age ?? '-'} | ${r.ttfb_ms ?? '-'} |`);
    }
  }
  md.push('');
  md.push(`## Reproductibilité`);
  md.push('');
  md.push('```bash');
  md.push(`npx tsx scripts/seo/gsc-5xx-evidence-batch.ts --sample-size=${SAMPLE_SIZE} --seed=${SEED}`);
  md.push('```');
  md.push('');
  md.push(`Durée : ${Math.round((Date.now() - t0) / 1000)}s`);

  const finalMdPath = path.join(OUTPUT_DIR, 'gsc-5xx-evidence-final.md');
  fs.writeFileSync(finalMdPath, md.join('\n'));

  process.stdout.write(JSON.stringify(pack, null, 2) + '\n');
  log(`✅ Wrote ${finalJsonPath}`);
  log(`✅ Wrote ${finalMdPath}`);
  log(`✅ Wrote ${fullResultsPath}`);

  if (totals.rate_5xx >= 0.005) process.exit(1);
}

main().catch((e) => {
  log(`❌ ${(e as Error).stack ?? e}`);
  process.exit(2);
});
