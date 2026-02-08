/**
 * Import Google Ads Keyword Planner JSON into __seo_keywords with V-Level detection
 *
 * Usage:
 *   npx tsx scripts/import-keyword-json.ts --json <path> --pg-id <id> [--dry-run]
 *
 * Example:
 *   npx tsx scripts/import-keyword-json.ts --json data/keywords/output/run__filtre-huile__20260130.json --pg-id 7
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

// ============================================================================
// TYPES
// ============================================================================

interface KeywordJSON {
  schema_version: string;
  gamme: {
    label: string;
    geo_target: string;
    language: string;
    seed_query: string;
  };
  vehicles: {
    model_stats_sorted: Array<{
      vehicle_key: string;
      bucket_label_max: string;
      bucket_rank_max: number;
      unique_count: number;
      row_count: number;
    }>;
    groups: Array<VehicleGroup>;
  };
}

interface VehicleGroup {
  vehicle_key: string;
  bucket_label_max: string;
  bucket_rank_max: number;
  keywords_sorted: Array<KeywordEntry>;
  exploration?: {
    model_level?: {
      seeds: string[];
      variants_model_sorted: Array<KeywordEntry>;
      motorisation_candidates: Array<{
        variant_key: string;
        query: string;
        volume_range: string;
        bucket_rank: number;
      }>;
    };
    variant_level?: {
      variant_enrichment: Record<string, {
        seed: string;
        details_sorted: Array<KeywordEntry>;
        ambiguity?: {
          is_ambiguous: boolean;
          reason?: string;
          candidates?: string[];
          planB_used?: boolean;
          planB_queries?: Array<{ query: string; volume_range: string }>;
          planB_winner?: string;
        };
      }>;
    };
  };
}

interface KeywordEntry {
  query: string;
  volume_range: string;
  bucket_rank: number;
  appears_in_seeds?: number;
  source?: string;
  note?: string;
}

interface ImportResult {
  total: number;
  updated: number;
  inserted: number;
  skipped: number;
  errors: string[];
  vLevelDistribution: Record<string, number>;
}

interface SeoKeywordRecord {
  keyword: string;
  pg_id: number;
  gamme: string;
  model: string;
  variant: string;
  energy: string;
  v_level: string;
  volume: number | null;
  best_rank: number;
  type: string;
  appears_in_seeds?: number;
  source?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Bucket rank → estimated volume midpoint
const BUCKET_TO_VOLUME: Record<number, number | null> = {
  5: 15000,  // 10k+
  4: 3000,   // 1k-10k
  3: 400,    // 100-1k
  2: 40,     // 10-100
  1: 5,      // 0-10
  0: null,   // empty
};

// Energy detection patterns
const ENERGY_PATTERNS: Record<string, string[]> = {
  diesel: ['dci', 'hdi', 'tdi', 'bluehdi', 'crdi', 'jtd', 'd4d', 'cdti', 'ddis', 'dtec', 'tdci'],
  essence: ['tce', 'tsi', 'tfsi', 'vti', 'vvt', 'mpi', '16v', 'vtec', 'cvvt', 'gdi', 'fsi', 'mivec'],
  hybride: ['hybrid', 'hybride', 'e-tense', 'phev', 'hev'],
  electrique: ['ev', 'electric', 'electrique', 'e-'],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize keyword for matching
 */
function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .trim();
}

/**
 * Detect energy type from variant string
 */
function detectEnergy(text: string): string {
  const lower = text.toLowerCase();
  for (const [energy, patterns] of Object.entries(ENERGY_PATTERNS)) {
    if (patterns.some((p) => lower.includes(p))) {
      return energy;
    }
  }
  return 'unknown';
}

/**
 * Check if query has full specification (motor + power/year)
 * Required for V2 candidate
 */
