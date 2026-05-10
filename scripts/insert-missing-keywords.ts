/**
 * Insert/Update keywords from Google Ads CSV into __seo_keywords
 * V-Level v5.0 Algorithm:
 *
 *   V1 = top V2 inter-gammes (calculated after multiple gammes)
 *   V2 = top 10 V3 de la gamme (promoted from V3), dedup par [model+energy]
 *   V3 = champion #1 du groupe [gamme+modèle+énergie], dans le CSV (volume >= 0)
 *   V4 = pas #1, dans le CSV
 *   V5 = dans la DB, pas dans le CSV, siblings avec même parent (pas root)
 *   V6 = dans la DB, dans AUCUNE gamme (global, pas calculé ici)
 *
 * Tous les V ont un type_id (véhicule réel dans la DB).
 * Energies: diesel, hybride, electrique, gpl, essence (dans cet ordre de détection).
 * Gamme universelle: ignore energy dans le groupement si gamme_universelle=true.
 *
 * Pipeline:
 *   Phase T: CSV → T1(pertinence) → T2(exclusion) → T3(catégorisation) → T4(véhicules seuls)
 *   Phase V: V3(champion) → V4(challengers) → V2(top V3) → V5(DB siblings same parent)
 *
 * score_seo = volume × (1 + nb_v4 / 5)
 *
 * Usage:
 *   npx tsx scripts/insert-missing-keywords.ts <csv_path> <gamme_name> [--dry-run] [--recalc]
 *
 *   --recalc: Recalculate V-Levels for ALL keywords in this gamme (not just new ones)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ParsedKeyword {
  keyword: string;
  volume: number;
  competition: string;
  competitionIndex: number;
}

interface KeywordRecord {
  id?: number;
  keyword: string;
  keyword_normalized: string;
  gamme: string;
  model: string | null;
  variant: string | null;
  energy: string;
  v_level: string | null;
  volume: number;
  score_seo: number | null;
  type: string;
  type_id: number | null;
  power: number | null;
  displacement: string | null;
}

interface VLevelStats {
  V1: number;
  V2: number;
  V3: number;
  V4: number;
  V5: number;
  V6: number;
  NULL: number;
}

// ── Phase T: Triage / Filtering ──────────────────────────────────────────────

/**
 * T1: Keyword must be relevant to the gamme (contains at least one gamme term)
 */
function filterT1_pertinence(keywords: ParsedKeyword[], gamme: string): { kept: ParsedKeyword[]; excluded: ParsedKeyword[] } {
  const gammeTerms = normalizeKeyword(gamme).split(/\s+/).filter(t => t.length > 2);
  const kept: ParsedKeyword[] = [];
  const excluded: ParsedKeyword[] = [];

  for (const kw of keywords) {
    const norm = normalizeKeyword(kw.keyword);
    const hasGammeTerm = gammeTerms.some(term => norm.includes(term));
    if (hasGammeTerm) {
      kept.push(kw);
    } else {
      excluded.push(kw);
    }
  }
  return { kept, excluded };
}

/**
 * T2: Exclude keywords that belong to OTHER gammes (not this one)
 */
const EXCLUSION_TERMS: Record<string, string[]> = {
  'disque de frein': ['vanne egr', 'embrayage', 'courroie', 'bougie', 'bobine', 'injecteur', 'turbo', 'demarreur', 'alternateur', 'pompe a eau', 'radiateur', 'echappement', 'amortisseur', 'cardan', 'rotule', 'biellette', 'silentbloc', 'silent bloc'],
  'plaquette de frein': ['vanne egr', 'embrayage', 'courroie', 'bougie', 'bobine'],
  'filtre a huile': ['vanne egr', 'embrayage', 'courroie'],
};

function filterT2_exclusion(keywords: ParsedKeyword[], gamme: string): { kept: ParsedKeyword[]; excluded: ParsedKeyword[] } {
  const gammeNorm = normalizeKeyword(gamme);
  const exclusions = EXCLUSION_TERMS[gammeNorm] || [];
  const kept: ParsedKeyword[] = [];
  const excluded: ParsedKeyword[] = [];

  for (const kw of keywords) {
    const norm = normalizeKeyword(kw.keyword);
    // Exclude if keyword contains an exclusion term AND does NOT contain a gamme term
    // (e.g. "disque et plaquette" is OK — "plaquette 307" without "disque"/"frein" is not)
    const hasExclusion = exclusions.some(ex => norm.includes(ex));
    if (hasExclusion) {
      excluded.push(kw);
    } else {
      kept.push(kw);
    }
  }
  return { kept, excluded };
}

/**
 * T3: Categorize keyword type
 * - 'vehicle': contains a vehicle model
 * - 'brand': contains a parts brand (brembo, bosch, etc.) but no vehicle
 * - 'generic': neither vehicle nor brand
 */
const BRAND_TERMS = ['brembo', 'bosch', 'ate', 'ferodo', 'galfer', 'trw', 'mintex', 'delphi', 'valeo', 'textar', 'bendix', 'motrio', 'ap racing', 'wilwood', 'ebc', 'newfren'];

function categorizeT3(keyword: string, gamme: string): 'vehicle' | 'brand' | 'generic' {
  const { model } = extractVehicleInfo(keyword, gamme);
  if (model) return 'vehicle';

  const norm = normalizeKeyword(keyword);
  if (BRAND_TERMS.some(b => norm.includes(b))) return 'brand';

  return 'generic';
}

/**
 * Run full T1-T4 pipeline
 * T4: Only vehicle keywords participate in V-Level classification
 */
