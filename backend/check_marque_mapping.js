const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMapping() {
  console.log('🔍 Vérification mapping marque_id...\n');
  
  // 1. Renault dans auto_marque
  const { data: renault } = await supabase
    .from('auto_marque')
    .select('marque_id, marque_alias, marque_name')
    .eq('marque_alias', 'renault')
    .single();
  
  console.log('✅ Renault dans auto_marque:');
  console.log('   marque_id:', renault.marque_id);
  console.log('   marque_alias:', renault.marque_alias);
  console.log('   marque_name:', renault.marque_name);
  
  // 2. Chercher dans __seo_marque avec ce marque_id
  const { data: seoData, error } = await supabase
    .from('__seo_marque')
    .select('*')
    .eq('sm_marque_id', renault.marque_id);
  
  console.log('\n📋 Données SEO pour marque_id', renault.marque_id, ':');
  if (error) {
    console.log('   ❌ Erreur:', error.message);
  } else if (!seoData || seoData.length === 0) {
    console.log('   ⚠️  Aucune donnée SEO trouvée');
    
    // Lister tous les sm_marque_id disponibles
    const { data: allSeo } = await supabase
      .from('__seo_marque')
      .select('sm_marque_id, sm_title')
      .order('sm_marque_id');
    
    console.log('\n📝 IDs disponibles dans __seo_marque:');
    allSeo.slice(0, 10).forEach(row => {
      console.log(`   - sm_marque_id: ${row.sm_marque_id} | ${row.sm_title.substring(0, 50)}`);
    });
  } else {
    console.log('   ✅ Trouvé:', seoData.length, 'ligne(s)');
    console.log('   Title:', seoData[0].sm_title);
  }
}

checkMapping().catch(console.error);
