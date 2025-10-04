const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY1NDQzMDksImV4cCI6MjAyMjEyMDMwOX0.VUg7IKz5XZ9tZMhP-2CfGvwwP5A_1qx4K6nGWPHYl1M';

const client = createClient(supabaseUrl, supabaseKey);

async function testEngineLink() {
  console.log('🔍 Test 1: Échantillon de cars_engine');
  const { data: engines } = await client
    .from('cars_engine')
    .select('eng_id, eng_mfa_id, eng_code')
    .limit(5);
  console.log(engines);

  console.log('\n🔍 Test 2: Type Peugeot 207 1.4');
  const { data: type } = await client
    .from('auto_type')
    .select('type_id, type_name, type_power_ps')
    .eq('type_id', '19348')
    .single();
  console.log('Type:', type);

  console.log('\n🔍 Test 3: Chercher eng_mfa_id = type_id');
  const { data: engineMatch } = await client
    .from('cars_engine')
    .select('*')
    .eq('eng_mfa_id', '19348');
  console.log('Correspondance:', engineMatch);

  console.log('\n🔍 Test 4: Colonnes auto_type disponibles');
  const { data: typeColumns } = await client
    .from('auto_type')
    .select('*')
    .eq('type_id', '19348')
    .single();
  console.log('Colonnes:', Object.keys(typeColumns || {}));
}

testEngineLink().catch(console.error);