function hasFullSpecification(query: string): boolean {
  const hasPower = /\b(\d{2,3})\s*(ch|cv|hp)\b/i.test(query);
  const hasYear = /\b(19|20)\d{2}\b/.test(query);
  const hasMotor = /(dci|hdi|tdi|tce|tsi|tfsi|bluehdi|crdi|multijet|jtd|d4d|cdti|ddis|dtec|tdci|vti|vvt|mpi|gdi|fsi|mivec|cvvt)/i.test(query);
  const hasCylinder = /\b\d[.,]\d\b/.test(query);

  // Full spec = has motor/cylinder AND has power/year
  return (hasMotor || hasCylinder) && (hasPower || hasYear);
}

/**
 * Check if query has motorization (motor or cylinder) but no power/year
 */
function hasMotorizationOnly(query: string): boolean {
  const hasPower = /\b(\d{2,3})\s*(ch|cv|hp)\b/i.test(query);
  const hasYear = /\b(19|20)\d{2}\b/.test(query);
  const hasMotor = /(dci|hdi|tdi|tce|tsi|tfsi|bluehdi|crdi|multijet|jtd|d4d|cdti|ddis|dtec|tdci|vti|vvt|mpi|gdi|fsi|mivec|cvvt)/i.test(query);
  const hasCylinder = /\b\d[.,]\d\b/.test(query);

  return (hasMotor || hasCylinder) && !hasPower && !hasYear;
}

/**
 * Detect V-Level from keyword structure
 *
 * RÈGLES V-LEVEL (IMPORT GOOGLE):
 * - V1: Gamme seule
 * - V2: Variante CHAMPIONNE (plus haut volume)
 * - V3: Toutes les autres variantes
 * - V4: NON utilisé à l'import Google
 * - V5: KTYPNR spécifique (assignation manuelle)
 *
 * IMPORTANT: V2 est déterminé APRÈS collecte de tous les keywords
 * Cette fonction retourne un V-Level "candidat" qui sera ajusté ensuite
 */
function detectVLevelCandidate(
  query: string,
  gammeLabel: string,
  vehicleKey: string,
  variantKey?: string
): string {
  const queryLower = query.toLowerCase();

  // Full specification (motor + power/year) → V2 candidate ou V4
  // La distinction V2/V4 sera faite après analyse des volumes
  if (hasFullSpecification(query)) {
    return 'V2_CANDIDATE';  // Will be resolved to V2 or V4 later
  }

  // Motorization only (motor/cylinder without power/year) → V3
  if (hasMotorizationOnly(query)) {
    return 'V3';
  }

  // Model only (vehicle key without motor/power) → V3
  if (vehicleKey && queryLower.includes(vehicleKey.toLowerCase())) {
    return 'V3';
  }

  // Gamme only → V1
  return 'V1';
}

/**
 * Extract variant from variant_key minus vehicle_key
 */
function extractVariant(variantKey: string, vehicleKey: string): string {
  const variantLower = variantKey.toLowerCase();
  const vehicleLower = vehicleKey.toLowerCase();

  if (variantLower.startsWith(vehicleLower)) {
    return variantKey.slice(vehicleKey.length).trim();
  }

  return variantKey;
}

/**
 * Create grouping key for V2 determination: model + energy
 */
function getV2GroupKey(model: string, energy: string): string {
  return `${model.toLowerCase()}|${energy}`;
}

// ============================================================================
// MAIN IMPORT LOGIC
// ============================================================================

/**
 * Resolve V2 candidates to actual V2 or V4 based on volume
 *
 * RÈGLE: Une seule V2 par [gamme + modèle + énergie]
 * La V2 est la variante avec le PLUS HAUT VOLUME parmi les V2_CANDIDATE
 */
