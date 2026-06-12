/**
 * 🚨 DEPRECATED 2026-06-12 — entrée canonique = scripts/seo/seo-readiness.ts
 * (verdict multi-rôle + batch/ranking, PR #941). Ce cockpit R1 4-dimensions reste
 * exécutable mais n'évolue plus ; toute nouvelle dimension va dans seo-readiness.ts.
 * Suppression après absorption complète.
 *
 * r1-readiness.ts — Cockpit READ-ONLY du verdict R1 par gamme (4 dimensions).
 *
 * Compose le verdict de readiness pour une page R1 gamme :
 *   WIKI_EXPORT : richesse de l'export WIKI (réutilise validate-gamme-schema.ts ;
 *                 valide l'EXPORT WIKI, jamais le RAG / __rag_knowledge).
 *   KW          : plan R1 (__seo_r1_keyword_plan, SoT — PAS google-ads-kp).
 *   CONTENT     : richesse du sg_content rendu (longueur + H2).
 *   LIVE        : sg_content réellement servi (présent).
 *
 * STRICTEMENT read-only : n'exécute AUCUN pipeline (ni RAW→WIKI, ni /kp, ni content-gen).
 * Retourne uniquement le verdict + NEXT_ACTION ; toute exécution reste owner-gated.
 *
 * Usage: npx tsx scripts/seo/r1-readiness.ts <pg_alias> [--json]
 * Ref: plan R1_READINESS ; calibrage WIKI_EXPORT dans validate-gamme-schema.ts.
 */

import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { wikiExportReadiness } from '../validate-gamme-schema';

dotenv.config({ path: path.join(__dirname, '../../backend/.env'), quiet: true } as dotenv.DotenvConfigOptions);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// ── Thresholds (calibrés sur exemplaires : filtre/disque rendent 9-10K c / 7 H2) ──
const KW_QUALITY_MIN = 80; // __seo_r1_keyword_plan validé + quality >= 80
const CONTENT_MIN_CHARS = 5000; // colonne=1079 (THIN) ; exemplaires ~9500
const CONTENT_MIN_H2 = 5; // colonne=3 (THIN) ; exemplaires 7

type Dim = 'READY' | 'BLOCKED';

async function readiness(alias: string) {
  // ── pg_id ──
  const { data: g } = await supabase
    .from('pieces_gamme')
    .select('pg_id, pg_name')
    .eq('pg_alias', alias)
    .maybeSingle();
  if (!g) {
    return { alias, error: `gamme introuvable: ${alias}` };
  }
  const pgId = g.pg_id as number;

  // ── WIKI_EXPORT (filesystem, réutilisé) ──
  const wiki = wikiExportReadiness(alias);

  // ── KW (__seo_r1_keyword_plan = SoT) ──
  const { data: kp } = await supabase
    .from('__seo_r1_keyword_plan')
    .select('rkp_status, rkp_quality_score, rkp_version')
    .eq('rkp_pg_id', pgId)
    .order('rkp_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const kwReady =
    kp?.rkp_status === 'validated' && (kp?.rkp_quality_score ?? 0) >= KW_QUALITY_MIN;
  const kwReasons: string[] = [];
  if (!kp) kwReasons.push('no_r1_plan');
  else {
    if (kp.rkp_status !== 'validated') kwReasons.push(`status=${kp.rkp_status}`);
    if ((kp.rkp_quality_score ?? 0) < KW_QUALITY_MIN)
      kwReasons.push(`quality=${kp.rkp_quality_score ?? 0}<${KW_QUALITY_MIN}`);
  }

  // ── CONTENT + LIVE (sg_content) ──
  const { data: sg } = await supabase
    .from('__seo_gamme')
    .select('sg_content')
    .eq('sg_pg_id', String(pgId))
    .maybeSingle();
  const content = (sg?.sg_content as string) ?? '';
  const chars = content.length;
  const h2 = (content.match(/<h2[\s>]/gi) || []).length;
  const live: 'RENDERED' | 'NOT_RENDERED' = chars > 0 ? 'RENDERED' : 'NOT_RENDERED';
  const contentOk = chars >= CONTENT_MIN_CHARS && h2 >= CONTENT_MIN_H2;

  // ── NEXT_ACTION (priorité descendante — owner-gated) ──
  let nextAction = 'RUN_SEO_AUDIT';
  if (wiki.status === 'BLOCKED') nextAction = 'RUN_RAW_TO_WIKI';
  else if (!kwReady) nextAction = 'RUN_KP_R1';
  else if (!contentOk) nextAction = 'RUN_CONTENT_GEN_R1';
  else if (live === 'NOT_RENDERED') nextAction = 'INVESTIGATE_RENDER';

  return {
    alias,
    pg_id: pgId,
    dimensions: {
      WIKI_EXPORT: { status: wiki.status as Dim, blockers: wiki.blockers, warnings: wiki.warnings },
      KW: { status: (kwReady ? 'READY' : 'BLOCKED') as Dim, reasons: kwReasons },
      CONTENT: { status: contentOk ? 'OK' : 'THIN', chars, h2 },
      LIVE: { status: live },
    },
    next_action: nextAction,
  };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const alias = args[0];
  if (!alias) {
    console.error('Usage: npx tsx scripts/seo/r1-readiness.ts <pg_alias> [--json]');
    process.exit(2);
  }
  const r = await readiness(alias);
  if ('error' in r) {
    console.error(r.error);
    process.exit(1);
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  const d = r.dimensions;
  console.log(`\nR1_READINESS ${r.alias} (pg_id ${r.pg_id}) — read-only, n'exécute rien`);
  console.log(`- WIKI_EXPORT: ${d.WIKI_EXPORT.status}${d.WIKI_EXPORT.blockers.length ? `  blockers:[${d.WIKI_EXPORT.blockers.join(', ')}]` : ''}${d.WIKI_EXPORT.warnings.length ? `  warnings:[${d.WIKI_EXPORT.warnings.join(', ')}]` : ''}`);
  console.log(`- KW:          ${d.KW.status}${d.KW.reasons.length ? `  reasons:[${d.KW.reasons.join(', ')}]` : ''}`);
  console.log(`- CONTENT:     ${d.CONTENT.status}  (chars=${d.CONTENT.chars}, h2=${d.CONTENT.h2})`);
  console.log(`- LIVE:        ${d.LIVE.status}`);
  console.log(`- NEXT_ACTION: ${r.next_action}   (owner-gated)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
