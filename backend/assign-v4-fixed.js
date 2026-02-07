const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function assignV4(pgId) {
  const BATCH_SIZE = 500;
  let totalAssigned = 0;

  console.log(`Assigning V4 for pg_id=${pgId}...\n`);

  // First, get all V2 and V3 type_ids to exclude (avoid trigger conflict)
  console.log('Fetching V2 and V3 type_ids to exclude...');
  const { data: v2v3Data } = await supabase
    .from('__seo_keywords')
    .select('type_id')
    .eq('pg_id', pgId)
    .in('v_level', ['V2', 'V3'])
    .not('type_id', 'is', null);

  const excludeTypeIds = new Set((v2v3Data || []).map(r => r.type_id));
  console.log(`Found ${excludeTypeIds.size} V2/V3 type_ids to exclude\n`);

  // Fetch ALL NULL keywords with type_id using pagination
  console.log('Fetching all NULL keywords with type_id...');
  let allKeywords = [];
  let offset = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('__seo_keywords')
      .select('id, type_id')
      .eq('pg_id', pgId)
      .is('v_level', null)
      .not('type_id', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Fetch error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      allKeywords = allKeywords.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
      console.log(`  Fetched ${allKeywords.length} keywords...`);
    } else {
      hasMore = false;
    }
  }

  console.log(`\nTotal NULL keywords with type_id: ${allKeywords.length}`);

  // Filter to only those not in V2/V3
  const eligibleKeywords = allKeywords.filter(r => !excludeTypeIds.has(r.type_id));
  console.log(`Eligible for V4 (not in V2/V3): ${eligibleKeywords.length}`);
  console.log(`Blocked by V2/V3 type_ids: ${allKeywords.length - eligibleKeywords.length}\n`);

  if (eligibleKeywords.length === 0) {
    console.log('No keywords to assign to V4.');
    return;
  }

  // Now update in batches
  console.log('Assigning V4...');
  for (let i = 0; i < eligibleKeywords.length; i += BATCH_SIZE) {
    const batch = eligibleKeywords.slice(i, i + BATCH_SIZE);
    const ids = batch.map(r => r.id);

    const { error: updateError } = await supabase
      .from('__seo_keywords')
      .update({ v_level: 'V4' })
      .in('id', ids);

    if (updateError) {
      console.error('Update error:', updateError.message);
      console.error('Sample IDs:', ids.slice(0, 5));
      return;
    }

    totalAssigned += ids.length;
    process.stdout.write(`  V4 assigned: ${totalAssigned}/${eligibleKeywords.length}\r`);
  }

  console.log(`\n\nTotal V4 assigned: ${totalAssigned}`);
}

const pgId = parseInt(process.argv[2], 10) || 7;
assignV4(pgId).catch(console.error);
