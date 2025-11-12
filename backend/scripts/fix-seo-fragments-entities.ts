#!/usr/bin/env ts-node
/**
 * Script de correction des entités HTML dans __seo_family_gamme_car_switch
 * 
 * Ce script :
 * 1. Récupère toutes les lignes avec des entités HTML (&eacute;, &ocirc;, etc.)
 * 2. Décode les entités HTML en caractères UTF-8
 * 3. Met à jour la base de données
 * 
 * Usage: npm run fix:seo-entities
 * ou:    ts-node scripts/fix-seo-fragments-entities.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Charger les variables d'environnement
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ⚠️ Utiliser SERVICE_ROLE pour contourner RLS

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERREUR: Variables d\'environnement manquantes (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Décoder les entités HTML en caractères UTF-8
 */
function decodeHtmlEntities(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&eacute;': 'é', '&egrave;': 'è', '&ecirc;': 'ê', '&euml;': 'ë',
    '&agrave;': 'à', '&acirc;': 'â', '&auml;': 'ä',
    '&ocirc;': 'ô', '&ouml;': 'ö', '&ograve;': 'ò',
    '&icirc;': 'î', '&iuml;': 'ï', '&igrave;': 'ì',
    '&ucirc;': 'û', '&ugrave;': 'ù', '&uuml;': 'ü',
    '&ccedil;': 'ç', '&rsquo;': "'", '&lsquo;': "'",
    '&rdquo;': '"', '&ldquo;': '"', '&nbsp;': ' ',
    '&amp;': '&', '&lt;': '<', '&gt;': '>',
  };

  let decoded = text;
  Object.entries(htmlEntities).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  });

  return decoded;
}

async function main() {
  console.log('🚀 Démarrage de la correction des entités HTML...\n');

  // Étape 1: Récupérer toutes les lignes avec des entités HTML
  console.log('📥 Récupération des fragments corrompus...');
  const { data: fragments, error: fetchError } = await supabase
    .from('__seo_family_gamme_car_switch')
    .select('sfgcs_id, sfgcs_content, sfgcs_pg_id')
    .ilike('sfgcs_content', '%&%');

  if (fetchError) {
    console.error('❌ Erreur lors de la récupération:', fetchError);
    process.exit(1);
  }

  if (!fragments || fragments.length === 0) {
    console.log('✅ Aucune entité HTML à corriger !');
    return;
  }

  console.log(`📊 ${fragments.length} fragments à corriger\n`);

  // Étape 2: Afficher quelques exemples AVANT
  console.log('📝 Exemples AVANT correction:');
  fragments.slice(0, 5).forEach((frag, idx) => {
    console.log(`  ${idx + 1}. ID ${frag.sfgcs_id}: "${frag.sfgcs_content}"`);
  });
  console.log('');

  // Étape 3: Demander confirmation
  console.log('⚠️  ATTENTION: Cette opération va modifier la base de données !');
  console.log('   Appuyez sur Ctrl+C pour annuler, ou attendez 5 secondes...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Étape 4: Correction des fragments
  console.log('🔄 Correction en cours...');
  let successCount = 0;
  let errorCount = 0;

  for (const fragment of fragments) {
    const cleanedContent = decodeHtmlEntities(fragment.sfgcs_content);
    
    // Ne mettre à jour que si le contenu a changé
    if (cleanedContent !== fragment.sfgcs_content) {
      const { error: updateError } = await supabase
        .from('__seo_family_gamme_car_switch')
        .update({ sfgcs_content: cleanedContent })
        .eq('sfgcs_id', fragment.sfgcs_id);

      if (updateError) {
        console.error(`❌ Erreur pour ID ${fragment.sfgcs_id}:`, updateError.message);
        errorCount++;
      } else {
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`   ✅ ${successCount} fragments corrigés...`);
        }
      }
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('✅ CORRECTION TERMINÉE');
  console.log(`   • ${successCount} fragments corrigés`);
  console.log(`   • ${errorCount} erreurs`);
  console.log('═══════════════════════════════════════\n');

  // Étape 5: Vérification APRÈS
  console.log('🔍 Vérification finale...');
  const { data: remaining, error: checkError } = await supabase
    .from('__seo_family_gamme_car_switch')
    .select('sfgcs_id, sfgcs_content')
    .ilike('sfgcs_content', '%&%')
    .limit(5);

  if (checkError) {
    console.error('❌ Erreur lors de la vérification:', checkError);
    return;
  }

  if (remaining && remaining.length > 0) {
    console.log(`⚠️  Il reste ${remaining.length} fragments avec des entités HTML:`);
    remaining.forEach((frag) => {
      console.log(`   ID ${frag.sfgcs_id}: "${frag.sfgcs_content}"`);
    });
  } else {
    console.log('✅ Toutes les entités HTML ont été corrigées !');
  }

  // Étape 6: Statistiques finales
  const { count: totalCount } = await supabase
    .from('__seo_family_gamme_car_switch')
    .select('*', { count: 'exact', head: true });

  const { count: withVariables } = await supabase
    .from('__seo_family_gamme_car_switch')
    .select('*', { count: 'exact', head: true })
    .ilike('sfgcs_content', '%#VMarque#%');

  console.log('\n📊 Statistiques:');
  console.log(`   • Total de fragments: ${totalCount || 'N/A'}`);
  console.log(`   • Fragments avec variables (#VMarque#): ${withVariables || 'N/A'}`);
  console.log('');
}

main()
  .then(() => {
    console.log('🎉 Script terminé avec succès !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
