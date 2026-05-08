#!/usr/bin/env tsx
/**
 * SEO seo-v9 PR-1 — Audit inventaire + matrice gap legacy → monorepo (READ-ONLY)
 *
 * Usage :
 *   cd backend && npx tsx scripts/seo/audit-v9-inventaire.ts \
 *     --base-url=http://localhost:3000 \
 *     --output-json=audit/seo-v9-inventaire-2026-05-08.json \
 *     --output-md=docs/seo/legacy_to_monorepo_gap_matrix.md
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { runInventoryVolet } from './audit/inventory-services';
import { runR2RoutesAudit } from './audit/r2-routes-audit';
import { runR2VolumeSample, makeSupabaseFromEnv, countSitemapPiecesUrls } from './audit/r2-volume-sample';
import { runDiffVolet } from './audit/diff-v4-vs-current';
import { runPhpVsRemixComparison } from './audit/php-vs-remix-comparison';
import { renderGapMatrixMarkdown, BASELINE_MATRIX_ROWS } from './audit/gap-matrix-generator';
import { AuditReportSchema } from './audit/types';

interface CliArgs {
  baseUrl: string;
  outputJson: string;
  outputMd: string;
  rmEndpoint: string;
  v4Endpoint: string;
  modulesRoot: string;
  routesRoot: string;
  snapshotDir: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const get = (key: string, fallback?: string): string => {
    const arg = argv.find((a) => a.startsWith(`--${key}=`));
    if (arg) return arg.slice(`--${key}=`.length);
    if (fallback !== undefined) return fallback;
    throw new Error(`Argument requis : --${key}=...`);
  };
  const today = new Date().toISOString().slice(0, 10);
  return {
    baseUrl: get('base-url', 'http://localhost:3000'),
    outputJson: get('output-json', `audit/seo-v9-inventaire-${today}.json`),
    outputMd: get('output-md', 'docs/seo/legacy_to_monorepo_gap_matrix.md'),
    rmEndpoint: get('rm-endpoint', '/api/rm/page-v2'),
    v4Endpoint: get('v4-endpoint', '/api/seo-dynamic-v4/generate-complete'),
    modulesRoot: get('modules-root', 'backend/src/modules'),
    routesRoot: get('routes-root', 'frontend/app/routes'),
    snapshotDir: argv.includes('--no-php-snapshot') ? null : get('php-snapshot-dir', '/tmp/php-legacy-snapshots'),
  };
}

interface SampleEntry {
  url: string;
  surface_key: string;
  gamme_id: number;
  vehicle_id: number;
  pgId: number;
  typeId: number;
  variables: Record<string, unknown>;
  category: string;
}

async function loadSampleUrls(scriptDir: string): Promise<SampleEntry[]> {
  const sampleFile = path.join(scriptDir, 'audit', 'sample-urls.json');
  const raw = await readFile(sampleFile, 'utf-8');
  const json = JSON.parse(raw) as { samples: SampleEntry[] };
  return json.samples;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const generated_at = new Date().toISOString();
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);

  console.log(`🔍 SEO seo-v9 PR-1 audit — ${generated_at}`);
  console.log(`   baseUrl: ${args.baseUrl}`);
  console.log(`   modules: ${args.modulesRoot}`);

  console.log('\n[Volet 1] Inventaire services SEO existants...');
  const service_inventory = await runInventoryVolet({
    modulesRoot: args.modulesRoot,
    patterns: ['seo', 'switch', 'template', 'title', 'meta', 'canonical', 'robots', 'indexability'],
  });
  console.log(`   ${service_inventory.length} services trouvés`);

  console.log('\n[Volet 2] Diff sortie SEO V4 vs actuel sur sample URLs...');
  const sampleUrls = await loadSampleUrls(scriptDir);
  const diff_samples = await runDiffVolet({
    baseUrl: args.baseUrl,
    rmEndpoint: args.rmEndpoint,
    v4Endpoint: args.v4Endpoint,
    samples: sampleUrls,
  });
  const divergent = diff_samples.filter((d) => d.diff_verdict === 'divergent').length;
  const exactMatches = diff_samples.filter((d) => d.diff_verdict === 'exact_match').length;
  console.log(`   ${exactMatches} exact_match / ${divergent} divergent / ${diff_samples.length} total`);

  console.log('\n[Volet 3] Audit routes Remix R2 fiche produit...');
  const r2_routes_audit = await runR2RoutesAudit({
    routesRoot: args.routesRoot,
    patterns: ['produit.$ref.tsx', 'pieces.$piece_id.tsx', 'articles.$ref.tsx'],
  });
  console.log(`   R2 route ${r2_routes_audit.found ? 'trouvée' : 'absente'} (${r2_routes_audit.evidence.length} evidence)`);

  console.log('\n[Volet 4] Sample volume R2 indexable...');
  const supabase = makeSupabaseFromEnv();
  const r2_volume_stats = await runR2VolumeSample({ supabase });
  const sitemap_p_count = await countSitemapPiecesUrls(supabase);
  console.log(`   total_pieces=${r2_volume_stats.total_pieces}, indexable=${r2_volume_stats.indexable_estimate}, sitemap_p=${sitemap_p_count}`);

  console.log('\n[Volet 5] Comparaison PHP vs Remix...');
  const php_vs_remix_comparison = await runPhpVsRemixComparison({
    snapshotDir: args.snapshotDir,
    sampleUrls: sampleUrls.map((s) => s.url),
  });
  console.log(`   ${php_vs_remix_comparison.available ? 'snapshots dispo' : 'snapshots absents (normal si baseline non capturée)'}`);

  console.log('\n[Aggregation] Construction du rapport...');
  const report = AuditReportSchema.parse({
    generated_at,
    gap_matrix: BASELINE_MATRIX_ROWS,
    service_inventory,
    diff_samples,
    r2_routes_audit,
    r2_volume_stats,
    php_vs_remix_comparison,
  });

  console.log(`\n💾 Écriture du JSON → ${args.outputJson}`);
  await mkdir(path.dirname(args.outputJson), { recursive: true });
  await writeFile(args.outputJson, JSON.stringify(report, null, 2), 'utf-8');

  // Findings empiriques agrégés pour la matrice
  const TARGET_SERVICES_COUNT = 14; // services cibles plan v9 (cf. seo-chain-architecture-seo-v9.md)
  const mappedSet = new Set(
    report.service_inventory.filter((s) => s.maps_to_target_service).map((s) => s.maps_to_target_service!),
  );
  const diffVerdicts: Record<string, number> = {};
  for (const d of report.diff_samples) {
    diffVerdicts[d.diff_verdict] = (diffVerdicts[d.diff_verdict] ?? 0) + 1;
  }
  const findings = {
    source: (args.baseUrl.includes('localhost') ? 'DEV' : 'preprod') as 'DEV' | 'preprod',
    services_total: report.service_inventory.length,
    services_mapped_to_targets: mappedSet.size,
    target_services_count: TARGET_SERVICES_COUNT,
    diff_samples_count: report.diff_samples.length,
    diff_verdicts: diffVerdicts,
    r2_routes_found: report.r2_routes_audit.found,
    pieces_total: report.r2_volume_stats.total_pieces,
    pieces_seo_safe: report.r2_volume_stats.indexable_estimate,
    pieces_in_sitemap: sitemap_p_count,
  };

  console.log(`💾 Écriture du markdown → ${args.outputMd}`);
  await mkdir(path.dirname(args.outputMd), { recursive: true });
  await writeFile(args.outputMd, renderGapMatrixMarkdown(report.gap_matrix, { generated_at, findings }), 'utf-8');

  console.log('\n✅ PR-1 audit terminé');
  console.log('   → Décision PR-2 : voir verdict scénario A/B/C dans plan section 4 (PR-2).');
  console.log(`   → Si > 5 collisions fingerprint cross-URL → priorité PR-9 (table fingerprint) confirmée.`);
}

main().catch((err) => {
  console.error('❌ PR-1 audit failed:', err);
  process.exit(1);
});