function resolveV2Dominants(records: SeoKeywordRecord[]): {
  records: SeoKeywordRecord[];
  v2Dominants: Array<{ model: string; energy: string; keyword: string; volume: number | null }>;
} {
  // Group V2_CANDIDATEs by model + energy
  const v2CandidateGroups = new Map<string, SeoKeywordRecord[]>();

  for (const record of records) {
    if (record.v_level === 'V2_CANDIDATE') {
      const groupKey = getV2GroupKey(record.model, record.energy);
      if (!v2CandidateGroups.has(groupKey)) {
        v2CandidateGroups.set(groupKey, []);
      }
      v2CandidateGroups.get(groupKey)!.push(record);
    }
  }

  // For each group, find the dominant (highest volume)
  const v2Winners = new Set<string>();
  const v2Dominants: Array<{ model: string; energy: string; keyword: string; volume: number | null }> = [];

  for (const [groupKey, candidates] of v2CandidateGroups) {
    // Sort by volume DESC (null = 0)
    candidates.sort((a, b) => (b.volume || 0) - (a.volume || 0));

    // First one is the winner (V2)
    if (candidates.length > 0 && candidates[0].volume && candidates[0].volume > 0) {
      const winner = candidates[0];
      v2Winners.add(normalizeKeyword(winner.keyword));
      v2Dominants.push({
        model: winner.model,
        energy: winner.energy,
        keyword: winner.keyword,
        volume: winner.volume,
      });
    }
  }

  // Update records: V2_CANDIDATE → V2 if winner, else V4
  const resolvedRecords = records.map((record) => {
    if (record.v_level === 'V2_CANDIDATE') {
      const isWinner = v2Winners.has(normalizeKeyword(record.keyword));
      return {
        ...record,
        v_level: isWinner ? 'V2' : 'V3',
      };
    }
    return record;
  });

  return { records: resolvedRecords, v2Dominants };
}

/**
 * Extract all keywords from JSON structure
 */
function extractKeywordsFromJSON(
  json: KeywordJSON,
  pgId: number
): { records: SeoKeywordRecord[]; v2Dominants: Array<{ model: string; energy: string; keyword: string; volume: number | null }> } {
  const records: SeoKeywordRecord[] = [];
  const gammeLabel = json.gamme.label;
  const seen = new Set<string>();

  for (const group of json.vehicles.groups) {
    const vehicleKey = group.vehicle_key;

    // 1. Process keywords_sorted
    for (const kw of group.keywords_sorted) {
      const normalized = normalizeKeyword(kw.query);
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const vLevelCandidate = detectVLevelCandidate(kw.query, gammeLabel, vehicleKey);

      records.push({
        keyword: kw.query,
        pg_id: pgId,
        gamme: gammeLabel,
        model: vehicleKey,
        variant: '',
        energy: detectEnergy(kw.query),
        v_level: vLevelCandidate,
        volume: BUCKET_TO_VOLUME[kw.bucket_rank] ?? null,
        best_rank: kw.bucket_rank,
        type: 'vehicle',
        appears_in_seeds: kw.appears_in_seeds,
        source: kw.source,
      });
    }

    // 2. Process exploration.model_level.variants_model_sorted
    if (group.exploration?.model_level?.variants_model_sorted) {
      for (const kw of group.exploration.model_level.variants_model_sorted) {
        const normalized = normalizeKeyword(kw.query);
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const vLevelCandidate = detectVLevelCandidate(kw.query, gammeLabel, vehicleKey);

        records.push({
          keyword: kw.query,
          pg_id: pgId,
          gamme: gammeLabel,
          model: vehicleKey,
          variant: '',
          energy: detectEnergy(kw.query),
          v_level: vLevelCandidate,
          volume: BUCKET_TO_VOLUME[kw.bucket_rank] ?? null,
          best_rank: kw.bucket_rank,
          type: 'vehicle',
          appears_in_seeds: kw.appears_in_seeds,
        });
      }
    }

    // 3. Process exploration.model_level.motorisation_candidates
    if (group.exploration?.model_level?.motorisation_candidates) {
      for (const mc of group.exploration.model_level.motorisation_candidates) {
        const normalized = normalizeKeyword(mc.query);
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const variant = extractVariant(mc.variant_key, vehicleKey);
        const vLevelCandidate = detectVLevelCandidate(mc.query, gammeLabel, vehicleKey, mc.variant_key);

        records.push({
          keyword: mc.query,
          pg_id: pgId,
          gamme: gammeLabel,
          model: vehicleKey,
          variant: variant,
          energy: detectEnergy(mc.variant_key),
          v_level: vLevelCandidate,
          volume: BUCKET_TO_VOLUME[mc.bucket_rank] ?? null,
          best_rank: mc.bucket_rank,
          type: 'vehicle',
        });
      }
    }

    // 4. Process exploration.variant_level.variant_enrichment
    if (group.exploration?.variant_level?.variant_enrichment) {
      for (const [variantKey, enrichment] of Object.entries(
        group.exploration.variant_level.variant_enrichment
      )) {
        const variant = extractVariant(variantKey, vehicleKey);

        for (const detail of enrichment.details_sorted) {
          const normalized = normalizeKeyword(detail.query);
          if (seen.has(normalized)) continue;
          seen.add(normalized);

          // Details always have full specification → V2_CANDIDATE
          records.push({
            keyword: detail.query,
            pg_id: pgId,
            gamme: gammeLabel,
            model: vehicleKey,
            variant: variant,
            energy: detectEnergy(variantKey),
            v_level: 'V2_CANDIDATE',
            volume: BUCKET_TO_VOLUME[detail.bucket_rank] ?? null,
            best_rank: detail.bucket_rank,
            type: 'vehicle',
          });
        }
      }
    }
  }

  // Resolve V2_CANDIDATE → V2 (dominant) or V4 (non-dominant)
  return resolveV2Dominants(records);
}

