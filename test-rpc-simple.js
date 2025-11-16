require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function test() {
  console.log('🔍 Test fonction RPC get_brand_bestsellers_optimized...\n');
  
  const { data, error } = await supabase.rpc('get_brand_bestsellers_optimized', {
    p_marque_id: 33,
    p_limit_vehicles: 3,
    p_limit_parts: 3
  });
  
  if (error) {
    console.log('❌ Erreur:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('\n⚠️  La fonction SQL n\'est PAS déployée sur Supabase\n');
      console.log('📝 À faire:');
      console.log('1. Ouvrir Supabase Dashboard → SQL Editor');
      console.log('2. Copier backend/prisma/supabase-functions/get_brand_bestsellers_optimized.sql');
      console.log('3. Exécuter');
    }
    process.exit(1);
  }
  
  console.log('✅ Fonction trouvée!');
  console.log('Véhicules:', data?.vehicles?.length || 0);
  console.log('Pièces:', data?.parts?.length || 0);
  
  if (data?.error) {
    console.log('⚠️  Erreur SQL:', data.error);
  }
}

test();
