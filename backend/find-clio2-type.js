const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function find() {
  // Trouver le bon type_id pour Clio II 1.2 essence
  console.log('=== Recherche type_id correct pour Clio II 1.2 essence ===\n');

  // D'abord trouver modele_id de Clio II
  const { data: modeles } = await supabase
    .from('auto_modele')
    .select('modele_id, modele_name')
    .ilike('modele_name', '%clio%')
    .order('modele_id');

  console.log('Modèles Clio trouvés:');
  for (const m of modeles || []) {
    console.log(`  ${m.modele_id}: ${m.modele_name}`);
  }

  // Trouver le modele_id de Clio II
  const clioII = modeles?.find(m => m.modele_name.toLowerCase().includes('clio ii') && !m.modele_name.toLowerCase().includes('break'));

  if (clioII) {
    console.log(`\nClio II modele_id: ${clioII.modele_id}`);

    // Chercher les motorisations 1.2 essence pour Clio II
    const { data: types } = await supabase
      .from('auto_type')
      .select('type_id, type_name, type_engine, type_cv')
      .eq('type_modele_id', clioII.modele_id)
      .ilike('type_engine', '%essence%')
      .ilike('type_name', '%1.2%')
      .order('type_id');

    console.log(`\nMotorisations 1.2 essence pour Clio II:`);
    for (const t of types || []) {
      console.log(`  type_id ${t.type_id}: ${t.type_name} (${t.type_engine}, ${t.type_cv}cv)`);
    }
  }
}

find().catch(console.error);
