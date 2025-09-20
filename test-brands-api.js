// Test de l'API Enhanced Vehicle getBrands côté serveur
const fetch = require('node-fetch');

async function testBrandsApi() {
  try {
    const url = 'http://localhost:3000/api/vehicles/brands';
    console.log(`🔍 Test URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`📡 Status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`❌ Erreur HTTP: ${response.status}`);
      return;
    }

    const data = await response.json();
    console.log(`📊 Type de données:`, typeof data);
    console.log(`📊 Clés:`, Object.keys(data));
    console.log(`📊 Nombre de marques:`, data.data ? data.data.length : 'Aucune propriété data');
    
    if (data.data && data.data.length > 0) {
      console.log(`📊 Première marque:`, data.data[0]);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

testBrandsApi();