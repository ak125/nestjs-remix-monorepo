const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cxpojprgwgubzjyqzmoq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY'
);

async function checkSeoMarque() {
  console.log('🔍 Vérification table __SEO_MARQUE...\n');
  
  const { data, error, count } = await supabase
    .from('__seo_marque')
    .select('*', { count: 'exact' })
    .limit(5);
  
  if (error) {
    if (error.code === '42P01') {
      console.log('❌ Table __seo_marque n\'existe PAS');
      console.log('   → Cette table n\'est pas dans la base de données');
      console.log('   → Switches marque probablement dans __seo_item_switch\n');
    } else if (error.code === '42501') {
      console.log('⚠️  Table existe mais accès refusé (RLS)');
    } else {
      console.log('❌ Erreur:', error.code, '-', error.message);
    }
    return;
  }
  
  if (data && data.length > 0) {
    console.log(`✅ Table __seo_marque existe avec ${count} lignes`);
    console.log('\n📋 Colonnes:', Object.keys(data[0]).join(', '));
    console.log('\n📝 Échantillon:');
    data.forEach((row, i) => {
      console.log(`  ${i+1}.`, JSON.stringify(row, null, 2).substring(0, 200));
    });
  } else {
    console.log('✅ Table __seo_marque existe mais est VIDE (0 lignes)');
  }
}

checkSeoMarque().catch(console.error);
