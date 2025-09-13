const axios = require('axios');

async function debugSearch() {
  console.log('🔍 Test de recherche...');
  
  try {
    // Test direct Meilisearch
    console.log('\n1️⃣ Test direct Meilisearch:');
    const meilisearchResponse = await axios.post('http://localhost:7700/indexes/vehicles/search', 
      { q: "1.4" }, 
      { headers: { 'Authorization': 'Bearer masterKey123', 'Content-Type': 'application/json' } }
    );
    console.log('✅ Meilisearch finds:', meilisearchResponse.data.hits.length, 'hits');
    console.log('First hit:', meilisearchResponse.data.hits[0]?.name);
    
    // Test API search
    console.log('\n2️⃣ Test API search:');
    const apiResponse = await axios.get('http://localhost:3000/api/search?query=1.4&limit=5');
    console.log('API response:', {
      success: apiResponse.data.success,
      resultsCount: apiResponse.data.data.results.length,
      totalCount: apiResponse.data.data.totalCount
    });
    
    // Test test-meilisearch endpoint
    console.log('\n3️⃣ Test direct endpoint:');
    const testResponse = await axios.get('http://localhost:3000/api/search/test-meilisearch?q=1.4');
    console.log('Test endpoint response:', testResponse.data.success);
    console.log('Vehicle results:', testResponse.data.vehicleResults?.hits?.length || 0);
    console.log('Product results:', testResponse.data.productResults?.hits?.length || 0);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

debugSearch();
