const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Vérifier type_id 9040
  const { data: type9040 } = await supabase
    .from('auto_type')
    .select('*')
    .eq('type_id', 9040);

  console.log('type_id 9040:');
  console.log(JSON.stringify(type9040, null, 2));

  // Chercher toutes les motorisations Clio II avec type_modele_id = 140003
  console.log('\n=== Motorisations avec type_modele_id proche de 140003 ===');
  const { data: nearby } = await supabase
    .from('auto_type')
    .select('type_id, type_name, type_engine, type_modele_id')
    .gte('type_id', 9000)
    .lte('type_id', 9100)
    .order('type_id')
    .limit(20);

  for (const t of nearby || []) {
    console.log(`${t.type_id}: ${t.type_name} | ${t.type_engine} | modele_id=${t.type_modele_id}`);
  }
}

check().catch(console.error);
