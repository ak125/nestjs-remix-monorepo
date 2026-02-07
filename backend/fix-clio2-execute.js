const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  console.log('=== Correction type_id Clio II ===\n');

  // Étape 1: Corriger type_id 2128 → 9040 pour Clio II 1.2
  console.log('Étape 1: UPDATE type_id 2128 → 9040 pour Clio II...');

  const { data: updated, error: updateError } = await supabase
    .from('__seo_keywords')
    .update({ type_id: 9040 })
    .eq('pg_id', 7)
    .ilike('model', 'clio ii')
    .eq('type_id', 2128)
    .select('id, keyword');

  if (updateError) {
    console.error('Erreur UPDATE:', updateError.message);
    return;
  }

  console.log(`  ✅ ${updated?.length || 0} keywords corrigés:`);
  for (const kw of updated || []) {
    console.log(`    - "${kw.keyword}"`);
  }

  // Étape 2: Reset v_level pour ces keywords
  console.log('\nÉtape 2: Reset v_level pour type_id 9040...');

  const { data: resetData, error: resetError } = await supabase
    .from('__seo_keywords')
    .update({ v_level: null })
    .eq('type_id', 9040)
    .select('id');

  if (resetError) {
    console.error('Erreur RESET:', resetError.message);
    return;
  }

  console.log(`  ✅ ${resetData?.length || 0} keywords reset`);

  // Vérification finale
  console.log('\nVérification:');
  const { data: check } = await supabase
    .from('__seo_keywords')
    .select('keyword, type_id, v_level, volume, model')
    .eq('type_id', 9040);

  for (const kw of check || []) {
    console.log(`  type_id=${kw.type_id} | v_level=${kw.v_level} | vol=${kw.volume} | "${kw.keyword}"`);
  }
}

fix().catch(console.error);
