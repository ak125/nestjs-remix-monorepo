const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function countAllUrls() {
  console.log('\n📊 COMPTAGE TOTAL DES URLS SITEMAP V2\n');
  console.log('=' .repeat(60));
  
  let totalUrls = 0;
  
  // 1. Constructeurs (chargement complet + filtrage JS)
  const { data: allMarques } = await supabase
    .from('auto_marque')
    .select('marque_id, marque_display, marque_relfollow');
  
  const constructeurs = (allMarques || []).filter(m => 
    (m.marque_display === 1 || m.marque_display === '1' || m.marque_display === true)
  ).length;
  
  console.log(`🚗 Constructeurs: ${constructeurs}`);
  totalUrls += constructeurs;
  
  // 2. Modèles (avec relfollow)
  const { data: allModeles } = await supabase
    .from('auto_modele')
    .select('modele_id, modele_display, modele_relfollow');
  
  const modeles = (allModeles || []).filter(m => 
    (m.modele_display === 1 || m.modele_display === '1' || m.modele_display === true) &&
    (m.modele_relfollow === 1 || m.modele_relfollow === '1' || m.modele_relfollow === true || m.modele_relfollow === null)
  ).length;
  
  console.log(`🚙 Modèles: ${modeles}`);
  totalUrls += modeles;
  
  // 3. Types (avec relfollow=1 OU null - AMÉLIORATION)
  const { data: allTypes } = await supabase
    .from('auto_type')
    .select('type_id, type_display, type_relfollow');
  
  const typesWithRelfollow1 = (allTypes || []).filter(t => 
    (t.type_display === 1 || t.type_display === '1' || t.type_display === true) &&
    (t.type_relfollow === 1 || t.type_relfollow === '1' || t.type_relfollow === true)
  ).length;
  
  const typesWithRelfollowNull = (allTypes || []).filter(t => 
    (t.type_display === 1 || t.type_display === '1' || t.type_display === true) &&
    (t.type_relfollow === null)
  ).length;
  
  const types = typesWithRelfollow1 + typesWithRelfollowNull;
  
  console.log(`🏎️  Types: ${types} (relfollow=1: ${typesWithRelfollow1}, relfollow=null: ${typesWithRelfollowNull})`);
  totalUrls += types;
  
  // 4. Gammes produits (tous niveaux)
  const { data: allGammes } = await supabase
    .from('pieces_gamme')
    .select('pg_id, pg_display, pg_relfollow, pg_level');
  
  const niveau1 = (allGammes || []).filter(g =>
    (g.pg_display === 1 || g.pg_display === '1' || g.pg_display === true) &&
    (g.pg_level === 1 || g.pg_level === '1') &&
    (g.pg_relfollow === 1 || g.pg_relfollow === '1' || g.pg_relfollow === true || g.pg_relfollow === null)
  ).length;
  
  const niveau2 = (allGammes || []).filter(g =>
    (g.pg_display === 1 || g.pg_display === '1' || g.pg_display === true) &&
    (g.pg_level === 2 || g.pg_level === '2') &&
    (g.pg_relfollow === 1 || g.pg_relfollow === '1' || g.pg_relfollow === true || g.pg_relfollow === null)
  ).length;
  
  console.log(`📦 Gammes niveau 1: ${niveau1}`);
  console.log(`📦 Gammes niveau 2: ${niveau2}`);
  totalUrls += niveau1 + niveau2;
  
  // 5. PIÈCES depuis __sitemap_p_link (NOUVEAU!)
  const { count: pieces } = await supabase
    .from('__sitemap_p_link')
    .select('*', { count: 'exact', head: true })
    .gt('map_has_item', 0);
  
  console.log(`🔗 Pièces détaillées (avec stock): ${pieces}`);
  totalUrls += pieces || 0;
  
  // 6. Blog (conseils + guides)
  const { count: conseils } = await supabase
    .from('blog_advice')
    .select('*', { count: 'exact', head: true });
  
  const { count: guides } = await supabase
    .from('blog_guide')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📝 Blog conseils: ${conseils || 0}`);
  console.log(`📚 Blog guides: ${guides || 0}`);
  totalUrls += (conseils || 0) + (guides || 0);
  
  // Pages statiques (homepage, products, constructeurs, support)
  const staticPages = 4;
  console.log(`📄 Pages statiques: ${staticPages}`);
  totalUrls += staticPages;
  
  // Résumé
  console.log('=' .repeat(60));
  console.log(`\n🎯 TOTAL URLs SITEMAP V2: ${totalUrls.toLocaleString()}`);
  console.log(`   Shards pièces nécessaires: ${Math.ceil((pieces || 0) / 50000)}`);
  
  // Comparaison avant/après
  const ancienTotal = 18121; // Avant amélioration
  const gain = totalUrls - ancienTotal;
  const gainPct = ((gain / ancienTotal) * 100).toFixed(1);
  
  console.log(`\n📈 AMÉLIORATION:`);
  console.log(`   Avant: ${ancienTotal.toLocaleString()} URLs`);
  console.log(`   Après: ${totalUrls.toLocaleString()} URLs`);
  console.log(`   Gain: +${gain.toLocaleString()} URLs (+${gainPct}%)`);
}

countAllUrls().catch(console.error);
