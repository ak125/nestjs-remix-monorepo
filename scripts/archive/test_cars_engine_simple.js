const { createClient } = require('@supabase/supabase-js');

const testCarsEngine = async () => {
  console.log('🔍 Test de la relation cars_engine...');
  
  // Configuration Supabase depuis le backend
  const supabaseUrl = 'https://obduqtnkxjsxirshfjuu.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iZHVxdG5reGpzeGlyc2hmanV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU5ODk0NDUsImV4cCI6MjA0MTU2NTQ0NX0.v3FbT7-tEY93VAr0HUeBTJb6JWFfaM9_Sc5L5IWlb5A';
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Test existence table cars_engine
    console.log('\n=== TEST 1: Existence table cars_engine ===');
    const { data: engines, error: engError } = await supabase
      .from('cars_engine')
      .select('*')
      .limit(3);
    
    if (engError) {
      console.log('❌ Table cars_engine non accessible:', engError.message);
      return false;
    } else {
      console.log('✅ Table cars_engine accessible:');
      console.log(JSON.stringify(engines, null, 2));
    }

    // 2. Test codes moteur dans auto_type
    console.log('\n=== TEST 2: Codes moteur auto_type ===');
    const { data: types, error: typeError } = await supabase
      .from('auto_type')
      .select('type_id, type_name, type_engine_code')
      .not('type_engine_code', 'is', null)
      .limit(5);
    
    if (typeError) {
      console.log('❌ Erreur auto_type:', typeError.message);
    } else {
      console.log('✅ Codes moteur trouvés dans auto_type:');
      console.log(JSON.stringify(types, null, 2));
    }

    // 3. Comparer pour trouver correspondances
    if (engines && types && engines.length > 0 && types.length > 0) {
      console.log('\n=== TEST 3: Recherche correspondances ===');
      
      const engineCodes = engines.map(e => e.eng_code).filter(Boolean);
      const typeCodes = types.map(t => t.type_engine_code).filter(Boolean);
      
      console.log('Codes engines:', engineCodes);
      console.log('Codes types:', typeCodes);
      
      const matches = engineCodes.filter(code => typeCodes.includes(code));
      console.log('Correspondances directes:', matches);
      
      return matches.length > 0;
    }

  } catch (error) {
    console.error('❌ Erreur test cars_engine:', error);
    return false;
  }
};

testCarsEngine().then(hasRelation => {
  console.log(`\n🎯 Résultat: Relation cars_engine ${hasRelation ? 'TROUVÉE' : 'NON TROUVÉE'}`);
  process.exit(0);
});