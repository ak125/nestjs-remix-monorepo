const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function test() {
  // Test avec string '2'
  const { data: family1 } = await client
    .from('catalog_family')
    .select('mf_id, mf_name, mf_name_meta')
    .eq('mf_id', '2')
    .eq('mf_display', 1)
    .single();
  
  console.log('Recherche avec mf_id="2" (string):', family1);
  
  // Test avec number 2
  const { data: family2 } = await client
    .from('catalog_family')
    .select('mf_id, mf_name, mf_name_meta')
    .eq('mf_id', 2)
    .eq('mf_display', 1)
    .single();
  
  console.log('Recherche avec mf_id=2 (number):', family2);
}

test().then(() => process.exit(0));
