// 📁 backend/explore-gamme-tables.js
// 🔍 Script pour explorer les tables gammes dans Supabase

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (à ajuster selon votre config)
const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function exploreGammeTables() {
  console.log('🔍 Exploration des tables gammes disponibles...\n');

  // 1. Vérifier la structure de pieces_gamme
  console.log('📋 1. Structure de la table pieces_gamme:');
  try {
    const { data: piecesGamme, error: piecesError } = await supabase
      .from('pieces_gamme')
      .select('*')
      .limit(3);

    if (piecesError) {
      console.error('❌ Erreur pieces_gamme:', piecesError);
    } else {
      console.log('✅ Exemple données pieces_gamme:');
      console.log(JSON.stringify(piecesGamme, null, 2));
      
      if (piecesGamme.length > 0) {
        console.log('\n📊 Colonnes détectées dans pieces_gamme:');
        Object.keys(piecesGamme[0]).forEach(col => console.log(`  - ${col}`));
      }
    }
  } catch (error) {
    console.error('❌ Erreur pieces_gamme:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // 2. Vérifier la structure de catalog_gamme  
  console.log('📋 2. Structure de la table catalog_gamme:');
  try {
    const { data: catalogGamme, error: catalogError } = await supabase
      .from('catalog_gamme')
      .select('*')
      .limit(3);

    if (catalogError) {
      console.error('❌ Erreur catalog_gamme:', catalogError);
    } else {
      console.log('✅ Exemple données catalog_gamme:');
      console.log(JSON.stringify(catalogGamme, null, 2));
      
      if (catalogGamme.length > 0) {
        console.log('\n📊 Colonnes détectées dans catalog_gamme:');
        Object.keys(catalogGamme[0]).forEach(col => console.log(`  - ${col}`));
      }
    }
  } catch (error) {
    console.error('❌ Erreur catalog_gamme:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // 3. Compter les enregistrements
  console.log('📊 3. Statistiques des tables:');
  
  try {
    const { count: piecesCount } = await supabase
      .from('pieces_gamme')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📦 pieces_gamme: ${piecesCount || 0} enregistrements`);
  } catch (error) {
    console.error('❌ Erreur comptage pieces_gamme:', error.message);
  }

  try {
    const { count: catalogCount } = await supabase
      .from('catalog_gamme')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📂 catalog_gamme: ${catalogCount || 0} enregistrements`);
  } catch (error) {
    console.error('❌ Erreur comptage catalog_gamme:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // 4. Recherche de la meilleure table pour les gammes
  console.log('🎯 4. Recommandation pour l\'affichage des gammes:\n');
  
  console.log('Based on the table names and typical e-commerce structure:');
  console.log('🔸 catalog_gamme: Likely contains category/range definitions');
  console.log('🔸 pieces_gamme: Likely contains product-category relationships');
  console.log('\n💡 Recommandation: Utiliser catalog_gamme pour l\'affichage des catégories/gammes');
}

// Exécution du script
exploreGammeTables()
  .then(() => {
    console.log('\n✅ Exploration terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur lors de l\'exploration:', error);
    process.exit(1);
  });