function runTriagePipeline(keywords: ParsedKeyword[], gamme: string): {
  vehicle: ParsedKeyword[];
  brand: ParsedKeyword[];
  generic: ParsedKeyword[];
  excludedT1: ParsedKeyword[];
  excludedT2: ParsedKeyword[];
} {
  // T1: pertinence
  const t1 = filterT1_pertinence(keywords, gamme);

  // T2: exclusion
  const t2 = filterT2_exclusion(t1.kept, gamme);

  // T3+T4: categorize and separate
  const vehicle: ParsedKeyword[] = [];
  const brand: ParsedKeyword[] = [];
  const generic: ParsedKeyword[] = [];

  for (const kw of t2.kept) {
    const cat = categorizeT3(kw.keyword, gamme);
    if (cat === 'vehicle') vehicle.push(kw);
    else if (cat === 'brand') brand.push(kw);
    else generic.push(kw);
  }

  return {
    vehicle,
    brand,
    generic,
    excludedT1: t1.excluded,
    excludedT2: t2.excluded,
  };
}

// ── Energy detection ─────────────────────────────────────────────────────────

// Energy detection patterns — ordered: diesel, hybride, electrique, gpl, essence
// Order matters: hybrid cars must not be classified as essence
const ENERGY_DETECTION_ORDER: Array<{ energy: string; patterns: string[] }> = [
  { energy: 'diesel', patterns: ['dci', 'hdi', 'tdi', 'bluehdi', 'crdi', 'jtd', 'd4d', 'cdti', 'ddis', 'diesel'] },
  { energy: 'hybride', patterns: ['hybrid', 'phev', 'e-hybrid', 'plug-in', 'hybride', 'e-tense'] },
  { energy: 'electrique', patterns: ['electrique', 'electric', 'e-208', 'e-c4'] },
  { energy: 'gpl', patterns: ['gpl', 'lpg', 'bifuel'] },
  { energy: 'essence', patterns: ['tce', 'tsi', 'tfsi', 'vti', 'vvt', 'mpi', '16v', 'vtec', 'essence'] },
];

function detectEnergy(text: string): string {
  const lower = text.toLowerCase();
  for (const { energy, patterns } of ENERGY_DETECTION_ORDER) {
    if (patterns.some((p) => lower.includes(p))) return energy;
  }
  // Special case: e-prefix models (e-208, e-c4, etc.) — check with word boundary
  if (/\be-\d/.test(lower) || /\be-[a-z]\d/.test(lower)) return 'electrique';
  // Standalone 'ev' with word boundary to avoid false positives
  if (/\bev\b/.test(lower)) return 'electrique';
  return 'unknown';
}

/**
 * Parse UTF-16 LE CSV from Google Ads Keyword Planner
 */
function parseGoogleAdsCSV(csvPath: string): ParsedKeyword[] {
  const buffer = fs.readFileSync(csvPath);

  let content: string;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    content = buffer.slice(2).toString('utf16le');
  } else {
    content = buffer.toString('utf16le');
  }

  const lines = content.split('\n').filter((line) => line.trim());
  const results: ParsedKeyword[] = [];

  // Skip header lines (first 3 lines)
  for (let i = 3; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 7) continue;

    const keyword = cols[0]?.trim();
    const volumeStr = cols[2]?.replace(/\s/g, '').replace(/,/g, '');
    const volume = parseInt(volumeStr || '0', 10);
    const competition = cols[5]?.trim() || '';
    const competitionIndex = parseInt(cols[6] || '0', 10);

    if (keyword) {
      results.push({ keyword, volume, competition, competitionIndex });
    }
  }

  return results;
}

/**
 * Normalize keyword for matching
 */
function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .trim();
}

// ── Vehicle extraction — DB-driven via RPC match_keyword_text_to_vehicle_batch ─
//
// Design : au lieu de regex hardcodées (qui rataient 2cv, 4l, c15, c25,
// espace, xantia, saxo, yaris, twingo i, etc.), on délègue l'extraction
// model+energy à une RPC SQL qui lit auto_modele FULL catalog avec aliases
// romain/arabe + digit-letter collapsed. Couvre 1482+ modèles dynamiquement.
//
// Flow :
//   1. Avant triage T3, appeler buildVehicleExtractionCache(csvKeywords)
//      — 1 round-trip DB par chunk de 500 KW
//   2. extractVehicleInfo() lit depuis la Map, pas de regex
//
// Cf. migration 20260423_match_keyword_text_to_vehicle.sql

interface VehicleExtraction {
  model: string | null;
  energy: string | null;
}

const vehicleExtractionCache = new Map<string, VehicleExtraction>();

async function buildVehicleExtractionCache(keywords: string[]): Promise<void> {
  if (keywords.length === 0) return;
  const unique = Array.from(new Set(keywords));
  const BATCH = 500;

  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const { data, error } = await supabase.rpc(
      'match_keyword_text_to_vehicle_batch',
      { p_texts: chunk }
    );
    if (error) {
      console.error(`⚠️ RPC match_keyword_text_to_vehicle_batch (batch ${i}): ${error.message}`);
      continue;
    }
    for (const row of (data || []) as Array<{ input: string; matched_model: string | null; matched_energy: string | null }>) {
      vehicleExtractionCache.set(row.input, {
        model: row.matched_model,
        energy: row.matched_energy,
      });
    }
  }
}

