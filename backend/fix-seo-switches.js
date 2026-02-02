#!/usr/bin/env node
// ============================================
// KILL-SWITCH PRODUCTION (P0.5 - 2026-02-02)
// ============================================
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_MUTATION !== '1') {
  console.error('\n⛔ ERREUR: Ce script ne peut pas s\'exécuter en production.');
  console.error('   Pour forcer: ALLOW_PROD_MUTATION=1 node script.js');
  console.error('   Environnement détecté: NODE_ENV=' + process.env.NODE_ENV);
  process.exit(1);
}
// ============================================

/**
 * Script de correction des switches Alias 3
 * Supprime les préfixes de motorisation (CDTI, Essence, TDI, etc.)
 *
 * Exécuter: cd backend && node fix-seo-switches.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSwitches() {
  console.log('🔧 CORRECTION DES SWITCHES ALIAS 3');
  console.log('='.repeat(60));

  // 1. Récupérer les switches Alias 3
  const { data: switches, error } = await supabase
    .from('__seo_gamme_car_switch')
    .select('*')
    .eq('sgcs_alias', '3');

  if (error) {
    console.log('❌ Erreur:', error.message);
    return;
  }

  console.log('📊 Switches Alias 3 trouvés:', switches.length);

  // 2. Pattern pour détecter les motorisations
  // Diesel 105 ch, Essence 110 ch, TDI 100 ch, HDI 90 ch, CDTI 105 ch, etc.
  const motorPattern = /^(Diesel|Essence|TDI|HDI|CDTI|DCI|TDCI|DTI|D|TD)\s+\d+\s*ch\s+/i;

  let updated = 0;
  for (const sw of switches) {
    if (motorPattern.test(sw.sgcs_content)) {
      const newContent = sw.sgcs_content.replace(motorPattern, '');
      
      console.log('\n🔄 ID ' + sw.sgcs_id + ' (pg_id=' + sw.sgcs_pg_id + '):');
      console.log('   AVANT: ' + sw.sgcs_content.substring(0, 60) + '...');
      console.log('   APRÈS: ' + newContent.substring(0, 60) + '...');

      const { error: updateError } = await supabase
        .from('__seo_gamme_car_switch')
        .update({ sgcs_content: newContent })
        .eq('sgcs_id', sw.sgcs_id);

      if (updateError) {
        console.log('   ❌ Erreur: ' + updateError.message);
      } else {
        console.log('   ✅ Corrigé');
        updated++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ TERMINÉ: ' + updated + ' switches corrigés');
  
  // 3. Vérification
  console.log('\n🔍 VÉRIFICATION POST-CORRECTION:');
  const { data: afterFix } = await supabase
    .from('__seo_gamme_car_switch')
    .select('sgcs_id, sgcs_pg_id, sgcs_content')
    .eq('sgcs_alias', '3')
    .limit(10);
  
  afterFix.forEach((sw, i) => {
    console.log((i+1) + '. ' + sw.sgcs_content);
  });
}

fixSwitches().then(() => process.exit(0)).catch(console.error);
