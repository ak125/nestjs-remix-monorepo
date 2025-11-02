import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

async function testSupabaseConnection() {
  console.log('🔍 Test de connexion Supabase avec service_role_key');
  console.log('=' .repeat(60));
  
  // Test 1: Client Supabase avec configuration par défaut
  console.log('\n📊 TEST 1: Client Supabase (config par défaut)');
  const client1 = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  
  const { data: data1, error: error1 } = await client1
    .from('catalog_family')
    .select('mf_id, mf_name')
    .eq('mf_display', '1')
    .limit(3);
  
  if (error1) {
    console.error('❌ Erreur:', JSON.stringify(error1, null, 2));
  } else {
    console.log(`✅ Succès: ${data1?.length || 0} familles récupérées`);
    console.log(JSON.stringify(data1, null, 2));
  }
  
  // Test 2: Client Supabase avec db.schema
  console.log('\n📊 TEST 2: Client Supabase (avec db.schema)');
  const client2 = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
  });
  
  const { data: data2, error: error2 } = await client2
    .from('catalog_family')
    .select('mf_id, mf_name')
    .eq('mf_display', '1')
    .limit(3);
  
  if (error2) {
    console.error('❌ Erreur:', JSON.stringify(error2, null, 2));
  } else {
    console.log(`✅ Succès: ${data2?.length || 0} familles récupérées`);
    console.log(JSON.stringify(data2, null, 2));
  }
  
  // Test 3: Vérifier la table pieces_relation_type
  console.log('\n📊 TEST 3: Table pieces_relation_type (type_id 100413)');
  const { data: data3, error: error3 } = await client2
    .from('pieces_relation_type')
    .select('count')
    .eq('rtp_type_id', 100413)
    .limit(1);
  
  if (error3) {
    console.error('❌ Erreur:', JSON.stringify(error3, null, 2));
  } else {
    console.log(`✅ Succès: Résultat =`, data3);
  }
  
  console.log('\n' + '='.repeat(60));
}

testSupabaseConnection()
  .then(() => {
    console.log('\n✅ Tests terminés');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
