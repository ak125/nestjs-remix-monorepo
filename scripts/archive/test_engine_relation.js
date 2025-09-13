// 🔍 TEST RELATION cars_engine avec auto_type
// Objectif : Comprendre comment lier eng_code avec type_engine_code

const testEngineRelation = async () => {
  const supabaseUrl = 'https://obduqtnkxjsxirshfjuu.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iZHVxdG5reGpzeGlyc2hmanV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU5ODk0NDUsImV4cCI6MjA0MTU2NTQ0NX0.v3FbT7-tEY93VAr0HUeBTJb6JWFfaM9_Sc5L5IWlb5A';
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🔍 Test relation cars_engine avec auto_type...');
    
    // 1. Échantillon cars_engine
    console.log('\n=== ÉCHANTILLON cars_engine ===');
    const { data: engines, error: engError } = await supabase
      .from('cars_engine')
      .select('*')
      .limit(5);
    
    if (engError) {
      console.log('❌ Erreur cars_engine:', engError.message);
      return;
    }
    
    console.log('✅ Données cars_engine:');
    engines.forEach(e => console.log(`ID: ${e.eng_id}, MFA: ${e.eng_mfa_id}, Code: ${e.eng_code}`));
    
    // 2. Tester auto_type avec engine codes non-null
    console.log('\n=== AUTO_TYPE avec codes moteur ===');
    const { data: types, error: typeError } = await supabase
      .from('auto_type')
      .select('type_id, type_name, type_engine_code, type_engine')
      .not('type_engine_code', 'is', null)
      .limit(5);
    
    if (typeError) {
      console.log('❌ Erreur auto_type:', typeError.message);
      return;
    }
    
    console.log('✅ Types avec codes moteur:');
    types.forEach(t => console.log(`ID: ${t.type_id}, Name: ${t.type_name}, Engine Code: ${t.type_engine_code}, Engine: ${t.type_engine}`));
    
    // 3. Chercher correspondances directes
    console.log('\n=== RECHERCHE CORRESPONDANCES ===');
    const engineCodes = engines.map(e => e.eng_code).filter(Boolean);
    const typeCodes = types.map(t => t.type_engine_code).filter(Boolean);
    
    console.log('Codes engines:', engineCodes);
    console.log('Codes types:', typeCodes);
    
    // Correspondances exactes
    const exactMatches = engineCodes.filter(code => typeCodes.includes(code));
    console.log('Correspondances exactes:', exactMatches);
    
    // Test avec un code spécifique de notre liste
    const testCodes = ['AR 31010', 'F4A', '930.50', '159 A3.046'];
    for (const testCode of testCodes) {
      const { data: matchingTypes } = await supabase
        .from('auto_type')
        .select('type_id, type_name, type_engine_code')
        .eq('type_engine_code', testCode)
        .limit(3);
      
      if (matchingTypes && matchingTypes.length > 0) {
        console.log(`✅ Code "${testCode}" trouvé dans auto_type:`, matchingTypes.length, 'résultats');
      }
    }

  } catch (error) {
    console.error('❌ Erreur test:', error.message);
  }
};

testEngineRelation().then(() => {
  console.log('\n🎯 Test relation cars_engine terminé');
  process.exit(0);
});