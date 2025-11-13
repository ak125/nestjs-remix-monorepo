const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('🔍 Vérification des tables et colonnes...\n');
  
  const tables = [
    'catalog_gamme',
    '__seo_gamme',
    '__seo_gamme_conseil',
    '__seo_gamme_info',
    '__cross_gamme_car_new',
    '__seo_equip_gamme',
    '__blog_advice',
    'catalog_family',
    'pieces_gamme',
    '__seo_item_switch'
  ];
  
  for (const table of tables) {
    console.log(`\n📋 Table: ${table}`);
    
    try {
      // Récupérer un échantillon de données
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
        continue;
      }
      
      if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log(`   ✅ Existe - ${columns.length} colonnes`);
        console.log(`   📊 Colonnes: ${columns.slice(0, 10).join(', ')}${columns.length > 10 ? '...' : ''}`);
        
        // Vérifier les types des colonnes clés
        const record = data[0];
        
        // Identifier les colonnes ID
        const idColumns = columns.filter(col => 
          col.includes('_id') || col.includes('pg_id') || col === 'pg_id' || 
          col.includes('sgc_pg_id') || col.includes('sgi_pg_id') || 
          col.includes('cgc_pg_id') || col.includes('seg_pg_id') || 
          col.includes('ba_pg_id') || col.includes('mc_pg_id') ||
          col.includes('sis_pg_id')
        );
        
        if (idColumns.length > 0) {
          console.log(`   🔑 Colonnes ID:`);
          idColumns.forEach(col => {
            const value = record[col];
            const type = typeof value;
            const isNumeric = !isNaN(value) && value !== null;
            console.log(`      - ${col}: ${type} (valeur: ${value}) ${isNumeric ? '🔢 numérique' : '📝 texte'}`);
          });
        }
      } else {
        console.log(`   ⚠️  Existe mais vide`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.message}`);
    }
  }
  
  // Test spécifique pour catalog_gamme et mc_pg_id
  console.log('\n\n🔍 TEST SPÉCIFIQUE: catalog_gamme.mc_pg_id');
  try {
    const { data, error } = await supabase
      .from('catalog_gamme')
      .select('mc_pg_id')
      .eq('mc_pg_id', '10')
      .limit(1);
    
    if (error) {
      console.log(`   ❌ Erreur avec mc_pg_id = '10' (texte): ${error.message}`);
    } else {
      console.log(`   ✅ mc_pg_id = '10' (texte) fonctionne: ${data?.length} résultats`);
    }
  } catch (err) {
    console.log(`   ❌ Erreur: ${err.message}`);
  }
  
  try {
    const { data, error } = await supabase
      .from('catalog_gamme')
      .select('mc_pg_id')
      .eq('mc_pg_id', 10)
      .limit(1);
    
    if (error) {
      console.log(`   ❌ Erreur avec mc_pg_id = 10 (entier): ${error.message}`);
    } else {
      console.log(`   ✅ mc_pg_id = 10 (entier) fonctionne: ${data?.length} résultats`);
    }
  } catch (err) {
    console.log(`   ❌ Erreur: ${err.message}`);
  }
  
  console.log('\n');
}

checkTables();
