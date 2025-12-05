const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const marqueId = parseInt(process.argv[2]) || 140;
  
  console.log(`\n=== VÉRIFICATION BESTSELLERS MARQUE ${marqueId} ===\n`);
  
  // 1. Vérifier via RPC
  console.log('1. RÉSULTAT RPC get_brand_bestsellers_optimized:');
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_brand_bestsellers_optimized', {
    p_marque_id: marqueId,
    p_limit_vehicles: 6,
    p_limit_parts: 12
  });
  
  if (rpcError) {
    console.log('Erreur RPC:', rpcError);
  } else if (rpcData?.parts) {
    console.log(`\nPièces retournées (${rpcData.parts.length}):`);
    rpcData.parts.forEach((p, i) => {
      console.log(`  ${i+1}. pg_id:${p.pg_id} | ${p.pg_name} | marque:${p.marque_name} | modele:${p.modele_name || 'N/A'} | type:${p.type_name || 'N/A'}`);
    });
  }
  
  // 2. Vérifier directement dans __cross_gamme_car_new niveau 1
  console.log('\n2. DIRECT: __cross_gamme_car_new niveau 1 pour cette marque:');
  const { data: crossData, error: crossError } = await supabase
    .from('__cross_gamme_car_new')
    .select(`
      cgc_id,
      cgc_pg_id,
      cgc_type_id,
      cgc_level
    `)
    .eq('cgc_level', '1')
    .limit(50);
  
  if (crossError) {
    console.log('Erreur cross:', crossError);
  } else {
    console.log(`Entrées niveau 1 trouvées: ${crossData.length}`);
    
    // Récupérer les infos de gamme pour les premiers
    const pgIds = [...new Set(crossData.slice(0, 10).map(c => c.cgc_pg_id))];
    console.log('pg_ids échantillon:', pgIds);
    
    const { data: gammes } = await supabase
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_alias')
      .in('pg_id', pgIds.map(Number));
    
    console.log('\nGammes correspondantes:');
    gammes?.forEach(g => {
      console.log(`  pg_id:${g.pg_id} | ${g.pg_name}`);
    });
  }
  
  // 3. Vérifier si le filtrage par marque fonctionne
  console.log('\n3. TEST: Pièces niveau 1 avec jointure marque:');
  const { data: joinedData, error: joinedError } = await supabase
    .rpc('debug_level1_parts_for_brand', { p_marque_id: marqueId });
  
  if (joinedError) {
    console.log('RPC debug non disponible, requête manuelle...');
    
    // Faire une requête SQL directe
    const { data: sqlData, error: sqlError } = await supabase
      .from('__cross_gamme_car_new')
      .select(`
        cgc_pg_id,
        cgc_type_id,
        cgc_level
      `)
      .eq('cgc_level', '1')
      .limit(20);
    
    if (sqlData) {
      console.log(`Entrées brutes niveau 1: ${sqlData.length}`);
      sqlData.slice(0, 5).forEach(d => {
        console.log(`  cgc_pg_id: ${d.cgc_pg_id}, cgc_type_id: ${d.cgc_type_id}`);
      });
    }
  }
  
  console.log('\n=== FIN VÉRIFICATION ===\n');
}

check().catch(console.error);
