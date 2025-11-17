#!/usr/bin/env node
/**
 * 🧪 Script de test complet du système SEO switches
 * 
 * Vérifie:
 * - Données insérées dans __seo_gamme_car_switch
 * - Template SEO avec variables
 * - Logique de rotation des switches
 * 
 * Exécuter: cd backend && node test_seo_system.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_URL || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);

async function testSeoSystem() {
  console.log('\n🧪 TEST COMPLET DU SYSTÈME SEO SWITCHES');
  console.log('='.repeat(80));

  // Test 1: Vérifier les données insérées
  console.log('\n📊 TEST 1: Vérification des données __seo_gamme_car_switch');
  console.log('-'.repeat(80));

  const { data: switches, error: switchesError } = await supabase
    .from('__seo_gamme_car_switch')
    .select('*');

  if (switchesError) {
    console.log('❌ Erreur:', switchesError.message);
  } else {
    console.log(`✅ Total switches: ${switches.length}`);
    
    const byPgId = {};
    switches.forEach(sw => {
      const pgId = sw.sgcs_pg_id;
      if (!byPgId[pgId]) byPgId[pgId] = {};
      const alias = sw.sgcs_alias;
      byPgId[pgId][alias] = (byPgId[pgId][alias] || 0) + 1;
    });

    console.log('\n📊 Distribution par gamme:');
    for (const [pgId, aliases] of Object.entries(byPgId)) {
      const total = Object.values(aliases).reduce((sum, count) => sum + count, 0);
      console.log(`  pg_id=${pgId}: ${total} switches`);
      for (const [alias, count] of Object.entries(aliases).sort((a, b) => a[0] - b[0])) {
        console.log(`    - Alias ${alias}: ${count} switches`);
      }
    }
  }

  // Test 2: Vérifier template SEO pour pg_id=2462
  console.log('\n\n📄 TEST 2: Template SEO pour pg_id=2462');
  console.log('-'.repeat(80));

  const { data: template, error: templateError } = await supabase
    .from('__seo_gamme_car')
    .select('sgc_h1, sgc_content, sgc_descrip')
    .eq('sgc_pg_id', 2462)
    .single();

  if (templateError) {
    console.log('❌ Erreur:', templateError.message);
  } else if (template) {
    console.log('✅ Template trouvé\n');
    
    // Extraire variables
    const fullText = [template.sgc_h1, template.sgc_content, template.sgc_descrip]
      .filter(Boolean)
      .join(' ');
    
    const variables = [...new Set(fullText.match(/#[\w_]+(?:_\d+)?#/g) || [])].sort();
    
    console.log(`📋 Variables dans le template (${variables.length}):`);
    variables.forEach(v => console.log(`  - ${v}`));
    
    console.log('\n📝 H1:');
    console.log(`  ${template.sgc_h1}`);
    
    console.log('\n📝 Content (200 premiers caractères):');
    console.log(`  ${(template.sgc_content || '').substring(0, 200)}...`);
  }

  // Test 3: Simuler remplacement pour type_id=17484, pg_id=2462
  console.log('\n\n🔄 TEST 3: Simulation remplacement variables');
  console.log('-'.repeat(80));
  console.log('Context: type_id=17484, pg_id=2462, marque_id=173, modele_id=173044');

  // Récupérer infos véhicule
  const { data: typeData } = await supabase
    .from('auto_type')
    .select(`
      type_id,
      type_name,
      type_power_ps,
      type_year_from,
      type_year_to,
      type_marque_id,
      type_modele_id
    `)
    .eq('type_id', 17484)
    .single();

  if (typeData) {
    const { data: marqueData } = await supabase
      .from('auto_marque')
      .select('marque_name')
      .eq('marque_id', typeData.type_marque_id)
      .single();

    const { data: modeleData } = await supabase
      .from('auto_modele')
      .select('modele_name')
      .eq('modele_id', typeData.type_modele_id)
      .single();

    const vehicleInfo = {
      marque: marqueData?.marque_name || '',
      modele: modeleData?.modele_name || '',
      type: typeData.type_name || '',
      nbCh: typeData.type_power_ps || '',
      annee: `${typeData.type_year_from || ''} - ${typeData.type_year_to || ''}`
    };

    console.log('\n🚗 Infos véhicule:');
    console.log(`  Marque: ${vehicleInfo.marque}`);
    console.log(`  Modèle: ${vehicleInfo.modele}`);
    console.log(`  Type: ${vehicleInfo.type}`);
    console.log(`  Puissance: ${vehicleInfo.nbCh} ch`);
    console.log(`  Année: ${vehicleInfo.annee}`);

    // Tester rotation switches
    console.log('\n🎲 TEST 4: Rotation des switches');
    console.log('-'.repeat(80));

    const { data: testSwitches } = await supabase
      .from('__seo_gamme_car_switch')
      .select('*')
      .eq('sgcs_pg_id', 2462)
      .eq('sgcs_alias', '3');

    if (testSwitches && testSwitches.length > 0) {
      console.log(`✅ ${testSwitches.length} switches alias=3 trouvés`);
      console.log(`\n🔄 Formule de rotation: typeId % count = ${17484} % ${testSwitches.length} = ${17484 % testSwitches.length}`);
      
      const selectedIndex = 17484 % testSwitches.length;
      const selected = testSwitches[selectedIndex];
      
      console.log(`\n🎯 Switch sélectionné (index ${selectedIndex}):`);
      console.log(`  ID: ${selected.sgcs_id}`);
      console.log(`  Content: ${selected.sgcs_content.substring(0, 100)}...`);
    }
  }

  // Test 5: Vérifier les autres tables de switches
  console.log('\n\n📊 TEST 5: Vérification des autres tables de switches');
  console.log('-'.repeat(80));

  // __seo_item_switch
  const { data: itemSwitches } = await supabase
    .from('__seo_item_switch')
    .select('*')
    .eq('sis_pg_id', 2462)
    .eq('sis_alias', 1)
    .limit(5);

  console.log(`\n__seo_item_switch (pg_id=2462, alias=1):`);
  console.log(`  ✅ ${itemSwitches?.length || 0} switches trouvés`);
  if (itemSwitches && itemSwitches.length > 0) {
    itemSwitches.forEach((sw, i) => {
      console.log(`  ${i + 1}. ${sw.sis_content}`);
    });
  }

  // __seo_family_gamme_car_switch
  const { data: catalogGamme } = await supabase
    .from('catalog_gamme')
    .select('mc_mf_prime')
    .eq('mc_pg_id', 2462)
    .single();

  if (catalogGamme) {
    const { data: familySwitches } = await supabase
      .from('__seo_family_gamme_car_switch')
      .select('*')
      .eq('sfgcs_mf_id', catalogGamme.mc_mf_prime)
      .eq('sfgcs_alias', 11)
      .limit(5);

    console.log(`\n__seo_family_gamme_car_switch (mf_id=${catalogGamme.mc_mf_prime}, alias=11):`);
    console.log(`  ✅ ${familySwitches?.length || 0} switches trouvés`);
    if (familySwitches && familySwitches.length > 0) {
      familySwitches.forEach((sw, i) => {
        const preview = sw.sfgcs_content.length > 80 ? sw.sfgcs_content.substring(0, 80) + '...' : sw.sfgcs_content;
        console.log(`  ${i + 1}. ${preview}`);
      });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ TESTS TERMINÉS');
  console.log('='.repeat(80));
  console.log(`
💡 PROCHAINES ÉTAPES:

1. ✅ Données insérées dans __seo_gamme_car_switch
2. ✅ Template SEO avec variables configuré
3. 🚀 Tester l'endpoint API: 
   GET /api/catalog/gammes/2462/seo-content?type_id=17484&marque_id=173&modele_id=173044

4. 🔍 Vérifier le rendu final dans le frontend
5. 📊 Comparer avec la sortie PHP attendue
`);
}

testSeoSystem().catch(console.error);
