const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Vérification des ba_pg_id dans __blog_advice...\n');
  
  const { data, error } = await supabase
    .from('__blog_advice')
    .select('ba_id, ba_title, ba_pg_id, ba_alias')
    .order('ba_visit', { ascending: false })
    .limit(15);
  
  if (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
  
  console.log('📊 Top 15 articles les plus consultés:\n');
  data.forEach((a, i) => {
    console.log(`${i+1}. ba_pg_id: "${a.ba_pg_id}" | ba_alias: "${a.ba_alias}"`);
    console.log(`   Titre: ${a.ba_title?.substring(0, 60)}`);
    console.log('');
  });
  
  // Stats
  const total = data.length;
  const withPgId = data.filter(a => a.ba_pg_id && a.ba_pg_id !== null).length;
  const withoutPgId = total - withPgId;
  
  console.log(`\n📈 STATS:`);
  console.log(`   - Total: ${total}`);
  console.log(`   - Avec ba_pg_id: ${withPgId}`);
  console.log(`   - Sans ba_pg_id (NULL): ${withoutPgId}`);
  
  if (withPgId > 0) {
    const uniquePgIds = [...new Set(data.filter(a => a.ba_pg_id).map(a => String(a.ba_pg_id)))];
    console.log(`\n🔍 ba_pg_id uniques trouvés: ${uniquePgIds.join(', ')}`);
  }
  
  process.exit(0);
})();
