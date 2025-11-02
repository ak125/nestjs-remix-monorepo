require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function checkBreadcrumb() {
  console.log('🔍 Vérification de la table ___meta_tags_ariane...\n');
  
  // 1. Vérifier la structure
  const { data: sample, error: sampleError } = await supabase
    .from('___meta_tags_ariane')
    .select('*')
    .limit(3);
    
  if (sampleError) {
    console.error('❌ Erreur:', sampleError);
    return;
  }
  
  console.log('📊 Exemples de données (3 premières lignes):');
  console.log(JSON.stringify(sample, null, 2));
  
  // 2. Vérifier combien d'entrées ont un fil d'ariane
  const { count } = await supabase
    .from('___meta_tags_ariane')
    .select('*', { count: 'exact', head: true })
    .not('mta_ariane', 'is', null);
    
  console.log(`\n📈 Nombre d'entrées avec mta_ariane rempli: ${count}`);
  
  // 3. Chercher une entrée pour BMW
  const { data: bmwData } = await supabase
    .from('___meta_tags_ariane')
    .select('*')
    .ilike('mta_alias', '%bmw%')
    .limit(5);
    
  console.log('\n🚗 Exemples pour BMW:');
  console.log(JSON.stringify(bmwData, null, 2));
  
  process.exit(0);
}

checkBreadcrumb();
