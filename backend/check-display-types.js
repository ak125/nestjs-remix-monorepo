require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDisplayTypes() {
  const { data: modele } = await supabase
    .from('auto_modele')
    .select('modele_display')
    .limit(1)
    .single();
  
  const { data: type } = await supabase
    .from('auto_type')
    .select('type_display')
    .limit(1)
    .single();
  
  console.log('📊 auto_modele.modele_display:');
  console.log('   Value:', modele?.modele_display);
  console.log('   Type:', typeof modele?.modele_display);
  
  console.log('\n📊 auto_type.type_display:');
  console.log('   Value:', type?.type_display);
  console.log('   Type:', typeof type?.type_display);
}

checkDisplayTypes();
