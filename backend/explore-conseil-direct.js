/**
 * Script pour explorer la table __seo_gamme_conseil
 */

const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

async function exploreTable() {
  try {
    console.log('🔍 Exploration via API REST Supabase\n');
    
    // Utiliser l'API REST de Supabase directement
    const supabaseUrl = process.env.SUPABASE_URL || 'https://iqbxfytvswjaqvpbznsu.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxYnhmeXR2c3dqYXF2cGJ6bnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQwNzU1NjQsImV4cCI6MjAzOTY1MTU2NH0.SRSMT9tqyp_Zv-Z8KZ1JIVwvnQvNu5TaRGmQYIhXBoc';
    
    // 1. Récupérer des exemples
    console.log('📋 Récupération de 5 exemples...');
    const response1 = await fetch(
      `${supabaseUrl}/rest/v1/__seo_gamme_conseil?select=sgc_id,sgc_pg_id,sgc_title&limit=5`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('✅ Exemples:', JSON.stringify(data1, null, 2));
      
      if (data1.length > 0) {
        console.log('\n📊 Types des pg_id:');
        data1.forEach(item => {
          console.log(`  - sgc_pg_id="${item.sgc_pg_id}" (type: ${typeof item.sgc_pg_id})`);
        });
      }
    } else {
      console.error('❌ Erreur:', response1.status, await response1.text());
    }
    
    // 2. Chercher pour pg_id = 247
    console.log('\n🔍 Recherche pour sgc_pg_id=247...');
    const response2 = await fetch(
      `${supabaseUrl}/rest/v1/__seo_gamme_conseil?sgc_pg_id=eq.247&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`✅ Résultats pour pg_id=247: ${data2.length}`);
      if (data2.length > 0) {
        console.log('  Titre:', data2[0].sgc_title);
        console.log('  Contenu (preview):', data2[0].sgc_content?.substring(0, 150) + '...');
      }
    } else {
      console.error('❌ Erreur:', response2.status, await response2.text());
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

exploreTable();
