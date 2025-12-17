#!/usr/bin/env node
/**
 * Import gammes SEO metrics from CSV to Supabase
 * Run AFTER creating the gamme_seo_metrics table
 *
 * Usage: node scripts/import-gammes-seo-metrics.js
 */

require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CSV_FILE = '/opt/automecanik/app/backend/gammes_with_trends.csv';

async function importData() {
  console.log('═'.repeat(60));
  console.log('📥 IMPORT GAMMES SEO METRICS');
  console.log('═'.repeat(60));
  console.log('');

  // Check if table exists
  const { data: check, error: checkError } = await supabase
    .from('gamme_seo_metrics')
    .select('id')
    .limit(1);

  if (checkError && checkError.code === '42P01') {
    console.error('❌ Table gamme_seo_metrics n\'existe pas!');
    console.error('');
    console.error('Exécutez d\'abord le SQL dans Supabase:');
    console.error('  migrations/create_gamme_seo_metrics.sql');
    process.exit(1);
  }

  // Read CSV
  console.log('📖 Lecture du fichier CSV...');
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.split('\n').slice(1).filter(l => l.trim());

  console.log(`   ${lines.length} gammes trouvées`);
  console.log('');

  // Parse CSV and prepare data
  const records = [];

  for (const line of lines) {
    const parts = line.match(/"([^"]*)"|([^,]+)/g);
    if (!parts || parts.length < 9) continue;

    const pg_id = parseInt(parts[1]) || 0;
    const gamme = parts[2].replace(/"/g, '');
    const pg_level = parts[4];
    const pg_top = parts[5];
    const trends_index = parseInt(parts[8]) || 0;

    // Calculate recommendations
    const isNoindex = pg_level !== '1';
    const isG1 = pg_top === '1';

    let g_level_recommended = 'G3';
    if (trends_index >= 50) g_level_recommended = 'G1';
    else if (trends_index >= 20) g_level_recommended = 'G2';

    let action_recommended = null;
    if (isNoindex && trends_index >= 30) {
      action_recommended = 'PROMOUVOIR_INDEX';
    } else if (!isG1 && trends_index >= 50) {
      action_recommended = 'PROMOUVOIR_G1';
    } else if (isG1 && trends_index < 5) {
      action_recommended = 'VERIFIER_G1';
    }

    records.push({
      pg_id,
      trends_index,
      trends_updated_at: new Date().toISOString(),
      g_level_recommended,
      action_recommended
    });
  }

  console.log(`📊 ${records.length} enregistrements à importer`);
  console.log('');

  // Check existing records
  const { data: existing } = await supabase
    .from('gamme_seo_metrics')
    .select('pg_id');

  const existingIds = new Set((existing || []).map(e => e.pg_id));

  const toInsert = records.filter(r => !existingIds.has(r.pg_id));
  const toUpdate = records.filter(r => existingIds.has(r.pg_id));

  console.log(`   Nouveaux: ${toInsert.length}`);
  console.log(`   À mettre à jour: ${toUpdate.length}`);
  console.log('');

  // Insert new records
  if (toInsert.length > 0) {
    console.log('⏳ Insertion des nouveaux enregistrements...');

    // Insert in batches of 100
    for (let i = 0; i < toInsert.length; i += 100) {
      const batch = toInsert.slice(i, i + 100);
      const { error } = await supabase
        .from('gamme_seo_metrics')
        .insert(batch);

      if (error) {
        console.error(`❌ Erreur batch ${i}-${i + batch.length}:`, error.message);
      } else {
        process.stdout.write(`\r   Inséré: ${Math.min(i + 100, toInsert.length)}/${toInsert.length}`);
      }
    }
    console.log('\n✅ Insertions terminées');
  }

  // Update existing records
  if (toUpdate.length > 0) {
    console.log('⏳ Mise à jour des enregistrements existants...');

    for (let i = 0; i < toUpdate.length; i++) {
      const record = toUpdate[i];
      const { error } = await supabase
        .from('gamme_seo_metrics')
        .update({
          trends_index: record.trends_index,
          trends_updated_at: record.trends_updated_at,
          g_level_recommended: record.g_level_recommended,
          action_recommended: record.action_recommended
        })
        .eq('pg_id', record.pg_id);

      if (error) {
        console.error(`❌ Erreur update pg_id=${record.pg_id}:`, error.message);
      }

      if ((i + 1) % 50 === 0) {
        process.stdout.write(`\r   Mis à jour: ${i + 1}/${toUpdate.length}`);
      }
    }
    console.log('\n✅ Mises à jour terminées');
  }

  // Summary
  console.log('');
  console.log('═'.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('═'.repeat(60));

  const { data: stats } = await supabase
    .from('gamme_seo_metrics')
    .select('g_level_recommended, action_recommended');

  const byLevel = { G1: 0, G2: 0, G3: 0 };
  const byAction = {};

  (stats || []).forEach(s => {
    byLevel[s.g_level_recommended] = (byLevel[s.g_level_recommended] || 0) + 1;
    if (s.action_recommended) {
      byAction[s.action_recommended] = (byAction[s.action_recommended] || 0) + 1;
    }
  });

  console.log('');
  console.log('G-Level recommandé:');
  Object.keys(byLevel).forEach(k => {
    console.log(`  ${k}: ${byLevel[k]}`);
  });

  console.log('');
  console.log('Actions recommandées:');
  Object.keys(byAction).forEach(k => {
    console.log(`  ${k}: ${byAction[k]}`);
  });

  console.log('');
  console.log('✅ Import terminé!');
}

importData().catch(console.error);
