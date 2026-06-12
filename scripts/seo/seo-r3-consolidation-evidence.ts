/**
 * seo-r3-consolidation-evidence.ts — READ-ONLY builder of the R3 pillar
 * consolidation evidence matrix (per gamme), GSC-backed.
 *
 * MEASURES ONLY — never decides/executes a fold, canonical, 301, noindex, role-matrix
 * change or content generation. Reads: GSC (service-account, like
 * scripts/audit/audit-gsc-france-traffic-drop-2026-05-27.mjs), Supabase (SELECT),
 * and the live page robots (read-only HTTP GET). Writes only the dated .md under audit/.
 * Anti-fabrication: any missing GSC/robots signal → OBSERVE (logic in *.logic.ts).
 *
 * Usage:
 *   npx tsx scripts/seo/seo-r3-consolidation-evidence.ts --end 2026-06-03 [--gammes a,b] [--no-live-robots] [--json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

import { MatrixSchema, type GammeRow, type Matrix, type RoleSignalsT } from './seo-r3-consolidation-evidence.schema';
import { decide, jaccard, overlapBand, r3Live, r4Live, r6Live, tokenizeFr, windowFromEnd } from './seo-r3-consolidation-evidence.logic';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..');
const SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:automecanik.com';
const BASE = 'https://www.automecanik.com';

// Default sample = the owner-approved 10 (actual pg_alias slugs, resolved against pieces_gamme).
const DEFAULT_GAMMES = [
  'filtre-a-air', 'filtre-a-huile', 'disque-de-frein', 'plaquette-de-frein', 'batterie',
  'vanne-egr', 'turbo', 'amortisseur', 'kit-de-distribution', 'kit-d-embrayage',
];

// ── env (backend/.env explicit, mirrors the GSC audit script) ──
function loadBackendEnv(): void {
  const p = path.resolve(MONOREPO_ROOT, 'backend', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\n/g, '\n');
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

function gscClient() {
  const email = process.env.GSC_CLIENT_EMAIL;
  const key = process.env.GSC_PRIVATE_KEY;
  if (!email || !key) throw new Error('GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY missing from backend/.env');
  const jwt = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
  return google.searchconsole({ version: 'v1', auth: jwt });
}

type Gsc = { clicks: number; impressions: number; position: number | null } | null;

async function gscFor(sc: any, url: string, start: string, end: string): Promise<Gsc> {
  try {
    const resp = await sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: start,
        endDate: end,
        dimensions: ['page'],
        rowLimit: 1,
        dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: url }] }],
      },
    });
    const row = resp.data.rows?.[0];
    if (!row) return { clicks: 0, impressions: 0, position: null }; // success, no data ≠ missing
    return { clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, position: typeof row.position === 'number' ? row.position : null };
  } catch (e) {
    process.stderr.write(`  GSC fetch failed for ${url}: ${String((e as any)?.message || e)}\n`);
    return null; // genuine missing signal → OBSERVE
  }
}

async function robotsFor(url: string, live: boolean): Promise<RoleSignalsT['index_follow']> {
  if (!live) return 'OBSERVE';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const resp = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'automecanik-r3-evidence-audit (read-only)' } });
    clearTimeout(t);
    if (!resp.ok) return 'OBSERVE';
    const xr = (resp.headers.get('x-robots-tag') || '').toLowerCase();
    let directive = xr;
    if (!xr.includes('noindex') && !xr.includes('nofollow')) {
      const html = await resp.text();
      const m = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
      directive = (m?.[1] || '').toLowerCase();
    }
    const noindex = directive.includes('noindex');
    const nofollow = directive.includes('nofollow');
    if (noindex && nofollow) return 'NOINDEX_NOFOLLOW';
    if (noindex) return 'NOINDEX_FOLLOW';
    return 'INDEX_FOLLOW';
  } catch {
    return 'OBSERVE';
  }
}

async function inboundLinks(supabase: any, url: string): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from('__seo_internal_link')
      .select('*', { count: 'exact', head: true })
      .eq('to_url', url)
      .eq('is_active', true)
      .eq('is_nofollow', false);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  loadBackendEnv();
  const end = arg('--end');
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    process.stderr.write('Usage: --end YYYY-MM-DD [--gammes a,b] [--no-live-robots] [--json]\n');
    process.exit(2);
  }
  const liveRobots = !process.argv.includes('--no-live-robots');
  const gammes = (arg('--gammes')?.split(',').map((s) => s.trim()).filter(Boolean)) || DEFAULT_GAMMES;
  const window = windowFromEnd(end);

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const sc = gscClient();

  // Resolve pg_id/pg_alias (authoritative) from pieces_gamme.
  const { data: pgRows } = await supabase.from('pieces_gamme').select('pg_id, pg_alias, pg_name').in('pg_alias', gammes);
  const byAlias = new Map<string, any>((pgRows || []).map((r: any) => [r.pg_alias, r]));

  const rows: GammeRow[] = [];
  for (const alias of gammes) {
    const pg = byAlias.get(alias);
    if (!pg) {
      process.stderr.write(`  gamme introuvable dans pieces_gamme: ${alias} (ignorée)\n`);
      continue;
    }
    const pgId = Number(pg.pg_id);
    process.stderr.write(`· ${alias} (pg_id ${pgId})\n`);

    // ── live coverage (DB SELECT) ──
    const { data: r3secs } = await supabase.from('__seo_gamme_conseil').select('sgc_content, sgc_quality_score').eq('sgc_pg_id', String(pgId));
    const r3sections = (r3secs || []).map((s: any) => ({ content: s.sgc_content || '', quality: s.sgc_quality_score || 0 }));
    const { data: r4row } = await supabase.from('__seo_reference').select('definition, role_mecanique, composition, confusions_courantes, regles_metier, is_published, slug').eq('pg_id', pgId).maybeSingle();
    const { data: r6row } = await supabase.from('__seo_gamme_purchase_guide').select('sgpg_how_to_choose, sgpg_brands_guide, sgpg_selection_criteria, sgpg_gatekeeper_score, sgpg_is_draft, sgpg_role_version').eq('sgpg_pg_id', String(pgId)).maybeSingle();

    const r3status = r3Live(r3sections);
    const r4status = r4Live(r4row);
    const r6status = r6Live(r6row);

    // ── URLs ──
    const urlR3 = `${BASE}/blog-pieces-auto/conseils/${pg.pg_alias}`;
    const urlR4 = r4row?.slug ? `${BASE}/reference-auto/${r4row.slug}` : null;
    const urlR6 = `${BASE}/blog-pieces-auto/guide-achat/${pg.pg_alias}`;

    // ── overlap texts ──
    const r3text = r3sections.map((s) => s.content).join(' ');
    const r4text = [r4row?.definition, r4row?.role_mecanique, ...(Array.isArray(r4row?.composition) ? r4row.composition : [])].filter(Boolean).join(' ');
    const r6text = [r6row?.sgpg_how_to_choose, ...(Array.isArray(r6row?.sgpg_selection_criteria) ? r6row.sgpg_selection_criteria : [])].filter(Boolean).join(' ');
    const t3 = tokenizeFr(r3text);
    const ov = (other: string, present: boolean): { j: number | null; band: any } => {
      if (!present || r3text.trim() === '' || other.trim() === '') return { j: null, band: 'OBSERVE' };
      const j = jaccard(t3, tokenizeFr(other));
      return { j, band: overlapBand(j) };
    };
    const ov34 = ov(r4text, r4status !== 'ABSENT');
    const ov36 = ov(r6text, r6status !== 'ABSENT');

    // ── per-role signals (GSC + robots + inbound) ──
    const mkRole = async (role: 'R3' | 'R4' | 'R6', url: string | null, live: RoleSignalsT['live']): Promise<RoleSignalsT> => {
      const pageLive = live === 'PRESENT_RICH' || live === 'PRESENT_THIN';
      const gsc28 = url && pageLive ? await gscFor(sc, url, window.d28.start, window.d28.end) : null;
      const gsc90 = url && pageLive ? await gscFor(sc, url, window.d90.start, window.d90.end) : null;
      const idx = url ? await robotsFor(url, pageLive && liveRobots) : 'OBSERVE';
      const inbound = url && pageLive ? await inboundLinks(supabase, url) : null;
      return { role, url, live, gsc_28d: gsc28, gsc_90d: gsc90, index_follow: idx, inbound_links: inbound };
    };
    const R3 = await mkRole('R3', urlR3, r3status);
    const R4 = await mkRole('R4', urlR4, r4status);
    const R6 = await mkRole('R6', urlR6, r6status);

    // ── intent gap (RAW intent_targets vs served roles) — best-effort from DB pg row not available; read RAW frontmatter optionally ──
    const intentTargets = readIntentTargets(alias);
    const served = new Set<string>();
    if (r3status !== 'ABSENT') served.add('diagnostic'); // R3 conseils covers diagnostic/how-to
    if (r6status !== 'ABSENT') served.add('achat');
    const gap = intentTargets.filter((it) => it === 'achat' ? r6status === 'ABSENT' : it === 'diagnostic' ? r3status === 'ABSENT' : false);

    rows.push(
      decide({
        gamme: alias,
        pg_id: pgId,
        pg_alias: pg.pg_alias,
        intent_targets: intentTargets,
        roles: { R3, R4, R6 },
        overlaps: [
          { pair: 'R3_R4', jaccard: ov34.j, band: ov34.band },
          { pair: 'R3_R6', jaccard: ov36.j, band: ov36.band },
        ],
        user_intent_gap: gap,
      }),
    );
  }

  const matrix: Matrix = MatrixSchema.parse({
    schema_version: 'r3-consolidation-evidence.v1',
    site: SITE_URL,
    window,
    live_robots: liveRobots,
    rows,
  });

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(matrix, null, 2) + '\n');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { renderMatrixMd } = require('./seo-r3-consolidation-evidence.logic');
  const md = renderMatrixMd(matrix);
  const outName = `seo-r3-pillar-consolidation-evidence-${end.replace(/-/g, '')}.md`;
  const outPath = path.join(MONOREPO_ROOT, 'audit', outName);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md, 'utf8');
  process.stdout.write(`\n✓ ${rows.length} gammes → audit/${outName}\n`);
}

// RAW intent_targets (read-only ; optional — absent file ⇒ []).
function readIntentTargets(alias: string): string[] {
  const rawRoot = process.env.AUTOMECANIK_RAW_PATH || '/opt/automecanik/automecanik-raw';
  const p = path.join(rawRoot, 'recycled', 'rag-knowledge', 'gammes', `${alias}.md`);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const m = raw.match(/intent_targets:\s*\n((?:\s*-\s*.+\n)+)/);
    if (!m) return [];
    return m[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

main().catch((e) => {
  process.stderr.write(`FATAL: ${e?.response?.data ? JSON.stringify(e.response.data) : e?.message ?? e}\n`);
  process.exit(1);
});
