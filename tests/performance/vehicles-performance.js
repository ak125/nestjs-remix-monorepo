/**
 * 🚗 TESTS DE PERFORMANCE - MODULE VÉHICULES
 * Test des APIs automobiles avec données réelles
 */

const API_BASE = 'http://localhost:3001';
const ENDPOINTS = {
  stats: '/api/catalog/vehicles/stats',
  brands: '/api/catalog/vehicles/brands',
  modelsById: '/api/catalog/vehicles/brands/{brandId}/models',
  typesById: '/api/catalog/vehicles/models/{modelId}/types',
  search: '/api/catalog/vehicles/search',
  compatibility: '/api/catalog/vehicles/compatibility/{pieceId}',
  partsByVehicle: '/api/catalog/vehicles/parts/by-vehicle',
  partsSearch: '/api/catalog/vehicles/parts/search',
  quickSearch: '/api/catalog/vehicles/parts/quick-search'
};

let testResults = [];
let startTime = Date.now();

console.log('🚗 DÉMARRAGE DES TESTS DE PERFORMANCE - MODULE VÉHICULES');
console.log('===============================================================');
console.log(`🌐 API Base: ${API_BASE}`);
console.log(`⏰ Début des tests: ${new Date().toISOString()}\n`);

/**
 * Fonction utilitaire pour tester un endpoint
 */
async function testEndpoint(name, url, expectedStatus = 200, description = '') {
  const startTime = Date.now();
  
  try {
    console.log(`🧪 Test: ${name}...`);
    
    const response = await fetch(url);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const result = {
      name,
      description,
      url,
      status: response.status,
      duration: `${duration}ms`,
      success: response.status === expectedStatus,
      timestamp: new Date().toISOString()
    };

    if (response.ok) {
      const data = await response.json();
      result.dataSize = JSON.stringify(data).length;
      result.hasData = data?.success !== false;
      
      // Log spécifique par type de données
      if (data.data) {
        if (Array.isArray(data.data)) {
          result.itemsCount = data.data.length;
        } else if (typeof data.data === 'object') {
          result.dataFields = Object.keys(data.data);
        }
      }
    }

    testResults.push(result);
    
    const statusIcon = result.success ? '✅' : '❌';
    console.log(`   ${statusIcon} ${name}: ${result.duration} (${result.status})`);
    
    if (result.itemsCount) {
      console.log(`      📊 Éléments: ${result.itemsCount}`);
    }
    if (result.dataFields) {
      console.log(`      🔑 Champs: ${result.dataFields.join(', ')}`);
    }
    
    return result;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const result = {
      name,
      description,
      url,
      status: 'ERROR',
      duration: `${duration}ms`,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    testResults.push(result);
    console.log(`   ❌ ${name}: ERREUR - ${error.message}`);
    
    return result;
  }
}

/**
 * Tests principaux
 */
async function runPerformanceTests() {
  console.log('📊 TESTS DES STATISTIQUES VÉHICULES');
  console.log('------------------------------------');
  
  await testEndpoint(
    'Stats véhicules',
    `${API_BASE}${ENDPOINTS.stats}`,
    200,
    'Statistiques générales des véhicules'
  );
  
  console.log('\n🏭 TESTS DES MARQUES AUTOMOBILES');
  console.log('--------------------------------');
  
  await testEndpoint(
    'Liste marques',
    `${API_BASE}${ENDPOINTS.brands}`,
    200,
    'Toutes les marques automobiles actives'
  );
  
  console.log('\n🚙 TESTS DES MODÈLES ET TYPES');
  console.log('-----------------------------');
  
  // Test avec une marque connue (par exemple Peugeot = ID 1)
  await testEndpoint(
    'Modèles Peugeot',
    `${API_BASE}${ENDPOINTS.modelsById.replace('{brandId}', '1')}`,
    200,
    'Modèles de la marque Peugeot'
  );
  
  // Test avec un modèle connu (par exemple 206 = ID 1)
  await testEndpoint(
    'Types 206',
    `${API_BASE}${ENDPOINTS.typesById.replace('{modelId}', '1')}`,
    200,
    'Types/motorisations Peugeot 206'
  );
  
  console.log('\n🔍 TESTS DE RECHERCHE VÉHICULES');
  console.log('-------------------------------');
  
  await testEndpoint(
    'Recherche simple',
    `${API_BASE}${ENDPOINTS.search}?limit=20`,
    200,
    'Recherche véhicules sans filtre'
  );
  
  await testEndpoint(
    'Recherche par marque',
    `${API_BASE}${ENDPOINTS.search}?brandId=1&limit=20`,
    200,
    'Recherche véhicules Peugeot'
  );
  
  await testEndpoint(
    'Recherche par carburant',
    `${API_BASE}${ENDPOINTS.search}?fuelType=diesel&limit=20`,
    200,
    'Recherche véhicules diesel'
  );
  
  console.log('\n🔧 TESTS DE COMPATIBILITÉ PIÈCES');
  console.log('--------------------------------');
  
  // Test avec une pièce connue
  await testEndpoint(
    'Compatibilité pièce',
    `${API_BASE}${ENDPOINTS.compatibility.replace('{pieceId}', '1')}`,
    200,
    'Véhicules compatibles avec pièce ID 1'
  );
  
  await testEndpoint(
    'Pièces par véhicule',
    `${API_BASE}${ENDPOINTS.partsByVehicle}?brandId=1&modelId=1`,
    200,
    'Pièces pour Peugeot 206'
  );
  
  console.log('\n🔎 TESTS DE RECHERCHE PIÈCES');
  console.log('----------------------------');
  
  await testEndpoint(
    'Recherche pièces simple',
    `${API_BASE}${ENDPOINTS.partsSearch}?limit=20`,
    200,
    'Recherche pièces sans filtre'
  );
  
  await testEndpoint(
    'Recherche pièces gamme',
    `${API_BASE}${ENDPOINTS.partsSearch}?gamme=freinage&limit=20`,
    200,
    'Recherche pièces freinage'
  );
  
  await testEndpoint(
    'Recherche rapide',
    `${API_BASE}${ENDPOINTS.quickSearch}?q=plaquette&limit=10`,
    200,
    'Recherche rapide "plaquette"'
  );
}

/**
 * Analyse des résultats
 */
function analyzeResults() {
  console.log('\n📊 ANALYSE DES PERFORMANCES');
  console.log('===========================');
  
  const totalTests = testResults.length;
  const successfulTests = testResults.filter(r => r.success).length;
  const failedTests = totalTests - successfulTests;
  
  const durations = testResults
    .filter(r => r.success)
    .map(r => parseInt(r.duration.replace('ms', '')));
  
  const avgDuration = durations.length > 0 
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  
  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);
  
  console.log(`✅ Tests réussis: ${successfulTests}/${totalTests}`);
  console.log(`❌ Tests échoués: ${failedTests}`);
  console.log(`⏱️  Temps moyen: ${avgDuration}ms`);
  console.log(`⚡ Plus rapide: ${minDuration}ms`);
  console.log(`🐌 Plus lent: ${maxDuration}ms`);
  
  // Classement par performance
  console.log('\n🏆 CLASSEMENT PAR PERFORMANCE:');
  testResults
    .filter(r => r.success)
    .sort((a, b) => parseInt(a.duration) - parseInt(b.duration))
    .slice(0, 5)
    .forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.name}: ${result.duration}`);
    });
  
  // Tests les plus lents
  console.log('\n🐌 TESTS LES PLUS LENTS:');
  testResults
    .filter(r => r.success)
    .sort((a, b) => parseInt(b.duration) - parseInt(a.duration))
    .slice(0, 3)
    .forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.name}: ${result.duration}`);
    });
  
  // Erreurs
  if (failedTests > 0) {
    console.log('\n❌ TESTS EN ERREUR:');
    testResults
      .filter(r => !r.success)
      .forEach(result => {
        console.log(`   • ${result.name}: ${result.error || result.status}`);
      });
  }
}

