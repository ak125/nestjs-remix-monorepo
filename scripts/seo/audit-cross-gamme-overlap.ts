/**
 * Audit cross-gamme keyword overlap.
 *
 * Loads all __seo_keyword_cluster rows, compares keyword sets between gammes,
 * and detects cannibalization risks. Writes overlap_flags to DB and generates
 * a JSON report with per-keyword overlap entries.
 *
 * Usage:
 *   npx tsx scripts/seo/audit-cross-gamme-overlap.ts [options]
 *
 * Options:
 *   --execute            Write overlap_flags to DB (default is dry-run)
 *   --output=json        Write report JSON to /tmp/
 *   --output=json:stdout Print report JSON to stdout
 *   --help               Show this help
 */

import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// ── Load environment ─────────────────────────────────────────────────────────

dotenv.config({ path: path.join(__dirname, '../../backend/.env'), quiet: true } as dotenv.DotenvConfigOptions);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Logging (M10: diagnostic → stderr, JSON → stdout) ───────────────────────

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}
function logWarn(msg: string): void {
  process.stderr.write('[WARN] ' + msg + '\n');
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ClusterRow {
  id: number;
  pg_id: number;
  pg_alias: string;
  primary_keyword: string;
  primary_volume: number;
  keyword_variants: Array<{
    keyword: string;
    volume: number;
    v_level: string | null;
    intent: string;
  }>;
  role_keywords: Record<
    string,
    { primary: string; primary_volume?: number; secondary: string[] }
  >;
}

interface OverlapPair {
  gamme_a: string;
  gamme_b: string;
  shared_tokens: string[];
  shared_keywords: string[];
  shared_role_keywords: Array<{
    role: string;
    keyword: string;
    in_a: 'primary' | 'secondary';
    in_b: 'primary' | 'secondary';
  }>;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
  is_expected?: boolean;
}

/** Flat per-keyword overlap entry for structured JSON report (V2-A) */
interface OverlapEntry {
  gamme_a: string;
  gamme_b: string;
  keyword: string;
  source: 'primary' | 'variant' | 'role_primary' | 'role_secondary';
  role: string | null;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  volume_a: number;
  volume_b: number;
  resolution_hint: 'volume_winner' | 'deduplicate' | 'review';
}

interface OverlapFlag {
  overlapping_gamme: string;
  shared_tokens: string[];
  shared_keywords: string[];
  severity: 'low' | 'medium' | 'high';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function getSignificantTokens(text: string): Set<string> {
  const STOP_WORDS = new Set([
    'les', 'des', 'une', 'pour', 'avec', 'dans', 'sur', 'par',
    'son', 'ses', 'aux', 'est', 'sont', 'pas', 'plus', 'que',
    'qui', 'tout', 'tous', 'votre', 'notre', 'vous', 'nous',
    'comment', 'quand', 'quel', 'quelle',
  ]);
  return new Set(
    tokenize(text).filter((t) => !STOP_WORDS.has(t)),
  );
}

/** Collect all keywords from a cluster (primary + all variants + all role keywords). */
function collectAllKeywords(cluster: ClusterRow): string[] {
  const keywords = new Set<string>();
  keywords.add(normalizeText(cluster.primary_keyword));

  for (const v of cluster.keyword_variants ?? []) {
    keywords.add(normalizeText(v.keyword));
  }

  for (const roleData of Object.values(cluster.role_keywords ?? {})) {
    if (roleData.primary) keywords.add(normalizeText(roleData.primary));
    for (const sec of roleData.secondary ?? []) {
      keywords.add(normalizeText(sec));
    }
  }

  return [...keywords];
}

/** Find shared keywords between two clusters (exact normalized match). */
function findSharedKeywords(
  keywordsA: string[],
  keywordsB: string[],
): string[] {
  const setB = new Set(keywordsB);
  return keywordsA.filter((kw) => setB.has(kw));
}

/** Find shared significant tokens between primary keywords. */
function findSharedTokens(
  clusterA: ClusterRow,
  clusterB: ClusterRow,
): string[] {
  const tokensA = getSignificantTokens(clusterA.primary_keyword);
  const tokensB = getSignificantTokens(clusterB.primary_keyword);
  return [...tokensA].filter((t) => tokensB.has(t));
}

/** Find role-level keyword collisions (same keyword assigned to same role in both gammes). */
function findRoleKeywordCollisions(
  clusterA: ClusterRow,
  clusterB: ClusterRow,
): Array<{
  role: string;
  keyword: string;
  in_a: 'primary' | 'secondary';
  in_b: 'primary' | 'secondary';
}> {
  const collisions: Array<{
    role: string;
    keyword: string;
    in_a: 'primary' | 'secondary';
    in_b: 'primary' | 'secondary';
  }> = [];

  const rolesA = clusterA.role_keywords ?? {};
  const rolesB = clusterB.role_keywords ?? {};

  for (const role of Object.keys(rolesA)) {
    if (!rolesB[role]) continue;

    const a = rolesA[role];
    const b = rolesB[role];

    const bPrimary = normalizeText(b.primary || '');
    const bSecondarySet = new Set(
      (b.secondary ?? []).map((s) => normalizeText(s)),
    );

    const aPrimary = normalizeText(a.primary || '');
    if (aPrimary && aPrimary === bPrimary) {
      collisions.push({ role, keyword: aPrimary, in_a: 'primary', in_b: 'primary' });
    } else if (aPrimary && bSecondarySet.has(aPrimary)) {
      collisions.push({ role, keyword: aPrimary, in_a: 'primary', in_b: 'secondary' });
    }

    for (const sec of a.secondary ?? []) {
      const normSec = normalizeText(sec);
      if (normSec === bPrimary) {
        collisions.push({ role, keyword: normSec, in_a: 'secondary', in_b: 'primary' });
      } else if (bSecondarySet.has(normSec)) {
        collisions.push({ role, keyword: normSec, in_a: 'secondary', in_b: 'secondary' });
      }
    }
  }

  return collisions;
}

function determineSeverity(
  sharedTokens: string[],
  sharedKeywords: string[],
  roleCollisions: number,
): 'low' | 'medium' | 'high' {
  const score = sharedTokens.length + sharedKeywords.length * 2 + roleCollisions * 3;
  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function buildRecommendation(
  pair: { gamme_a: string; gamme_b: string },
  severity: 'low' | 'medium' | 'high',
  sharedTokens: string[],
  roleCollisions: number,
): string {
  if (severity === 'high') {
    return `Risque de cannibalisation eleve entre ${pair.gamme_a} et ${pair.gamme_b}. ` +
      `${roleCollisions} collision(s) sur les memes roles. ` +
      `Revoir les keywords primaires et differencier les angles par role.`;
  }
  if (severity === 'medium') {
    return `Overlap modere entre ${pair.gamme_a} et ${pair.gamme_b} ` +
      `(tokens communs: ${sharedTokens.join(', ')}). ` +
      `Surveiller lors du prochain enrichissement.`;
  }
  return `Overlap mineur entre ${pair.gamme_a} et ${pair.gamme_b}. Pas d'action requise.`;
}

// ── Volume lookup helpers (V2-A: per-keyword volume) ─────────────────────────

/** Build a keyword→volume map from a cluster's data. */
function buildVolumeMap(cluster: ClusterRow): Map<string, number> {
  const map = new Map<string, number>();
  map.set(normalizeText(cluster.primary_keyword), cluster.primary_volume);
  for (const v of cluster.keyword_variants ?? []) {
    map.set(normalizeText(v.keyword), v.volume);
  }
  for (const [, roleData] of Object.entries(cluster.role_keywords ?? {})) {
    if (roleData.primary) {
      map.set(normalizeText(roleData.primary), roleData.primary_volume ?? 0);
    }
  }
  return map;
}

/** Determine resolution hint based on volumes and severity. */
function resolveHint(
  volA: number,
  volB: number,
  severity: 'HIGH' | 'MEDIUM' | 'LOW',
): OverlapEntry['resolution_hint'] {
  if (severity === 'HIGH' && volA !== volB) return 'volume_winner';
  if (severity === 'HIGH' && volA === volB) return 'review';
  return 'deduplicate';
}

// ── Flat overlap entries (V2-A) ──────────────────────────────────────────────

/** Build flat OverlapEntry[] for a pair of clusters. */
function buildFlatOverlaps(
  a: ClusterRow,
  b: ClusterRow,
  sharedKeywords: string[],
  roleCollisions: Array<{ role: string; keyword: string; in_a: string; in_b: string }>,
): OverlapEntry[] {
  const entries: OverlapEntry[] = [];
  const volMapA = buildVolumeMap(a);
  const volMapB = buildVolumeMap(b);

  const normPrimaryA = normalizeText(a.primary_keyword);
  const normPrimaryB = normalizeText(b.primary_keyword);

  // Primary vs Primary
  if (normPrimaryA === normPrimaryB) {
    entries.push({
      gamme_a: a.pg_alias, gamme_b: b.pg_alias,
      keyword: normPrimaryA,
      source: 'primary', role: null,
      severity: 'HIGH',
      volume_a: a.primary_volume, volume_b: b.primary_volume,
      resolution_hint: resolveHint(a.primary_volume, b.primary_volume, 'HIGH'),
    });
  }

  // Shared keywords (variant-level)
  const variantSetA = new Set((a.keyword_variants ?? []).map((v) => normalizeText(v.keyword)));
  const variantSetB = new Set((b.keyword_variants ?? []).map((v) => normalizeText(v.keyword)));

  for (const kw of sharedKeywords) {
    // Skip if already counted as primary
    if (kw === normPrimaryA && kw === normPrimaryB) continue;

    const inVariantA = variantSetA.has(kw);
    const inVariantB = variantSetB.has(kw);
    const source: OverlapEntry['source'] =
      (inVariantA || inVariantB) ? 'variant' : 'role_secondary';

    const volA = volMapA.get(kw) ?? 0;
    const volB = volMapB.get(kw) ?? 0;
    const severity: OverlapEntry['severity'] = 'MEDIUM';

    entries.push({
      gamme_a: a.pg_alias, gamme_b: b.pg_alias,
      keyword: kw,
      source, role: null,
      severity,
      volume_a: volA, volume_b: volB,
      resolution_hint: resolveHint(volA, volB, severity),
    });
  }

  // Role collisions
  for (const rc of roleCollisions) {
    const volA = volMapA.get(normalizeText(rc.keyword)) ?? 0;
    const volB = volMapB.get(normalizeText(rc.keyword)) ?? 0;
    const isBothPrimary = rc.in_a === 'primary' && rc.in_b === 'primary';
    const severity: OverlapEntry['severity'] = isBothPrimary ? 'HIGH' : 'MEDIUM';
    const source: OverlapEntry['source'] = rc.in_a === 'primary' ? 'role_primary' : 'role_secondary';

    // Skip duplicates already counted in shared keywords
    const alreadyCounted = entries.some(
      (e) => e.keyword === normalizeText(rc.keyword) && e.gamme_a === a.pg_alias && e.gamme_b === b.pg_alias,
    );
    if (alreadyCounted) continue;

    entries.push({
      gamme_a: a.pg_alias, gamme_b: b.pg_alias,
      keyword: normalizeText(rc.keyword),
      source, role: rc.role,
      severity,
      volume_a: volA, volume_b: volB,
      resolution_hint: resolveHint(volA, volB, severity),
    });
  }

  return entries;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function loadAllClusters(): Promise<ClusterRow[]> {
  const { data, error } = await supabase
    .from('__seo_keyword_cluster')
    .select('id, pg_id, pg_alias, primary_keyword, primary_volume, keyword_variants, role_keywords')
    .order('pg_alias');

  if (error) throw new Error(`Failed to load clusters: ${error.message}`);
  return (data ?? []) as ClusterRow[];
}

async function writeOverlapFlags(
  pgId: number,
  flags: OverlapFlag[],
): Promise<void> {
  const { error } = await supabase
    .from('__seo_keyword_cluster')
    .update({ overlap_flags: flags })
    .eq('pg_id', pgId);

  if (error) {
    throw new Error(`Failed to write overlap_flags for pg_id=${pgId}: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    log(`
Usage: npx tsx scripts/seo/audit-cross-gamme-overlap.ts [options]

Options:
  --execute            Write overlap_flags to DB (default is dry-run)
  --output=json        Write report JSON to /tmp/
  --output=json:stdout Print report JSON to stdout
  --help               Show this help

Examples:
  npx tsx scripts/seo/audit-cross-gamme-overlap.ts
  npx tsx scripts/seo/audit-cross-gamme-overlap.ts --execute
  npx tsx scripts/seo/audit-cross-gamme-overlap.ts --output=json:stdout 2>/dev/null | jq '.overlaps | length'
`);
    process.exit(0);
  }

  // 3a: Default dry-run, --execute to write (aligned with build-keyword-clusters.ts)
  const explicitExecute = args.includes('--execute');
  const dryRun = !explicitExecute;

  // 3b: --output=json:stdout support
  const outputJsonArg = args.find((a) => a.startsWith('--output='));
  const outputJson = !!outputJsonArg;
  const outputToStdout = outputJsonArg === '--output=json:stdout';

  log('=== Cross-Gamme Overlap Audit ===');
  log(`Mode: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);
  log('');

  // 1. Load all clusters
  const clusters = await loadAllClusters();
  log(`Loaded ${clusters.length} clusters`);

  if (clusters.length < 2) {
    log('Need at least 2 clusters for overlap detection. Exiting.');
    return;
  }

  // 2. Compute all pairwise overlaps
  const pairs: OverlapPair[] = [];
  const allFlatOverlaps: OverlapEntry[] = [];
  const overlapByGamme = new Map<number, OverlapFlag[]>();

  for (const c of clusters) {
    overlapByGamme.set(c.pg_id, []);
  }

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i];
      const b = clusters[j];

      const keywordsA = collectAllKeywords(a);
      const keywordsB = collectAllKeywords(b);
      const sharedKeywords = findSharedKeywords(keywordsA, keywordsB);
      const sharedTokens = findSharedTokens(a, b);
      const roleCollisions = findRoleKeywordCollisions(a, b);

      if (sharedTokens.length === 0 && sharedKeywords.length === 0 && roleCollisions.length === 0) {
        continue;
      }

      const severity = determineSeverity(sharedTokens, sharedKeywords, roleCollisions.length);
      const recommendation = buildRecommendation(
        { gamme_a: a.pg_alias, gamme_b: b.pg_alias },
        severity,
        sharedTokens,
        roleCollisions.length,
      );

      const pair: OverlapPair = {
        gamme_a: a.pg_alias,
        gamme_b: b.pg_alias,
        shared_tokens: sharedTokens,
        shared_keywords: sharedKeywords,
        shared_role_keywords: roleCollisions,
        severity,
        recommendation,
      };
      pairs.push(pair);

      // V2-A: flat per-keyword overlaps with volumes
      const flatEntries = buildFlatOverlaps(a, b, sharedKeywords, roleCollisions);
      allFlatOverlaps.push(...flatEntries);

      overlapByGamme.get(a.pg_id)!.push({
        overlapping_gamme: b.pg_alias,
        shared_tokens: sharedTokens,
        shared_keywords: sharedKeywords,
        severity,
      });
      overlapByGamme.get(b.pg_id)!.push({
        overlapping_gamme: a.pg_alias,
        shared_tokens: sharedTokens,
        shared_keywords: sharedKeywords,
        severity,
      });
    }
  }

  // 2b. Tag expected overlaps
  const expectedPath = path.join(__dirname, 'expected-overlaps.json');
  let expectedOverlaps: Array<{ gamme_a: string; gamme_b: string }> = [];
  if (fs.existsSync(expectedPath)) {
    try {
      expectedOverlaps = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
    } catch {
      logWarn('Failed to parse expected-overlaps.json — skipping tagging');
    }
  }
  for (const pair of pairs) {
    pair.is_expected = expectedOverlaps.some(
      (e) =>
        (e.gamme_a === pair.gamme_a && e.gamme_b === pair.gamme_b) ||
        (e.gamme_a === pair.gamme_b && e.gamme_b === pair.gamme_a),
    );
  }

  // 3. Print results
  log(`\nFound ${pairs.length} overlap pair(s):\n`);

  for (const p of pairs) {
    const icon = p.severity === 'high' ? '!!!' : p.severity === 'medium' ? '!!' : '!';
    const expectedTag = p.is_expected ? ' [EXPECTED]' : '';
    log(`[${icon}] ${p.gamme_a} <-> ${p.gamme_b} (${p.severity})${expectedTag}`);
    if (p.shared_tokens.length > 0) {
      log(`     Shared tokens: ${p.shared_tokens.join(', ')}`);
    }
    if (p.shared_keywords.length > 0) {
      log(`     Shared keywords: ${p.shared_keywords.slice(0, 5).join(', ')}${p.shared_keywords.length > 5 ? ` (+${p.shared_keywords.length - 5} more)` : ''}`);
    }
    if (p.shared_role_keywords.length > 0) {
      log(`     Role collisions: ${p.shared_role_keywords.map((r) => `${r.role}:${r.keyword}`).join(', ')}`);
    }
    log(`     -> ${p.recommendation}`);
    log('');
  }

  // Summary
  const byLevel = { low: 0, medium: 0, high: 0 };
  for (const p of pairs) byLevel[p.severity]++;
  const bySeverity = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const e of allFlatOverlaps) bySeverity[e.severity]++;

  log(`Summary: ${byLevel.high} high, ${byLevel.medium} medium, ${byLevel.low} low (pairs)`);
  log(`Flat overlaps: ${allFlatOverlaps.length} entries (${bySeverity.HIGH} HIGH, ${bySeverity.MEDIUM} MEDIUM, ${bySeverity.LOW} LOW)`);

  // 4. Write overlap_flags to DB
  if (!dryRun) {
    log('\nWriting overlap_flags to __seo_keyword_cluster...');
    for (const [pgId, flags] of overlapByGamme) {
      await writeOverlapFlags(pgId, flags);
      const cluster = clusters.find((c) => c.pg_id === pgId);
      log(`  ${cluster?.pg_alias}: ${flags.length} flag(s)`);
    }
    log('Done.');
  } else {
    log('\n[DRY-RUN] No DB writes performed.');
  }

  // 5. JSON report
  if (outputJson) {
    const report = {
      metadata: {
        overlap_rules_version: '1.0',
        generated_at: new Date().toISOString(),
      },
      total_clusters: clusters.length,
      total_pairs_checked: (clusters.length * (clusters.length - 1)) / 2,
      overlaps_found: pairs.length,
      summary: { ...byLevel, flat_entries: allFlatOverlaps.length },
      pairs,
      overlaps: allFlatOverlaps,
      flags_by_gamme: Object.fromEntries(
        [...overlapByGamme.entries()].map(([pgId, flags]) => {
          const cluster = clusters.find((c) => c.pg_id === pgId);
          return [cluster?.pg_alias ?? `pg_${pgId}`, flags];
        }),
      ),
    };

    if (outputToStdout) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      const reportPath = `/tmp/cross-gamme-overlap-report-${new Date().toISOString().slice(0, 10)}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      log(`\nReport written to ${reportPath}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
