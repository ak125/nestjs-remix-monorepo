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
 * Import des données Agent 2 SEO Expert dans gamme_seo_metrics
 * Utilise les colonnes existantes + stocke extras dans user_notes (JSON)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function importAgent2Data() {
  console.log('📥 Import des données Agent 2 SEO Expert...');

  // Charger les données JSON
  const data = JSON.parse(fs.readFileSync('./gammes_seo_expert.json', 'utf8'));
  console.log(`📦 ${data.length} gammes à importer`);

  let updated = 0;
  let errors = 0;

  for (const item of data) {
    try {
      // Données supplémentaires Agent 2 stockées en JSON
      const agent2Data = {
        seo_score: item.seo_score || 0,
        serp_score: item.serp_score || 0,
        search_intent: item.search_intent || 'UNKNOWN',
        intent_confidence: item.intent_confidence || 0,
        competition_difficulty: item.competition_difficulty || 0,
        competition_level: item.competition_level || 'UNKNOWN',
        shopping_likely: item.shopping_likely || false,
        paa_count: item.paa_count || 0,
        commercial_value: item.commercial_value || 0,
        google_suggest_count: item.google_suggest_count || 0,
        analyzed_at: item.analyzed_at
      };

      // Mise à jour avec colonnes existantes + JSON pour extras
      const { error } = await supabase
        .from('gamme_seo_metrics')
        .upsert({
          pg_id: item.pg_id,
          trends_index: item.trends_index || 0,
          search_volume: item.seo_score || 0,  // Utiliser search_volume pour seo_score
          competition: item.competition_level || 'UNKNOWN',
          competition_index: item.competition_difficulty || 0,
          g_level_recommended: item.recommended_g_level || 'G3',
          action_recommended: item.action_recommended || null,
          user_notes: JSON.stringify(agent2Data),  // Données complètes Agent 2
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'pg_id'
        });

      if (error) {
        console.log(`   ❌ ${item.gamme}: ${error.message}`);
        errors++;
      } else {
        updated++;
        if (updated % 50 === 0) {
          console.log(`   ✅ ${updated}/${data.length} importées...`);
        }
      }
    } catch (err) {
      console.log(`   ❌ ${item.gamme}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n📊 Résumé:');
  console.log(`   ✅ Importées: ${updated}`);
  console.log(`   ❌ Erreurs: ${errors}`);

  // Vérifier un échantillon
  const { data: sample } = await supabase
    .from('gamme_seo_metrics')
    .select('pg_id, search_volume, competition, competition_index, g_level_recommended, user_notes')
    .gt('search_volume', 0)
    .limit(3);

  console.log('\n🔍 Échantillon importé:');
  sample?.forEach(s => {
    const extra = s.user_notes ? JSON.parse(s.user_notes) : {};
    console.log(`   pg_id=${s.pg_id}: SEO=${s.search_volume}, Competition=${s.competition}, Intent=${extra.search_intent}`);
  });

  console.log('\n✅ Import terminé!');
}

importAgent2Data().catch(console.error);
