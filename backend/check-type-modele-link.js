const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dvbrpitugxfevdxxgrsm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YnJwaXR1Z3hmZXZkeHhncnNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTk4NDY4OCwiZXhwIjoyMDU3NTYwNjg4fQ.4lQ9ohDXSdtCr7IMSfeFmDmQmrTBbCk0E8B0rVpWlKE'
);

async function analyze() {
  console.log('=== ANALYSE TYPES → MODÈLES ===\n');

  // 1. Charger un échantillon de types filtrés
  const { data: types } = await supabase
    .from('auto_type')
    .select('type_id, type_modele_id')
    .eq('type_display', '1')
    .eq('type_relfollow', '1')
    .limit(100);

  console.log('Sample types:', types?.slice(0, 10)?.map(t => `type_id=${t.type_id}, modele_id=${t.type_modele_id}`));

  // 2. Extraire les modele_ids uniques
  const modeleIds = [...new Set(types?.map(t => t.type_modele_id) || [])];
  console.log('\nUnique modele_ids in sample:', modeleIds.slice(0, 20));

  // 3. Vérifier ces modèles
  const { data: modeles } = await supabase
    .from('auto_modele')
    .select('modele_id, modele_display')
    .in('modele_id', modeleIds.slice(0, 50));

  console.log('\nModèles trouvés:', modeles?.length);
  
  const activeModeles = modeles?.filter(m => m.modele_display === '1' || m.modele_display === 1);
  console.log('Modèles actifs:', activeModeles?.length);
  
  const inactiveModeles = modeles?.filter(m => m.modele_display !== '1' && m.modele_display !== 1);
  console.log('Modèles inactifs:', inactiveModeles?.length);
  
  console.log('\nSample modèles:');
  modeles?.slice(0, 10).forEach(m => {
    console.log(`  modele_id=${m.modele_id}, display=${m.modele_display} (type: ${typeof m.modele_display})`);
  });

  // 4. Charger tous les modèles actifs
  const { data: allActiveModeles } = await supabase
    .from('auto_modele')
    .select('modele_id')
    .eq('modele_display', '1');

  console.log('\n\nTotal modèles actifs (display=1):', allActiveModeles?.length);
  console.log('Sample IDs:', allActiveModeles?.slice(0, 20).map(m => m.modele_id));

  // 5. Comparer avec integer
  const { data: allActiveModelesInt } = await supabase
    .from('auto_modele')
    .select('modele_id')
    .eq('modele_display', 1);

  console.log('Total modèles actifs (display=1 int):', allActiveModelesInt?.length);
}

analyze().catch(console.error);
