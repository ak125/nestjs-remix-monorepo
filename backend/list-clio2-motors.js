const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function list() {
  console.log('=== Toutes les motorisations Clio II (140003) ===\n');

  const { data: types } = await supabase
    .from('auto_type')
    .select('type_id, type_name, type_engine, type_cv')
    .eq('type_modele_id', 140003)
    .order('type_engine')
    .order('type_name');

  console.log(`Total: ${types?.length || 0} motorisations\n`);

  let currentEngine = '';
  for (const t of types || []) {
    if (t.type_engine !== currentEngine) {
      currentEngine = t.type_engine;
      console.log(`\n${currentEngine}:`);
    }
    console.log(`  ${t.type_id}: ${t.type_name} (${t.type_cv}cv)`);
  }
}

list().catch(console.error);
