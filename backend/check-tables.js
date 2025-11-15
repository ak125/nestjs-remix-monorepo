require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('🔍 Vérification des tables Supabase...\n');
  
  // 1. Vérifier __cross_gamme_car_new
  console.log('📊 Table: __cross_gamme_car_new');
  const { count: cgcTotal } = await supabase
    .from('__cross_gamme_car_new')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total entrées: ${cgcTotal || 0}`);
  
  if (cgcTotal > 0) {
    const { count: level1 } = await supabase
      .from('__cross_gamme_car_new')
      .select('*', { count: 'exact', head: true })
      .eq('cgc_level', '1');
    console.log(`   - cgc_level='1' (pièces): ${level1 || 0}`);
    
    const { count: level2 } = await supabase
      .from('__cross_gamme_car_new')
      .select('*', { count: 'exact', head: true })
      .eq('cgc_level', '2');
    console.log(`   - cgc_level='2' (véhicules): ${level2 || 0}`);
    
    // Échantillon
    const { data: sample } = await supabase
      .from('__cross_gamme_car_new')
      .select('cgc_id, cgc_level, cgc_type_id, cgc_pg_id')
      .limit(3);
    console.log('   Échantillon:');
    console.table(sample);
  }
  
  // 2. Vérifier auto_type
  console.log('\n📊 Table: auto_type');
  const { count: typesTotal } = await supabase
    .from('auto_type')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total types: ${typesTotal || 0}`);
  
  if (typesTotal > 0) {
    const { data: bmwTypes } = await supabase
      .from('auto_type')
      .select('type_id, type_name, type_modele_id')
      .eq('type_display', 1)
      .limit(3);
    console.log('   Échantillon (type_display=1):');
    console.table(bmwTypes);
  }
  
  // 3. Vérifier auto_modele pour BMW
  console.log('\n📊 Table: auto_modele (BMW marque_id=33)');
  const { data: bmwModels } = await supabase
    .from('auto_modele')
    .select('modele_id, modele_name, modele_alias, modele_marque_id')
    .eq('modele_marque_id', 33)
    .eq('modele_display', 1)
    .limit(5);
  console.log(`   Modèles BMW visibles: ${bmwModels?.length || 0}`);
  if (bmwModels?.length > 0) {
    console.table(bmwModels);
  }
  
  // 4. Vérifier pieces_gamme
  console.log('\n📊 Table: pieces_gamme');
  const { count: partsTotal } = await supabase
    .from('pieces_gamme')
    .select('*', { count: 'exact', head: true })
    .eq('pg_activ', '1');
  console.log(`   Total pièces actives: ${partsTotal || 0}`);
  
  if (partsTotal > 0) {
    const { data: topParts } = await supabase
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_alias, pg_top')
      .eq('pg_activ', '1')
      .order('pg_top', { ascending: false })
      .limit(3);
    console.log('   Top 3 pièces:');
    console.table(topParts);
  }
  
  // 5. Test fonction RPC
  console.log('\n🔧 Test fonction RPC get_brand_bestsellers_optimized(33, 3, 3)...');
  try {
    const { data: result, error } = await supabase.rpc(
      'get_brand_bestsellers_optimized',
      { p_marque_id: 33, p_limit_vehicles: 3, p_limit_parts: 3 }
    );
    
    if (error) {
      console.error('   ❌ Erreur RPC:', error.message);
    } else {
      console.log(`   ✅ Véhicules retournés: ${result?.vehicles?.length || 0}`);
      console.log(`   ✅ Pièces retournées: ${result?.parts?.length || 0}`);
      if (result?.error) {
        console.warn(`   ⚠️  Erreur SQL: ${result.error}`);
      }
    }
  } catch (err) {
    console.error('   ❌ Exception:', err.message);
  }
}

checkTables();
