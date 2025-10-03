const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cxpojprgwgubzjyqzmoq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1Ynp5cXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzU4NjY2OCwiZXhwIjoyMDQ5MTYyNjY4fQ.3tOckT2nqoOWHCGrJ5eRRUH7K6_Vg91nt4nt0fz13qk'
);

(async () => {
  const pg_id = '4'; // alternateur
  
  console.log('🔍 Recherche PEUGEOT 206 1.4 HDI dans la base...\n');
  
  // 1. Trouver le type_id de PEUGEOT 206 1.4 HDI
  const { data: types } = await supabase
    .from('auto_type')
    .select('type_id, type_name, type_modele_id, type_power')
    .ilike('type_name', '%1.4%HDI%')
    .limit(20);
  
  console.log('📋 Types correspondant à "1.4 HDI":');
  for (const t of types || []) {
    console.log(`  type_id=${t.type_id}, name="${t.type_name}", power=${t.type_power}ch, modele_id=${t.type_modele_id}`);
  }
  
  // 2. Trouver les modèles PEUGEOT 206
  const { data: modeles } = await supabase
    .from('auto_modele')
    .select('modele_id, modele_name, modele_marque_id')
    .ilike('modele_name', '%206%')
    .limit(10);
  
  console.log('\n📋 Modèles contenant "206":');
  for (const m of modeles || []) {
    console.log(`  modele_id=${m.modele_id}, name="${m.modele_name}", marque_id=${m.modele_marque_id}`);
  }
  
  // 3. Trouver PEUGEOT marque_id
  const { data: marques } = await supabase
    .from('auto_marque')
    .select('marque_id, marque_name')
    .ilike('marque_name', '%PEUGEOT%');
  
  console.log('\n📋 Marque PEUGEOT:');
  for (const m of marques || []) {
    console.log(`  marque_id=${m.marque_id}, name="${m.marque_name}"`);
  }
  
  // 4. Si on trouve PEUGEOT 206, chercher dans cross_gamme_car
  if (modeles && modeles.length > 0) {
    const modele206 = modeles.find(m => m.modele_name.includes('206'));
    if (modele206) {
      console.log(`\n🎯 Modèle PEUGEOT 206 trouvé: modele_id=${modele206.modele_id}`);
      
      // Chercher les types de ce modèle
      const { data: types206 } = await supabase
        .from('auto_type')
        .select('type_id, type_name, type_power, type_fuel')
        .eq('type_modele_id', modele206.modele_id)
        .ilike('type_name', '%1.4%')
        .limit(10);
      
      console.log('\n📋 Types PEUGEOT 206 1.4:');
      for (const t of types206 || []) {
        console.log(`  type_id=${t.type_id}, name="${t.type_name}", power=${t.type_power}ch, fuel=${t.type_fuel}`);
        
        // Chercher dans cross_gamme_car
        const { data: cross } = await supabase
          .from('__cross_gamme_car_new')
          .select('cgc_id, cgc_level')
          .eq('cgc_pg_id', pg_id)
          .eq('cgc_type_id', t.type_id.toString())
          .limit(5);
        
        if (cross && cross.length > 0) {
          console.log(`    ✅ Trouvé dans cross_gamme_car:`);
          for (const c of cross) {
            console.log(`       cgc_id=${c.cgc_id}, level=${c.cgc_level}`);
          }
        } else {
          console.log(`    ❌ Pas dans cross_gamme_car pour alternateur`);
        }
      }
    }
  }
})();
