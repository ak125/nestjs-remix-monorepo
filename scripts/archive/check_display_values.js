// Script pour vérifier les valeurs de display dans la base de données
const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://nkzpkdilhcyxyvxehcnr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5renBrZGlsaGN5eHl2eGVoY25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5ODI0NjgsImV4cCI6MjA0ODU1ODQ2OH0.cBYhMTMb9lJXaQ-VK8ycLnQhOhj4ZZGZQH5tObzVWI0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDisplayValues() {
  console.log('🔍 Vérification des valeurs display dans la base de données');
  
  try {
    // 1. Vérifier les modèles AUDI 80
    console.log('\n1. Modèles AUDI contenant "80":');
    const { data: models, error: modelsError } = await supabase
      .from('auto_modele')
      .select('modele_id, modele_name, modele_display, modele_marque_id')
      .eq('modele_marque_id', 22) // AUDI
      .ilike('modele_name', '%80%');
    
    if (modelsError) {
      console.error('❌ Erreur modèles:', modelsError);
    } else {
      console.table(models);
    }

    // 2. Vérifier les types pour AUDI 80 V
    console.log('\n2. Types AUDI contenant "80 V":');
    const { data: types, error: typesError } = await supabase
      .from('auto_type')
      .select('type_id, type_name, type_display, type_year_from, type_year_to, type_modele_id')
      .eq('type_marque_id', 22) // AUDI
      .ilike('type_name', '%80 V%');
    
    if (typesError) {
      console.error('❌ Erreur types:', typesError);
    } else {
      console.table(types);
    }

    // 3. Statistiques des valeurs display
    console.log('\n3. Statistiques marques par display:');
    const { data: marqueStats } = await supabase
      .from('auto_marque')
      .select('marque_display, count(*)')
      .group('marque_display');
    console.table(marqueStats);

    console.log('\n4. Statistiques modèles par display:');
    const { data: modeleStats } = await supabase
      .from('auto_modele')
      .select('modele_display, count(*)')
      .group('modele_display');
    console.table(modeleStats);

    console.log('\n5. Statistiques types par display:');
    const { data: typeStats } = await supabase
      .from('auto_type')
      .select('type_display, count(*)')
      .group('type_display');
    console.table(typeStats);

    // 4. Compter les modèles AUDI avec display = 0
    console.log('\n6. Modèles AUDI avec display = 0:');
    const { data: hiddenModels } = await supabase
      .from('auto_modele')
      .select('modele_id, modele_name, modele_display')
      .eq('modele_marque_id', 22)
      .eq('modele_display', 0)
      .limit(10);
    console.table(hiddenModels);

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

checkDisplayValues();