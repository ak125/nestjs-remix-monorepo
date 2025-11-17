#!/usr/bin/env node
/**
 * Script d'inspection complète des 3 tables SEO de switches
 * 
 * Tables inspectées:
 * - __seo_item_switch (13 883 rows) - Switches génériques par gamme
 * - __seo_family_gamme_car_switch (3 790 rows) - Switches par famille/gamme
 * - __seo_gamme_car_switch (0 rows) - Switches spécifiques gamme/véhicule
 * 
 * Exécuter: cd backend && node check_all_seo_tables.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Utiliser SERVICE_ROLE pour contourner RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_URL || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('Assurez-vous que .env contient SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log(`🔑 Utilisation de: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON_KEY'}`);
console.log(`📅 Date: ${new Date().toISOString()}\n`);

const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

/**
 * Inspection de __seo_item_switch
 */
async function inspectItemSwitch() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TABLE: __seo_item_switch (13 883 rows)');
  console.log('='.repeat(80));
  
  // Structure
  console.log('\n📋 Structure de la table:');
  const { data: sample, error: sampleError } = await supabase
    .from('__seo_item_switch')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.log('❌ Erreur:', sampleError.message);
    return;
  }
  
  if (sample?.[0]) {
    console.log('Colonnes:', Object.keys(sample[0]));
    console.log('Exemple:', sample[0]);
  }

  // Statistiques globales
  console.log('\n📈 Statistiques globales:');
  const { data: stats, error: statsError } = await supabase
    .from('__seo_item_switch')
    .select('sis_pg_id, sis_alias')
    .limit(15000);

  if (stats) {
    const byAlias = {};
    const byPgId = {};
    
    stats.forEach(row => {
      const alias = String(row.sis_alias);
      const pgId = String(row.sis_pg_id);
      
      byAlias[alias] = (byAlias[alias] || 0) + 1;
      byPgId[pgId] = (byPgId[pgId] || 0) + 1;
    });

    console.log('\n📊 Distribution par alias:');
    Object.entries(byAlias)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([alias, count]) => {
        console.log(`  Alias ${alias.padStart(3)}: ${count.toString().padStart(5)} switches`);
      });

    console.log('\n📊 Distribution par pg_id (top 10):');
    Object.entries(byPgId)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([pgId, count]) => {
        console.log(`  pg_id ${pgId.padStart(4)}: ${count.toString().padStart(4)} switches`);
      });
  }

  // Switches pour pg_id 2462 (Rotule de suspension)
  console.log('\n🎯 Switches pour pg_id=2462:');
  console.log('-'.repeat(80));
  
  const { data: switches2462, error: switches2462Error } = await supabase
    .from('__seo_item_switch')
    .select('*')
    .eq('sis_pg_id', 2462)
    .order('sis_alias');

  if (switches2462Error) {
    console.log('❌ Erreur:', switches2462Error.message);
  } else {
    console.log(`✅ ${switches2462.length} switches trouvés\n`);
    
    switches2462.forEach((sw, i) => {
      const content = sw.sis_content || '';
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      console.log(`${(i + 1).toString().padStart(2)}. Alias ${sw.sis_alias}: ${preview}`);
    });
  }

  // Switches avec pg_id=0 (switches globaux)
  console.log('\n🌐 Switches globaux (pg_id=0):');
  console.log('-'.repeat(80));
  
  const { data: switchesGlobal, error: switchesGlobalError } = await supabase
    .from('__seo_item_switch')
    .select('*')
    .eq('sis_pg_id', 0)
    .order('sis_alias')
    .limit(10);

  if (switchesGlobal) {
    console.log(`✅ ${switchesGlobal.length} premiers switches globaux:\n`);
    
    switchesGlobal.forEach((sw, i) => {
      const content = sw.sis_content || '';
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      console.log(`${(i + 1).toString().padStart(2)}. Alias ${sw.sis_alias}: ${preview}`);
    });
  }
}

/**
 * Inspection de __seo_family_gamme_car_switch
 */
