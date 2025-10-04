/**
 * Script pour vérifier les marques avec display = 1
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzQwODg2MywiZXhwIjoyMDM4OTg0ODYzfQ.ZgaPKeyUd5mq6hRdwLFhIgEtFJYx5FQ9AiS20LnCcTE';

const client = createClient(supabaseUrl, supabaseKey);

async function checkDisplay1() {
  console.log('🔍 Vérification des marques avec marque_display = 1\n');

  const { data, error } = await client
    .from('auto_marque')
    .select('marque_id, marque_name, marque_alias, marque_logo, marque_display')
    .eq('marque_display', 1)
    .order('marque_name', { ascending: true });

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log(`📊 Total marques avec display = 1 : ${data.length}\n`);
  console.log('Liste des marques :\n');

  data.forEach((m, index) => {
    const logo = m.marque_logo ? '✅' : '❌';
    console.log(`${(index + 1).toString().padStart(2, '0')}. ${logo} ${m.marque_name.padEnd(20)} (alias: ${m.marque_alias || 'N/A'})`);
  });

  console.log('\n\n🔍 Vérification si ABARTH existe dans la base :');
  const { data: abarth } = await client
    .from('auto_marque')
    .select('*')
    .ilike('marque_name', '%abarth%');
  
  if (abarth && abarth.length > 0) {
    console.log('✅ ABARTH trouvé :');
    console.log(JSON.stringify(abarth, null, 2));
  } else {
    console.log('❌ ABARTH non trouvé dans la base de données');
  }
}

checkDisplay1()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });
