/**
 * Insert/Update keywords from Google Ads CSV into __seo_keywords
 * V-Level v3.0 Algorithm:
 *
 *   V1 = Super-champion inter-gammes (V3 in 2+ gammes, promoted later)
 *   V2 = TOP 20 by score_seo per gamme
 *   V3 = Champion local (TOP 1 by volume per model+energy)
 *   V4 = Variant secondaire (volume > 0, not champion)
 *   V5 = Sans demande (volume = 0 or NULL)
 *   V6 = Bloc B catalogue (manual assignment)
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

// Energy detection patterns
const ENERGY_PATTERNS: Record<string, string[]> = {
  diesel: ['dci', 'hdi', 'tdi', 'bluehdi', 'crdi', 'jtd', 'd4d', 'cdti', 'ddis', 'diesel'],
  essence: ['tce', 'tsi', 'tfsi', 'vti', 'vvt', 'mpi', '16v', 'vtec', 'essence'],
  hybride: ['hybrid', 'hybride', 'e-tense'],
  electrique: ['ev', 'electric', 'electrique', 'e-'],
};

function detectEnergy(text: string): string {
  const lower = text.toLowerCase();
  for (const [energy, patterns] of Object.entries(ENERGY_PATTERNS)) {
    if (patterns.some((p) => lower.includes(p))) return energy;
  }
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

/**
 * Extract model and variant from keyword
 */
function extractVehicleInfo(
  keyword: string,
  gamme: string
): { model: string | null; variant: string | null; power: number | null; displacement: string | null } {
  const normalized = normalizeKeyword(keyword);
  const gammeNorm = normalizeKeyword(gamme);

  // Remove gamme from keyword
  let remaining = normalized.replace(gammeNorm, '').trim();

  // STEP 1: Extract displacement FIRST
  let displacement: string | null = null;
  const dispMatch = remaining.match(/\b(\d)[.,](\d)\b/);
  if (dispMatch) {
    displacement = `${dispMatch[1]}.${dispMatch[2]}`;
    remaining = remaining.replace(dispMatch[0], ' __DISP__ ').trim();
  }

  // STEP 2: Extract power (CV)
  let power: number | null = null;
  const powerMatch = remaining.match(/\b(6[05]|7[05]|8[056]|9[05]|1[0-4][05]|1[56]0)\s*(ch|cv)?\b/i);
  if (powerMatch) {
    power = parseInt(powerMatch[1], 10);
    remaining = remaining.replace(powerMatch[0], ' ').trim();
  }

  // STEP 3: Model patterns
  const modelsWithGeneration = [
    /\b(clio)\s+(\d+|[ivx]+)\b/i,
    /\b(megane)\s+(\d+|[ivx]+)\b/i,
    /\b(scenic)\s+(\d+|[ivx]+)\b/i,
    /\b(twingo)\s+(\d+|[ivx]+)\b/i,
    /\b(golf)\s+(\d+|[ivx]+)\b/i,
  ];

  const modelsOptionalGeneration = [
    /\b(captur)\s*(\d+|[ivx]+)?\b/i,
    /\b(kangoo)\s*(\d+|[ivx]+)?\b/i,
    /\b(polo)\s*(\d+|[ivx]+)?\b/i,
    /\b(focus)\s*(\d+|[ivx]+)?\b/i,
    /\b(fiesta)\s*(\d+|[ivx]+)?\b/i,
    /\b(mondeo)\s*(\d+|[ivx]+)?\b/i,
    /\b(corsa)\s*(\d+|[ivx]+)?\b/i,
    /\b(astra)\s*(\d+|[ivx]+)?\b/i,
  ];

  const modelsNoGeneration = [
    /\b(c3|c4|c5)\b/i,
    /\b(c3 i|c3 ii|c3 iii)\b/i,
    /\b(c4 i|c4 ii)\b/i,
    /\b(c3 picasso|c4 picasso)\b/i,
    /\b(berlingo)\s*(\d+|[ivx]+)?\b/i,
    /\b(207|208|2008)\b/i,
    /\b(307|308|3008)\b/i,
    /\b(407|408|4008)\b/i,
    /\b(508|5008)\b/i,
    /\b(a3|a4|a6|a1|a5|a7|a8)\b/i,
    /\b(q3|q5|q7|q2|q8)\b/i,
  ];

  const allPatterns = [
    ...modelsWithGeneration,
    ...modelsNoGeneration,
    ...modelsOptionalGeneration,
  ];

  let model: string | null = null;
  let variant: string | null = null;

  for (const pattern of allPatterns) {
    const match = remaining.match(pattern);
    if (match) {
      model = match[0].toLowerCase().replace(/\s+/g, ' ').trim();

      const modelEnd = remaining.indexOf(match[0]) + match[0].length;
      let afterModel = remaining.slice(modelEnd).trim();

      afterModel = afterModel.replace('__DISP__', displacement || '').trim();

      if (afterModel) {
        variant = afterModel
          .replace(/\s+/g, ' ')
          .replace(/^\s*,\s*/, '')
          .trim() || null;
      }
      break;
    }
  }

  if (!model && displacement) {
    const cleanRemaining = remaining.replace('__DISP__', '').trim();
    if (cleanRemaining) {
      variant = `${displacement} ${cleanRemaining}`.replace(/\s+/g, ' ').trim();
    }
  }

  return { model, variant, power, displacement };
}

/**
 * Calculate score_seo for a V3 champion
 * score_seo = volume × (1 + nb_v4 / 5)
 */
function calculateScoreSeo(volume: number, nbV4: number): number {
  return Math.round(volume * (1 + nbV4 / 5));
}

