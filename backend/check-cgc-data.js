require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  console.log('🔍 Vérification données __cross_gamme_car_new pour BMW...\n');
  
  // Compter les entrées avec cgc_level='2' (véhicules)
  const { count: countVehicles, error: err1 } = await supabase
    .from('__cross_gamme_car_new')
    .select('*', { count: 'exact', head: true })
    .eq('cgc_level', '2');
  
  console.log(`Total véhicules (cgc_level='2'): ${countVehicles || 0}`);
  
  // Compter les entrées avec cgc_level='1' (pièces)
  const { count: countParts, error: err2 } = await supabase
    .from('__cross_gamme_car_new')
    .select('*', { count: 'exact', head: true })
    .eq('cgc_level', '1');
  
  console.log(`Total pièces (cgc_level='1'): ${countParts || 0}`);
  
  // Échantillon de données
  const { data: sample } = await supabase
    .from('__cross_gamme_car_new')
    .select('cgc_id, cgc_level, cgc_type_id, cgc_pg_id, cgc_modele_id')
    .limit(5);
  
  console.log('\n📦 Échantillon de 5 entrées:');
  console.table(sample);
}

check();
