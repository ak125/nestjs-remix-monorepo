#!/usr/bin/env node
/**
 * Script pour inspecter la table __seo_gamme_car_switch
 * Exécuter: cd backend && node check_seo_switches.js
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

const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

async function inspectSeoSwitches() {
  console.log('🔍 Inspection de la table __seo_gamme_car_switch');
  console.log('='.repeat(80));

  // 1. Structure de la table
  console.log('\n📋 Structure de la table (1 exemple):');
  const { data: sample, error: sampleError } = await supabase
    .from('__seo_gamme_car_switch')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.log('❌ Erreur:', sampleError.message);
  } else if (sample?.[0]) {
    console.log('Colonnes:', Object.keys(sample[0]));
    console.log('Exemple:', sample[0]);
  } else {
    console.log('⚠️ Table vide');
  }

  // 2. Switches pour gamme 2462 (Rotule de suspension)
  console.log('\n\n🎯 Switches pour pg_id=2462 (Rotule de suspension):');
  console.log('-'.repeat(80));
  
  const { data: switches, error: switchesError } = await supabase
    .from('__seo_gamme_car_switch')
    .select('*')
    .eq('sgcs_pg_id', 2462);

  if (switchesError) {
    console.log('❌ Erreur:', switchesError.message);
  } else {
    console.log(`✅ ${switches.length} switches trouvés\n`);
    
    switches.slice(0, 15).forEach((sw, i) => {
      const content = sw.sgcs_content || '';
      const preview = content.length > 120 ? content.substring(0, 120) + '...' : content;
      console.log(`${i + 1}. Alias ${sw.sgcs_alias}: ${preview}`);
    });

    // Statistiques par alias
    console.log('\n\n📊 Statistiques par alias:');
    console.log('-'.repeat(80));
    const aliasCount = {};
    switches.forEach(sw => {
      const alias = String(sw.sgcs_alias);
      aliasCount[alias] = (aliasCount[alias] || 0) + 1;
    });

    Object.entries(aliasCount)
      .sort((a, b) => {
        const aNum = parseInt(a[0]);
        const bNum = parseInt(b[0]);
        return isNaN(aNum) ? 1 : isNaN(bNum) ? -1 : aNum - bNum;
      })
      .forEach(([alias, count]) => {
        console.log(`Alias ${alias}: ${count} switch(es)`);
      });
  }

  // 3. Template SEO brut
  console.log('\n\n📄 Template SEO brut pour pg_id=2462:');
  console.log('-'.repeat(80));
  
  const { data: template, error: templateError } = await supabase
    .from('__seo_gamme_car')
    .select('sgc_content, sgc_h1, sgc_preview')
    .eq('sgc_pg_id', 2462)
    .limit(1);

  if (templateError) {
    console.log('❌ Erreur:', templateError.message);
  } else if (template?.[0]) {
    const { sgc_content, sgc_h1, sgc_preview } = template[0];
    const fullText = (sgc_h1 || '') + (sgc_content || '') + (sgc_preview || '');
    
    // Extraire toutes les variables
    const variablePattern = /#[\w_]+(?:_\d+)?#/g;
    const variables = [...new Set(fullText.match(variablePattern) || [])].sort();
    
    console.log(`Variables trouvées (${variables.length}):`);
    variables.forEach(v => console.log(`  - ${v}`));
    
    console.log(`\n📝 H1:\n${sgc_h1}`);
    console.log(`\n📝 Preview:\n${sgc_preview}`);
    console.log(`\n📝 Content (800 premiers caractères):\n${(sgc_content || '').substring(0, 800)}`);
  }

  // 4. Comparaison avec d'autres gammes
  console.log('\n\n🔄 Comparaison avec d\'autres gammes:');
  console.log('-'.repeat(80));
  
  const gammeIds = [78, 2066, 273, 274];
  for (const pgId of gammeIds) {
    const { data: gammeSwitches } = await supabase
      .from('__seo_gamme_car_switch')
      .select('sgcs_alias')
      .eq('sgcs_pg_id', pgId);
    
    const { data: gammeInfo } = await supabase
      .from('pieces_gamme')
      .select('pg_name')
      .eq('pg_id', pgId)
      .limit(1);
    
    const name = gammeInfo?.[0]?.pg_name || 'Inconnu';
    console.log(`pg_id=${pgId} (${name}): ${gammeSwitches?.length || 0} switches`);
  }

  console.log('\n\n✅ Inspection terminée');
}

inspectSeoSwitches().catch(console.error);
