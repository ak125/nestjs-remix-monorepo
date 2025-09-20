// 🔍 TEST DIRECT : Structure table cars_engine
// Créons une requête de test pour comprendre la relation

import { SupabaseClient } from '@supabase/supabase-js';

// Test de la structure cars_engine
const testCarsEngineStructure = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Variables Supabase manquantes');
    return;
  }

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Structure cars_engine
    console.log('=== STRUCTURE cars_engine ===');
    const { data: enginesData, error: enginesError } = await supabase
      .from('cars_engine')
      .select('*')
      .limit(5);
    
    if (enginesError) {
      console.error('Erreur cars_engine:', enginesError);
    } else {
      console.log('Données cars_engine:', JSON.stringify(enginesData, null, 2));
    }

    // 2. Codes moteur dans auto_type
    console.log('\n=== CODES MOTEUR auto_type ===');
    const { data: typesData, error: typesError } = await supabase
      .from('auto_type')
      .select('type_id, type_name, type_engine_code')
      .not('type_engine_code', 'is', null)
      .limit(5);
    
    if (typesError) {
      console.error('Erreur auto_type:', typesError);
    } else {
      console.log('Codes moteur auto_type:', JSON.stringify(typesData, null, 2));
    }

    // 3. Test de jointure potentielle
    console.log('\n=== TEST JOINTURE ===');
    const { data: joinData, error: joinError } = await supabase
      .from('auto_type')
      .select(`
        type_id,
        type_name,
        type_engine_code,
        cars_engine!inner(eng_id, eng_code, eng_mfa_id)
      `)
      .limit(3);
    
    if (joinError) {
      console.log('Jointure directe impossible:', joinError.message);
      
      // Test jointure manuelle
      if (enginesData && typesData) {
        console.log('Test correspondances manuelles...');
        const engines = enginesData.map(e => ({ id: e.eng_id, code: e.eng_code, mfa: e.eng_mfa_id }));
        const types = typesData.map(t => ({ id: t.type_id, name: t.type_name, code: t.type_engine_code }));
        
        console.log('Moteurs disponibles:', engines);
        console.log('Types avec codes:', types);
      }
    } else {
      console.log('Jointure réussie:', JSON.stringify(joinData, null, 2));
    }

  } catch (error) {
    console.error('Erreur test:', error);
  }
};

// Exporter pour utilisation
module.exports = { testCarsEngineStructure };