/**
 * Import keywords into Supabase
 */
async function importKeywords(
  records: SeoKeywordRecord[],
  pgId: number,
  dryRun: boolean
): Promise<ImportResult> {
  const result: ImportResult = {
    total: records.length,
    updated: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
    vLevelDistribution: { V1: 0, V2: 0, V3: 0 },
  };

  // Fetch existing keywords for this pg_id
  const { data: existingKeywords, error: fetchError } = await supabase
    .from('__seo_keywords')
    .select('id, keyword, volume, v_level, best_rank')
    .eq('pg_id', pgId);

  if (fetchError) {
    console.error('Failed to fetch existing keywords:', fetchError.message);
    result.errors.push(`Fetch error: ${fetchError.message}`);
    return result;
  }

  // Create lookup map
  const existingMap = new Map<string, { id: number; volume: number | null; v_level: string | null; best_rank: number | null }>();
  for (const kw of existingKeywords || []) {
    existingMap.set(normalizeKeyword(kw.keyword), {
      id: kw.id,
      volume: kw.volume,
      v_level: kw.v_level,
      best_rank: kw.best_rank,
    });
  }

  console.log(`📦 Found ${existingMap.size} existing keywords for pg_id=${pgId}`);

  // Process each record
  for (const record of records) {
    const normalized = normalizeKeyword(record.keyword);
    const existing = existingMap.get(normalized);

    // Track V-Level distribution
    result.vLevelDistribution[record.v_level] = (result.vLevelDistribution[record.v_level] || 0) + 1;

    if (existing) {
      // Check if update needed
      const needsUpdate =
        existing.volume !== record.volume ||
        existing.v_level !== record.v_level ||
        existing.best_rank !== record.best_rank;

      if (!needsUpdate) {
        result.skipped++;
        continue;
      }

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('__seo_keywords')
          .update({
            volume: record.volume,
            v_level: record.v_level,
            best_rank: record.best_rank,
            model: record.model,
            variant: record.variant,
            energy: record.energy,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          result.errors.push(`Update error for "${record.keyword}": ${updateError.message}`);
          continue;
        }
      }

      result.updated++;
      if (result.updated <= 10) {
        console.log(`  ✅ Updated: "${record.keyword}" → ${record.v_level}, vol=${record.volume}`);
      }
    } else {
      // Insert new record
      if (!dryRun) {
        const { error: insertError } = await supabase.from('__seo_keywords').insert({
          keyword: record.keyword,
          pg_id: record.pg_id,
          gamme: record.gamme,
          model: record.model,
          variant: record.variant,
          energy: record.energy,
          v_level: record.v_level,
          volume: record.volume,
          best_rank: record.best_rank,
          type: record.type,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          result.errors.push(`Insert error for "${record.keyword}": ${insertError.message}`);
          continue;
        }
      }

      result.inserted++;
      if (result.inserted <= 10) {
        console.log(`  ➕ Inserted: "${record.keyword}" → ${record.v_level}, vol=${record.volume}`);
      }
    }
  }

  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const jsonIndex = args.indexOf('--json');
  const pgIdIndex = args.indexOf('--pg-id');
  const dryRun = args.includes('--dry-run');

  if (jsonIndex === -1 || pgIdIndex === -1) {
    console.log(`
Usage: npx tsx scripts/import-keyword-json.ts --json <path> --pg-id <id> [--dry-run]

Options:
  --json <path>    Path to the JSON file (schema 1.0.0)
  --pg-id <id>     Product group ID (e.g., 7 for "filtre à huile")
  --dry-run        Preview changes without writing to database

Example:
  npx tsx scripts/import-keyword-json.ts --json data/keywords/output/run__filtre-huile__20260130.json --pg-id 7
  npx tsx scripts/import-keyword-json.ts --json data/keywords/output/run__filtre-huile__20260130.json --pg-id 7 --dry-run
`);
    process.exit(1);
  }

  const jsonPath = path.resolve(args[jsonIndex + 1]);
  const pgId = parseInt(args[pgIdIndex + 1], 10);

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}`);
    process.exit(1);
  }

  if (isNaN(pgId)) {
    console.error(`❌ Invalid pg_id: ${args[pgIdIndex + 1]}`);
    process.exit(1);
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Google Ads Keyword JSON → Supabase V-Level Import         ║
╚════════════════════════════════════════════════════════════╝

📄 JSON: ${jsonPath}
🎯 pg_id: ${pgId}
${dryRun ? '🔍 Mode: DRY RUN' : '💾 Mode: LIVE'}
`);

  // Load and parse JSON
  console.log('📂 Loading JSON...');
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const json: KeywordJSON = JSON.parse(jsonContent);

  console.log(`📊 Schema version: ${json.schema_version}`);
  console.log(`🏷️  Gamme: ${json.gamme.label}`);
  console.log(`🚗 Vehicle groups: ${json.vehicles.groups.length}`);

  // Extract keywords
  console.log('\n📥 Extracting keywords from JSON...');
  const { records, v2Dominants } = extractKeywordsFromJSON(json, pgId);
  console.log(`📊 Extracted ${records.length} unique keywords`);

  // Show V2 Dominants
  if (v2Dominants.length > 0) {
    console.log('\n🏆 V2 Dominants (highest volume per model+energy):');
    for (const v2 of v2Dominants.slice(0, 10)) {
      console.log(`   • ${v2.model} [${v2.energy}]: "${v2.keyword}" (vol=${v2.volume})`);
    }
    if (v2Dominants.length > 10) {
      console.log(`   ... and ${v2Dominants.length - 10} more`);
    }
  }

  // Import to Supabase
  console.log('\n📤 Importing to Supabase...\n');
  const result = await importKeywords(records, pgId, dryRun);

  // Print summary
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  IMPORT SUMMARY                                            ║
╚════════════════════════════════════════════════════════════╝

📊 Total keywords extracted:  ${result.total}
✅ Updated in Supabase:       ${result.updated}
➕ Inserted new:              ${result.inserted}
⏭️  Skipped (unchanged):      ${result.skipped}
❌ Errors:                    ${result.errors.length}

📈 V-Level Distribution:
   V1 (gamme seule):                    ${result.vLevelDistribution.V1 || 0}
   V2 (championne):                     ${result.vLevelDistribution.V2 || 0}
   V3 (autres variantes):               ${result.vLevelDistribution.V3 || 0}

🏆 V2 Dominants: ${v2Dominants.length} variantes dominantes identifiées
`);

  if (result.errors.length > 0) {
    console.log('\n⚠️ Errors:');
    result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }

  if (dryRun) {
    console.log('\n💡 This was a DRY RUN. No changes were made to the database.');
    console.log('   Remove --dry-run to apply changes.');
  }
}

main().catch(console.error);
