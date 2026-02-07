const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
  const pgId = 7;

  // 1. Get V2/V3 type_ids
  console.log('1. Fetching V2/V3 type_ids...');
  const { data: v2v3Data } = await supabase
    .from('__seo_keywords')
    .select('type_id, v_level')
    .eq('pg_id', pgId)
    .in('v_level', ['V2', 'V3'])
    .not('type_id', 'is', null);

  const v2v3TypeIds = new Set((v2v3Data || []).map(r => r.type_id));
  console.log(`   V2/V3 type_ids: ${v2v3TypeIds.size}`);

  // 2. Get sample of NULL keywords with type_id
  console.log('\n2. Fetching NULL keywords with type_id (sample)...');
  const { data: nullData } = await supabase
    .from('__seo_keywords')
    .select('id, type_id, keyword')
    .eq('pg_id', pgId)
    .is('v_level', null)
    .not('type_id', 'is', null)
    .limit(20);

  console.log(`   Sample NULL keywords with type_id: ${nullData?.length}`);

  let canAssign = 0;
  let blocked = 0;

  for (const row of nullData || []) {
    if (v2v3TypeIds.has(row.type_id)) {
      blocked++;
      console.log(`   ❌ Blocked: "${row.keyword}" (type_id ${row.type_id} is V2/V3)`);
    } else {
      canAssign++;
      console.log(`   ✅ Can assign V4: "${row.keyword}" (type_id ${row.type_id})`);
    }
  }

  console.log(`\n3. Summary from sample:`);
  console.log(`   Can assign V4: ${canAssign}`);
  console.log(`   Blocked: ${blocked}`);

  // 4. Full count of assignable
  console.log('\n4. Counting all assignable (using NOT IN)...');
  const v2v3Array = Array.from(v2v3TypeIds);

  if (v2v3Array.length > 0) {
    // Count total NULL with type_id
    let allNull = [];
    let offset = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data } = await supabase
        .from('__seo_keywords')
        .select('type_id')
        .eq('pg_id', pgId)
        .is('v_level', null)
        .not('type_id', 'is', null)
        .range(offset, offset + PAGE_SIZE - 1);

      if (data && data.length > 0) {
        allNull = allNull.concat(data);
        offset += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    const canAssignTotal = allNull.filter(r => !v2v3TypeIds.has(r.type_id)).length;
    const blockedTotal = allNull.filter(r => v2v3TypeIds.has(r.type_id)).length;

    console.log(`   Total NULL with type_id: ${allNull.length}`);
    console.log(`   Can assign V4: ${canAssignTotal}`);
    console.log(`   Blocked by V2/V3: ${blockedTotal}`);
  }
}

debug().catch(console.error);
