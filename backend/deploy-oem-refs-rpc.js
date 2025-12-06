#!/usr/bin/env node

/**
 * Script de déploiement pour la RPC get_oem_refs_for_vehicle
 * 
 * Usage: node deploy-oem-refs-rpc.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🚀 Déploiement de get_oem_refs_for_vehicle...\n');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables manquantes: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Vérifiez votre fichier .env');
  process.exit(1);
}

// Chemin du fichier SQL
const sqlFilePath = path.join(__dirname, 'sql/010-create-rpc-get-oem-refs-for-vehicle.sql');

if (!fs.existsSync(sqlFilePath)) {
  console.error(`❌ Fichier SQL introuvable: ${sqlFilePath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

console.log(`📄 Fichier: ${path.basename(sqlFilePath)}`);
console.log(`📦 Taille: ${(sqlContent.length / 1024).toFixed(2)} KB`);
console.log();

// Créer le client Supabase
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function testRPC() {
  try {
    console.log('🧪 Test de la fonction RPC...\n');
    
    // Test avec un véhicule Renault (Clio III - type_id: 6932, pg_id: 10)
    const { data, error } = await supabase.rpc('get_oem_refs_for_vehicle', {
      p_type_id: 6932,
      p_pg_id: 10,
      p_marque_name: 'RENAULT'
    });
    
    if (error) {
      console.error('❌ RPC non déployée ou erreur:', error.message);
      console.log('\n📋 INSTRUCTIONS DE DÉPLOIEMENT MANUEL:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log('1. Ouvrez le Supabase Dashboard: https://supabase.com/dashboard');
      console.log('2. Naviguez vers SQL Editor');
      console.log('3. Copiez le contenu du fichier:');
      console.log(`   ${sqlFilePath}`);
      console.log('4. Collez et exécutez le SQL');
      console.log('─────────────────────────────────────────────────────────────');
      return false;
    }
    
    console.log('✅ RPC déployée et fonctionnelle!');
    console.log('📊 Résultat du test:', JSON.stringify(data, null, 2));
    return true;
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    return false;
  }
}

// Afficher le contenu SQL pour copier-coller
async function showInstructions() {
  console.log('📋 INSTRUCTIONS DE DÉPLOIEMENT:');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log();
  console.log('OPTION 1: Supabase Dashboard');
  console.log('────────────────────────────');
  console.log('1. Ouvrez https://supabase.com/dashboard');
  console.log('2. Allez dans SQL Editor');
  console.log('3. Copiez-collez le contenu ci-dessous et exécutez');
  console.log();
  console.log('OPTION 2: Supabase CLI (si installée)');
  console.log('────────────────────────────');
  console.log(`supabase db execute -f "${sqlFilePath}"`);
  console.log();
  console.log('═════════════════════════════════════════════════════════════════');
  console.log();
  console.log('📄 CONTENU SQL À EXÉCUTER:');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log(sqlContent);
  console.log('═════════════════════════════════════════════════════════════════');
}

async function main() {
  const isDeployed = await testRPC();
  
  if (!isDeployed) {
    console.log();
    await showInstructions();
  }
}

main();
