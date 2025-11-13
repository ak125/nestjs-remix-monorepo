const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variables manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const sqlFile = path.join(__dirname, 'prisma/supabase-functions/get_gamme_page_data_optimized.sql');
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

console.log('🚀 Déploiement via test RPC...\n');

// Test si la fonction existe et fonctionne
async function testAndDeploy() {
  console.log('📊 Test de la fonction actuelle...');
  
  const { data, error } = await supabase.rpc('get_gamme_page_data_optimized', { p_pg_id: 10 });
  
  if (error) {
    console.error('❌ Erreur actuelle:', error.message);
    console.log('\n📋 LA FONCTION DOIT ÊTRE MISE À JOUR MANUELLEMENT');
    console.log('═'.repeat(60));
    console.log('\n1. Ouvrez: https://supabase.com/dashboard/project/cxpojprgwgubzjyqzmoq/sql/new');
    console.log('\n2. Copiez-collez ce SQL:\n');
    console.log(sqlContent);
    console.log('\n' + '═'.repeat(60));
    console.log('\n3. Cliquez sur RUN');
    console.log('\n4. Relancez ce script pour vérifier\n');
  } else {
    console.log('✅ La fonction fonctionne correctement!');
    console.log('📊 Données reçues:', JSON.stringify(data).substring(0, 200) + '...');
  }
}

testAndDeploy();
