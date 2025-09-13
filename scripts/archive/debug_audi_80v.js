// Script pour vérifier les années des types AUDI 80 V
const { createClient } = require('@supabase/supabase-js');

// Configuration backend (depuis le backend)
const supabaseUrl = process.env.SUPABASE_URL || 'https://nkzpkdilhcyxyvxehcnr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5renBrZGlsaGN5eHl2eGVoY25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5ODI0NjgsImV4cCI6MjA0ODU1ODQ2OH0.cBYhMTMb9lJXaQ-VK8ycLnQhOhj4ZZGZQH5tObzVWI0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAudi80VYears() {
  console.log('🔍 Vérification des années AUDI 80 V');
  
  try {
    // 1. Vérifier les types pour AUDI 80 V (modele_id: 22021)
    console.log('\n1. Types AUDI 80 V (modele_id: 22021):');
    const { data: audi80VTypes, error: typesError } = await supabase
      .from('auto_type')
      .select('type_id, type_name, type_year_from, type_year_to, type_display')
      .eq('type_modele_id', 22021)
      .order('type_name');
    
    if (typesError) {
      console.error('❌ Erreur types:', typesError);
    } else {
      console.table(audi80VTypes);
    }

    // 2. Vérifier combien de types AUDI 80 V sont disponibles en 2012
    console.log('\n2. Types AUDI 80 V disponibles en 2012:');
    const { data: types2012, error: types2012Error } = await supabase
      .from('auto_type')
      .select('type_id, type_name, type_year_from, type_year_to')
      .eq('type_modele_id', 22021)
      .lte('type_year_from', '2012')
      .gte('type_year_to', '2012');
    
    if (types2012Error) {
      console.error('❌ Erreur types 2012:', types2012Error);
    } else {
      console.table(types2012);
      console.log(`Nombre de types AUDI 80 V en 2012: ${types2012?.length || 0}`);
    }

    // 3. Vérifier combien de types AUDI 80 V sont disponibles en 1994
    console.log('\n3. Types AUDI 80 V disponibles en 1994:');
    const { data: types1994, error: types1994Error } = await supabase
      .from('auto_type')
      .select('type_id, type_name, type_year_from, type_year_to')
      .eq('type_modele_id', 22021)
      .lte('type_year_from', '1994')
      .gte('type_year_to', '1994');
    
    if (types1994Error) {
      console.error('❌ Erreur types 1994:', types1994Error);
    } else {
      console.table(types1994);
      console.log(`Nombre de types AUDI 80 V en 1994: ${types1994?.length || 0}`);
    }

    // 4. Plage d'années min/max pour AUDI 80 V
    if (audi80VTypes && audi80VTypes.length > 0) {
      const yearFroms = audi80VTypes.map(t => parseInt(t.type_year_from)).filter(y => !isNaN(y));
      const yearTos = audi80VTypes.map(t => parseInt(t.type_year_to)).filter(y => !isNaN(y));
      
      console.log('\n4. Plage d\'années AUDI 80 V:');
      console.log(`Année min: ${Math.min(...yearFroms)}`);
      console.log(`Année max: ${Math.max(...yearTos)}`);
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

checkAudi80VYears();