async function inspectFamilySwitches() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TABLE: __seo_family_gamme_car_switch (3 790 rows)');
  console.log('='.repeat(80));
  
  // Structure
  console.log('\n📋 Structure de la table:');
  const { data: sample, error: sampleError } = await supabase
    .from('__seo_family_gamme_car_switch')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.log('❌ Erreur:', sampleError.message);
    return;
  }
  
  if (sample?.[0]) {
    console.log('Colonnes:', Object.keys(sample[0]));
    console.log('Exemple:', sample[0]);
  }

  // Statistiques globales
  console.log('\n📈 Statistiques globales:');
  const { data: stats, error: statsError } = await supabase
    .from('__seo_family_gamme_car_switch')
    .select('sfgcs_mf_id, sfgcs_pg_id, sfgcs_alias')
    .limit(5000);

  if (stats) {
    const byAlias = {};
    const byMfId = {};
    
    stats.forEach(row => {
      const alias = String(row.sfgcs_alias);
      const mfId = String(row.sfgcs_mf_id);
      
      byAlias[alias] = (byAlias[alias] || 0) + 1;
      byMfId[mfId] = (byMfId[mfId] || 0) + 1;
    });

    console.log('\n📊 Distribution par alias:');
    Object.entries(byAlias)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([alias, count]) => {
        console.log(`  Alias ${alias.padStart(3)}: ${count.toString().padStart(5)} switches`);
      });

    console.log('\n📊 Distribution par mf_id (catalog_family):');
    Object.entries(byMfId)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([mfId, count]) => {
        console.log(`  mf_id ${mfId.padStart(3)}: ${count.toString().padStart(4)} switches`);
      });
  }

  // Récupérer mf_id pour pg_id 2462
  console.log('\n🎯 Famille pour pg_id=2462:');
  const { data: catalogGamme, error: cgError } = await supabase
    .from('catalog_gamme')
    .select('mc_mf_prime')
    .eq('mc_pg_id', 2462)
    .limit(1);

  if (catalogGamme?.[0]) {
    const mfId = catalogGamme[0].mc_mf_prime;
    console.log(`✅ mf_id = ${mfId}`);

    // Switches pour cette famille
    console.log(`\n🎯 Switches pour mf_id=${mfId} et pg_id=2462 (alias 11-16):`);
    console.log('-'.repeat(80));
    
    const { data: familySwitches, error: familySwitchesError } = await supabase
      .from('__seo_family_gamme_car_switch')
      .select('*')
      .eq('sfgcs_mf_id', mfId)
      .or(`sfgcs_pg_id.eq.0,sfgcs_pg_id.eq.2462`)
      .gte('sfgcs_alias', 11)
      .lte('sfgcs_alias', 16)
      .order('sfgcs_alias');

    if (familySwitchesError) {
      console.log('❌ Erreur:', familySwitchesError.message);
    } else {
      console.log(`✅ ${familySwitches.length} switches trouvés\n`);
      
      familySwitches.forEach((sw, i) => {
        const content = sw.sfgcs_content || '';
        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
        console.log(`${(i + 1).toString().padStart(2)}. Alias ${sw.sfgcs_alias} (pg=${sw.sfgcs_pg_id}): ${preview}`);
      });
    }
  }
}

/**
 * Inspection de __seo_gamme_car_switch
 */
async function inspectGammeCarSwitch() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TABLE: __seo_gamme_car_switch (0 rows - À PEUPLER)');
  console.log('='.repeat(80));
  
  // Structure
  console.log('\n📋 Structure de la table:');
  const { data: sample, error: sampleError } = await supabase
    .from('__seo_gamme_car_switch')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.log('❌ Erreur:', sampleError.message);
    return;
  }
  
  if (sample?.[0]) {
    console.log('Colonnes:', Object.keys(sample[0]));
  } else {
    console.log('⚠️ Table vide - structure attendue: sgcs_id, sgcs_pg_id, sgcs_alias, sgcs_content');
  }

  // Vérifier le template pour voir quels switches sont nécessaires
  console.log('\n📄 Analyse du template SEO (pg_id=2462):');
  const { data: template, error: templateError } = await supabase
    .from('__seo_gamme_car')
    .select('sgc_content, sgc_h1, sgc_preview, sgc_title, sgc_descrip')
    .eq('sgc_pg_id', 2462)
    .limit(1);

  if (template?.[0]) {
    const { sgc_content, sgc_h1, sgc_preview, sgc_title, sgc_descrip } = template[0];
    const fullText = [sgc_h1, sgc_content, sgc_preview, sgc_title, sgc_descrip]
      .filter(Boolean)
      .join(' ');
    
    // Extraire variables #CompSwitch_X_Y# et #LinkGammeCar_X#
    const compSwitchPattern = /#CompSwitch_(\d+)_(\d+)#/g;
    const linkGammeCarPattern = /#LinkGammeCar_(\d+)#/g;
    
    const compSwitches = [...fullText.matchAll(compSwitchPattern)];
    const linkGammeCar = [...fullText.matchAll(linkGammeCarPattern)];
    
    console.log(`\n🔍 Switches requis dans __seo_gamme_car_switch:`);
    
    // Grouper par pg_id et alias
    const requiredSwitches = {};
    
    compSwitches.forEach(match => {
      const alias = match[1];
      const pgId = match[2];
      if (!requiredSwitches[pgId]) requiredSwitches[pgId] = new Set();
      requiredSwitches[pgId].add(alias);
    });

    linkGammeCar.forEach(match => {
      const pgId = match[1];
      if (!requiredSwitches[pgId]) requiredSwitches[pgId] = new Set();
      requiredSwitches[pgId].add('1'); // LinkGammeCar utilise alias 1 et 2
      requiredSwitches[pgId].add('2');
    });

    Object.entries(requiredSwitches).forEach(([pgId, aliases]) => {
      console.log(`  pg_id=${pgId}: alias [${[...aliases].sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}]`);
    });

    // Obtenir les noms des gammes
    console.log(`\n📦 Gammes référencées:`);
    for (const pgId of Object.keys(requiredSwitches)) {
      const { data: gamme } = await supabase
        .from('pieces_gamme')
        .select('pg_name')
        .eq('pg_id', parseInt(pgId))
        .limit(1);
      
      if (gamme?.[0]) {
        console.log(`  pg_id=${pgId}: ${gamme[0].pg_name}`);
      }
    }
  }
}

