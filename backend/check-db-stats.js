const { createClient } = require('@supabase/supabase-js');

async function checkDB() {
  const supabase = createClient(
    'https://dvbrpitugxfevdxxgrsm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YnJwaXR1Z3hmZXZkeHhncnNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTk4NDY4OCwiZXhwIjoyMDU3NTYwNjg4fQ.4lQ9ohDXSdtCr7IMSfeFmDmQmrTBbCk0E8B0rVpWlKE'
  );

  console.log('=== STATISTIQUES BASE DE DONNÉES ===\n');

  // 1. Marques
  const { count: totalMarques } = await supabase.from('auto_marque').select('*', { count: 'exact', head: true });
  const { count: activeMarques } = await supabase.from('auto_marque').select('*', { count: 'exact', head: true }).eq('marque_display', '1');
  console.log('MARQUES:');
  console.log('  Total:', totalMarques);
  console.log('  Actives (display=1):', activeMarques);

  // 2. Modèles
  const { count: totalModeles } = await supabase.from('auto_modele').select('*', { count: 'exact', head: true });
  const { count: activeModeles } = await supabase.from('auto_modele').select('*', { count: 'exact', head: true }).eq('modele_display', '1');
  console.log('\nMODÈLES:');
  console.log('  Total:', totalModeles);
  console.log('  Actifs (display=1):', activeModeles);

  // 3. Types - différentes combinaisons de filtres
  const { count: totalTypes } = await supabase.from('auto_type').select('*', { count: 'exact', head: true });
  const { count: typesDisplay1 } = await supabase.from('auto_type').select('*', { count: 'exact', head: true }).eq('type_display', '1');
  const { count: typesRelfollow1 } = await supabase.from('auto_type').select('*', { count: 'exact', head: true }).eq('type_relfollow', '1');
  const { count: typesBoth } = await supabase.from('auto_type').select('*', { count: 'exact', head: true }).eq('type_display', '1').eq('type_relfollow', '1');
  
  console.log('\nTYPES:');
  console.log('  Total:', totalTypes);
  console.log('  display=1:', typesDisplay1);
  console.log('  relfollow=1:', typesRelfollow1);
  console.log('  display=1 ET relfollow=1:', typesBoth);

  // 4. Vérifier les valeurs distinctes de type_display
  const { data: displayValues } = await supabase.from('auto_type').select('type_display').limit(1000);
  const uniqueDisplay = [...new Set(displayValues?.map(d => d.type_display))];
  console.log('\n  Valeurs type_display distinctes:', uniqueDisplay);

  // 5. Vérifier les valeurs distinctes de type_relfollow
  const { data: relfollowValues } = await supabase.from('auto_type').select('type_relfollow').limit(1000);
  const uniqueRelfollow = [...new Set(relfollowValues?.map(d => d.type_relfollow))];
  console.log('  Valeurs type_relfollow distinctes:', uniqueRelfollow);

  // 6. Échantillon de types filtrés
  const { data: sampleTypes, error } = await supabase
    .from('auto_type')
    .select('type_id, type_modele_id, type_display, type_relfollow')
    .eq('type_display', '1')
    .eq('type_relfollow', '1')
    .limit(10);
  
  console.log('\nÉCHANTILLON TYPES (display=1 & relfollow=1):');
  if (error) {
    console.log('  Erreur:', error.message);
  } else {
    console.log('  Nombre:', sampleTypes?.length);
    sampleTypes?.forEach(t => {
      console.log(`    type_id=${t.type_id}, modele_id=${t.type_modele_id}`);
    });
  }

  // 7. Vérifier si les modèles référencés existent et sont actifs
  if (sampleTypes && sampleTypes.length > 0) {
    const modeleIds = sampleTypes.map(t => t.type_modele_id);
    const { data: modeles } = await supabase
      .from('auto_modele')
      .select('modele_id, modele_display, modele_marque_id')
      .in('modele_id', modeleIds);
    
    console.log('\nMODÈLES RÉFÉRENCÉS:');
    modeles?.forEach(m => {
      console.log(`    modele_id=${m.modele_id}, display=${m.modele_display}, marque_id=${m.modele_marque_id}`);
    });
  }
}

checkDB().catch(err => {
  console.error('Erreur:', err.message);
});
