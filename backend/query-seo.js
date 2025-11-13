const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function test() {
  // Test avec les IDs du catalogue de freinage
  const testIds = ['54', '70', '73', '78', '82']; // vis de disque, mâchoires, répartiteur, étrier, disque
  
  const { data, error } = await client
    .from('__seo_gamme')
    .select('sg_pg_id, sg_title, sg_descrip')
    .in('sg_pg_id', testIds)
    .limit(10);
  
  console.log('Résultats:', JSON.stringify(data, null, 2));
  console.log('Erreur:', error);
  console.log('Nombre de résultats:', data?.length || 0);
}

test().then(() => process.exit(0));
