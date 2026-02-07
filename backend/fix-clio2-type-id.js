const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  console.log('=== Corriger les type_id Clio II ===\n');

  // 1. Trouver les keywords Clio II avec mauvais type_id
  const { data: wrongKeywords } = await supabase
    .from('__seo_keywords')
    .select('id, keyword, model, variant, energy, type_id, v_level')
    .eq('pg_id', 7)
    .ilike('model', 'clio ii')
    .eq('type_id', 2128);  // Mauvais type_id (Clio I)

  console.log(`Keywords Clio II avec type_id=2128 (Clio I): ${wrongKeywords?.length || 0}\n`);

  for (const kw of (wrongKeywords || []).slice(0, 5)) {
    console.log(`  - "${kw.keyword}" (variant: ${kw.variant}, energy: ${kw.energy})`);
  }

  // 2. Chercher le bon type_id pour Clio II 1.2 essence
  // D'après la recherche: type_id 9040 = CLIO II 1.2 Essence
  const correctTypeId = 9040;

  console.log(`\nType_id correct: ${correctTypeId} (CLIO II 1.2 Essence)`);

  // 3. Compter combien seraient affectés
  const { data: toFix } = await supabase
    .from('__seo_keywords')
    .select('id')
    .eq('pg_id', 7)
    .ilike('model', 'clio ii')
    .eq('type_id', 2128)
    .ilike('variant', '%1.2%');

  console.log(`\nKeywords à corriger (Clio II 1.2 avec type_id=2128): ${toFix?.length || 0}`);

  // 4. Dry run - montrer ce qui serait fait
  console.log('\n=== DRY RUN - pas de modification ===');
  console.log(`UPDATE __seo_keywords SET type_id = ${correctTypeId}`);
  console.log(`WHERE pg_id = 7 AND model ILIKE 'clio ii' AND type_id = 2128 AND variant ILIKE '%1.2%'`);
}

fix().catch(console.error);
