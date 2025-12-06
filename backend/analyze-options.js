const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function analyzeOptions() {
  console.log('\n📊 ANALYSE DES OPTIONS DE FILTRAGE\n');
  console.log('=' .repeat(70));
  
  // Charger toutes les marques
  const { data: marques } = await supabase.from('auto_marque').select('*');
  const marquesActives = marques.filter(m => m.marque_display === 1 || m.marque_display === '1');
  const marquesActiveIds = new Set(marquesActives.map(m => m.marque_id));
  
  console.log('\n🚗 MARQUES:');
  console.log('  Total:', marques.length);
  console.log('  Actives (display=1):', marquesActives.length);
  
  // Charger tous les modèles
  let allModeles = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase.from('auto_modele').select('*').range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allModeles.push(...data);
    offset += 1000;
  }
  
  const modelesDisplay1 = allModeles.filter(m => m.modele_display === 1 || m.modele_display === '1');
  const modelesWithActiveMarque = modelesDisplay1.filter(m => marquesActiveIds.has(m.modele_marque_id));
  
  console.log('\n🚙 MODÈLES:');
  console.log('  Total:', allModeles.length);
  console.log('  display=1:', modelesDisplay1.length);
  console.log('  display=1 + marque active:', modelesWithActiveMarque.length);
  console.log('  ⚠️  Perdus par marque inactive:', modelesDisplay1.length - modelesWithActiveMarque.length);
  
  // Charger tous les types
  let allTypes = [];
  offset = 0;
  while (true) {
    const { data } = await supabase.from('auto_type').select('type_id, type_display, type_relfollow, type_modele_id').range(offset, offset + 4999);
    if (!data || data.length === 0) break;
    allTypes.push(...data);
    offset += 5000;
  }
  
  const modelesActiveIds = new Set(modelesDisplay1.map(m => m.modele_id));
  const modelesWithActiveMarqueIds = new Set(modelesWithActiveMarque.map(m => m.modele_id));
  
  const typesDisplay1 = allTypes.filter(t => t.type_display === 1 || t.type_display === '1');
  const typesWithRelfollow = typesDisplay1.filter(t => t.type_relfollow === 1 || t.type_relfollow === '1' || t.type_relfollow === null);
  const typesWithActiveModele = typesWithRelfollow.filter(t => modelesActiveIds.has(t.type_modele_id));
  const typesWithActiveMarque = typesWithRelfollow.filter(t => modelesWithActiveMarqueIds.has(t.type_modele_id));
  
  console.log('\n🏎️  TYPES:');
  console.log('  Total:', allTypes.length);
  console.log('  display=1:', typesDisplay1.length);
  console.log('  display=1 + relfollow:', typesWithRelfollow.length);
  console.log('  display=1 + relfollow + modele actif:', typesWithActiveModele.length);
  console.log('  display=1 + relfollow + modele + marque active:', typesWithActiveMarque.length);
  console.log('  ⚠️  Perdus par cascade marque inactive:', typesWithRelfollow.length - typesWithActiveMarque.length);
  
  // Pièces
  const { count: pieces } = await supabase.from('__sitemap_p_link').select('*', { count: 'exact', head: true }).gt('map_has_item', 0);
  const { count: piecesAll } = await supabase.from('__sitemap_p_link').select('*', { count: 'exact', head: true });
  
  console.log('\n🔗 PIÈCES (__sitemap_p_link):');
  console.log('  Total:', piecesAll);
  console.log('  Avec stock (map_has_item > 0):', pieces);
  console.log('  ✅ Non affectées par filtres marques/modèles (pré-calculées)');
  
  // Résumé des options
  console.log('\n' + '=' .repeat(70));
  console.log('\n📈 OPTIONS DE CONFIGURATION:\n');
  
  const option1 = marquesActives.length + modelesWithActiveMarque.length + typesWithActiveMarque.length + pieces;
  const option2 = marquesActives.length + modelesDisplay1.length + typesWithRelfollow.length + pieces;
  const option3 = marques.length + modelesDisplay1.length + typesDisplay1.length + piecesAll;
  
  console.log('  Option 1 (ACTUEL - filtre cascade marque):');
  console.log('    Marques:', marquesActives.length);
  console.log('    Modèles:', modelesWithActiveMarque.length);
  console.log('    Types:', typesWithActiveMarque.length);
  console.log('    Pièces:', pieces);
  console.log('    TOTAL:', option1.toLocaleString());
  
  console.log('\n  Option 2 (SANS cascade marque - recommandé):');
  console.log('    Marques:', marquesActives.length);
  console.log('    Modèles (display=1):', modelesDisplay1.length);
  console.log('    Types (display=1 + relfollow):', typesWithRelfollow.length);
  console.log('    Pièces:', pieces);
  console.log('    TOTAL:', option2.toLocaleString());
  
  console.log('\n  Option 3 (MAXIMUM - tout display=1):');
  console.log('    Marques (toutes):', marques.length);
  console.log('    Modèles:', modelesDisplay1.length);
  console.log('    Types:', typesDisplay1.length);
  console.log('    Pièces (toutes):', piecesAll);
  console.log('    TOTAL:', option3.toLocaleString());
}

analyzeOptions().catch(console.error);
