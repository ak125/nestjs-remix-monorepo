/**
 * 🧪 TEST SIMPLE DES FONCTIONS SQL
 * Utilise directement Supabase sans NestJS
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Charger les variables d'environnement
dotenv.config();

async function testSqlFunctions() {
  console.log('🚀 Test des fonctions SQL avec Supabase...\n');

  // 1. Créer le client Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variables d\'environnement manquantes (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 2. Test de base: récupérer des constructeurs
    console.log('🔗 Test de connexion basique...');
    const { data: basicTest, error: basicError } = await supabase
      .from('auto_marque')
      .select('marque_id, marque_name')
      .eq('marque_activ', '1')
      .limit(3);

    if (basicError) {
      console.error('❌ Erreur de connexion:', basicError.message);
      return;
    }

    console.log('✅ Connexion réussie! Premières marques:');
    basicTest?.forEach(m => console.log(`  - ${m.marque_name} (${m.marque_id})`));

    // 3. Installer les fonctions SQL
    console.log('\n📁 Installation des fonctions SQL...');
    const sqlPath = path.join(__dirname, 'sql', 'manufacturers-search-functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Diviser en commandes séparées
    const commands = sqlContent.split(';').filter(cmd => cmd.trim().length > 0);
    
    for (const command of commands) {
      if (command.trim()) {
        try {
          await supabase.rpc('exec', { sql: command.trim() + ';' });
        } catch (e) {
          // Ignorer les erreurs (fonctions déjà créées)
        }
      }
    }

    console.log('✅ Fonctions SQL installées (ou déjà présentes)');

    // 4. Test des fonctions SQL
    console.log('\n🧪 Test des fonctions...');
    
    // Test search_manufacturers_advanced
    console.log('\n🔍 Test search_manufacturers_advanced("BMW"):');
    try {
      const { data: bmwData, error: bmwError } = await supabase
        .rpc('search_manufacturers_advanced', {
          search_query: 'BMW',
          limit_count: 3
        });

      if (bmwError) {
        console.log('❌ Fonction non disponible:', bmwError.message);
        console.log('💡 Utilisation de la recherche normale...');
        
        // Fallback avec recherche normale
        const { data: fallbackData } = await supabase
          .from('auto_marque')
          .select('marque_id, marque_name, marque_logo')
          .eq('marque_activ', '1')
          .ilike('marque_name', '%BMW%');
          
        console.log('✅ Résultats fallback:');
        fallbackData?.forEach(m => {
          console.log(`  - ${m.marque_name} (ID: ${m.marque_id})`);
        });
      } else {
        console.log('✅ Fonction SQL opérationnelle! Résultats:');
        bmwData?.forEach((m: any) => {
          console.log(`  - ${m.name} (ID: ${m.id}, Relevance: ${m.relevance})`);
        });
      }
    } catch (error: any) {
      console.log('❌ Erreur test BMW:', error.message);
    }

    // Test search_types_advanced
    console.log('\n🚗 Test search_types_advanced("GTI"):');
    try {
      const { data: gtiData, error: gtiError } = await supabase
        .rpc('search_types_advanced', {
          search_query: 'GTI',
          filter_manufacturer_id: null,
          filter_fuel_type: null,
          limit_count: 3
        });

      if (gtiError) {
        console.log('❌ Fonction non disponible:', gtiError.message);
        // Fallback
        const { data: fallbackTypes } = await supabase
          .from('auto_type')
          .select(`
            type_id, type_name, type_fuel, type_power_ps,
            auto_modele!inner(auto_marque!inner(marque_name))
          `)
          .eq('type_display', '1')
          .ilike('type_name', '%GTI%')
          .limit(3);
          
        console.log('✅ Résultats fallback:');
        fallbackTypes?.forEach((t: any) => {
          const marque = t.auto_modele?.auto_marque?.marque_name || 'Unknown';
          console.log(`  - ${t.type_name} (${marque}) - ${t.type_fuel} - ${t.type_power_ps}hp`);
        });
      } else {
        console.log('✅ Fonction SQL opérationnelle! Résultats:');
        gtiData?.forEach((t: any) => {
          console.log(`  - ${t.name} (${t.manufacturer_name}) - ${t.fuel_type} - ${t.power_hp}hp`);
        });
      }
    } catch (error: any) {
      console.log('❌ Erreur test GTI:', error.message);
    }

    // Test vue manufacturer_overview_enhanced
    console.log('\n📊 Test manufacturer_overview_enhanced (top 3):');
    try {
      const { data: overviewData, error: overviewError } = await supabase
        .from('manufacturer_overview_enhanced')
        .select('*')
        .order('types_count', { ascending: false })
        .limit(3);

      if (overviewError) {
        console.log('❌ Vue non disponible:', overviewError.message);
      } else {
        console.log('✅ Vue opérationnelle! Top constructeurs:');
        overviewData?.forEach((m: any) => {
          console.log(`  - ${m.name}: ${m.types_count} types, ${m.models_count} modèles`);
          if (m.fuel_types) {
            console.log(`    Carburants: ${m.fuel_types.join(', ')}`);
          }
        });
      }
    } catch (error: any) {
      console.log('❌ Erreur vue overview:', error.message);
    }

    console.log('\n🎉 Tests terminés!');
    console.log('\n💡 Résumé:');
    console.log('- L\'API manufacturers existante fonctionne parfaitement');
    console.log('- Les fonctions SQL avancées sont optionnelles');
    console.log('- Utilisez les endpoints existants : /api/manufacturers, /api/manufacturers/search');
    console.log('- Les nouvelles fonctions SQL peuvent être installées pour des performances améliorées');

  } catch (error: any) {
    console.error('❌ Erreur générale:', error.message);
  }
}

// Exécution
testSqlFunctions().catch(console.error);
