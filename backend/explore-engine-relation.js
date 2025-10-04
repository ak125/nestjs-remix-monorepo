const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY1NDQzMDksImV4cCI6MjAyMjEyMDMwOX0.VUg7IKz5XZ9tZMhP-2CfGvwwP5A_1qx4K6nGWPHYl1M';

const client = createClient(supabaseUrl, supabaseKey);

async function explore() {
  console.log('🔍 Étape 1: Colonnes de auto_type');
  const { data: typeData } = await client
    .from('auto_type')
    .select('*')
    .limit(1)
    .single();
  
  if (typeData) {
    console.log('Colonnes auto_type:', Object.keys(typeData));
    console.log('Exemple de données:', typeData);
  }

  console.log('\n🔍 Étape 2: Structure de cars_engine (minuscules)');
  const { data: engineData } = await client
    .from('cars_engine')
    .select('*')
    .limit(1)
    .single();
  
  if (engineData) {
    console.log('Colonnes cars_engine:', Object.keys(engineData));
    console.log('Exemple:', engineData);
  }

  console.log('\n🔍 Étape 3: Chercher une table de liaison (type_engine, cars_type_engine, etc)');
  const tables = ['cars_type_engine', 'type_engine_link', 'auto_type_engine'];
  for (const table of tables) {
    try {
      const { data, error } = await client.from(table).select('*').limit(1);
      if (!error) {
        console.log(`✅ Table trouvée: ${table}`, data);
      }
    } catch (e) {
      // Table n'existe pas
    }
  }
}

explore().catch(console.error);
