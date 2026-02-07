const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('=== Structure Clio dans auto_type ===\n');

  // Compter les motorisations par modèle Clio
  const clioModeles = [140002, 140003, 140004, 140005, 140006, 140007, 140173, 140174];
  const names = {
    140002: 'CLIO I',
    140003: 'CLIO II',
    140004: 'CLIO III',
    140005: 'CLIO III Break',
    140006: 'CLIO IV',
    140007: 'CLIO IV Break',
    140173: 'CLIO IV Break (KH)',
    140174: 'CLIO V'
  };

  for (const modeleId of clioModeles) {
    const { count } = await supabase
      .from('auto_type')
      .select('type_id', { count: 'exact', head: true })
      .eq('type_modele_id', modeleId);

    console.log(`${names[modeleId]} (${modeleId}): ${count || 0} motorisations`);
  }

  // Chercher "clio" dans les noms de type
  console.log('\n=== Recherche "clio" dans type_name ===\n');
  const { data: clioTypes } = await supabase
    .from('auto_type')
    .select('type_id, type_name, type_modele_id')
    .ilike('type_name', '%clio%')
    .limit(10);

  for (const t of clioTypes || []) {
    console.log(`  ${t.type_id}: ${t.type_name} (modele_id: ${t.type_modele_id})`);
  }

  // Vérifier la structure de auto_type
  console.log('\n=== Vérifier si modele_id 140003 existe ===\n');
  const { data: sample } = await supabase
    .from('auto_type')
    .select('type_id, type_name, type_modele_id')
    .gte('type_modele_id', 140000)
    .lte('type_modele_id', 140010)
    .limit(20);

  for (const t of sample || []) {
    console.log(`  ${t.type_modele_id} | ${t.type_id}: ${t.type_name}`);
  }
}

check().catch(console.error);
