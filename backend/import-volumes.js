/**
 * Import Google Ads Keyword Planner CSV volumes into __seo_keywords
 * Node.js script (no TypeScript)
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/opt/automecanik/app/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse the CSV
function parseGoogleAdsCSV(csvPath) {
  const buffer = fs.readFileSync(csvPath);

  let content;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    content = buffer.slice(2).toString('utf16le');
  } else {
    content = buffer.toString('utf16le');
  }

  const lines = content.split('\n').filter(line => line.trim());
  const results = [];

  for (let i = 3; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 3) continue;

    const keyword = cols[0]?.trim();
    const volumeStr = cols[2]?.replace(/\s/g, '').replace(/,/g, '');
    const volume = parseInt(volumeStr || '0', 10);

    if (keyword) {
      results.push({ keyword, volume });
    }
  }

  return results;
}

// Normalize keyword
function normalize(keyword) {
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
 * Fetch all keywords with pagination (bypass 1000 limit)
 */
async function fetchAllKeywords(pgId) {
  const PAGE_SIZE = 1000;
  let allKeywords = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('__seo_keywords')
      .select('id, keyword, keyword_normalized, volume')
      .eq('pg_id', pgId)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Error fetching keywords: ${error.message}`);
    }

    if (data && data.length > 0) {
      allKeywords = allKeywords.concat(data);
      offset += PAGE_SIZE;
      console.log(`  Fetched ${allKeywords.length} keywords...`);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allKeywords;
}

async function main() {
  const csvPath = process.argv[2];
  const pgId = parseInt(process.argv[3], 10);
  const dryRun = process.argv.includes('--dry-run');

  if (!csvPath || !pgId) {
    console.log('Usage: node import-volumes.js <csv_path> <pg_id> [--dry-run]');
    process.exit(1);
  }

  console.log(`\n=== Import Keyword Volumes ===`);
  console.log(`CSV: ${csvPath}`);
  console.log(`pg_id: ${pgId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Parse CSV
  const csvKeywords = parseGoogleAdsCSV(csvPath);
  console.log(`Found ${csvKeywords.length} keywords in CSV\n`);

  // Fetch DB keywords with pagination
  console.log(`Fetching keywords from DB (with pagination)...`);
  let dbKeywords;
  try {
    dbKeywords = await fetchAllKeywords(pgId);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`\nTotal: ${dbKeywords.length} keywords in DB for pg_id=${pgId}\n`);

  // Create lookup maps
  const dbMap = new Map();
  for (const kw of dbKeywords) {
    if (kw.keyword_normalized) {
      dbMap.set(kw.keyword_normalized, kw);
    }
    dbMap.set(normalize(kw.keyword), kw);
  }

  let updated = 0, notFound = 0, skipped = 0;
  const notFoundList = [];

  for (const { keyword, volume } of csvKeywords) {
    const normalized = normalize(keyword);
    const match = dbMap.get(normalized);

    if (!match) {
      notFound++;
      if (notFoundList.length < 20) {
        notFoundList.push({ keyword, volume });
      }
      continue;
    }

    if (match.volume === volume) {
      skipped++;
      continue;
    }

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('__seo_keywords')
        .update({ volume })
        .eq('id', match.id);

      if (updateError) {
        console.error(`Error updating "${keyword}":`, updateError.message);
        continue;
      }
    }

    updated++;
    if (updated <= 30) {
      console.log(`  Updated: "${keyword}" → ${volume}/m`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total in CSV:  ${csvKeywords.length}`);
  console.log(`Updated:       ${updated}`);
  console.log(`Skipped:       ${skipped}`);
  console.log(`Not found:     ${notFound}`);

  if (notFoundList.length > 0) {
    console.log(`\nNot found examples (first 20):`);
    for (const { keyword, volume } of notFoundList) {
      console.log(`  - "${keyword}" (vol: ${volume})`);
    }
  }
}

main().catch(console.error);
