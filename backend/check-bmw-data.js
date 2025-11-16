require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBMWData() {
  // Compter les véhicules BMW dans cgc
  const { data, error } = await supabase.rpc('sql', { 
    query: `
      SELECT COUNT(DISTINCT cgc.cgc_type_id) as total
      FROM __cross_gamme_car_new cgc
      INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
      INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
      WHERE cgc.cgc_level = '2'
        AND am.modele_marque_id = 33
        AND am.modele_display = 1
        AND at.type_display = '1'
    `
  });
  
  console.log('📊 Véhicules BMW dans __cross_gamme_car_new:');
  if (error) {
    console.log('   Erreur:', error.message);
  } else {
    console.log('   Total:', data?.[0]?.total || 'N/A');
  }
}

checkBMWData();
