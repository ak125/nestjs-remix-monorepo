// 📁 backend/find-filtre-huile.js
// 🔍 Script pour trouver les données filtre à huile

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findFiltreHuile() {
  console.log('🔍 Recherche "filtre à huile"...\n');

  // 1. Chercher par ID 7
  console.log('📋 1. Recherche par ID 7:');
  try {
    const { data, error } = await supabase
      .from('pieces_gamme')
      .select('*')
      .eq('pg_id', '7');

    if (error) {
      console.error('❌ Erreur:', error.message);
    } else {
      console.log(`✅ Trouvé ${data.length} résultats:`);
      data.forEach(item => {
        console.log(`  ID: ${item.pg_id}, Name: ${item.pg_name}, Alias: ${item.pg_alias}, Display: ${item.pg_display}`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur ID 7:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 2. Chercher par nom contenant "filtre" et "huile"
  console.log('📋 2. Recherche par nom "filtre huile":');
  try {
    const { data, error } = await supabase
      .from('pieces_gamme')
      .select('*')
      .ilike('pg_name', '%filtre%huile%');

    if (error) {
      console.error('❌ Erreur:', error.message);
    } else {
      console.log(`✅ Trouvé ${data.length} résultats:`);
      data.forEach(item => {
        console.log(`  ID: ${item.pg_id}, Name: ${item.pg_name}, Alias: ${item.pg_alias}, Display: ${item.pg_display}`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur recherche nom:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 3. Chercher par alias contenant "filtre-huile"
  console.log('📋 3. Recherche par alias "filtre-huile":');
  try {
    const { data, error } = await supabase
      .from('pieces_gamme')
      .select('*')
      .ilike('pg_alias', '%filtre%huile%');

    if (error) {
      console.error('❌ Erreur:', error.message);
    } else {
      console.log(`✅ Trouvé ${data.length} résultats:`);
      data.forEach(item => {
        console.log(`  ID: ${item.pg_id}, Name: ${item.pg_name}, Alias: ${item.pg_alias}, Display: ${item.pg_display}`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur recherche alias:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 4. Lister toutes les gammes actives (pg_display = 1)
  console.log('📋 4. Toutes les gammes actives (pg_display = 1):');
  try {
    const { data, error } = await supabase
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_alias, pg_display')
      .eq('pg_display', '1')
      .order('pg_id');

    if (error) {
      console.error('❌ Erreur:', error.message);
    } else {
      console.log(`✅ Trouvé ${data.length} gammes actives:`);
      data.forEach(item => {
        console.log(`  ID: ${item.pg_id}, Name: ${item.pg_name}, Alias: ${item.pg_alias}`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur gammes actives:', error.message);
  }
}

findFiltreHuile()
  .then(() => {
    console.log('\n✅ Recherche terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });