/**
 * Script pour explorer la table __seo_gamme_conseil
 */

import { SupabaseService } from './src/common/services/supabase.service';

async function exploreConseilTable() {
  const supabaseService = new SupabaseService();
  
  try {
    console.log('🔍 Exploration de la table __seo_gamme_conseil\n');
    
    // 1. Compter le total
    const { count, error: countError } = await supabaseService.client
      .from('__seo_gamme_conseil')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Erreur count:', countError.message);
    } else {
      console.log(`📊 Total de conseils: ${count}\n`);
    }
    
    // 2. Récupérer quelques exemples
    const { data: samples, error: samplesError } = await supabaseService.client
      .from('__seo_gamme_conseil')
      .select('sgc_id, sgc_pg_id, sgc_title')
      .limit(10);
    
    if (samplesError) {
      console.error('❌ Erreur samples:', samplesError.message);
    } else {
      console.log('📋 Exemples de conseils:');
      samples?.forEach((conseil) => {
        console.log(`  - pg_id="${conseil.sgc_pg_id}" (type: ${typeof conseil.sgc_pg_id}): ${conseil.sgc_title?.substring(0, 60)}...`);
      });
    }
    
    // 3. Chercher spécifiquement le pg_id 247
    console.log('\n🔍 Recherche pour pg_id=247:');
    
    const { data: data247, error: error247 } = await supabaseService.client
      .from('__seo_gamme_conseil')
      .select('*')
      .eq('sgc_pg_id', '247');
    
    if (error247) {
      console.error('❌ Erreur:', error247.message);
    } else {
      console.log(`  Résultats: ${data247?.length || 0}`);
      if (data247 && data247.length > 0) {
        console.log(`  Titre: ${data247[0].sgc_title}`);
        console.log(`  Contenu: ${data247[0].sgc_content?.substring(0, 100)}...`);
      }
    }
    
    // 4. Vérifier avec différents types
    console.log('\n🔍 Test avec différents types pour pg_id=247:');
    
    const tests = [
      { label: 'String "247"', value: '247' },
      { label: 'Number 247', value: 247 },
      { label: 'String "0247"', value: '0247' },
    ];
    
    for (const test of tests) {
      const { data, error } = await supabaseService.client
        .from('__seo_gamme_conseil')
        .select('sgc_id, sgc_title')
        .eq('sgc_pg_id', test.value);
      
      console.log(`  ${test.label}: ${data?.length || 0} résultats`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

exploreConseilTable();
