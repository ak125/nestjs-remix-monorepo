/**
 * Script pour vérifier les h3 dans la base pour l'article ba_id=75
 */

const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

async function checkH3Direct() {
  try {
    console.log('🔍 Vérification des H3 dans la base pour ba_id=75 (support-moteur)\n');
    
    // Utiliser l'API Supabase REST directement
    const supabaseUrl = process.env.SUPABASE_URL || 'https://iqbxfytvswjaqvpbznsu.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseKey) {
      console.error('❌ SUPABASE_ANON_KEY non défini');
      return;
    }
    
    // 1. Récupérer les H2
    console.log('📋 H2 pour ba_id=75:');
    const h2Res = await fetch(
      `${supabaseUrl}/rest/v1/__blog_advice_h2?ba2_ba_id=eq.75&select=ba2_id,ba2_h2&order=ba2_id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );
    
    if (h2Res.ok) {
      const h2Data = await h2Res.json();
      console.log(`   Trouvés: ${h2Data.length} H2`);
      h2Data.forEach((h2, index) => {
        console.log(`   ${index + 1}. ID=${h2.ba2_id}: ${h2.ba2_h2}`);
      });
    }
    
    // 2. Récupérer TOUS les H3 pour cet article
    console.log('\n📋 H3 pour ba_id=75:');
    const h3Res = await fetch(
      `${supabaseUrl}/rest/v1/__blog_advice_h3?ba3_ba_id=eq.75&select=ba3_id,ba3_ba2_id,ba3_h3&order=ba3_id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );
    
    if (h3Res.ok) {
      const h3Data = await h3Res.json();
      console.log(`   Trouvés: ${h3Data.length} H3`);
      if (h3Data.length > 0) {
        h3Data.forEach((h3, index) => {
          console.log(`   ${index + 1}. ID=${h3.ba3_id}, ba2_id=${h3.ba3_ba2_id}: ${h3.ba3_h3}`);
        });
      } else {
        console.log('   ⚠️  Aucun H3 trouvé pour cet article');
      }
    }
    
    // 3. Vérifier un autre article avec des H3
    console.log('\n🔍 Recherche d\'un article avec des H3...');
    const allH3Res = await fetch(
      `${supabaseUrl}/rest/v1/__blog_advice_h3?select=ba3_ba_id,ba3_h3&limit=5`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );
    
    if (allH3Res.ok) {
      const allH3 = await allH3Res.json();
      console.log(`   Exemples de H3 (premiers 5):`);
      allH3.forEach((h3, index) => {
        console.log(`   ${index + 1}. ba_id=${h3.ba3_ba_id}: ${h3.ba3_h3}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkH3Direct();
