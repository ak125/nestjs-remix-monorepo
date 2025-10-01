/**
 * Script de test pour déboguer les véhicules compatibles
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function testVehicles() {
  console.log('🧪 Test 1: Récupération des TYPE_ID depuis __cross_gamme_car_new');
  
  const pg_id = 4; // alternateur
  
  const { data: crossData, error: crossError } = await supabase
    .from('__cross_gamme_car_new')
    .select('cgc_type_id')
    .eq('cgc_pg_id', pg_id)
    .eq('cgc_level', 2)
    .limit(5);

  if (crossError) {
    console.error('❌ Erreur:', crossError);
    return;
  }

  console.log('✅ Résultat:', crossData);
  console.log(`📊 Nombre de résultats: ${crossData?.length || 0}`);

  if (crossData && crossData.length > 0) {
    const typeIds = crossData.map(item => item.cgc_type_id);
    console.log('📋 TYPE_IDs:', typeIds);

    console.log('\n🧪 Test 2: Récupération des types');
    const { data: typesData, error: typesError } = await supabase
      .from('auto_type')
      .select('*')
      .in('type_id', typeIds)
      .eq('type_display', 1)
      .limit(5);

    if (typesError) {
      console.error('❌ Erreur types:', typesError);
      return;
    }

    console.log('✅ Types récupérés:', typesData?.length || 0);
    if (typesData && typesData.length > 0) {
      console.log('📄 Premier type:', {
        type_id: typesData[0].type_id,
        type_name: typesData[0].type_name,
        type_modele_id: typesData[0].type_modele_id
      });
    }
  }
}

testVehicles().catch(console.error);
