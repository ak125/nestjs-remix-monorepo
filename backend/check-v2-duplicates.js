const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const pgId = 7;

  // 1. Get all V2 keywords
  console.log('Fetching all V2 keywords...');
  const { data: v2Data } = await supabase
    .from('__seo_keywords')
    .select('id, keyword, model, energy, volume, type_id')
    .eq('pg_id', pgId)
    .eq('v_level', 'V2');

  console.log(`Total V2: ${v2Data?.length}\n`);

  // 2. Group by model+energy
  const groups = {};
  for (const row of v2Data || []) {
    const key = `${row.model}|${row.energy}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  // 3. Find duplicates (more than 1 V2 per model+energy)
  console.log('=== DUPLICATES (multiple V2 per model+energy) ===\n');
  let duplicateCount = 0;
  for (const [key, rows] of Object.entries(groups)) {
    if (rows.length > 1) {
      duplicateCount++;
      console.log(`${key}: ${rows.length} V2`);
      for (const r of rows.slice(0, 3)) {
        console.log(`  - "${r.keyword}" (vol: ${r.volume}, type_id: ${r.type_id})`);
      }
      if (rows.length > 3) console.log(`  ... +${rows.length - 3} more`);
      console.log();
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Unique model+energy combinations with V2: ${Object.keys(groups).length}`);
  console.log(`Combinations with DUPLICATE V2: ${duplicateCount}`);
  console.log(`Expected V2 count: ${Object.keys(groups).length}`);
  console.log(`Actual V2 count: ${v2Data?.length}`);
  console.log(`Excess V2: ${(v2Data?.length || 0) - Object.keys(groups).length}`);
}

check().catch(console.error);
