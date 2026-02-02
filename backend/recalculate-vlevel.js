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
 * Recalculate V-Level for a gamme (pg_id)
 *
 * Usage: node recalculate-vlevel.js <pg_id>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Reset V-Levels in batches to avoid timeout
 */
async function resetVLevelsInBatches(pgId) {
  const BATCH_SIZE = 500;
  let totalReset = 0;
  let hasMore = true;

  while (hasMore) {
    // Get IDs with v_level set
    const { data: batch, error: fetchError } = await supabase
      .from('__seo_keywords')
      .select('id')
      .eq('pg_id', pgId)
      .not('v_level', 'is', null)
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching batch:', fetchError.message);
      return totalReset;
    }

    if (!batch || batch.length === 0) {
      hasMore = false;
      continue;
    }

    const ids = batch.map(r => r.id);
    const { error: updateError } = await supabase
      .from('__seo_keywords')
      .update({ v_level: null })
      .in('id', ids);

    if (updateError) {
      console.error('Error updating batch:', updateError.message);
      return totalReset;
    }

    totalReset += ids.length;
    console.log(`  Reset ${totalReset} keywords...`);
  }

  return totalReset;
}

async function recalculateVLevel(pgId) {
  console.log(`\n=== Recalculating V-Level for pg_id=${pgId} ===\n`);

  // 1. Reset V-Levels pour cette gamme (in batches)
  console.log('Step 1: Resetting V-Levels (batched)...');
  const resetCount = await resetVLevelsInBatches(pgId);
  console.log(`  Total reset: ${resetCount}\n`);

  // 2. Get all unique models
  console.log('Step 2: Getting unique models...');
  const { data: models, error: modelError } = await supabase
    .from('__seo_keywords')
    .select('model')
    .eq('pg_id', pgId)
    .not('model', 'is', null);

  if (modelError) {
    console.error('Error fetching models:', modelError.message);
    return;
  }

  const uniqueModels = [...new Set(models?.map(m => m.model) || [])];
  console.log(`  Found ${uniqueModels.length} unique models\n`);

  // 3. Assign V2 for each model+energy
  console.log('Step 3: Assigning V2 (champion by model+energy with type_id)...');
  let v2Count = 0;
  const v2TypeIds = [];

  for (const model of uniqueModels) {
    for (const energy of ['diesel', 'essence']) {
      // V2 = Champion (TOP 1 by volume with type_id)
      const { data: champion, error: champError } = await supabase
        .from('__seo_keywords')
        .select('id, keyword, type_id, volume')
        .eq('pg_id', pgId)
        .eq('model', model)
        .eq('energy', energy)
        .not('type_id', 'is', null)
        .order('volume', { ascending: false, nullsFirst: false })
        .limit(1)
        .single();

      if (champError && champError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (not an error)
        continue;
      }

      if (champion) {
        await supabase
          .from('__seo_keywords')
          .update({ v_level: 'V2' })
          .eq('id', champion.id);

        v2TypeIds.push(champion.type_id);
        v2Count++;

        if (v2Count <= 20) {
          console.log(`  V2: "${champion.keyword}" (vol: ${champion.volume}, type_id: ${champion.type_id})`);
        }
      }
    }
  }
  console.log(`\n  Total V2 assigned: ${v2Count}\n`);

  // 4. V3 = Others with type_id AND volume > 0 (excluding V2 type_ids) - in batches
  console.log('Step 4: Assigning V3 (type_id + volume > 0, not V2)...');
  let v3Count = 0;
  let hasMoreV3 = true;

  while (hasMoreV3) {
    let query = supabase
      .from('__seo_keywords')
      .select('id')
      .eq('pg_id', pgId)
      .is('v_level', null)
      .not('type_id', 'is', null)
      .gt('volume', 0)
      .limit(500);

    if (v2TypeIds.length > 0) {
      query = query.not('type_id', 'in', `(${v2TypeIds.join(',')})`);
    }

    const { data: batch } = await query;

    if (!batch || batch.length === 0) {
      hasMoreV3 = false;
      continue;
    }

    const ids = batch.map(r => r.id);
    await supabase.from('__seo_keywords').update({ v_level: 'V3' }).in('id', ids);
    v3Count += ids.length;
    console.log(`  V3 assigned: ${v3Count}...`);
  }
  console.log(`  Total V3 assigned: ${v3Count}\n`);

  // 5. V4 = Remaining with type_id (volume = 0 or NULL) - in batches
  console.log('Step 5: Assigning V4 (type_id, volume = 0)...');
  let v4Count = 0;
  let hasMoreV4 = true;

  while (hasMoreV4) {
    const { data: batch } = await supabase
      .from('__seo_keywords')
      .select('id')
      .eq('pg_id', pgId)
      .is('v_level', null)
      .not('type_id', 'is', null)
      .limit(500);

    if (!batch || batch.length === 0) {
      hasMoreV4 = false;
      continue;
    }

    const ids = batch.map(r => r.id);
    await supabase.from('__seo_keywords').update({ v_level: 'V4' }).in('id', ids);
    v4Count += ids.length;
    console.log(`  V4 assigned: ${v4Count}...`);
  }
  console.log(`  Total V4 assigned: ${v4Count}\n`);

  // 6. Summary
  console.log('=== SUMMARY ===');
  console.log(`V2 (champions):     ${v2Count}`);
  console.log(`V3 (secondaires):   ${v3Count}`);
  console.log(`V4 (sans demande):  ${v4Count}`);
  console.log(`NULL (sans type_id): remaining\n`);

  // 7. Verify distribution
  console.log('=== VERIFICATION ===');
  const { data: stats } = await supabase
    .from('__seo_keywords')
    .select('v_level, type_id')
    .eq('pg_id', pgId);

  const distribution = {};
  for (const row of stats || []) {
    const level = row.v_level || 'NULL';
    if (!distribution[level]) {
      distribution[level] = { total: 0, with_type_id: 0 };
    }
    distribution[level].total++;
    if (row.type_id) {
      distribution[level].with_type_id++;
    }
  }

  console.log('V-Level | Total | With type_id');
  console.log('--------|-------|-------------');
  for (const [level, data] of Object.entries(distribution).sort()) {
    console.log(`${level.padEnd(7)} | ${String(data.total).padEnd(5)} | ${data.with_type_id}`);
  }
}

const pgId = parseInt(process.argv[2], 10);
if (!pgId) {
  console.log('Usage: node recalculate-vlevel.js <pg_id>');
  process.exit(1);
}

recalculateVLevel(pgId).catch(console.error);
