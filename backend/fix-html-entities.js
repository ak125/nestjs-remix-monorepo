#!/usr/bin/env node
/**
 * Corrige les HTML entities dans les templates SEO
 * Exécuter: cd backend && node fix-html-entities.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fonction de décodage HTML entities
function decodeHtml(html) {
  if (!html) return html;
  return html
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/&acirc;/g, 'â')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&icirc;/g, 'î')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&ucirc;/g, 'û')
    .replace(/&uuml;/g, 'ü')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-');
}

async function fixHtmlEntities() {
  console.log('🔧 CORRECTION DES HTML ENTITIES');
  console.log('='.repeat(60));

  const { data: templates, error } = await supabase
    .from('__seo_gamme_car')
    .select('sgc_pg_id, sgc_h1, sgc_content, sgc_preview, sgc_descrip');

  if (error) {
    console.log('❌ Erreur:', error.message);
    return;
  }

  console.log('📊 Total templates:', templates.length);

  let fixed = 0;
  for (const t of templates) {
    const origContent = t.sgc_content || '';
    const origH1 = t.sgc_h1 || '';
    const origPreview = t.sgc_preview || '';
    const origDescrip = t.sgc_descrip || '';
    
    const newContent = decodeHtml(origContent);
    const newH1 = decodeHtml(origH1);
    const newPreview = decodeHtml(origPreview);
    const newDescrip = decodeHtml(origDescrip);
    
    if (newContent !== origContent || newH1 !== origH1 || newPreview !== origPreview || newDescrip !== origDescrip) {
      const { error: updateError } = await supabase
        .from('__seo_gamme_car')
        .update({ 
          sgc_content: newContent,
          sgc_h1: newH1,
          sgc_preview: newPreview,
          sgc_descrip: newDescrip
        })
        .eq('sgc_pg_id', t.sgc_pg_id);
      
      if (!updateError) {
        fixed++;
        if (fixed <= 10) console.log('✅ Corrigé pg_id=' + t.sgc_pg_id);
      } else {
        console.log('❌ Erreur pg_id=' + t.sgc_pg_id + ':', updateError.message);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Total corrigé:', fixed, 'templates');
}

fixHtmlEntities().then(() => process.exit(0)).catch(console.error);
