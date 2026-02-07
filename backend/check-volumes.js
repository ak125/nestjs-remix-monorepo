const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const pgId = 7;

  // Get volume distribution
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from('__seo_keywords')
      .select('v_level, volume, type_id')
      .eq('pg_id', pgId)
      .range(offset, offset + 999);

    if (data && data.length > 0) {
      allData = allData.concat(data);
      offset += 1000;
      hasMore = data.length === 1000;
    } else {
      hasMore = false;
    }
  }

  // Volume distribution
  const volumeGroups = {};
  for (const r of allData) {
    const vol = r.volume || 0;
    if (!volumeGroups[vol]) volumeGroups[vol] = { total: 0, withTypeId: 0, v2: 0, v3: 0, v4: 0, null: 0 };
    volumeGroups[vol].total++;
    if (r.type_id) volumeGroups[vol].withTypeId++;
    if (r.v_level === 'V2') volumeGroups[vol].v2++;
    else if (r.v_level === 'V3') volumeGroups[vol].v3++;
    else if (r.v_level === 'V4') volumeGroups[vol].v4++;
    else volumeGroups[vol].null++;
  }

  console.log('=== Volume Distribution ===\n');
  console.log('Volume | Total | type_id | V2  | V3  | V4   | NULL');
  console.log('-------|-------|---------|-----|-----|------|-----');

  const sortedVolumes = Object.keys(volumeGroups).map(Number).sort((a, b) => b - a);
  for (const vol of sortedVolumes) {
    const g = volumeGroups[vol];
    console.log(`${String(vol).padEnd(6)} | ${String(g.total).padEnd(5)} | ${String(g.withTypeId).padEnd(7)} | ${String(g.v2).padEnd(3)} | ${String(g.v3).padEnd(3)} | ${String(g.v4).padEnd(4)} | ${g.null}`);
  }

  // Summary
  console.log('\n=== Problème potentiel ===');
  const vol50 = volumeGroups[50] || { total: 0, withTypeId: 0, v2: 0, v3: 0, v4: 0, null: 0 };
  console.log(`Volume 50: ${vol50.total} total, ${vol50.withTypeId} avec type_id`);
  console.log(`  V2: ${vol50.v2}, V3: ${vol50.v3}, V4: ${vol50.v4}, NULL: ${vol50.null}`);

  if (vol50.withTypeId > vol50.v2 + vol50.v3 + vol50.v4) {
    console.log(`  ⚠️ ${vol50.withTypeId - vol50.v2 - vol50.v3 - vol50.v4} keywords avec type_id mais NULL v_level!`);
  }
}

check().catch(console.error);
