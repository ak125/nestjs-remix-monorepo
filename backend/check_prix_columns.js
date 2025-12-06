const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cxpojprgwgubzjyqzmoq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY'
);

async function checkColumns() {
  console.log('🔍 Vérification structure table __seo_gamme_car...\n');
  
  const { data: sample } = await supabase
    .from('__seo_gamme_car')
    .select('*')
    .limit(1);
  
  if (sample && sample.length > 0) {
    console.log('📋 Colonnes disponibles:', Object.keys(sample[0]).join(', '));
    console.log('');
  }
  
  const textColumns = ['sgc_h1', 'sgc_title', 'sgc_descrip', 'sgc_content'];
  
  for (const col of textColumns) {
    console.log(`🔍 Recherche #PrixPasCher# dans ${col}...`);
    
    const { data, error, count } = await supabase
      .from('__seo_gamme_car')
      .select(`sgc_pg_id, ${col}`, { count: 'exact' })
      .ilike(col, '%#PrixPasCher#%')
      .limit(5);
    
    if (error) {
      console.error(`❌ Erreur sur ${col}:`, error.message);
      continue;
    }
    
    if (data && data.length > 0) {
      console.log(`✅ TROUVÉ ${count} résultats dans ${col}:`);
      data.forEach((row, i) => {
        console.log(`  ${i+1}. pg_id=${row.sgc_pg_id}`);
        const text = row[col] || '';
        const index = text.toLowerCase().indexOf('#prixpascher#');
        if (index !== -1) {
          const start = Math.max(0, index - 50);
          const end = Math.min(text.length, index + 100);
          const preview = text.substring(start, end).replace(/\n/g, ' ');
          console.log(`     ...${preview}...`);
        }
      });
      console.log('');
    } else {
      console.log(`   ℹ️  Aucun résultat dans ${col}\n`);
    }
  }
}

checkColumns().catch(console.error);
