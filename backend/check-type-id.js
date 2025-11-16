require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTypeId() {
  // Vérifier le type exact de type_id
  const { data: type } = await supabase
    .from('auto_type')
    .select('type_id')
    .limit(1)
    .single();
  
  console.log('📊 auto_type.type_id:');
  console.log('   Value:', type?.type_id);
  console.log('   Type:', typeof type?.type_id);
  console.log('   Is string number?', !isNaN(type?.type_id));
  
  // Vérifier modele_id
  const { data: modele } = await supabase
    .from('auto_modele')
    .select('modele_id')
    .limit(1)
    .single();
  
  console.log('\n📊 auto_modele.modele_id:');
  console.log('   Value:', modele?.modele_id);
  console.log('   Type:', typeof modele?.modele_id);
}

checkTypeId();