function extractVehicleInfo(
  keyword: string,
  gamme: string
): { model: string | null; variant: string | null; power: number | null; displacement: string | null } {
  const normalized = normalizeKeyword(keyword);
  const gammeNorm = normalizeKeyword(gamme);

  // Remove gamme from keyword for variant extraction
  let remaining = normalized.replace(gammeNorm, '').trim();

  // STEP 1: Extract displacement (1.6, 2.0, ...)
  let displacement: string | null = null;
  const dispMatch = remaining.match(/\b(\d)[.,](\d)\b/);
  if (dispMatch) {
    displacement = `${dispMatch[1]}.${dispMatch[2]}`;
    remaining = remaining.replace(dispMatch[0], ' __DISP__ ').trim();
  }

  // STEP 2: Extract power (CV/CH)
  let power: number | null = null;
  const powerMatch = remaining.match(/\b(6[05]|7[05]|8[056]|9[05]|1[0-4][05]|1[56]0)\s*(ch|cv)?\b/i);
  if (powerMatch) {
    power = parseInt(powerMatch[1], 10);
    remaining = remaining.replace(powerMatch[0], ' ').trim();
  }

  // STEP 3: Model from DB-driven cache (canon via auto_modele + roman/arabic/collapsed aliases)
  const cached = vehicleExtractionCache.get(keyword);
  const model = cached?.model ?? null;

  // STEP 4: Variant = what's left after stripping the matched model + gamme + displacement
  let variant: string | null = null;
  if (model) {
    const escapedModel = model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const modelPattern = new RegExp(`\\b${escapedModel}\\b`, 'i');
    let afterModel = remaining.replace(modelPattern, ' ').trim();
    afterModel = afterModel.replace('__DISP__', displacement || '').trim();
    if (afterModel) {
      variant = afterModel.replace(/\s+/g, ' ').replace(/^\s*,\s*/, '').trim() || null;

      // Strip non-variant noise words
      if (variant) {
        const NON_VARIANT_TERMS = [
          'prix', 'avant', 'arriere', 'arrière', 'avec roulement',
          'et plaquette', 'de frein', 'frein', 'disque', 'ventile',
          'plein', 'arriere avec roulement', 'avant ventile',
        ];
        const variantClean = variant.toLowerCase().trim();
        if (NON_VARIANT_TERMS.some(t => variantClean === t || variantClean === `${t} prix`)) {
          variant = null;
        }
      }
    }
  } else if (displacement) {
    const cleanRemaining = remaining.replace('__DISP__', '').trim();
    if (cleanRemaining) {
      variant = `${displacement} ${cleanRemaining}`.replace(/\s+/g, ' ').trim();
    }
  }

  return { model, variant, power, displacement };
}

/**
 * V-Level v5.0 Classification Algorithm
 *
 * Phase T = trier les KEYWORDS (CSV, texte + volume) — déjà fait avant cette fonction
 * Phase V = classer les VEHICULES (type_ids, après match backfill)
 *
 * Les V-levels ne regardent PAS le volume. Le volume est déjà trié par les T.
 *
 * Definitions:
 *   V3 = type_id matché par le backfill (match principal), même si volume=0
 *   V4 = type_id dans le CSV, pas le match principal
 *   V5 = type_id dans la DB, siblings avec même parent (pas root)
 *   V6 = orphelins DB (assigné globalement)
 *   V2 = top 10 modèles promus depuis V3, dedup par [model+energy]
 *   V1 = modèle V2 dans ≥30% des gammes (batch inter-gammes)
 *
 * Pre-backfill: on utilise (model, variant, energy) comme proxy pour type_id.
 * Le keyword avec le plus de volume dans un groupe est le V3 (match principal).
 * Les autres keywords du même groupe sont V4 (dans CSV, pas le match principal).
 * Gamme universelle: groupement par [gamme+modèle] seulement (ignore energy).
 */
function assignVLevels(keywords: KeywordRecord[], gammeUniverselle: boolean = false): KeywordRecord[] {
  // Step 1: Only classify vehicle keywords (type = 'vehicle')
  const vehicleKws = keywords.filter(kw => kw.type === 'vehicle');
  const nonVehicleKws = keywords.filter(kw => kw.type !== 'vehicle');

  // Non-vehicle keywords don't get V-levels
  for (const kw of nonVehicleKws) {
    kw.v_level = null;
    kw.score_seo = null;
  }

  // Step 2: Group vehicle keywords
  // Gamme universelle: group by [model] only (ignore energy)
  // Normal gamme: group by [model + energy]
  const byGroup = new Map<string, KeywordRecord[]>();

  for (const kw of vehicleKws) {
    const key = gammeUniverselle
      ? `${kw.model || '_no_model'}`
      : `${kw.model || '_no_model'}|${kw.energy}`;
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
    }
    byGroup.get(key)!.push(kw);
  }

  // Step 3: For each group, elect V3 (match principal) and V4 (dans CSV, pas matché)
  // V3 = first keyword after sorting by volume DESC (even if volume=0)
  // V4 = other keywords in CSV for this group (different variants, not the primary match)
  const v3Champions: KeywordRecord[] = [];

  for (const [_groupKey, group] of byGroup) {
    // Sort by volume DESC, then keyword length ASC (shorter = more generic = better match)
    group.sort((a, b) => {
      if (b.volume !== a.volume) return b.volume - a.volume;
      return a.keyword.length - b.keyword.length;
    });

    // V3 = first keyword in the group (no volume > 0 requirement)
    const [champion, ...rest] = group;
    champion.v_level = 'V3';
    champion.score_seo = champion.volume;
    v3Champions.push(champion);

    for (const kw of rest) {
      // V4: dans le CSV, pas le match principal
      kw.v_level = 'V4';
      kw.score_seo = null;
    }
  }

  // Step 4: Promote top 10 DISTINCT [model+energy] V3 → V2
  // Dedup by [model + energy] so a model can have 2 V2 entries (one diesel + one essence)
  if (v3Champions.length > 0) {
    v3Champions.sort((a, b) => (b.score_seo || 0) - (a.score_seo || 0));
    const seenModelEnergy = new Set<string>();
    const top10: KeywordRecord[] = [];
    for (const kw of v3Champions) {
      const dedupKey = `${(kw.model || '').toLowerCase()}|${kw.energy}`;
      if (seenModelEnergy.has(dedupKey)) continue;
      seenModelEnergy.add(dedupKey);
      top10.push(kw);
      if (top10.length >= 10) break;
    }
    for (const kw of top10) {
      kw.v_level = 'V2';
    }
  }

  return keywords;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  V-Level v5.0 Keyword Import Script                        ║
