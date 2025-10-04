const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY1NDQzMDksImV4cCI6MjAyMjEyMDMwOX0.VUg7IKz5XZ9tZMhP-2CfGvwwP5A_1qx4K6nGWPHYl1M';

const client = createClient(supabaseUrl, supabaseKey);

async function explore() {
  console.log('🔍 Test 1: Récupérer un type_id de Peugeot 207');
  const { data: type207 } = await client
    .from('auto_type')
    .select('type_id, type_name, type_engine')
    .eq('type_modele_id', '19348')
    .limit(1)
    .single();
  console.log('Type 207:', type207);

  if (type207) {
    console.log('\n🔍 Test 2: Chercher dans cars_engine avec eng_mfa_id');
    const { data: engine1 } = await client
      .from('cars_engine')
      .select('*')
      .eq('eng_mfa_id', type207.type_id)
      .limit(1);
    console.log('Match par eng_mfa_id:', engine1);

    console.log('\n🔍 Test 3: Exemples de cars_engine');
    const { data: samples } = await client
      .from('cars_engine')
      .select('eng_id, eng_mfa_id, eng_code')
      .limit(10);
    console.log('Échantillons:', samples);
  }
}

explore().catch(console.error);
