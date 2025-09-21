// 📁 backend/src/scripts/test-gamme-tables.ts
// 🔍 Script simple pour tester les tables gammes

import { createClient } from '@supabase/supabase-js';

// Configuration Supabase (utilise les variables d'environnement si disponibles)
const supabaseUrl = (
  process.env.SUPABASE_URL || 'https://your-supabase-url.supabase.co'
).replace(/"/g, '');
const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'your-supabase-key'
).replace(/"/g, '');

async function testGammeTables() {
  console.log('🔍 Test direct des tables gammes...');
  console.log('=======================================');

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: catalog_gamme
    console.log('\n📋 1. Test table catalog_gamme:');
    try {
      const { data: catalogData, error: catalogError } = await supabase
        .from('catalog_gamme')
        .select('*')
        .limit(3);

      if (catalogError) {
        console.error('❌ Erreur catalog_gamme:', catalogError.message);
      } else {
        console.log(
          `✅ catalog_gamme: ${catalogData?.length || 0} échantillons trouvés`,
        );
        if (catalogData && catalogData.length > 0) {
          console.log('📊 Colonnes:', Object.keys(catalogData[0]));
          console.log(
            '📄 Premier enregistrement:',
            JSON.stringify(catalogData[0], null, 2),
          );
        }
      }
    } catch (error: any) {
      console.error('❌ Exception catalog_gamme:', error.message);
    }

    // Test 2: pieces_gamme
    console.log('\n📋 2. Test table pieces_gamme:');
    try {
      const { data: piecesData, error: piecesError } = await supabase
        .from('pieces_gamme')
        .select('*')
        .limit(3);

      if (piecesError) {
        console.error('❌ Erreur pieces_gamme:', piecesError.message);
      } else {
        console.log(
          `✅ pieces_gamme: ${piecesData?.length || 0} échantillons trouvés`,
        );
        if (piecesData && piecesData.length > 0) {
          console.log('📊 Colonnes:', Object.keys(piecesData[0]));
          console.log(
            '📄 Premier enregistrement:',
            JSON.stringify(piecesData[0], null, 2),
          );
        }
      }
    } catch (error: any) {
      console.error('❌ Exception pieces_gamme:', error.message);
    }

    // Test 3: Comptage
    console.log('\n📊 3. Comptage des enregistrements:');

    try {
      const { count: catalogCount } = await supabase
        .from('catalog_gamme')
        .select('*', { count: 'exact', head: true });
      console.log(`📂 catalog_gamme: ${catalogCount || 0} enregistrements`);
    } catch (error: any) {
      console.error('❌ Erreur comptage catalog_gamme:', error.message);
    }

    try {
      const { count: piecesCount } = await supabase
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true });
      console.log(`📦 pieces_gamme: ${piecesCount || 0} enregistrements`);
    } catch (error: any) {
      console.error('❌ Erreur comptage pieces_gamme:', error.message);
    }
  } catch (error: any) {
    console.error('❌ Erreur générale:', error.message);
  }

  console.log('\n✅ Test terminé!');
}

// Si exécuté directement
if (require.main === module) {
  testGammeTables()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
}

export { testGammeTables };
