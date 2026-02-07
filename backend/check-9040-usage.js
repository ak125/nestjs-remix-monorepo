const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Vérifier si type_id 9040 est déjà utilisé
  const { data: existing } = await supabase
    .from('__seo_keywords')
    .select('id, keyword, model, v_level, volume')
    .eq('type_id', 9040);

  console.log(`Keywords avec type_id 9040: ${existing?.length || 0}\n`);

  for (const kw of existing || []) {
    console.log(`  ${kw.v_level || 'NULL'} | vol=${kw.volume} | "${kw.keyword}"`);
  }

  if (!existing || existing.length === 0) {
    console.log('\n✅ type_id 9040 pas utilisé - correction possible!');
  } else {
    const hasV2 = existing.some(k => k.v_level === 'V2');
    if (hasV2) {
      console.log('\n⚠️ type_id 9040 déjà V2 - trigger bloquera!');
    } else {
      console.log('\n✅ type_id 9040 existe mais pas en V2 - correction possible');
    }
  }
}

check().catch(console.error);
