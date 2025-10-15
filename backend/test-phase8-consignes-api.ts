/**
 * 🧪 TEST PHASE 8 - Consignes dans Cart API
 * 
 * Script pour tester que les consignes sont bien retournées
 * par l'API /cart avec de vrais produits ayant pri_consigne_ttc > 0
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ekygxwacnwjnwonzxizs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreWd4d2Fjbndqbndvbnp4aXpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcxODg5NTUsImV4cCI6MjA0Mjc2NDk1NX0.hfY5kNXG0BEvMdEi-s-gfJTBtDFYxnYgx4PJfzA0qKU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConsignes() {
  console.log('🧪 TEST PHASE 8 - Consignes dans Cart API\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Trouver des produits avec consignes
    console.log('\n📦 1. Recherche produits avec consignes...');
    const { data: productsWithConsignes, error: searchError } = await supabase
      .from('pieces_price')
      .select('pri_piece_id, pri_vente_ttc, pri_consigne_ttc')
      .not('pri_consigne_ttc', 'is', null)
      .neq('pri_consigne_ttc', '')
      .neq('pri_consigne_ttc', '0')
      .neq('pri_consigne_ttc', '0.00')
      .limit(5);
    
    if (searchError) {
      console.error('❌ Erreur recherche:', searchError);
      return;
    }
    
    if (!productsWithConsignes || productsWithConsignes.length === 0) {
      console.log('⚠️  Aucun produit avec consigne trouvé');
      return;
    }
    
    console.log(`✅ Trouvé ${productsWithConsignes.length} produits avec consignes:\n`);
    productsWithConsignes.forEach((p, i) => {
      const price = parseFloat(p.pri_vente_ttc || '0');
      const consigne = parseFloat(p.pri_consigne_ttc || '0');
      console.log(`   ${i + 1}. Produit #${p.pri_piece_id}`);
      console.log(`      Prix TTC: ${price.toFixed(2)}€`);
      console.log(`      Consigne: ${consigne.toFixed(2)}€`);
    });
    
    // 2. Récupérer les infos complètes d'un produit
    const testProduct = productsWithConsignes[0];
    console.log(`\n📋 2. Test avec produit #${testProduct.pri_piece_id}...\n`);
    
    const { data: pieceData, error: pieceError } = await supabase
      .from('pieces')
      .select('piece_id, piece_name, piece_ref, piece_pm_id')
      .eq('piece_id', testProduct.pri_piece_id)
      .single();
    
    if (pieceError || !pieceData) {
      console.error('❌ Erreur récupération pièce:', pieceError);
      return;
    }
    
    console.log(`   Nom: ${pieceData.piece_name || 'N/A'}`);
    console.log(`   Ref: ${pieceData.piece_ref || 'N/A'}`);
    console.log(`   Prix TTC: ${parseFloat(testProduct.pri_vente_ttc || '0').toFixed(2)}€`);
    console.log(`   Consigne: ${parseFloat(testProduct.pri_consigne_ttc || '0').toFixed(2)}€`);
    
    // 3. Test API Cart - Ajouter au panier
    console.log('\n🛒 3. Test API /cart - Ajout au panier...\n');
    
    const sessionId = `test-session-${Date.now()}`;
    const apiUrl = 'http://localhost:3000/api/cart';
    
    // Ajouter le produit
    const addResponse = await fetch(`${apiUrl}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sessionId=${sessionId}`,
      },
      body: JSON.stringify({
        productId: testProduct.pri_piece_id,
        quantity: 2, // Quantité 2 pour tester le calcul consigne_total
      }),
    });
    
    if (!addResponse.ok) {
      console.error('❌ Erreur API add:', await addResponse.text());
      return;
    }
    
    const addResult = await addResponse.json();
    console.log('   ✅ Produit ajouté au panier');
    
    // 4. Récupérer le panier complet
    console.log('\n📊 4. Récupération panier avec métadonnées...\n');
    
    const cartResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': `sessionId=${sessionId}`,
      },
    });
    
    if (!cartResponse.ok) {
      console.error('❌ Erreur API cart:', await cartResponse.text());
      return;
    }
    
    const cart = await cartResponse.json();
    
    // 5. Vérifier les données de consigne
    console.log('🔍 5. Vérification consignes dans la réponse:\n');
    
    if (cart.items && cart.items.length > 0) {
      const item = cart.items[0];
      
      console.log('   📦 Item details:');
      console.log(`      product_name: ${item.product_name}`);
      console.log(`      quantity: ${item.quantity}`);
      console.log(`      price: ${item.price}€`);
      console.log(`      has_consigne: ${item.has_consigne ? '✅' : '❌'}`);
      console.log(`      consigne_unit: ${item.consigne_unit || 0}€`);
      console.log(`      consigne_total: ${item.consigne_total || 0}€`);
      
      console.log('\n   💰 Totaux:');
      console.log(`      Subtotal: ${cart.stats.subtotal}€`);
      console.log(`      Consignes: ${cart.stats.consigne_total}€`);
      console.log(`      Total: ${cart.stats.total}€`);
      
      // Validation
      const expectedConsigneTotal = (item.consigne_unit || 0) * item.quantity;
      const consigneOK = Math.abs((item.consigne_total || 0) - expectedConsigneTotal) < 0.01;
      
      console.log('\n   ✅ Validation:');
      console.log(`      Consigne unitaire correcte: ${item.consigne_unit > 0 ? '✅' : '❌'}`);
      console.log(`      Consigne total correcte: ${consigneOK ? '✅' : '❌'}`);
      console.log(`      has_consigne flag correct: ${item.has_consigne ? '✅' : '❌'}`);
      console.log(`      Consigne incluse dans total: ${cart.stats.total > cart.stats.subtotal ? '✅' : '❌'}`);
      
      if (item.has_consigne && item.consigne_unit > 0 && consigneOK) {
        console.log('\n🎉 SUCCESS: Phase 8 fonctionnelle end-to-end!');
      } else {
        console.log('\n⚠️  WARNING: Quelque chose ne fonctionne pas comme prévu');
      }
    } else {
      console.log('   ❌ Aucun item dans le panier');
    }
    
    // 6. Nettoyage
    console.log('\n🧹 6. Nettoyage...');
    await fetch(`${apiUrl}/clear`, {
      method: 'DELETE',
      headers: {
        'Cookie': `sessionId=${sessionId}`,
      },
    });
    console.log('   ✅ Panier vidé');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test terminé\n');
    
  } catch (error) {
    console.error('\n❌ Erreur test:', error);
  }
}

// Exécuter le test
testConsignes();
