const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  // Chercher les keywords mentionnés
  const keywords = [
    'filtre a huile clio 2 1.2 essence',
    'filtre à huile clio 1 1.2 essence',
    'filtre à huile clio 2 1.2 essence',
    'filtre a huile clio 1 1.2 essence'
  ];

  console.log('=== Vérification des type_id pour Clio 1 vs Clio 2 ===\n');

  for (const kw of keywords) {
    const { data } = await supabase
      .from('__seo_keywords')
      .select('id, keyword, model, energy, type_id, v_level, volume')
      .eq('pg_id', 7)
      .ilike('keyword', `%${kw}%`)
      .limit(5);

    if (data && data.length > 0) {
      for (const row of data) {
        console.log(`"${row.keyword}"`);
        console.log(`  model: ${row.model}, energy: ${row.energy}`);
        console.log(`  type_id: ${row.type_id}, v_level: ${row.v_level}, volume: ${row.volume}`);
        console.log();
      }
    }
  }

  // Vérifier si type_id 2128 correspond vraiment à Clio 1 et Clio 2
  console.log('\n=== Vérification type_id 2128 dans auto_type ===\n');

  const { data: typeData } = await supabase
    .from('auto_type')
    .select('type_id, type_name, type_engine, type_modele_id')
    .eq('type_id', 2128);

  if (typeData && typeData.length > 0) {
    console.log('type_id 2128:');
    for (const t of typeData) {
      console.log(`  name: ${t.type_name}`);
      console.log(`  engine: ${t.type_engine}`);
      console.log(`  modele_id: ${t.type_modele_id}`);
    }

    // Récupérer le nom du modèle
    const { data: modeleData } = await supabase
      .from('auto_modele')
      .select('modele_id, modele_name')
      .eq('modele_id', typeData[0].type_modele_id);

    if (modeleData && modeleData.length > 0) {
      console.log(`  → Modèle: ${modeleData[0].modele_name} (id: ${modeleData[0].modele_id})`);
    }
  }

  // Chercher tous les keywords avec type_id 2128
  console.log('\n=== Keywords avec type_id 2128 ===\n');
  const { data: kw2128 } = await supabase
    .from('__seo_keywords')
    .select('keyword, model, v_level, volume')
    .eq('pg_id', 7)
    .eq('type_id', 2128)
    .order('volume', { ascending: false });

  for (const row of kw2128 || []) {
    console.log(`${row.v_level || 'NULL'} | vol=${row.volume} | model=${row.model} | "${row.keyword}"`);
  }
}

verify().catch(console.error);
