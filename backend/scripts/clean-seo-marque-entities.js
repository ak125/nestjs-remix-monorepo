#!/usr/bin/env node
/**
 * 🧹 Nettoyage direct des entités HTML dans __seo_marque
 * Utilise des UPDATE SQL directs via Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanHtmlEntities() {
  console.log('🧹 Nettoyage des entités HTML dans __seo_marque\n');

  try {
    // 1. Récupérer toutes les lignes
    console.log('📥 Récupération des données...');
    const { data: rows, error: fetchError } = await supabase
      .from('__seo_marque')
      .select('*');

    if (fetchError) {
      console.error('❌ Erreur fetch:', fetchError);
      return;
    }

    console.log(`✅ ${rows.length} lignes récupérées\n`);

    // 2. Nettoyer chaque ligne
    const entities = {
      '&nbsp;': ' ',
      '&eacute;': 'é',
      '&egrave;': 'è',
      '&ecirc;': 'ê',
      '&agrave;': 'à',
      '&acirc;': 'â',
      '&ccedil;': 'ç',
      '&ocirc;': 'ô',
      '&ucirc;': 'û',
      '&ugrave;': 'ù',
      '&icirc;': 'î',
      '&iuml;': 'ï',
      '&ouml;': 'ö',
      '&uuml;': 'ü',
      '&auml;': 'ä',
      '&Eacute;': 'É',
      '&Agrave;': 'À',
      '&Ccedil;': 'Ç',
    };

    const cleanText = (text) => {
      if (!text) return text;
      
      let cleaned = text;
      
      // Remplacer entités HTML
      Object.entries(entities).forEach(([entity, char]) => {
        cleaned = cleaned.split(entity).join(char);
      });
      
      // Ajouter espaces après </b> suivis d'une majuscule
      cleaned = cleaned.replace(/<\/b>([A-ZÉÀÈÊÂÔÛÙÎÏÄÖÜ])/g, '</b> $1');
      
      // Nettoyer espaces multiples
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      return cleaned;
    };

    let updated = 0;
    let errors = 0;

    for (const row of rows) {
      const needsUpdate = 
        (row.sm_title && row.sm_title.includes('&')) ||
        (row.sm_descrip && row.sm_descrip.includes('&')) ||
        (row.sm_h1 && row.sm_h1.includes('&')) ||
        (row.sm_content && (row.sm_content.includes('&') || row.sm_content.includes('</b>')));

      if (!needsUpdate) continue;

      const cleaned = {
        sm_title: cleanText(row.sm_title),
        sm_descrip: cleanText(row.sm_descrip),
        sm_h1: cleanText(row.sm_h1),
        sm_content: cleanText(row.sm_content),
      };

      console.log(`🔄 Mise à jour marque ID ${row.sm_marque_id}...`);
      
      const { error: updateError } = await supabase
        .from('__seo_marque')
        .update(cleaned)
        .eq('sm_id', row.sm_id);

      if (updateError) {
        console.error(`  ❌ Erreur: ${updateError.message}`);
        errors++;
      } else {
        console.log(`  ✅ Nettoyé`);
        updated++;
      }
    }

    console.log(`\n📊 Résumé:`);
    console.log(`  ✅ Mis à jour: ${updated}`);
    console.log(`  ❌ Erreurs: ${errors}`);
    console.log(`  ⏭️  Ignorés (déjà propres): ${rows.length - updated - errors}`);

    // 3. Vérification
    console.log(`\n🔍 Vérification...`);
    const { data: verified, error: verifyError } = await supabase
      .from('__seo_marque')
      .select('sm_marque_id, sm_title, sm_content')
      .limit(3);

    if (!verifyError && verified) {
      verified.forEach(row => {
        const hasEntities = row.sm_content?.includes('&');
        console.log(`\n  Marque ${row.sm_marque_id}:`);
        console.log(`    Title: ${row.sm_title?.substring(0, 60)}`);
        console.log(`    Status: ${hasEntities ? '⚠️ Entités restantes' : '✅ Propre'}`);
      });
    }

    console.log(`\n✅ Nettoyage terminé!`);
    console.log(`\n💡 Test: curl http://localhost:3000/api/brands/brand/renault | jq .data.seo\n`);

  } catch (err) {
    console.error('❌ Exception:', err.message);
    console.error(err);
  }
}

cleanHtmlEntities();
