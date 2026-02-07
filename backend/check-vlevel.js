const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Fetch with pagination
  const PAGE_SIZE = 1000;
  let allData = [];
  let offset = 0;
  let hasMore = true;

  console.log('Fetching keywords for pg_id=7...');
  while (hasMore) {
    const { data, error } = await supabase
      .from('__seo_keywords')
      .select('v_level, type_id')
      .eq('pg_id', 7)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  console.log(`Total keywords: ${allData.length}\n`);

  const distribution = {};
  for (const row of allData) {
    const level = row.v_level || 'NULL';
    if (distribution[level] === undefined) {
      distribution[level] = { total: 0, with_type_id: 0 };
    }
    distribution[level].total++;
    if (row.type_id) {
      distribution[level].with_type_id++;
    }
  }

  console.log('V-Level Distribution for pg_id=7:');
  console.log('V-Level | Total | With type_id');
  console.log('--------|-------|-------------');
  for (const [level, d] of Object.entries(distribution).sort()) {
    console.log(`${level.padEnd(7)} | ${String(d.total).padEnd(5)} | ${d.with_type_id}`);
  }
}

check().catch(console.error);
