// Découvrir les vraies tables dans Supabase
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://cxpojprgwgubzjyqzmoq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MzQ1OTUsImV4cCI6MjA2ODExMDU5NX0.4sdE4f8QRwDU1De5-Kf8ZCD1otS8mgTRBds1I0gYDOg"
);

async function discoverTables() {
  console.log('� Découverte des tables disponibles...');
  
  // Tables probables pour les relations véhicule-pièces
  const tablesToCheck = [
    '__cross_gamme_car_new',
    '__cross_gamme_car', 
    'cross_gamme_car_new',
    'cross_gamme_car',
    'car_gamme_relation',
    'vehicle_parts_relation',
    'type_gamme_relation',
    'gamme_car',
    'car_parts'
  ];
  
  for (const tableName of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (!error && data) {
        console.log(`✅ Table "${tableName}" existe`);
        if (data.length > 0) {
          console.log(`   Colonnes:`, Object.keys(data[0]));
          console.log(`   Échantillon:`, data[0]);
        }
      }
    } catch (err) {
      // Table n'existe pas, continuer
    }
  }
  
  // Test direct pieces_relation_type avec un LIMIT très petit
  console.log('\n� Test pieces_relation_type avec timeout court...');
  
  // Créer une promesse avec timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout 3 secondes')), 3000);
  });
  
  const queryPromise = supabase
    .from('pieces_relation_type')
    .select('rtp_piece_id, rtp_type_id, rtp_pg_id')
    .eq('rtp_type_id', 11985)
    .limit(1);
    
  try {
    const result = await Promise.race([queryPromise, timeoutPromise]);
    console.log('✅ pieces_relation_type accessible:', result.data?.length || 0);
  } catch (error) {
    console.log('❌ pieces_relation_type:', error.message);
  }
}

discoverTables();
