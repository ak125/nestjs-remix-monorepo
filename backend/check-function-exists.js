const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFunction() {
  console.log('🔍 Vérification de la fonction dans le schéma PostgreSQL...\n');
  
  // Requête pour vérifier si la fonction existe
  const { data, error } = await supabase
    .from('pg_proc')
    .select('proname, prosrc')
    .eq('proname', 'get_gamme_page_data_optimized')
    .single();
    
  if (error) {
    console.log('❌ Erreur:', error.message);
    console.log('\n📋 La fonction n\'existe probablement pas encore.');
    console.log('⚠️  Veuillez exécuter le SQL dans Supabase Studio\n');
    return;
  }
  
  if (data && data.prosrc) {
    const hasCorrectConversion = data.prosrc.includes('mc_pg_id::INTEGER = p_pg_id');
    const hasOldConversion = data.prosrc.includes('p_pg_id::TEXT');
    
    console.log('✅ Fonction trouvée!');
    console.log('📊 Analyse du code source:');
    console.log(`   - Utilise mc_pg_id::INTEGER = p_pg_id: ${hasCorrectConversion ? '✅ OUI' : '❌ NON'}`);
    console.log(`   - Utilise p_pg_id::TEXT (ancien): ${hasOldConversion ? '⚠️  OUI (PROBLÈME!)' : '✅ NON'}`);
    
    if (hasCorrectConversion && !hasOldConversion) {
      console.log('\n🎉 La fonction est CORRECTEMENT déployée!');
      console.log('💡 Si l\'erreur persiste, c\'est un problème de cache Supabase.');
      console.log('   Attendez 1-2 minutes ou redémarrez le serveur NestJS.\n');
    } else if (hasOldConversion) {
      console.log('\n❌ La fonction contient ENCORE l\'ancienne version!');
      console.log('⚠️  Vous devez réexécuter le SQL de mise à jour.\n');
    }
  }
}

checkFunction();
