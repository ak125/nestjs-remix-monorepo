const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function deepAnalysis() {
  console.log('\n🔍 ANALYSE APPROFONDIE DES DONNÉES SITEMAP\n');
  console.log('=' .repeat(70));
  
  // 1. Analyse CONSTRUCTEURS
  console.log('\n📊 AUTO_MARQUE (Constructeurs):');
  const { data: marques, count: totalMarques } = await supabase
    .from('auto_marque')
    .select('*', { count: 'exact' });
  
  const marqueStats = {
    total: totalMarques,
    display1: marques.filter(m => m.marque_display === 1 || m.marque_display === '1').length,
    display0: marques.filter(m => m.marque_display === 0 || m.marque_display === '0').length,
    displayNull: marques.filter(m => m.marque_display === null).length,
    relfollow1: marques.filter(m => m.marque_relfollow === 1 || m.marque_relfollow === '1').length,
    relfollowNull: marques.filter(m => m.marque_relfollow === null).length,
    relfollow0: marques.filter(m => m.marque_relfollow === 0 || m.marque_relfollow === '0').length,
  };
  console.log('  Total:', marqueStats.total);
  console.log('  display=1:', marqueStats.display1, '| display=0:', marqueStats.display0, '| display=null:', marqueStats.displayNull);
  console.log('  relfollow=1:', marqueStats.relfollow1, '| relfollow=null:', marqueStats.relfollowNull, '| relfollow=0:', marqueStats.relfollow0);
  
  // 2. Analyse MODÈLES
  console.log('\n📊 AUTO_MODELE (Modèles):');
  const { count: totalModeles } = await supabase.from('auto_modele').select('*', { count: 'exact', head: true });
  
  // Charger par batches pour analyse
  let allModeles = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase.from('auto_modele')
      .select('modele_display, modele_relfollow')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allModeles.push(...data);
    offset += 1000;
  }
  
  const modeleStats = {
    total: totalModeles,
    display1: allModeles.filter(m => m.modele_display === 1 || m.modele_display === '1').length,
    display0: allModeles.filter(m => m.modele_display === 0 || m.modele_display === '0').length,
    displayNull: allModeles.filter(m => m.modele_display === null).length,
    relfollow1: allModeles.filter(m => m.modele_relfollow === 1 || m.modele_relfollow === '1').length,
    relfollowNull: allModeles.filter(m => m.modele_relfollow === null).length,
    relfollow0: allModeles.filter(m => m.modele_relfollow === 0 || m.modele_relfollow === '0').length,
  };
  console.log('  Total:', modeleStats.total);
  console.log('  display=1:', modeleStats.display1, '| display=0:', modeleStats.display0, '| display=null:', modeleStats.displayNull);
  console.log('  relfollow=1:', modeleStats.relfollow1, '| relfollow=null:', modeleStats.relfollowNull, '| relfollow=0:', modeleStats.relfollow0);
  
  // Combinaisons pour modèles
  const modelesActifs = allModeles.filter(m => 
    (m.modele_display === 1 || m.modele_display === '1') &&
    (m.modele_relfollow === 1 || m.modele_relfollow === '1' || m.modele_relfollow === null)
  ).length;
  const modelesDisplayOnly = allModeles.filter(m => m.modele_display === 1 || m.modele_display === '1').length;
  console.log('  → Avec display=1 uniquement:', modelesDisplayOnly);
  console.log('  → Avec display=1 ET (relfollow=1 OU null):', modelesActifs);
  
  // 3. Analyse TYPES
  console.log('\n📊 AUTO_TYPE (Types/Motorisations):');
  const { count: totalTypes } = await supabase.from('auto_type').select('*', { count: 'exact', head: true });
  
  let allTypes = [];
  offset = 0;
  while (true) {
    const { data } = await supabase.from('auto_type')
      .select('type_display, type_relfollow')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allTypes.push(...data);
    offset += 1000;
  }
  
  const typeStats = {
    total: totalTypes,
    display1: allTypes.filter(t => t.type_display === 1 || t.type_display === '1').length,
    display0: allTypes.filter(t => t.type_display === 0 || t.type_display === '0').length,
    displayNull: allTypes.filter(t => t.type_display === null).length,
    relfollow1: allTypes.filter(t => t.type_relfollow === 1 || t.type_relfollow === '1').length,
    relfollowNull: allTypes.filter(t => t.type_relfollow === null).length,
    relfollow0: allTypes.filter(t => t.type_relfollow === 0 || t.type_relfollow === '0').length,
  };
  console.log('  Total:', typeStats.total);
  console.log('  display=1:', typeStats.display1, '| display=0:', typeStats.display0, '| display=null:', typeStats.displayNull);
  console.log('  relfollow=1:', typeStats.relfollow1, '| relfollow=null:', typeStats.relfollowNull, '| relfollow=0:', typeStats.relfollow0);
  
  const typesActifs = allTypes.filter(t => 
    (t.type_display === 1 || t.type_display === '1') &&
    (t.type_relfollow === 1 || t.type_relfollow === '1' || t.type_relfollow === null)
  ).length;
  const typesDisplayOnly = allTypes.filter(t => t.type_display === 1 || t.type_display === '1').length;
  console.log('  → Avec display=1 uniquement:', typesDisplayOnly);
  console.log('  → Avec display=1 ET (relfollow=1 OU null):', typesActifs);
  
  // 4. Analyse GAMMES PRODUITS
  console.log('\n📊 PIECES_GAMME (Gammes produits):');
  const { data: gammes, count: totalGammes } = await supabase
    .from('pieces_gamme')
    .select('*', { count: 'exact' });
  
  console.log('  Total:', totalGammes);
  console.log('  Niveau 1:', gammes.filter(g => g.pg_level === 1 || g.pg_level === '1').length);
  console.log('  Niveau 2:', gammes.filter(g => g.pg_level === 2 || g.pg_level === '2').length);
  console.log('  display=1:', gammes.filter(g => g.pg_display === 1 || g.pg_display === '1').length);
  
  // 5. Analyse PIÈCES pré-calculées
  console.log('\n📊 __SITEMAP_P_LINK (Pièces détaillées):');
  const { count: totalPLinks } = await supabase.from('__sitemap_p_link').select('*', { count: 'exact', head: true });
  const { count: pLinksWithStock } = await supabase.from('__sitemap_p_link').select('*', { count: 'exact', head: true }).gt('map_has_item', 0);
  console.log('  Total:', totalPLinks);
  console.log('  Avec stock (map_has_item > 0):', pLinksWithStock);
  console.log('  Sans stock:', totalPLinks - pLinksWithStock);
  
  // 6. Autres tables potentielles
  console.log('\n📊 AUTRES TABLES POTENTIELLES:');
  
  // Blog
  const { count: blogAdvice } = await supabase.from('blog_advice').select('*', { count: 'exact', head: true });
  const { count: blogGuide } = await supabase.from('blog_guide').select('*', { count: 'exact', head: true });
  console.log('  blog_advice:', blogAdvice || 0);
  console.log('  blog_guide:', blogGuide || 0);
  
  // Produits/Articles
  const { count: produits } = await supabase.from('pieces_articles').select('*', { count: 'exact', head: true }).catch(() => ({ count: 0 }));
  console.log('  pieces_articles:', produits || 'N/A');
  
  // Résumé
  console.log('\n' + '=' .repeat(70));
  console.log('\n📈 POTENTIEL MAXIMUM (sans filtres relfollow):');
  console.log('  Constructeurs (display=1):', marqueStats.display1);
  console.log('  Modèles (display=1):', modelesDisplayOnly);
  console.log('  Types (display=1):', typesDisplayOnly);
  console.log('  Pièces (avec stock):', pLinksWithStock);
  console.log('  Pièces (TOUT):', totalPLinks);
  
  const maxPotential = marqueStats.display1 + modelesDisplayOnly + typesDisplayOnly + totalPLinks;
  const maxWithStock = marqueStats.display1 + modelesDisplayOnly + typesDisplayOnly + pLinksWithStock;
  console.log('\n  TOTAL POTENTIEL (pièces avec stock):', maxWithStock?.toLocaleString());
  console.log('  TOTAL POTENTIEL (toutes pièces):', maxPotential?.toLocaleString());
}

deepAnalysis().catch(console.error);
