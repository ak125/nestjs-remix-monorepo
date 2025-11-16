// Test direct de la fonction RPC Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_KEY manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpcFunction() {
  console.log('🔍 Test de la fonction RPC get_brand_bestsellers_optimized...\n');
  
  try {
    // Test BMW (marque_id = 33)
    console.log('Test 1: BMW (marque_id=33, limit=3)');
    const { data, error } = await supabase.rpc('get_brand_bestsellers_optimized', {
      p_marque_id: 33,
      p_limit_vehicles: 3,
      p_limit_parts: 3
    });
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('\n⚠️  La fonction SQL n\'est pas encore déployée sur Supabase!');
        console.log('\n📝 Actions à faire:');
        console.log('1. Ouvrir Supabase Dashboard → SQL Editor');
        console.log('2. Copier le contenu de backend/prisma/supabase-functions/get_brand_bestsellers_optimized.sql');
        console.log('3. Exécuter le script SQL');
        console.log('4. Re-tester ce script');
      }
      
      process.exit(1);
    }
    
    console.log('✅ Fonction trouvée et exécutée!');
    console.log('\nRésultat:');
    console.log(`  - Véhicules: ${data?.vehicles?.length || 0}`);
    console.log(`  - Pièces: ${data?.parts?.length || 0}`);
    
    if (data?.vehicles?.length > 0) {
      console.log('\n📦 Premier véhicule:');
      console.log(`  - Type: ${data.vehicles[0].type_name}`);
      console.log(`  - Alias: ${data.vehicles[0].type_alias}`);
      console.log(`  - Modèle: ${data.vehicles[0].modele_name}`);
    }
    
    if (data?.parts?.length > 0) {
      console.log('\n🔧 Première pièce:');
      console.log(`  - Nom: ${data.parts[0].pg_name}`);
      console.log(`  - Alias: ${data.parts[0].pg_alias}`);
    }
    
    if (data?.error) {
      console.warn('\n⚠️  Erreur SQL interne:', data.error);
    }
    
  } catch (err) {
    console.error('❌ Erreur inattendue:', err.message);
    process.exit(1);
  }
}

testRpcFunction();