╚════════════════════════════════════════════════════════════╝

Usage: npx tsx scripts/insert-missing-keywords.ts <csv_path> <gamme_name> [--dry-run] [--recalc]

Options:
  --dry-run   Preview changes without writing to database
  --recalc    Recalculate V-Levels for ALL keywords (not just new ones)

Examples:
  npx tsx scripts/insert-missing-keywords.ts "Keyword Stats 2026-02-01.csv" "filtre à huile" --dry-run
  npx tsx scripts/insert-missing-keywords.ts "Keyword Stats 2026-02-01.csv" "filtre à huile" --recalc
`);
    process.exit(1);
  }

  const csvPath = path.resolve(args[0]);
  const gammeName = args[1]; // Now accepts gamme name directly
  const dryRun = args.includes('--dry-run');
  const recalc = args.includes('--recalc');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  if (!gammeName || gammeName.startsWith('--')) {
    console.error(`❌ Gamme name is required as second argument`);
    process.exit(1);
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  V-Level v5.0 Import                                       ║
╚════════════════════════════════════════════════════════════╝
`);

  console.log(`📦 Gamme: "${gammeName}"`);
  console.log(`📂 CSV: ${path.basename(csvPath)}`);
  console.log(`🔧 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}${recalc ? ' + RECALC' : ''}`);

  // Lookup pg_id from gamme name
  const { data: gammeData, error: gammeError } = await supabase
    .from('pieces_gamme')
    .select('pg_id')
    .ilike('pg_name', gammeName)
    .single();

  if (gammeError || !gammeData) {
    console.error(`❌ Gamme "${gammeName}" not found in pieces_gamme`);
    process.exit(1);
  }

  const pgId = gammeData.pg_id;
  console.log(`🔑 pg_id: ${pgId}`);

  // Parse CSV
  const csvKeywordsRaw = parseGoogleAdsCSV(csvPath);
  console.log(`📊 CSV: ${csvKeywordsRaw.length} keywords parsed`);

  // ── Pre-fetch vehicle extraction (DB-driven via RPC) ───────────────────────
  // Remplace les regex hardcodées par un lookup dans auto_modele (1482+ modèles).
  // Couvre tous les modèles anciens (2cv/c15/c25/xantia/saxo/espace/twingo i/etc).
  console.log(`\n⚙️  Pré-fetch extraction véhicule (RPC match_keyword_text_to_vehicle_batch)...`);
  await buildVehicleExtractionCache(csvKeywordsRaw.map(k => k.keyword));
  const cachedModelCount = Array.from(vehicleExtractionCache.values()).filter(v => v.model).length;
  console.log(`   → ${cachedModelCount}/${vehicleExtractionCache.size} KW ont un modèle véhicule détecté`);

  // ── Phase T: Triage ─────────────────────────────────────────────────────────
  console.log(`\n⚙️  Phase T: Triage...`);
  const triage = runTriagePipeline(csvKeywordsRaw, gammeName);

  console.log(`   T1 exclus (hors gamme):    ${triage.excludedT1.length}`);
  console.log(`   T2 exclus (autre gamme):   ${triage.excludedT2.length}`);
  console.log(`   T3/T4 véhicule:            ${triage.vehicle.length}`);
  console.log(`   T3 marque:                 ${triage.brand.length}`);
  console.log(`   T3 générique:              ${triage.generic.length}`);

  if (triage.excludedT1.length > 0) {
    console.log(`\n   Exemples T1 exclus:`);
    triage.excludedT1.slice(0, 5).forEach(k => console.log(`     ✗ ${k.keyword}`));
  }
  if (triage.excludedT2.length > 0) {
    console.log(`\n   Exemples T2 exclus:`);
    triage.excludedT2.slice(0, 5).forEach(k => console.log(`     ✗ ${k.keyword}`));
  }

  // All filtered keywords (vehicle + brand + generic) go to DB, but only vehicle gets V-level
  const csvKeywords = [...triage.vehicle, ...triage.brand, ...triage.generic];
  console.log(`   → ${csvKeywords.length} keywords retenus (${triage.vehicle.length} véhicules pour V-Level)`);

  // Get existing keywords from DB (use gamme, not pg_id)
  // Fetch in batches to avoid Supabase 1000 row limit
  let existingKeywords: any[] = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error: fetchError } = await supabase
      .from('__seo_keywords')
      .select('id, keyword, keyword_normalized, model, variant, energy, v_level, volume, type_id, score_seo')
      .eq('gamme', gammeName)
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error(`❌ Failed to fetch existing keywords: ${fetchError.message}`);
      process.exit(1);
    }

    if (batch && batch.length > 0) {
      existingKeywords = existingKeywords.concat(batch);
      offset += batchSize;
      hasMore = batch.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`📦 DB: ${existingKeywords.length} existing keywords`);

  // Create map of existing keywords
  const existingMap = new Map<string, (typeof existingKeywords)[0]>();
  for (const kw of existingKeywords || []) {
    existingMap.set(normalizeKeyword(kw.keyword), kw);
  }

  // Build keyword records for processing
  const allKeywords: KeywordRecord[] = [];

  // Add existing keywords (for recalc mode) — skip V5 (DB siblings, not from CSV)
  if (recalc) {
    // Extend vehicle cache with existing KW that aren't in the CSV (e.g. from previous imports).
    // Ensures V-Level recalculation uses fresh RPC-based model detection even for legacy rows.
    const existingKwTexts = (existingKeywords || []).map(k => k.keyword).filter(Boolean);
    const uncached = existingKwTexts.filter(t => !vehicleExtractionCache.has(t));
    if (uncached.length > 0) {
      await buildVehicleExtractionCache(uncached);
    }

    for (const kw of (existingKeywords || []).filter(k => k.v_level !== 'V5')) {
      // Find volume from CSV if available
      const csvMatch = csvKeywords.find(
        (c) => normalizeKeyword(c.keyword) === normalizeKeyword(kw.keyword)
      );

      // Refresh model/energy from canonical RPC cache (overrides potentially stale DB values)
      const cached = vehicleExtractionCache.get(kw.keyword);
      const refreshedModel = cached?.model ?? kw.model;
      const refreshedEnergy = cached?.energy ?? kw.energy ?? detectEnergy(kw.keyword);

      allKeywords.push({
        id: kw.id,
        keyword: kw.keyword,
        keyword_normalized: normalizeKeyword(kw.keyword),
        gamme: gammeName,
        model: refreshedModel,
        variant: kw.variant,
        energy: refreshedEnergy,
        v_level: kw.v_level,
        volume: csvMatch?.volume ?? kw.volume ?? 0,
        score_seo: null, // Will be recalculated
        type: refreshedModel ? 'vehicle' : 'generic',
        type_id: kw.type_id,
        power: null,
        displacement: null,
      });
    }
  }

  // Add new keywords from CSV
  let newCount = 0;
  for (const csvKw of csvKeywords) {
    const normalized = normalizeKeyword(csvKw.keyword);
    const existing = existingMap.get(normalized);

    if (!existing) {
      // New keyword
      const { model, variant, power, displacement } = extractVehicleInfo(csvKw.keyword, gammeName);
      const energy = detectEnergy(csvKw.keyword);

      allKeywords.push({
        keyword: csvKw.keyword,
        keyword_normalized: normalized,
        gamme: gammeName,
        model,
        variant,
        energy,
        v_level: null, // Will be assigned
        volume: csvKw.volume,
        score_seo: null,
        type: model ? 'vehicle' : 'generic',
        type_id: null, // Will be backfilled
        power,
        displacement,
      });
      newCount++;
    } else if (recalc) {
      // Update existing with new volume from CSV
      const record = allKeywords.find((k) => k.id === existing.id);
      if (record) {
        record.volume = csvKw.volume;
      }
    }
  }

  console.log(`🆕 New keywords: ${newCount}`);

  // ── Fetch gamme_universelle flag before groupement ──────────────────────────
  const { data: gammeMetaData } = await supabase
    .from('pieces_gamme')
    .select('gamme_universelle')
    .eq('pg_id', pgId)
    .single();

  const gammeUniverselle = gammeMetaData?.gamme_universelle === true;
  if (gammeUniverselle) {
    console.log(`🌐 Gamme universelle: OUI — groupement par [modèle] uniquement (énergie ignorée)`);
  }

  if (allKeywords.length === 0) {
    console.log('✅ Pas de nouveaux keywords CSV — saut direct à V5');
  } else {
  // Assign V-Levels using v5.0 algorithm
  console.log(`\n⚙️  Phase V: Classification V-Level v5.0...`);
  assignVLevels(allKeywords, gammeUniverselle);

  // Count V-Level distribution
  const stats: VLevelStats = { V1: 0, V2: 0, V3: 0, V4: 0, V5: 0, V6: 0, NULL: 0 };
  for (const kw of allKeywords) {
    if (kw.v_level === null) {
      stats.NULL++;
    } else if (kw.v_level in stats) {
      stats[kw.v_level as keyof VLevelStats]++;
    }
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  V-Level Distribution (v5.0)                               ║
╠════════════════════════════════════════════════════════════╣
║  V2 (Top 10 V3):               ${String(stats.V2).padStart(4)}                        ║
║  V3 (Champions groupe):        ${String(stats.V3).padStart(4)}                        ║
║  V4 (Challengers CSV):         ${String(stats.V4).padStart(4)}                        ║
║  V5 (DB hors CSV):             ${String(stats.V5).padStart(4)}  (après backfill)       ║
║  NULL (générique/marque):      ${String(stats.NULL).padStart(4)}                        ║
╚════════════════════════════════════════════════════════════╝
`);

  // Show V2 (top 10 V3)
  const v2Keywords = allKeywords
    .filter(k => k.v_level === 'V2')
    .sort((a, b) => (b.score_seo || 0) - (a.score_seo || 0));

  console.log(`👑 V2 (Top 10 V3):`);
  v2Keywords.forEach((kw, i) => {
    console.log(`   ${i + 1}. ${kw.keyword} | vol=${kw.volume} | score=${kw.score_seo} | model=${kw.model}`);
  });

  // Show all V3 champions
  const v3Keywords = allKeywords
    .filter(k => k.v_level === 'V3')
    .sort((a, b) => (b.score_seo || 0) - (a.score_seo || 0));

  console.log(`\n📈 V3 Champions par groupe (${v3Keywords.length}):`);
  console.log(`${'Score'.padEnd(7)} ${'Vol'.padEnd(6)} ${'Modèle'.padEnd(15)} ${'Énergie'.padEnd(10)} Keyword`);
  console.log(`${'─'.repeat(70)}`);
  v3Keywords.slice(0, 20).forEach(kw => {
    const score = (kw.score_seo || 0).toString().padEnd(7);
    const vol = kw.volume.toString().padEnd(6);
    const model = (kw.model || '-').padEnd(15);
    const energy = kw.energy.padEnd(10);
    console.log(`${score} ${vol} ${model} ${energy} ${kw.keyword}`);
  });
  if (v3Keywords.length > 20) {
    console.log(`   ... et ${v3Keywords.length - 20} autres V3`);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes made to database');
    return;
  }

  // Upsert to database
  console.log('\n💾 Writing to database...');

  // Separate new keywords (insert) from existing (update)
  const toInsert = allKeywords.filter((k) => !k.id);
  const toUpdate = allKeywords.filter((k) => k.id);

  if (toInsert.length > 0) {
    const insertData = toInsert.map((k) => ({
      keyword: k.keyword,
      keyword_normalized: k.keyword_normalized,
      gamme: k.gamme,
      pg_id: pgId, // Include pg_id for FK integrity
      model: k.model,
      variant: k.variant,
      energy: k.energy,
      v_level: k.v_level,
      volume: k.volume,
      score_seo: k.score_seo,
      type: k.type,
    }));

    const { error: insertError } = await supabase
      .from('__seo_keywords')
      .upsert(insertData, { onConflict: 'keyword,gamme', ignoreDuplicates: false });

    if (insertError) {
      console.error(`❌ Insert error: ${insertError.message}`);
    } else {
      console.log(`   ✅ Inserted ${toInsert.length} new keywords`);
    }
  }

  if (toUpdate.length > 0 && recalc) {
    // Update in batches of 100
    const batchSize = 100;
    let updated = 0;

    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const batch = toUpdate.slice(i, i + batchSize);

      for (const kw of batch) {
        const { error: updateError } = await supabase
          .from('__seo_keywords')
          .update({
            v_level: kw.v_level,
            volume: kw.volume,
            score_seo: kw.score_seo,
          })
          .eq('id', kw.id);

        if (!updateError) updated++;
      }
    }

    console.log(`   ✅ Updated ${updated} existing keywords`);
  }

  // Backfill type_id for new keywords
  if (toInsert.length > 0) {
    console.log(`\n🔗 Backfilling type_ids...`);

    let totalMatched = 0;
    let totalUnmatched = 0;
    let batchCount = 0;
    let hasMore = true;
    const MAX_BATCHES = 20;

    while (hasMore && batchCount < MAX_BATCHES) {
      const rpcResult = await supabase.rpc('backfill_seo_keywords_type_ids', {
        p_batch_size: 100,
        p_pg_id: pgId,
      });

      if (rpcResult.error) {
        console.error(`   ⚠️ Backfill error: ${rpcResult.error.message}`);
        break;
      }

      const result = rpcResult.data?.[0];
      if (!result || result.processed === 0) {
        hasMore = false;
        break;
      }
      totalMatched += result.matched;
      totalUnmatched += result.unmatched;

      batchCount++;
      await new Promise((r) => setTimeout(r, 50));
    }

    const matchRate =
      totalMatched + totalUnmatched > 0
        ? ((totalMatched / (totalMatched + totalUnmatched)) * 100).toFixed(1)
        : '0';

    console.log(`   Matched: ${totalMatched} (${matchRate}%)`);
    console.log(`   Unmatched: ${totalUnmatched}`);
  }
  } // end of allKeywords.length > 0 block

  // ── Phase V5: Véhicules DB pas dans le CSV (même modèle a des V3/V4) ──────
  console.log(`\n⚙️  Phase V5: Véhicules DB hors CSV...`);

  // Step 1: Get type_ids that have V2/V3/V4 keywords in this gamme (after backfill)
  const { data: gammeTypeIdRows, error: gmError } = await supabase
    .from('__seo_keywords')
    .select('type_id')
    .eq('gamme', gammeName)
    .in('v_level', ['V2', 'V3', 'V4'])
    .not('type_id', 'is', null);

  if (gmError) {
    console.error(`   ⚠️ V5 query error: ${gmError.message}`);
  } else {
    const linkedTypeIds = new Set((gammeTypeIdRows || []).map(r => r.type_id));
    console.log(`   Type_ids liés (V2/V3/V4): ${linkedTypeIds.size}`);

    if (linkedTypeIds.size === 0) {
      console.log(`   ⚠️ Aucun type_id lié — backfill nécessaire d'abord. V5 ignoré.`);
    } else {
      // Step 2: Get type_modele_id for those type_ids (via auto_type)
      const typeIdArray = [...linkedTypeIds];
      const modeleIdSet = new Set<string>();

      // Batch in groups of 100 to avoid PostgREST limits
      for (let i = 0; i < typeIdArray.length; i += 100) {
        const batch = typeIdArray.slice(i, i + 100);
        const { data: typeRows } = await supabase
          .from('auto_type')
          .select('type_modele_id')
          .in('type_id', batch);

        for (const row of typeRows || []) {
          if (row.type_modele_id) modeleIdSet.add(String(row.type_modele_id));
        }
      }

      console.log(`   Modèles DB trouvés (directs): ${modeleIdSet.size}`);

      // Step 2b: Find siblings with the SAME PARENT (v5.0 rule)
      // - If modele_parent = 0, the model IS a root → no siblings (skip)
      // - If modele_parent > 0, find all children of that parent (siblings)
      const directModeleIdSet = new Set<string>(); // direct models (already V2/V3/V4)
      const expandedModeleIds = new Set<string>(); // only TRUE siblings (for V5)
      const directModeleIds = [...modeleIdSet];
      const parentIds = new Set<number>(); // parents that are NOT roots
      let rootSkipCount = 0;

      // Find parent for each modele_id
      for (let i = 0; i < directModeleIds.length; i += 100) {
        const batch = directModeleIds.slice(i, i + 100);
        const { data: modeleRows } = await supabase
          .from('auto_modele')
          .select('modele_id, modele_parent')
          .in('modele_id', batch);

        for (const row of modeleRows || []) {
          directModeleIdSet.add(String(row.modele_id)); // track but don't V5
          if (row.modele_parent === 0) {
            // Model IS a root → no siblings to expand
            rootSkipCount++;
          } else {
            // Model has a parent → collect parent to find siblings
            parentIds.add(row.modele_parent);
          }
        }
      }

      // Get siblings: all children of each parent, excluding direct models
      const parentIdArray = [...parentIds];
      for (let i = 0; i < parentIdArray.length; i += 100) {
        const batch = parentIdArray.slice(i, i + 100);
        const { data: siblingRows } = await supabase
          .from('auto_modele')
          .select('modele_id')
          .in('modele_parent', batch);

        for (const row of siblingRows || []) {
          const id = String(row.modele_id);
          if (!directModeleIdSet.has(id)) {
            expandedModeleIds.add(id); // only true siblings
          }
        }
      }

      console.log(`   Modèles DB expandés (siblings même parent): ${expandedModeleIds.size} (parents: ${parentIds.size}, racines ignorées: ${rootSkipCount})`);

      // Step 3: Get modele names for ALL expanded modeles (for display + model field)
      const modeleIds = [...expandedModeleIds];
      const modeleNameMap = new Map<string, string>();

      for (let i = 0; i < modeleIds.length; i += 100) {
        const batch = modeleIds.slice(i, i + 100);
        const { data: modeleRows } = await supabase
          .from('auto_modele')
          .select('modele_id, modele_name')
          .in('modele_id', batch);

        for (const row of modeleRows || []) {
          modeleNameMap.set(String(row.modele_id), row.modele_name);
        }
      }

      // Step 4: Get ALL type_ids for those modele_ids (siblings)
      // Also get all type_ids already in __seo_keywords for this gamme
      const { data: allGammeTypeIdRows } = await supabase
        .from('__seo_keywords')
        .select('type_id')
        .eq('gamme', gammeName)
        .not('type_id', 'is', null);

      const allLinkedTypeIds = new Set((allGammeTypeIdRows || []).map(r => r.type_id));

      let v5Count = 0;
      for (let i = 0; i < modeleIds.length; i += 50) {
        const batch = modeleIds.slice(i, i + 50);
        const { data: siblingTypes } = await supabase
          .from('auto_type')
          .select('type_id, type_name, type_fuel, type_engine, type_modele_id')
          .in('type_modele_id', batch)
          .eq('type_display', '1')
          .limit(1000);

        if (!siblingTypes) continue;

        // Filter out types already linked to this gamme (coerce to Number for consistent comparison)
        const v5Candidates = siblingTypes.filter(t => !allLinkedTypeIds.has(Number(t.type_id)));

        if (v5Candidates.length === 0) continue;

        // Create synthetic V5 keyword entries
        const v5Records = v5Candidates.map(v => {
          const modelName = modeleNameMap.get(String(v.type_modele_id)) || 'unknown';
          const fuel = (v.type_fuel || '').toLowerCase();
          return {
            keyword: `${gammeName} ${modelName} ${v.type_name}`.toLowerCase().trim(),
            keyword_normalized: normalizeKeyword(`${gammeName} ${modelName} ${v.type_name}`),
            gamme: gammeName,
            pg_id: pgId,
            model: modelName.toLowerCase(),
            variant: v.type_engine || null,
            energy: fuel.includes('diesel') ? 'diesel'
              : fuel.includes('hybrid') ? 'hybride'
              : fuel.includes('electr') || fuel.includes('electric') ? 'electrique'
              : fuel.includes('gpl') || fuel.includes('lpg') ? 'gpl'
              : fuel.includes('essence') || fuel.includes('gasoline') || fuel.includes('petrol') ? 'essence'
              : 'unknown',
            v_level: 'V5',
            volume: 0,
            score_seo: null,
            type: 'vehicle',
            type_id: v.type_id,
          };
        });

        // Upsert in sub-batches of 200
        for (let j = 0; j < v5Records.length; j += 200) {
          const subBatch = v5Records.slice(j, j + 200);
          const { error: v5Error } = await supabase
            .from('__seo_keywords')
            .upsert(subBatch, { onConflict: 'keyword,gamme', ignoreDuplicates: true });

          if (!v5Error) {
            v5Count += subBatch.length;
          } else {
            console.error(`   ⚠️ V5 upsert error: ${v5Error.message}`);
          }
        }

        // Track newly inserted type_ids to avoid duplicates in next batch
        for (const v of v5Candidates) {
          allLinkedTypeIds.add(v.type_id);
        }
      }

      // Count actual V5 in DB (v5Count tracks attempts, not actual inserts due to ignoreDuplicates)
      const { count: v5Actual } = await supabase
        .from('__seo_keywords')
        .select('id', { count: 'exact', head: true })
        .eq('pg_id', pgId)
        .eq('v_level', 'V5');
      console.log(`   ✅ V5 créés: ${v5Actual ?? v5Count} véhicules`);
    }
  }

  // ── Phase V-PROPAGATE: Un V-level par type_id ──────────────────────────────
  console.log(`\n⚙️  Phase V-PROPAGATE: Uniformisation V-level par véhicule...`);

  // For each type_id, propagate the best V-level to all its keywords
  // V2 vehicles: champion keyword stays V2, others get V3 (unique constraint)
  // V3/V4/V5 vehicles: all keywords inherit the vehicle's level
  const { data: propResult, error: propError } = await supabase.rpc('propagate_vlevel_per_typeid', {
    p_pg_id: pgId
  });

  if (propError) {
    console.error(`   ⚠️ Propagation error: ${propError.message}`);
  } else {
    const updatedCount = propResult?.[0]?.updated ?? 0;
    console.log(`   ✅ ${updatedCount} keywords réalignés sur leur véhicule`);
  }

  // ── Stats par véhicule (type_id) ─────────────────────────────────────────
  const { data: vehicleStats } = await supabase
    .from('__seo_keywords')
    .select('v_level, type_id')
    .eq('pg_id', pgId)
    .not('type_id', 'is', null)
    .not('v_level', 'is', null);

  const vehicleByLevel = new Map<string, Set<number>>();
  for (const row of vehicleStats || []) {
    const vl = row.v_level as string;
    if (!vehicleByLevel.has(vl)) vehicleByLevel.set(vl, new Set());
    vehicleByLevel.get(vl)!.add(row.type_id as number);
  }

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  Stats par VEHICULE (type_id)                              ║`);
  console.log(`╠════════════════════════════════════════════════════════════╣`);
  for (const level of ['V2', 'V3', 'V4', 'V5']) {
    const count = vehicleByLevel.get(level)?.size ?? 0;
    console.log(`║  ${level}: ${String(count).padStart(4)} véhicules                                  ║`);
  }
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  // ── Phase V1: Inter-gammes (batch) ─────────────────────────────────────────
  console.log(`\n⚙️  Phase V1: Calcul inter-gammes...`);

  // Get all distinct gammes that have been imported
  const { data: allGammes } = await supabase
    .from('__seo_keywords')
    .select('pg_id')
    .not('v_level', 'is', null)
    .in('v_level', ['V2', 'V3'])
    .limit(10000);

  const distinctPgIds = new Set((allGammes || []).map((r: { pg_id: number }) => r.pg_id));
  const totalGammes = distinctPgIds.size;
  const v1Threshold = Math.max(2, Math.ceil(totalGammes * 0.3));

  console.log(`   Gammes importées: ${totalGammes}`);
  console.log(`   Seuil V1: ≥${v1Threshold} gammes (30% de ${totalGammes})`);

  if (totalGammes < 2) {
    console.log(`   ⚠️ Pas assez de gammes pour V1 (minimum 2). V1 ignoré.`);
  } else {
    // Get all V2 keywords with their model, grouped by pg_id
    const { data: v2Keywords } = await supabase
      .from('__seo_keywords')
      .select('model, pg_id')
      .eq('v_level', 'V2')
      .not('model', 'is', null);

    // Count how many gammes each model appears as V2
    const modelGammeCount = new Map<string, Set<number>>();
    for (const row of v2Keywords || []) {
      const model = (row.model as string).toLowerCase();
      if (!modelGammeCount.has(model)) modelGammeCount.set(model, new Set());
      modelGammeCount.get(model)!.add(row.pg_id as number);
    }

    // Find models that meet the V1 threshold
    const v1Models: Array<{ model: string; gammeCount: number }> = [];
    for (const [model, pgIds] of modelGammeCount) {
      if (pgIds.size >= v1Threshold) {
        v1Models.push({ model, gammeCount: pgIds.size });
      }
    }

    v1Models.sort((a, b) => b.gammeCount - a.gammeCount);

    if (v1Models.length === 0) {
      console.log(`   Aucun modèle ne dépasse le seuil V1.`);
    } else {
      console.log(`\n👑 V1 Candidates (model V2 dans ≥${v1Threshold} gammes):`);
      for (const { model, gammeCount } of v1Models) {
        console.log(`   ${model} — V2 dans ${gammeCount}/${totalGammes} gammes`);
      }
      console.log(`   (V1 non écrit en DB — calcul informatif pour l'instant)`);
    }
  }

  // ── Phase V6: Véhicules dans aucune gamme ──────────────────────────────────
  console.log(`\n⚙️  Phase V6: Véhicules dans aucune gamme...`);

  const { data: v6Data, error: v6Error } = await supabase.rpc('count_vehicles_no_gamme');

  if (v6Error) {
    // RPC might not exist yet, just count and report
    const { count: totalVehicles } = await supabase
      .from('auto_type')
      .select('type_id', { count: 'exact', head: true })
      .eq('type_display', '1');

    const { count: vehiclesWithKeywords } = await supabase
      .from('__seo_keywords')
      .select('type_id', { count: 'exact', head: true })
      .not('type_id', 'is', null);

    const v6Estimate = (totalVehicles || 0) - (vehiclesWithKeywords || 0);
    console.log(`   Total véhicules DB: ${totalVehicles}`);
    console.log(`   Véhicules avec keywords: ${vehiclesWithKeywords}`);
    console.log(`   V6 estimé: ~${v6Estimate} (pas assigné — calcul global séparé)`);
  } else {
    console.log(`   V6: ${v6Data} véhicules dans aucune gamme`);
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✅ V-Level v5.0 Import Complete                           ║
╚════════════════════════════════════════════════════════════╝
`);
}

main().catch(console.error);