/**
 * Rapport détaillé
 */
function generateDetailedReport() {
  const totalTime = Date.now() - startTime;
  
  console.log('\n📋 RAPPORT DÉTAILLÉ');
  console.log('==================');
  
  testResults.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`\n${index + 1}. ${icon} ${result.name}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Durée: ${result.duration}`);
    
    if (result.description) {
      console.log(`   Description: ${result.description}`);
    }
    
    if (result.itemsCount) {
      console.log(`   Éléments retournés: ${result.itemsCount}`);
    }
    
    if (result.dataSize) {
      console.log(`   Taille données: ${result.dataSize} bytes`);
    }
    
    if (result.error) {
      console.log(`   Erreur: ${result.error}`);
    }
  });
  
  console.log(`\n⏰ Temps total d'exécution: ${totalTime}ms`);
  console.log(`🏁 Tests terminés: ${new Date().toISOString()}`);
}

/**
 * Exécution principale
 */
async function main() {
  try {
    await runPerformanceTests();
    analyzeResults();
    generateDetailedReport();
    
    console.log('\n🎯 TESTS DE PERFORMANCE TERMINÉS !');
    console.log('==================================');
    
    const successRate = (testResults.filter(r => r.success).length / testResults.length) * 100;
    console.log(`📊 Taux de réussite: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 90) {
      console.log('🎉 EXCELLENT ! Le module véhicules est très performant !');
    } else if (successRate >= 70) {
      console.log('👍 BON ! Quelques optimisations possibles.');
    } else {
      console.log('⚠️  ATTENTION ! Plusieurs APIs nécessitent des corrections.');
    }
    
  } catch (error) {
    console.error('💥 ERREUR CRITIQUE:', error);
    process.exit(1);
  }
}

// Lancement des tests
main().catch(console.error);
