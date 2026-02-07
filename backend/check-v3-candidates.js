const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const pgId = 7;

  // V3 = type_id NOT NULL + volume > 0 + NOT V2
  // Get current V3
  const { data: v3Data } = await supabase
    .from('__seo_keywords')
    .select('id, keyword, volume')
    .eq('pg_id', pgId)
    .eq('v_level', 'V3')
    .order('volume', { ascending: false });

  console.log(`Current V3 count: ${v3Data?.length}`);
  console.log(`V3 samples (top by volume):`);
  for (const r of (v3Data || []).slice(0, 10)) {
    console.log(`  vol=${r.volume}: "${r.keyword}"`);
  }

  // Check V4 with volume > 0 (should be V3!)
  console.log(`\n=== Checking V4 with volume > 0 (potential V3 errors) ===`);

  let v4WithVolume = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data } = await supabase
      .from('__seo_keywords')
      .select('id, keyword, volume, type_id')
      .eq('pg_id', pgId)
      .eq('v_level', 'V4')
      .gt('volume', 0)
      .range(offset, offset + 999);

    if (data && data.length > 0) {
      v4WithVolume = v4WithVolume.concat(data);
      offset += 1000;
      hasMore = data.length === 1000;
    } else {
      hasMore = false;
    }
  }

  console.log(`V4 with volume > 0: ${v4WithVolume.length}`);
  console.log(`These should be V3, not V4!`);

  if (v4WithVolume.length > 0) {
    console.log(`\nSamples:`);
    for (const r of v4WithVolume.slice(0, 10)) {
      console.log(`  vol=${r.volume}: "${r.keyword}" (type_id: ${r.type_id})`);
    }
  }
}

check().catch(console.error);
