const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testSimpleQuery() {
  console.log('🚀 Test requête pieces_relation_type AVEC LIMIT 5...');
  
  const { data, error } = await supabase
    .from('pieces_relation_type')
    .select('rtp_piece_id, rtp_type_id')
    .eq('rtp_type_id', 25)
    .limit(5);
    
  if (error) {
    console.log('❌ Erreur:', error.message);
  } else {
    console.log('✅ Données trouvées:', data.length);
    console.log('Échantillon:', data);
  }
}

testSimpleQuery();
