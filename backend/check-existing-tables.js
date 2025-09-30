const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
  console.log('🔍 Tables disponibles liées aux pièces:');
  
  const tables = [
    'pieces', 'pieces_gamme', 'pieces_marque', 'pieces_marques', 
    'pieces_price', 'pieces_ref_search', 'pieces_media_img',
    'catalog_gamme', 'auto_marque', 'auto_modele', 'auto_type'
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ ${table}: ${count} enregistrements`);
      } else {
        console.log(`❌ ${table}: ${error.message}`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }
}

checkTables();