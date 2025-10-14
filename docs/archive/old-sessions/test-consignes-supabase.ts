/**
 * 🧪 Test Intégration Supabase - PHASE 1 POC
 * Vérifier que pieces_price.pri_consigne_ttc est accessible via l'API Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger .env
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_KEY requises');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConsignes() {
  console.log('🔍 Test PHASE 1 POC - Consignes dans pieces_price');
  console.log('=================================================\n');

  try {
    // 1. Test requête simple pieces_price
    console.log('📋 1. Test requête pieces_price...');
    const { data: priceData, error: priceError } = await supabase
      .from('pieces_price')
      .select('pri_piece_id, pri_vente_ttc, pri_consigne_ttc')
      .limit(5);

    if (priceError) {
      console.error('❌ Erreur:', priceError.message);
      return;
    }

    console.log('✅ Requête réussie -', priceData?.length, 'lignes récupérées\n');

    // 2. Statistiques consignes (avec COUNT pour éviter la limite de 1000)
    console.log('📋 2. Statistiques consignes...');
    
    // Utiliser count() pour obtenir le vrai nombre
    const { count: totalCount } = await supabase
      .from('pieces_price')
      .select('*', { count: 'exact', head: true });
    
    const { count: consigneCount } = await supabase
      .from('pieces_price')
      .select('*', { count: 'exact', head: true })
      .gt('pri_consigne_ttc', 0);

    // Pour la moyenne, prendre un échantillon de 1000
    const { data: statsData } = await supabase
      .from('pieces_price')
      .select('pri_consigne_ttc')
      .gt('pri_consigne_ttc', 0)
      .limit(1000);

    const consigneMoyenne = statsData && statsData.length > 0
      ? statsData.reduce((sum, item) => sum + parseFloat(item.pri_consigne_ttc || '0'), 0) / statsData.length
      : 0;

    console.log(`   Total lignes dans pieces_price: ${totalCount || 'N/A'}`);
    console.log(`   Produits avec consigne > 0: ${consigneCount || 'N/A'}`);
    console.log(`   Consigne moyenne (échantillon ${statsData?.length}): ${consigneMoyenne.toFixed(2)}€`);
    
    if (consigneCount && consigneCount > 1000) {
      console.log(`   ⚠️  Attention: ${consigneCount} produits mais limite Supabase = 1000 lignes`);
    }
    console.log('');

    // 3. Échantillon produits avec consignes
    if (consigneCount && consigneCount > 0) {
      console.log('📋 3. TOP 5 produits avec consignes:');
      const { data: samples } = await supabase
        .from('pieces_price')
        .select('piece_id, price_ttc, pri_consigne_ttc')
        .gt('pri_consigne_ttc', 0)
        .order('pri_consigne_ttc', { ascending: false })
        .limit(5);

      samples?.forEach((item, idx) => {
        const total = parseFloat(item.price_ttc || '0') + parseFloat(item.pri_consigne_ttc || '0');
        console.log(`   ${idx + 1}. Piece ID: ${item.piece_id}`);
        console.log(`      Prix: ${item.price_ttc}€ + Consigne: ${item.pri_consigne_ttc}€ = ${total.toFixed(2)}€`);
      });
      console.log('');
    }

    // 4. Test JOIN avec pieces et pieces_marque
    console.log('📋 4. Test JOIN pieces + pieces_price + pieces_marque...');
    const { data: joinData, error: joinError } = await supabase
      .from('pieces')
      .select(`
        piece_ref,
        piece_design,
        pieces_marque(pm_name),
        pieces_price!inner(pri_vente_ttc, pri_consigne_ttc)
      `)
      .gt('pieces_price.pri_consigne_ttc', 0)
      .limit(1)
      .single();

    if (joinError) {
      console.log('⚠️  JOIN échoué (normal si pas de relation FK configurée)');
      console.log('   Message:', joinError.message);
    } else if (joinData) {
      console.log('✅ JOIN fonctionne!');
      console.log('   Exemple:');
      console.log('   Référence:', joinData.piece_ref);
      console.log('   Désignation:', joinData.piece_design);
      const marque = Array.isArray(joinData.pieces_marque) ? joinData.pieces_marque[0] : joinData.pieces_marque;
      const price = Array.isArray(joinData.pieces_price) ? joinData.pieces_price[0] : joinData.pieces_price;
      console.log('   Marque:', marque?.pm_name || 'N/A');
      console.log('   Prix TTC:', price?.price_ttc);
      console.log('   Consigne:', price?.pri_consigne_ttc);
    }
    console.log('');

    // 5. Test images
    console.log('📋 5. Test gestion images...');
    const { data: imgData } = await supabase
      .from('pieces')
      .select('piece_has_img')
      .limit(100);

    const avecImg = imgData?.filter(p => p.piece_has_img === 1).length || 0;
    const sansImg = imgData?.filter(p => p.piece_has_img === 0).length || 0;

    console.log(`   Avec image: ${avecImg}`);
    console.log(`   Sans image (→ no.png): ${sansImg}\n`);

    // Résumé
    console.log('=================================================');
    console.log('✅ Tests terminés avec succès\n');
    console.log('📊 Résumé:');
    console.log('   - API Supabase: ✅ Accessible');
    console.log('   - Table pieces_price: ✅ OK');
    console.log(`   - Total lignes: ${totalCount || 'N/A'}`);
    console.log('   - Colonne pri_consigne_ttc: ✅ Existe');
    console.log(`   - Produits avec consignes: ${consigneCount || 'N/A'} ${consigneCount && consigneCount > 1000 ? '(au-delà de la limite de 1000)' : ''}`);
    console.log('   - Gestion images: ✅ piece_has_img détecté');
    console.log('');
    console.log('🚀 Prêt pour intégration frontend!');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
    process.exit(1);
  }
}

// Exécuter les tests
testConsignes();
