import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

const client = createClient(supabaseUrl, supabaseKey);

async function testSeoFragments() {
  console.log('🔍 Test des fragments SEO pour pg_id=402 (Plaquette de frein)...\n');
  
  const { data, error } = await client
    .from('__seo_family_gamme_car_switch')
    .select('sfgcs_id, sfgcs_content, sfgcs_pg_id')
    .eq('sfgcs_pg_id', '402')
    .limit(5);
  
  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }
  
  console.log(`✅ ${data?.length || 0} fragments trouvés\n`);
  
  data?.forEach((fragment, index) => {
    console.log(`📝 Fragment #${index + 1} (ID: ${fragment.sfgcs_id}):`);
    console.log(`   Contenu brut: ${fragment.sfgcs_content}`);
    console.log(`   Contient des entités HTML: ${fragment.sfgcs_content.includes('&') ? '✅ OUI' : '❌ NON'}`);
    console.log(`   Variables: ${fragment.sfgcs_content.includes('#') ? fragment.sfgcs_content.match(/#[^#]+#/g) : 'Aucune'}`);
    console.log('');
  });
}

testSeoFragments().then(() => process.exit(0)).catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
