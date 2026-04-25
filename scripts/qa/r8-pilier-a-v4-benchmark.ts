/**
 * Pilier A v4 benchmark — measures Jaccard overlap on REAL RAG content.
 *
 * Calls fetchWearGammesByType()-equivalent via Supabase + GammeSymptomReader
 * (real fs reads of /opt/automecanik/rag/knowledge/gammes/*.md) for 3 DS 3
 * siblings, then composes the S_MOTOR_ISSUES + S_COMPAT_SCOPE block contents
 * and reports word-set Jaccard between each pair.
 *
 * Run :
 *   cd backend
 *   npx ts-node --transpile-only -P tsconfig.json ../scripts/qa/r8-pilier-a-v4-benchmark.ts
 */
import { createClient } from '@supabase/supabase-js';
import { GammeSymptomReader } from '../../backend/src/modules/admin/services/gamme-symptom-reader.service';
import {
  deriveEngineProfile,
  deriveEuroNorm,
} from '../../backend/src/config/engine-profile.config';

interface SampleType {
  type_id: number;
  type_name: string;
  fuel: string;
  power_ps: number;
  liter: string;
  body: string;
  year_from: number;
  year_to: number | null;
}

const DS3_TYPE_IDS = [19045, 19053, 19355]; // Essence 75, Diesel 106, Essence 197 sport
const CLIO3_TYPE_IDS = [34746, 34747, 34748]; // Three close-power dCi siblings

async function fetchType(
  client: ReturnType<typeof createClient>,
  typeId: number,
): Promise<SampleType | null> {
  const { data } = await client
    .from('auto_type')
    .select(
      'type_id_i, type_name, type_fuel, type_power_ps, type_liter, type_body, type_year_from, type_year_to',
    )
    .eq('type_id_i', typeId)
    .eq('type_display', '1')
    .single();
  if (!data) return null;
  const row = data as Record<string, string | number | null>;
  return {
    type_id: typeId,
    type_name: String(row.type_name || ''),
    fuel: String(row.type_fuel || ''),
    power_ps: parseInt(String(row.type_power_ps || '0'), 10),
    liter: String(row.type_liter || ''),
    body: String(row.type_body || ''),
    year_from: parseInt(String(row.type_year_from || '0'), 10),
    year_to: row.type_year_to ? parseInt(String(row.type_year_to), 10) : null,
  };
}

async function fetchWearGammes(
  client: ReturnType<typeof createClient>,
  typeId: number,
): Promise<{ pg_alias: string; pg_name: string; piece_count: number }[]> {
  // Use __cross_gamme_car_new (pre-aggregated 44-66 rows per type with
  // cgc_level priority rank). Bypasses pieces_relation_type 1000-row limit.
  const { data, error } = await client
    .from('__cross_gamme_car_new')
    .select('cgc_pg_id, cgc_level')
    .eq('cgc_type_id', String(typeId))
    .order('cgc_level', { ascending: true });
  if (error || !Array.isArray(data) || data.length === 0) return [];

  const bestLevel = new Map<number, number>();
  for (const row of data) {
    const pgId = parseInt(String((row as { cgc_pg_id: string }).cgc_pg_id), 10);
    const level = parseInt(String((row as { cgc_level: string }).cgc_level), 10);
    if (!Number.isFinite(pgId) || !Number.isFinite(level)) continue;
    const existing = bestLevel.get(pgId);
    if (existing === undefined || level < existing) bestLevel.set(pgId, level);
  }

  const topPgIds = [...bestLevel.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, 24)
    .map(([pgId]) => pgId);

  const { data: gammesData } = await client
    .from('pieces_gamme')
    .select('pg_id, pg_alias, pg_name')
    .in('pg_id', topPgIds)
    .in('pg_level', ['1', '2'])
    .eq('pg_display', '1');
  if (!Array.isArray(gammesData)) return [];

  return (
    gammesData as Array<{ pg_id: number; pg_alias: string; pg_name: string }>
  )
    .map((g) => ({
      pg_alias: g.pg_alias,
      pg_name: g.pg_name,
      piece_count: bestLevel.get(g.pg_id) ?? 999,
    }))
    .sort((a, b) => a.piece_count - b.piece_count)
    .slice(0, 8);
}

function composeR8Sections(
  type: SampleType,
  brand: string,
  model: string,
  wearGammes: { pg_alias: string; pg_name: string; piece_count: number }[],
  motorIssues: string[],
): string {
  const profile = deriveEngineProfile(type.fuel, type.power_ps);
  const euro = deriveEuroNorm(type.year_from);

  // S_COMPAT_SCOPE — colonnes auto_type réelles
  const compatFacts: string[] = [];
  if (type.liter) compatFacts.push(`cylindrée ${type.liter} cm³`);
  if (type.fuel) compatFacts.push(`carburant ${type.fuel.toLowerCase()}`);
  if (type.power_ps) compatFacts.push(`${type.power_ps} ch`);
  if (type.body) compatFacts.push(`carrosserie ${type.body.toLowerCase()}`);
  if (type.year_from) {
    const range = type.year_to ? `${type.year_from}–${type.year_to}` : `${type.year_from}`;
    compatFacts.push(`production ${range}`);
  }
  const compatText = `Motorisation ${type.type_name} : ${compatFacts.join(' · ')}.`;

  // S_TECH_SPECS — euro derivé + motorisation line
  const techSpecs = [
    `**Motorisation** : ${type.type_name} ${type.power_ps} ch (${type.fuel})`,
    euro
      ? `**Norme Euro (estimée)** : ${euro} — production à partir de ${type.year_from}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  // S_SELECTION_GUIDE — top 8 wear gammes per type
  const gammeList = wearGammes
    .map((g, i) => `${i + 1}. **${g.pg_name}** — ${g.piece_count} références`)
    .join('\n');
  const selectionGuide = `Top ${wearGammes.length} familles pour la ${brand} ${model} ${type.type_name} :\n\n${gammeList}`;

  // S_MOTOR_ISSUES — composed from gamme RAG
  const issuesText = motorIssues.map((l) => `- ${l}`).join('\n');
  const motorIssuesSection = motorIssues.length > 0
    ? `Symptômes éditoriaux des pièces les plus référencées :\n\n${issuesText}`
    : '';

  return [
    `## S_COMPAT_SCOPE\n\nprofile=${profile}\n\n${compatText}`,
    `## S_TECH_SPECS\n\n${techSpecs}`,
    `## S_SELECTION_GUIDE\n\n${selectionGuide}`,
    motorIssuesSection ? `## S_MOTOR_ISSUES\n\n${motorIssuesSection}` : '',
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/\W+/)
      .filter((w) => w.length >= 4),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = new Set([...a].filter((w) => b.has(w)));
  const union = new Set([...a, ...b]);
  return union.size ? inter.size / union.size : 0;
}

async function runSample(
  label: string,
  brand: string,
  model: string,
  typeIds: number[],
  client: ReturnType<typeof createClient>,
  reader: GammeSymptomReader,
): Promise<void> {
  console.log(`\n═══ ${label} ═══`);
  const samples: { label: string; text: string; tokens: Set<string> }[] = [];
  for (const tid of typeIds) {
    const type = await fetchType(client, tid);
    if (!type) {
      console.log(`  WARN type_id=${tid} not found`);
      continue;
    }
    const wearGammes = await fetchWearGammes(client, tid);
    const motorIssues = reader.compose(
      wearGammes.map((g) => g.pg_alias),
      2,
    );
    const text = composeR8Sections(type, brand, model, wearGammes, motorIssues);
    samples.push({
      label: `${type.type_id} ${type.type_name} ${type.fuel} ${type.power_ps}ch`,
      text,
      tokens: tokenize(text),
    });
    console.log(
      `  fetched type_id=${type.type_id}: ${wearGammes.length} gammes, ${motorIssues.length} issue lines`,
    );
  }

  const allJ: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const j_val = jaccard(samples[i].tokens, samples[j].tokens);
      allJ.push(j_val);
      const verdict = j_val < 0.4 ? '✓ PASS' : j_val < 0.55 ? '⚠ REVIEW' : '✗ FAIL';
      console.log(
        `  ${samples[i].label.padEnd(48)} vs ${samples[j].label.padEnd(48)} → ${(j_val * 100).toFixed(1).padStart(5)}% ${verdict}`,
      );
    }
  }
  if (allJ.length > 0) {
    const avg = allJ.reduce((a, b) => a + b, 0) / allJ.length;
    const max = Math.max(...allJ);
    console.log(`  ─────────────────────────────────`);
    console.log(`  avg = ${(avg * 100).toFixed(1)}%   max = ${(max * 100).toFixed(1)}%`);
    console.log(
      `  verdict : ${max < 0.4 ? '✓ PASS (<40%)' : max < 0.55 ? '⚠ REVIEW (40-55%)' : '✗ FAIL (>55%)'}`,
    );
  }
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Run from backend/ with .env loaded.',
    );
  }
  const client = createClient(url, key);
  const reader = new GammeSymptomReader();

  await runSample('DS 3 — 3 distinct profiles (essence/diesel/sport)', 'DS', 'DS 3', DS3_TYPE_IDS, client, reader);
  await runSample('Clio III dCi — 3 close-power siblings (hardest case)', 'RENAULT', 'CLIO III', CLIO3_TYPE_IDS, client, reader);

  console.log(
    '\nNOTE : ce benchmark utilise les VRAIS fichiers RAG /opt/automecanik/rag/knowledge/gammes/*.md.',
  );
  console.log('Aucun mock, aucune donnée hardcodée.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
