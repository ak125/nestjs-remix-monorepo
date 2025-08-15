#!/usr/bin/env ts-node
/**
 * 🔍 Script de Diagnostic - Connexion aux Tables Existantes
 * Vérifie quelles tables existent et leur structure
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables Supabase manquantes dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseDatabaseTables() {
  console.log('🔍 DIAGNOSTIC DES TABLES EXISTANTES');
  console.log('=====================================\n');

  try {
    // 1. Lister toutes les tables
    console.log('📋 1. TABLES DISPONIBLES:');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');

    if (tablesError) {
      // Fallback : requête SQL directe
      const { data: tablesRaw, error: rawError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .order('table_name');

      if (rawError) {
        console.error('❌ Erreur lors de la récupération des tables:', rawError);
        return;
      }

      console.log('Tables trouvées:');
      tablesRaw?.forEach((table: any) => {
        console.log(`  - ${table.table_name}`);
      });
    }

    // 2. Vérifier les tables spécifiques ___xtr_*
    console.log('\n🎯 2. TABLES ___xtr_* (LEGACY):');
    const xtrTables = [
      '___xtr_customer',
      '___xtr_order',
      '___xtr_product',
      '___xtr_cart',
      '___xtr_payment',
      '___xtr_msg'
    ];

    for (const tableName of xtrTables) {
      await checkTable(tableName);
    }

    // 3. Vérifier les nouvelles tables modernes
    console.log('\n🆕 3. TABLES MODERNES:');
    const modernTables = [
      'users',
      'products',
      'orders',
      'order_items',
      'carts',
      'cart_items'
    ];

    for (const tableName of modernTables) {
      await checkTable(tableName);
    }

    console.log('\n✅ Diagnostic terminé!');

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

async function checkTable(tableName: string) {
  try {
    // Tenter de compter les enregistrements
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`  ❌ ${tableName}: Table non trouvée ou inaccessible`);
      return;
    }

    console.log(`  ✅ ${tableName}: ${count} enregistrements`);

    // Si la table existe et a des données, montrer un échantillon
    if (count && count > 0) {
      const { data: sample, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!sampleError && sample && sample.length > 0) {
        const columns = Object.keys(sample[0]);
        console.log(`    📊 Colonnes: ${columns.slice(0, 5).join(', ')}${columns.length > 5 ? '...' : ''}`);
      }
    }

  } catch (error) {
    console.log(`  ❌ ${tableName}: Erreur lors de la vérification`);
  }
}

// Fonction pour tester les services spécifiques
async function testServices() {
  console.log('\n🧪 4. TEST DES SERVICES:');
  console.log('========================');

  // Test UserDataService
  console.log('\n👤 Test UserDataService:');
  try {
    const { data: users, error } = await supabase
      .from('___xtr_customer')
      .select('*')
      .limit(3);

    if (error) {
      console.log('  ❌ Impossible de récupérer les utilisateurs');
    } else {
      console.log(`  ✅ ${users?.length || 0} utilisateurs trouvés`);
      if (users && users.length > 0) {
        console.log(`  📧 Premier user: ${users[0].customer_email || 'Email non défini'}`);
      }
    }
  } catch (error) {
    console.log('  ❌ Erreur service utilisateurs');
  }

  // Test OrderDataService
  console.log('\n📦 Test OrderDataService:');
  try {
    const { data: orders, error } = await supabase
      .from('___xtr_order')
      .select('*')
      .limit(3);

    if (error) {
      console.log('  ❌ Impossible de récupérer les commandes');
    } else {
      console.log(`  ✅ ${orders?.length || 0} commandes trouvées`);
      if (orders && orders.length > 0) {
        console.log(`  🛒 Première commande: ID ${orders[0].ord_id || orders[0].order_id}`);
      }
    }
  } catch (error) {
    console.log('  ❌ Erreur service commandes');
  }

  // Test CartDataService
  console.log('\n🛒 Test CartDataService:');
  try {
    const { data: carts, error } = await supabase
      .from('cart')
      .select('*')
      .limit(3);

    if (error) {
      console.log('  ❌ Table cart non trouvée, test avec ___xtr_cart...');
      
      const { data: xtrCarts, error: xtrError } = await supabase
        .from('___xtr_cart')
        .select('*')
        .limit(3);

      if (xtrError) {
        console.log('  ❌ Aucune table de panier trouvée');
      } else {
        console.log(`  ✅ ${xtrCarts?.length || 0} paniers trouvés (table legacy)`);
      }
    } else {
      console.log(`  ✅ ${carts?.length || 0} paniers trouvés (table moderne)`);
    }
  } catch (error) {
    console.log('  ❌ Erreur service panier');
  }
}

// Fonction pour recommandations
function showRecommendations() {
  console.log('\n💡 5. RECOMMANDATIONS:');
  console.log('======================');
  console.log('1. Si les tables ___xtr_* existent et ont des données:');
  console.log('   → Utiliser les services existants (UserDataService, OrderDataService)');
  console.log('   → Ces services utilisent déjà Supabase avec les bonnes tables');
  console.log('');
  console.log('2. Si seules les tables modernes existent:');
  console.log('   → Créer de nouveaux services avec Drizzle ORM');
  console.log('   → Migration des données si nécessaire');
  console.log('');
  console.log('3. Si les deux types de tables existent:');
  console.log('   → Utiliser les services legacy pour les données existantes');
  console.log('   → Migrer progressivement vers les tables modernes');
}

// Exécution du diagnostic
async function main() {
  await diagnoseDatabaseTables();
  await testServices();
  showRecommendations();
  process.exit(0);
}

main().catch(console.error);
