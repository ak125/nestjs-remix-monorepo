const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function test() {
  console.log('\n📊 Testing __sitemap_p_link table...\n');
  
  // Compter total pieces
  const { count: totalPieces, error: e1 } = await supabase
    .from('__sitemap_p_link')
    .select('*', { count: 'exact', head: true });
  
  if (e1) {
    console.log('Error counting total:', e1.message);
    return;
  }
  
  // Compter pieces avec map_has_item > 0
  const { count: piecesAvailable, error: e2 } = await supabase
    .from('__sitemap_p_link')
    .select('*', { count: 'exact', head: true })
    .gt('map_has_item', 0);
  
  if (e2) {
    console.log('Error counting available:', e2.message);
    return;
  }
  
  // Test premier batch
  const { data: sample, error: e3 } = await supabase
    .from('__sitemap_p_link')
    .select('*')
    .gt('map_has_item', 0)
    .range(0, 4)
    .order('map_id');
  
  console.log('📊 __sitemap_p_link Statistics:');
  console.log('  Total rows:', totalPieces);
  console.log('  With items (map_has_item > 0):', piecesAvailable);
  console.log('  Shards needed (50k each):', Math.ceil(piecesAvailable / 50000));
  
  console.log('\n📄 Sample URLs (first 5):');
  if (sample && !e3) {
    sample.forEach(p => {
      const url = '/pieces/' + p.map_pg_alias + '-' + p.map_pg_id + '/' + 
                  p.map_marque_alias + '-' + p.map_marque_id + '/' +
                  p.map_modele_alias + '-' + p.map_modele_id + '/' +
                  p.map_type_alias + '-' + p.map_type_id + '.html';
      console.log('  ', url);
    });
  } else {
    console.log('  Error:', e3?.message);
  }
  
  console.log('\n✅ Test completed!');
}

test().catch(console.error);
