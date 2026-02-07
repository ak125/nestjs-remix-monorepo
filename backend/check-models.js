const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const pgId = 7;

  // Get all V2 keywords
  const { data: v2Data } = await supabase
    .from('__seo_keywords')
    .select('model, energy')
    .eq('pg_id', pgId)
    .eq('v_level', 'V2');

  // Unique models
  const models = new Set((v2Data || []).map(r => r.model));
  const energies = { diesel: 0, essence: 0, null: 0, other: 0 };

  for (const r of v2Data || []) {
    if (r.energy === 'diesel') energies.diesel++;
    else if (r.energy === 'essence') energies.essence++;
    else if (!r.energy) energies.null++;
    else energies.other++;
  }

  console.log(`=== V2 Distribution ===`);
  console.log(`Total V2: ${v2Data?.length}`);
  console.log(`Unique models: ${models.size}`);
  console.log(`\nBy energy:`);
  console.log(`  diesel: ${energies.diesel}`);
  console.log(`  essence: ${energies.essence}`);
  console.log(`  null: ${energies.null}`);
  console.log(`  other: ${energies.other}`);

  // Sample of models
  console.log(`\nSample models (first 20):`);
  const modelList = Array.from(models).sort().slice(0, 20);
  for (const m of modelList) {
    console.log(`  - ${m}`);
  }
}

check().catch(console.error);
