/**
 * 🧪 TEST PHASE 8 - Version Simple
 * Test direct de l'API cart backend
 */

async function testPhase8Simple() {
  console.log('🧪 TEST PHASE 8 - Consignes dans Cart API\n');
  console.log('='.repeat(60));
  
  try {
    const sessionId = `test-session-${Date.now()}`;
    const apiUrl = 'http://localhost:3000/api/cart';
    
    // Test 1: Ajouter un produit au hasard
    console.log('\n📦 1. Ajout produit au panier...');
    const productId = 12345; // ID test
    
    const addResponse = await fetch(`${apiUrl}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sessionId=${sessionId}`,
      },
      body: JSON.stringify({
        productId: productId,
        quantity: 2,
      }),
    });
    
    if (!addResponse.ok) {
      console.log(`⚠️  Erreur produit ${productId} (normal si inexistant)`);
      console.log('   Essayons avec un autre ID...');
      
      // Essayer avec ID 1
      const addResponse2 = await fetch(`${apiUrl}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `sessionId=${sessionId}`,
        },
        body: JSON.stringify({
          productId: 1,
          quantity: 2,
        }),
      });
      
      if (!addResponse2.ok) {
        console.error('❌ Impossible d\'ajouter un produit');
        return;
      }
    }
    
    console.log('   ✅ Produit ajouté');
    
    // Test 2: Récupérer le panier
    console.log('\n🛒 2. Récupération du panier...');
    const cartResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': `sessionId=${sessionId}`,
      },
    });
    
    if (!cartResponse.ok) {
      console.error('❌ Erreur récupération panier:', await cartResponse.text());
      return;
    }
    
    const cart = await cartResponse.json();
    
    // Test 3: Vérifier structure
    console.log('\n📊 3. Structure de la réponse cart:\n');
    console.log('   Items:', cart.items?.length || 0);
    console.log('   Stats présentes:', !!cart.stats);
    
    if (cart.items && cart.items.length > 0) {
      const item = cart.items[0];
      
      console.log('\n   📦 Premier item:');
      console.log(`      product_name: ${item.product_name || 'N/A'}`);
      console.log(`      product_brand: ${item.product_brand || 'N/A'}`);
      console.log(`      quantity: ${item.quantity}`);
      console.log(`      price: ${item.price}€`);
      console.log(`      has_consigne: ${item.has_consigne !== undefined ? (item.has_consigne ? '✅' : '❌') : '⚠️ MANQUANT'}`);
      console.log(`      consigne_unit: ${item.consigne_unit !== undefined ? item.consigne_unit + '€' : '⚠️ MANQUANT'}`);
      console.log(`      consigne_total: ${item.consigne_total !== undefined ? item.consigne_total + '€' : '⚠️ MANQUANT'}`);
      
      if (cart.stats) {
        console.log('\n   💰 Stats:');
        console.log(`      subtotal: ${cart.stats.subtotal}€`);
        console.log(`      consigne_total: ${cart.stats.consigne_total !== undefined ? cart.stats.consigne_total + '€' : '⚠️ MANQUANT'}`);
        console.log(`      total: ${cart.stats.total}€`);
      }
      
      // Validation
      console.log('\n   ✅ Validation Phase 8:');
      const hasConsigneField = item.hasOwnProperty('has_consigne');
      const hasConsigneUnit = item.hasOwnProperty('consigne_unit');
      const hasConsigneTotal = item.hasOwnProperty('consigne_total');
      const hasStatsConsigne = cart.stats?.hasOwnProperty('consigne_total');
      
      console.log(`      has_consigne présent: ${hasConsigneField ? '✅' : '❌'}`);
      console.log(`      consigne_unit présent: ${hasConsigneUnit ? '✅' : '❌'}`);
      console.log(`      consigne_total présent: ${hasConsigneTotal ? '✅' : '❌'}`);
      console.log(`      stats.consigne_total présent: ${hasStatsConsigne ? '✅' : '❌'}`);
      
      if (hasConsigneField && hasConsigneUnit && hasConsigneTotal && hasStatsConsigne) {
        console.log('\n🎉 SUCCESS: Phase 8 complète! Tous les champs consignes sont présents.');
        
        if (item.has_consigne && item.consigne_unit > 0) {
          console.log('🎉 BONUS: Ce produit a une consigne > 0 !');
        } else {
          console.log('ℹ️  Ce produit n\'a pas de consigne (normal pour la plupart des produits)');
        }
      } else {
        console.log('\n⚠️  WARNING: Certains champs consignes manquent!');
      }
    } else {
      console.log('   ❌ Panier vide ou mal formé');
    }
    
    // Nettoyage
    console.log('\n🧹 4. Nettoyage...');
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

testPhase8Simple();