/**
 * V-Level v3.0 Classification Algorithm
 */
function assignVLevels(keywords: KeywordRecord[], top20Limit = 20): KeywordRecord[] {
  // Step 1: Group by (model + energy)
  const byModelEnergy = new Map<string, KeywordRecord[]>();

  for (const kw of keywords) {
    // Skip keywords without type_id (cannot be classified per rules)
    if (kw.type_id === null) {
      kw.v_level = null;
      kw.score_seo = null;
      continue;
    }

    const key = `${kw.model || '_no_model'}|${kw.energy}`;
    if (!byModelEnergy.has(key)) {
      byModelEnergy.set(key, []);
    }
    byModelEnergy.get(key)!.push(kw);
  }

  // Step 2: For each group, assign V3 (champion) vs V4 (variants) vs V5 (no volume)
  const champions: KeywordRecord[] = [];

  for (const [_groupKey, group] of byModelEnergy) {
    // Sort by volume DESC, then by keyword length (shorter preferred)
    group.sort((a, b) => {
      if (b.volume !== a.volume) return b.volume - a.volume;
      return a.keyword.length - b.keyword.length;
    });

    let championAssigned = false;
    let nbV4 = 0;

    // Count V4s first (all non-champion keywords with volume > 0)
    for (const kw of group) {
      if (kw.volume > 0) {
        nbV4++;
      }
    }
    nbV4--; // Subtract 1 for the champion

    for (const kw of group) {
      if (kw.volume === 0 || kw.volume === null) {
        // V5: Sans demande
        kw.v_level = 'V5';
        kw.score_seo = null;
      } else if (!championAssigned) {
        // V3: Champion local (TOP 1 by volume)
        kw.v_level = 'V3';
        kw.score_seo = calculateScoreSeo(kw.volume, Math.max(0, nbV4));
        championAssigned = true;
        champions.push(kw);
      } else {
        // V4: Variant secondaire
        kw.v_level = 'V4';
        kw.score_seo = null;
      }
    }
  }

  // Step 3: Promote TOP 20 V3 → V2 (champions stratégiques)
  // Sort champions by score_seo DESC
  champions.sort((a, b) => (b.score_seo || 0) - (a.score_seo || 0));

  // Promote top N to V2
  const top20 = champions.slice(0, top20Limit);
  for (const kw of top20) {
    kw.v_level = 'V2';
  }

  return keywords;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  V-Level v3.0 Keyword Import Script                        ║
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
║  V-Level v3.0 Import                                       ║
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
  const csvKeywords = parseGoogleAdsCSV(csvPath);
  console.log(`📊 CSV: ${csvKeywords.length} keywords parsed`);

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

  // Add existing keywords (for recalc mode)
  if (recalc) {
    for (const kw of existingKeywords || []) {
      // Find volume from CSV if available
      const csvMatch = csvKeywords.find(
        (c) => normalizeKeyword(c.keyword) === normalizeKeyword(kw.keyword)
      );

      allKeywords.push({
        id: kw.id,
        keyword: kw.keyword,
        keyword_normalized: normalizeKeyword(kw.keyword),
        gamme: gammeName,
        model: kw.model,
        variant: kw.variant,
        energy: kw.energy || detectEnergy(kw.keyword),
        v_level: kw.v_level,
        volume: csvMatch?.volume ?? kw.volume ?? 0,
        score_seo: null, // Will be recalculated
        type: kw.model ? 'vehicle' : 'generic',
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

  if (allKeywords.length === 0) {
    console.log('✅ Nothing to process');
    return;
  }

  // Assign V-Levels using v3.0 algorithm
  console.log(`\n⚙️  Running V-Level v3.0 algorithm...`);
  assignVLevels(allKeywords);

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
║  V-Level Distribution                                      ║
╠════════════════════════════════════════════════════════════╣
║  V2 (TOP 20 stratégiques):     ${String(stats.V2).padStart(4)}                        ║
║  V3 (Champions locaux):        ${String(stats.V3).padStart(4)}                        ║
║  V4 (Variants secondaires):    ${String(stats.V4).padStart(4)}                        ║
║  V5 (Sans demande):            ${String(stats.V5).padStart(4)}                        ║
║  V6 (Bloc B):                  ${String(stats.V6).padStart(4)}                        ║
║  NULL (type_id manquant):      ${String(stats.NULL).padStart(4)}                        ║
╚════════════════════════════════════════════════════════════╝
`);

  // Show TOP 10 V2 (champions stratégiques)
  const v2Keywords = allKeywords
    .filter((k) => k.v_level === 'V2')
    .sort((a, b) => (b.score_seo || 0) - (a.score_seo || 0));

  console.log(`📈 TOP 10 V2 (Champions Stratégiques):`);
  console.log(`${'Rang'.padEnd(5)} ${'Score'.padEnd(7)} ${'Vol'.padEnd(6)} ${'Modèle'.padEnd(12)} Keyword`);
  console.log(`${'─'.repeat(60)}`);
  v2Keywords.slice(0, 10).forEach((kw, i) => {
    const rank = (i + 1).toString().padEnd(5);
    const score = (kw.score_seo || 0).toString().padEnd(7);
    const vol = kw.volume.toString().padEnd(6);
    const model = (kw.model || '-').padEnd(12);
    console.log(`${rank} ${score} ${vol} ${model} ${kw.keyword}`);
  });

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

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✅ V-Level v3.0 Import Complete                           ║
╚════════════════════════════════════════════════════════════╝
`);
}

main().catch(console.error);
