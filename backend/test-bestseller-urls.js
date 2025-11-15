require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBestsellerUrls() {
  console.log('🔗 Test URLs Bestsellers\n');

  try {
    // Récupérer les données depuis la fonction RPC
    const { data, error } = await supabase.rpc('get_brand_bestsellers_optimized', {
      p_marque_id: 33,
      p_limit_vehicles: 2,
      p_limit_parts: 2
    });

    if (error) {
      console.error('❌ Erreur RPC:', error);
      return;
    }

    console.log('📊 Données retournées:\n');

    // Test véhicules
    console.log('🚗 VÉHICULES:');
    data.vehicles.forEach((v, idx) => {
      console.log(`\n${idx + 1}. ${v.marque_name} ${v.modele_name} ${v.type_name}`);
      
      // Construire URL attendue
      const expectedUrl = `/constructeurs/${v.marque_alias}-${v.marque_id}/${v.modele_alias}-${v.modele_id}/${v.type_alias}-${v.cgc_type_id}.html`;
      const expectedImg = `/upload/constructeurs-automobiles/modeles/${v.modele_pic}`;
      
      console.log(`   URL:   ${expectedUrl}`);
      console.log(`   Image: ${expectedImg}`);
      console.log(`   Data:  marque_id=${v.marque_id}, modele_id=${v.modele_id}, cgc_type_id=${v.cgc_type_id}`);
    });

    // Test pièces
    console.log('\n\n📦 PIÈCES:');
    data.parts.forEach((p, idx) => {
      console.log(`\n${idx + 1}. ${p.pg_name}`);
      
      // Construire URL attendue
      const expectedUrl = `/pieces/${p.marque_alias}/${p.pg_alias}`;
      const expectedImg = `/upload/pieces-auto/${p.pg_pic}`;
      
      console.log(`   URL:   ${expectedUrl}`);
      console.log(`   Image: ${expectedImg}`);
      console.log(`   Data:  pg_id=${p.pg_id}, marque=${p.marque_name}, modèle=${p.modele_name}`);
    });

    console.log('\n\n✅ Test terminé!');
    console.log('\n💡 Pour tester visuellement:');
    console.log('   1. cd frontend && npm run dev');
    console.log('   2. Open: http://localhost:5173/constructeurs/bmw-33.html');
    console.log('   3. Vérifier que les 6 véhicules et 8 pièces s\'affichent');
    console.log('   4. Vérifier que les liens fonctionnent');

  } catch (err) {
    console.error('❌ Erreur:', err);
  }
}

testBestsellerUrls();
