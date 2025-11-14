#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🚀 Déploiement de get_gamme_page_data_optimized avec seo_fragments_3...\n');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables manquantes: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Vérifiez votre fichier .env');
  process.exit(1);
}

// Lire le fichier SQL avec seo_fragments_3
const sqlFilePath = path.join(__dirname, 'prisma/supabase-functions/DROP_AND_CREATE_get_gamme_page_data_optimized.sql');

if (!fs.existsSync(sqlFilePath)) {
  console.error(`❌ Fichier SQL introuvable: ${sqlFilePath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

console.log(`📄 Fichier: ${path.basename(sqlFilePath)}`);
console.log(`📦 Taille: ${(sqlContent.length / 1024).toFixed(2)} KB`);
console.log(`🔍 Contient seo_fragments_3: ${sqlContent.includes('seo_fragments_3') ? '✅ OUI' : '❌ NON'}`);
console.log();

// Créer le client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Exécuter le SQL via l'API REST Supabase
async function deployRPC() {
  try {
    // Supabase ne permet pas d'exécuter du SQL DDL directement via le client JS
    // Il faut utiliser l'API REST avec un endpoint spécifique ou le SQL Editor
    
    console.log('📋 INSTRUCTIONS DE DÉPLOIEMENT MANUEL:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('1. Ouvrez le Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Naviguez vers SQL Editor');
    console.log('3. Copiez le contenu du fichier:');
    console.log(`   ${sqlFilePath}`);
    console.log('4. Collez et exécutez le SQL');
    console.log('─────────────────────────────────────────────────────────────');
    console.log();
    console.log('💡 ALTERNATIVE: Utilisez la CLI Supabase si installée:');
    console.log(`   supabase db execute -f "${sqlFilePath}"`);
    console.log();
    
    // Tester si la fonction existe déjà
    console.log('🧪 Test de la fonction actuelle...');
    const { data, error } = await supabase.rpc('get_gamme_page_data_optimized', { pg_id: 10 });
    
    if (error) {
      console.error('❌ Erreur lors du test:', error.message);
      return;
    }
    
    if (data && data.seo_fragments_3) {
      console.log(`✅ SUCCÈS: seo_fragments_3 contient ${data.seo_fragments_3.length} variations`);
      console.log('🎉 La fonction RPC est déjà déployée avec seo_fragments_3 !');
    } else {
      console.log('⚠️  seo_fragments_3 ABSENT dans la réponse RPC');
      console.log('📝 Veuillez déployer manuellement le fichier SQL ci-dessus');
    }
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

deployRPC();
