/**
 * Script de déploiement de la fonction RPC get_brand_bestsellers_optimized
 * Utilise cgc_marque_id pour filtrer directement par marque
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deploy() {
  console.log('🚀 Déploiement de get_brand_bestsellers_optimized...\n');
  
  // Lire le fichier SQL
  const sqlPath = path.join(__dirname, 'prisma/supabase-functions/get_brand_bestsellers_optimized.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('📄 Fichier SQL chargé');
  
  // Exécuter le SQL via la fonction sql de Supabase
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    // Essayer une approche alternative - via le dashboard SQL
    console.log('⚠️ exec_sql non disponible, affichage du SQL pour exécution manuelle:\n');
    console.log('='.repeat(80));
    console.log(sql);
    console.log('='.repeat(80));
    console.log('\n📋 Copiez ce SQL et exécutez-le dans le SQL Editor de Supabase Dashboard');
    console.log('   URL: https://supabase.com/dashboard/project/cxpojprgwgubzjyqzmoq/sql');
    return;
  }
  
  console.log('✅ Fonction déployée avec succès!');
  
  // Test de la fonction
  console.log('\n🧪 Test avec Renault (marque_id=140)...');
  const { data: testData, error: testError } = await supabase.rpc('get_brand_bestsellers_optimized', {
    p_marque_id: 140,
    p_limit_vehicles: 6,
    p_limit_parts: 12
  });
  
  if (testError) {
    console.log('❌ Erreur test:', testError.message);
  } else {
    console.log(`✅ Véhicules: ${testData?.vehicles?.length || 0}`);
    console.log(`✅ Pièces: ${testData?.parts?.length || 0}`);
    
    if (testData?.parts?.length > 0) {
      console.log('\n📦 Pièces retournées:');
      testData.parts.forEach((p, i) => {
        console.log(`  ${i+1}. ${p.pg_name} (pg_id: ${p.pg_id}) - ${p.marque_name} ${p.modele_name || ''}`);
      });
    }
  }
}

deploy().catch(console.error);
