require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugTypes() {
  console.log('🔍 Analyse des types de colonnes...\n');
  
  // Vérifier le type exact de modele_marque_id
  const { data: modele } = await supabase
    .from('auto_modele')
    .select('modele_id, modele_marque_id')
    .eq('modele_marque_id', 33)
    .limit(1)
    .single();
  
  console.log('📊 auto_modele.modele_marque_id:');
  console.log('   Value:', modele?.modele_marque_id);
  console.log('   Type:', typeof modele?.modele_marque_id);
  
  // Vérifier type_modele_id
  const { data: type } = await supabase
    .from('auto_type')
    .select('type_id, type_modele_id')
    .limit(1)
    .single();
  
  console.log('\n📊 auto_type.type_modele_id:');
  console.log('   Value:', type?.type_modele_id);
  console.log('   Type:', typeof type?.type_modele_id);
  
  // Vérifier marque_id
  const { data: marque } = await supabase
    .from('auto_marque')
    .select('marque_id, marque_name')
    .eq('marque_id', 33)
    .single();
  
  console.log('\n📊 auto_marque.marque_id:');
  console.log('   Value:', marque?.marque_id);
  console.log('   Type:', typeof marque?.marque_id);
  
  // Test jointure manuelle
  console.log('\n🧪 Test jointure manuelle...');
  const { data: testJoin, error } = await supabase
    .from('auto_type')
    .select(`
      type_id,
      type_name,
      type_modele_id,
      auto_modele!inner(modele_id, modele_name, modele_marque_id)
    `)
    .eq('auto_modele.modele_marque_id', 33)
    .limit(3);
  
  if (error) {
    console.log('   ❌ Erreur:', error.message);
  } else {
    console.log('   ✅ Success! Résultats:', testJoin?.length);
    console.table(testJoin);
  }
}

debugTypes();
