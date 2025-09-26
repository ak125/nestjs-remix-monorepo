// Test rapide pour vérifier les données pieces
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://oqgzjzpbhcqxpvjbigfc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xZ3pqenBiaGNxeHB2amJpZ2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU5MTExMzgsImV4cCI6MjA0MTQ4NzEzOH0.EAMjTDnYtYxfO1jnNRe6qvxPQqcLZjQLEiKxECsZu4o'
);

async function testPiecesData() {
  console.log('🔍 Test des données pieces...');

  // Test de quelques pièces pour voir la structure
  const { data: pieces, error } = await supabase
    .from('pieces')
    .select('piece_id, piece_name, piece_ref, piece_pm_id')
    .limit(5);

  console.log('📦 Premières pièces de la base:', pieces);
  console.log('❌ Erreur éventuelle:', error);

  if (pieces && pieces.length > 0) {
    const firstPiece = pieces[0];
    console.log('� Première pièce:', firstPiece);

    if (firstPiece.piece_pm_id) {
      // Test de la marque correspondante
      const { data: marque } = await supabase
        .from('pieces_marque')
        .select('pm_id, pm_name, pm_quality, pm_oes')
        .eq('pm_id', firstPiece.piece_pm_id)
        .single();

      console.log('🏭 Marque correspondante:', marque);
    }

    // Test des prix pour cette pièce
    const { data: prix } = await supabase
      .from('pieces_price')
      .select('piece_id, pri_vente_ttc, piece_qty_sale')
      .eq('piece_id', firstPiece.piece_id);

    console.log('💰 Prix pour cette pièce:', prix);
  }
}

testPiecesData().catch(console.error);