const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const pgId = 7;

  // V2 with volume = 0 - this is wrong!
  console.log('=== V2 avec volume=0 (ANOMALIE) ===\n');
  const { data: v2Vol0 } = await supabase
    .from('__seo_keywords')
    .select('id, keyword, model, energy, volume, type_id')
    .eq('pg_id', pgId)
    .eq('v_level', 'V2')
    .eq('volume', 0)
    .limit(10);

  for (const r of v2Vol0 || []) {
    // Check if there's a higher volume keyword for same model+energy
    const { data: better } = await supabase
      .from('__seo_keywords')
      .select('keyword, volume, type_id, v_level')
      .eq('pg_id', pgId)
      .eq('model', r.model)
      .eq('energy', r.energy)
      .not('type_id', 'is', null)
      .gt('volume', 0)
      .order('volume', { ascending: false })
      .limit(3);

    console.log(`V2: "${r.keyword}" (vol: ${r.volume}, model: ${r.model}, energy: ${r.energy})`);
    if (better && better.length > 0) {
      console.log(`  ⚠️ Meilleurs candidats:`);
      for (const b of better) {
        console.log(`    - "${b.keyword}" vol=${b.volume} v_level=${b.v_level}`);
      }
    } else {
      console.log(`  ✓ Pas de meilleur candidat (ce model+energy n'a que volume=0)`);
    }
    console.log();
  }

  // NULL with type_id and volume > 0
  console.log('=== NULL avec type_id ET volume > 0 (devraient être V3) ===\n');
  const { data: nullWithVol } = await supabase
    .from('__seo_keywords')
    .select('id, keyword, model, energy, volume, type_id')
    .eq('pg_id', pgId)
    .is('v_level', null)
    .not('type_id', 'is', null)
    .gt('volume', 0)
    .order('volume', { ascending: false })
    .limit(10);

  console.log(`Total: checking first 10...`);
  for (const r of nullWithVol || []) {
    // Why is this NULL? Check if its type_id is in V2/V3
    const { data: existing } = await supabase
      .from('__seo_keywords')
      .select('keyword, v_level')
      .eq('pg_id', pgId)
      .eq('type_id', r.type_id)
      .not('v_level', 'is', null)
      .limit(1);

    console.log(`NULL: "${r.keyword}" (vol: ${r.volume}, type_id: ${r.type_id})`);
    if (existing && existing.length > 0) {
      console.log(`  → Bloqué: type_id déjà en ${existing[0].v_level} pour "${existing[0].keyword}"`);
    } else {
      console.log(`  → BUG: devrait être V3!`);
    }
  }
}

check().catch(console.error);