/**
 * Analyse des patterns PHP pour reproduction
 */
async function analyzePhpPatterns() {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 ANALYSE DES PATTERNS PHP À REPRODUIRE');
  console.log('='.repeat(80));

  console.log(`
📋 LOGIQUE DE ROTATION IDENTIFIÉE DANS LE PHP:

1. __seo_item_switch (SIS):
   - Alias 1, 2: Utilisé dans title/description
   - Alias 3: Utilisé dans H1
   - Formule: ($type_id + offset) % count
   - Query: WHERE SIS_PG_ID = $pg_id AND SIS_ALIAS = X

2. __seo_family_gamme_car_switch (SFGCS):
   - Alias 11-16: Switches par famille
   - Formule: ($type_id + $pg_id + $alias) % count
   - Query: WHERE SFGCS_MF_ID = '$mf_id' AND (SFGCS_PG_ID = 0 OR SFGCS_PG_ID = $pg_id) AND SFGCS_ALIAS = X

3. __seo_gamme_car_switch (SGCS):
   - Alias 0: Switch principal sans alias
   - Alias 1, 2: Pour LinkGammeCar
   - Alias 3: Pour CompSwitch_3_PG_ID
   - Formule: ($type_id + $pg_id + offset) % count
   - Query: WHERE SGCS_PG_ID = $pg_id AND SGCS_ALIAS = X

4. Switches externes (cross-gamme):
   - Boucle sur toutes les gammes actives
   - Variables: #CompSwitch_PG_ID#, #CompSwitch_1_PG_ID#, #CompSwitch_2_PG_ID#, #CompSwitch_3_PG_ID#
   - Variables: #LinkGammeCar_PG_ID#
   - Permet références croisées entre gammes

5. Variables additionnelles:
   - #VCarosserie# = TYPE_BODY
   - #VMotorisation# = TYPE_FUEL
   - #VCodeMoteur# = TMC_CODE (comma-separated)
   - #PrixPasCher# = Array[($pg_id + $type_id) % length]
   - #VousPropose# = Array[$type_id % length]
   - #MinPrice# = MIN(PRI_VENTE_TTC * PIECE_QTY_SALE)
`);

  console.log('\n💡 RECOMMANDATIONS D\'IMPLÉMENTATION:\n');
  console.log('1. Créer des méthodes séparées pour chaque source de switches');
  console.log('2. Implémenter un cache Redis pour les switches fréquents');
  console.log('3. Ajouter des index: (sis_pg_id, sis_alias), (sfgcs_mf_id, sfgcs_pg_id, sfgcs_alias)');
  console.log('4. Créer un script de population pour __seo_gamme_car_switch');
  console.log('5. Centraliser les formules de rotation dans une classe utilitaire');
  console.log('6. Ajouter des tests unitaires pour chaque type de switch');
}

/**
 * Génération de données pour __seo_gamme_car_switch
 */
async function generateMissingData() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 GÉNÉRATION DE DONNÉES POUR __seo_gamme_car_switch');
  console.log('='.repeat(80));

  console.log(`
📝 Données à insérer basées sur l'analyse du template PHP:

Pour pg_id=2462 (Rotule de suspension):
- Alias 2462 (switch principal)
- Alias 1, 2 (pour LinkGammeCar)
- Alias 3 (pour CompSwitch_3)

Pour pg_id=2066 (Rotule de direction):
- Alias 1, 2 (pour LinkGammeCar)
- Alias 3 (pour CompSwitch_3)

Pour pg_id=273 (Bras de suspension):
- Alias 1, 2 (pour LinkGammeCar)
- Alias 3 (pour CompSwitch_3)

💡 Script SQL sera généré dans: populate_seo_gamme_car_switch.sql
`);
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🚀 INSPECTION COMPLÈTE DES TABLES SEO SWITCHES');
    console.log('='.repeat(80));

    await inspectItemSwitch();
    await inspectFamilySwitches();
    await inspectGammeCarSwitch();
    await analyzePhpPatterns();
    await generateMissingData();

    console.log('\n' + '='.repeat(80));
    console.log('✅ INSPECTION TERMINÉE');
    console.log('='.repeat(80));
    console.log(`
📋 PROCHAINES ÉTAPES:

1. Examiner les résultats ci-dessus
2. Exécuter: node populate_seo_gamme_car_switch.js (à créer)
3. Mettre à jour gamme-unified.service.ts
4. Ajouter tests unitaires
5. Tester avec type_id=17484, pg_id=2462
`);

  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    process.exit(1);
  }
}

main();
