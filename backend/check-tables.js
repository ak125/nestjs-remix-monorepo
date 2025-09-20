// 📁 backend/check-tables.js
// 🔍 Script pour voir la structure des tables

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('🔍 Vérification des tables disponibles...\n');

  // 1. Essayer pieces_gamme avec des colonnes simples
  console.log('📋 1. Table pieces_gamme:');
  try {
    const { data, error } = await supabase
      .from('pieces_gamme')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Erreur pieces_gamme:', error.message);
    } else if (data && data.length > 0) {
      console.log('✅ Colonnes disponibles dans pieces_gamme:');
      Object.keys(data[0]).forEach(col => console.log(`  - ${col}`));
      console.log('\n📄 Exemple de données:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('⚠️  Table pieces_gamme existe mais est vide');
    }
  } catch (error) {
    console.error('❌ Erreur pieces_gamme:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 2. Chercher toutes les tables contenant "gamme"
  console.log('📋 2. Recherche de tables avec "gamme":');
  try {
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', '%gamme%');

    if (error) {
      console.error('❌ Erreur recherche tables:', error.message);
    } else {
      console.log('✅ Tables trouvées:');
      tables.forEach(table => console.log(`  - ${table.table_name}`));
    }
  } catch (error) {
    console.error('❌ Erreur recherche tables:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 3. Chercher des tables contenant "category" ou "piece"
  console.log('📋 3. Autres tables utiles:');
  try {
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .or('table_name.like.%piece%,table_name.like.%category%,table_name.like.%catalog%');

    if (error) {
      console.error('❌ Erreur recherche tables:', error.message);
    } else {
      console.log('✅ Tables trouvées:');
      tables.forEach(table => console.log(`  - ${table.table_name}`));
    }
  } catch (error) {
    console.error('❌ Erreur recherche tables:', error.message);
  }
}

checkTables()
  .then(() => {
    console.log('\n✅ Vérification terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });