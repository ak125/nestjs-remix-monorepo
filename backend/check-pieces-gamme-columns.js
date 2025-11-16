require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPiecesGammeColumns() {
  console.log('🔍 Vérification structure table pieces_gamme...\n');

  // Récupérer un échantillon pour voir les colonnes
  const { data: sample, error } = await supabase
    .from('pieces_gamme')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  if (sample && sample.length > 0) {
    console.log('📋 Colonnes disponibles:');
    Object.keys(sample[0]).forEach(col => {
      console.log(`   - ${col}: ${typeof sample[0][col]} = ${JSON.stringify(sample[0][col])}`);
    });
  } else {
    console.log('⚠️  Table vide');
  }

  // Compter avec différents critères possibles
  const { count: total } = await supabase
    .from('pieces_gamme')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total entrées: ${total}`);

  // Tester avec pg_id présent dans __cross_gamme_car_new
  const { data: withCross, error: crossError } = await supabase
    .from('pieces_gamme')
    .select('pg_id, pg_name, pg_alias')
    .in('pg_id', [402, 403, 404, 405])
    .limit(5);

  console.log('\n🔗 Pièces avec pg_id dans cross_gamme:');
  console.table(withCross);
}

checkPiecesGammeColumns();
