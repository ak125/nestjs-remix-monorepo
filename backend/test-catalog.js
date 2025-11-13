const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function test() {
  // Test: récupérer mc_mf_prime pour pg_id=402
  const { data: catalogData } = await client
    .from('catalog_gamme')
    .select('mc_mf_prime')
    .eq('mc_pg_id', 402)
    .single();
  
  console.log('📊 mc_mf_prime pour pg_id=402:', catalogData);
  
  if (catalogData) {
    const mfId = catalogData.mc_mf_prime;
    console.log(`\n🔍 Recherche catalogue pour mf_id=${mfId}`);
    
    // Test: récupérer les items du catalogue pour cette famille
    const { data: items } = await client
      .from('catalog_gamme')
      .select('mc_pg_id, mc_sort')
      .eq('mc_mf_prime', mfId)
      .neq('mc_pg_id', 402);
    
    console.log(`📋 Items trouvés: ${items?.length || 0}`);
    if (items && items.length > 0) {
      console.log('Premiers items:', items.slice(0, 5));
    }
  }
}

test().then(() => process.exit(0));
