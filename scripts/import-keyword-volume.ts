/**
 * Import Google Ads Keyword Planner CSV volumes into __seo_keywords
 *
 * Usage:
 *   npx ts-node scripts/import-keyword-volume.ts <csv_path> <pg_id> [--dry-run]
 *
 * Example:
 *   npx ts-node scripts/import-keyword-volume.ts data/keywords/raw/raw__filtre-huile__FR__fr__20260123.csv 7
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

interface ImportResult {
  total: number;
  updated: number;
  notFound: number;
  skipped: number;
  errors: string[];
}

/**
 * Parse UTF-16 LE CSV from Google Ads Keyword Planner
 */
function parseGoogleAdsCSV(
  csvPath: string
): Array<{
  keyword: string;
  volume: number;
  competition: string;
  competitionIndex: number;
}> {
  // Read buffer
  const buffer = fs.readFileSync(csvPath);

  // Decode UTF-16 LE (skip BOM if present)
  let content: string;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    // Has BOM, skip it
    content = buffer.slice(2).toString('utf16le');
  } else {
    content = buffer.toString('utf16le');
  }

  // Split lines and parse
  const lines = content.split('\n').filter((line) => line.trim());
  const results: Array<{
    keyword: string;
    volume: number;
    competition: string;
    competitionIndex: number;
  }> = [];

  // Skip header lines (first 3 lines: title, date range, column headers)
  for (let i = 3; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 7) continue;

    const keyword = cols[0]?.trim();
    const volumeStr = cols[2]?.replace(/\s/g, '').replace(/,/g, '');
    const volume = parseInt(volumeStr || '0', 10);
    const competition = cols[5]?.trim() || '';
    const competitionIndex = parseInt(cols[6] || '0', 10);

    if (keyword && volume > 0) {
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
 * Import keyword volumes into __seo_keywords
 */
async function importKeywordVolumes(
  csvPath: string,
  pgId: number,
  dryRun = false
): Promise<ImportResult> {
  const result: ImportResult = {
    total: 0,
    updated: 0,
    notFound: 0,
    skipped: 0,
    errors: [],
  };

  console.log(`\n📂 Reading CSV: ${csvPath}`);
  const keywords = parseGoogleAdsCSV(csvPath);
  result.total = keywords.length;
  console.log(`📊 Found ${keywords.length} keywords with volume > 0`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes will be made\n');
  }

  // Fetch all keywords for this pg_id once
  const { data: dbKeywords, error: fetchError } = await supabase
    .from('__seo_keywords')
    .select('id, keyword, volume')
    .eq('pg_id', pgId);

  if (fetchError) {
    console.error('❌ Failed to fetch keywords from DB:', fetchError.message);
    return result;
  }

  console.log(`📦 Found ${dbKeywords?.length || 0} keywords in DB for pg_id=${pgId}\n`);

  // Create a map for faster lookup (normalized keyword -> db record)
  const dbKeywordMap = new Map<string, { id: number; keyword: string; volume: number | null }>();
  for (const kw of dbKeywords || []) {
    const normalized = normalizeKeyword(kw.keyword);
    dbKeywordMap.set(normalized, kw);
    // Also add original for exact match
    dbKeywordMap.set(kw.keyword.toLowerCase().trim(), kw);
  }

  for (const { keyword, volume } of keywords) {
    const normalized = normalizeKeyword(keyword);

    // Try exact match first, then normalized
    let match = dbKeywordMap.get(keyword.toLowerCase().trim());
    if (!match) {
      match = dbKeywordMap.get(normalized);
    }

    if (!match) {
      result.notFound++;
      if (result.notFound <= 15) {
        console.log(`  ❌ Not found: "${keyword}" (vol: ${volume})`);
      }
      continue;
    }

    // Skip if volume already set and same
    if (match.volume === volume) {
      result.skipped++;
      continue;
    }

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('__seo_keywords')
        .update({ volume })
        .eq('id', match.id);

      if (updateError) {
        result.errors.push(`Error updating "${keyword}": ${updateError.message}`);
        continue;
      }
    }

    result.updated++;
    console.log(`  ✅ Updated: "${keyword}" → ${volume}/m`);
  }

  return result;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage: npx ts-node scripts/import-keyword-volume.ts <csv_path> <pg_id> [--dry-run]

Examples:
  npx ts-node scripts/import-keyword-volume.ts data/keywords/raw/raw__filtre-huile__FR__fr__20260123.csv 7
  npx ts-node scripts/import-keyword-volume.ts data/keywords/raw/raw__filtre-huile__FR__fr__20260123.csv 7 --dry-run
`);
    process.exit(1);
  }

  const csvPath = path.resolve(args[0]);
  const pgId = parseInt(args[1], 10);
  const dryRun = args.includes('--dry-run');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  if (isNaN(pgId)) {
    console.error(`❌ Invalid pg_id: ${args[1]}`);
    process.exit(1);
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Google Ads Keyword Planner → Supabase Import              ║
╚════════════════════════════════════════════════════════════╝

📄 CSV: ${csvPath}
🎯 pg_id: ${pgId}
${dryRun ? '🔍 Mode: DRY RUN' : '💾 Mode: LIVE'}
`);

  const result = await importKeywordVolumes(csvPath, pgId, dryRun);

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  IMPORT SUMMARY                                            ║
╚════════════════════════════════════════════════════════════╝

📊 Total keywords in CSV:  ${result.total}
✅ Updated in Supabase:    ${result.updated}
⏭️  Skipped (unchanged):   ${result.skipped}
❌ Not found in DB:        ${result.notFound}
⚠️  Errors:                ${result.errors.length}
`);

  if (result.errors.length > 0) {
    console.log('\n⚠️ Errors:');
    result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }

  if (result.notFound > 10) {
    console.log(
      `\n💡 ${result.notFound} keywords not found. These keywords exist in Google Ads but not in __seo_keywords.`
    );
  }
}

main().catch(console.error);
