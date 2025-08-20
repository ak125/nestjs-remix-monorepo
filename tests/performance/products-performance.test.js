/**
 * Scripts de test de performance pour l'interface produits
 */

import { performance } from 'perf_hooks';

// Configuration de test
const CONFIG = {
  API_BASE_URL: process.env.API_URL || 'http://localhost:3000',
  TEST_RUNS: 10,
  MAX_RESPONSE_TIME: 2000, // 2 secondes max
  CONCURRENT_REQUESTS: 5,
};

interface TestResult {
  name: string;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  successRate: number;
  errors: string[];
}

/**
 * Test de performance pour l'API du catalogue
 */
async function testCatalogPerformance(): Promise<TestResult> {
  const results: number[] = [];
  const errors: string[] = [];
  let successCount = 0;

  console.log('🧪 Test de performance: API Catalogue');
  console.log(`📊 ${CONFIG.TEST_RUNS} requêtes à tester`);

  for (let i = 0; i < CONFIG.TEST_RUNS; i++) {
    try {
      const start = performance.now();
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/products/pieces-catalog?page=1&limit=24`, {
        headers: { 'internal-call': 'true' }
      });

      const end = performance.now();
      const responseTime = end - start;

      if (response.ok) {
        const data = await response.json();
        if (data.products && Array.isArray(data.products)) {
          results.push(responseTime);
          successCount++;
          console.log(`✅ Test ${i + 1}/${CONFIG.TEST_RUNS}: ${Math.round(responseTime)}ms - ${data.products.length} produits`);
        } else {
          errors.push(`Test ${i + 1}: Invalid response format`);
          console.log(`❌ Test ${i + 1}/${CONFIG.TEST_RUNS}: Format de réponse invalide`);
        }
      } else {
        errors.push(`Test ${i + 1}: HTTP ${response.status}`);
        console.log(`❌ Test ${i + 1}/${CONFIG.TEST_RUNS}: HTTP ${response.status}`);
      }
    } catch (error) {
      errors.push(`Test ${i + 1}: ${error.message}`);
      console.log(`❌ Test ${i + 1}/${CONFIG.TEST_RUNS}: ${error.message}`);
    }

    // Pause entre les requêtes
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const avgResponseTime = results.length > 0 ? results.reduce((a, b) => a + b, 0) / results.length : 0;
  const maxResponseTime = results.length > 0 ? Math.max(...results) : 0;
  const minResponseTime = results.length > 0 ? Math.min(...results) : 0;
  const successRate = (successCount / CONFIG.TEST_RUNS) * 100;

  return {
    name: 'Catalogue API',
    avgResponseTime,
    maxResponseTime,
    minResponseTime,
    successRate,
    errors,
  };
}

/**
 * Test de charge avec requêtes concurrentes
 */
async function testConcurrentLoad(): Promise<TestResult> {
  const results: number[] = [];
  const errors: string[] = [];
  let successCount = 0;

  console.log('\n🚀 Test de charge: Requêtes concurrentes');
  console.log(`⚡ ${CONFIG.CONCURRENT_REQUESTS} requêtes simultanées`);

  const requests = Array(CONFIG.CONCURRENT_REQUESTS).fill(null).map(async (_, index) => {
    try {
      const start = performance.now();
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/products/pieces-catalog?page=${index + 1}&limit=12`, {
        headers: { 'internal-call': 'true' }
      });

      const end = performance.now();
      const responseTime = end - start;

      if (response.ok) {
        const data = await response.json();
        results.push(responseTime);
        successCount++;
        return { success: true, responseTime, productsCount: data.products?.length || 0 };
      } else {
        errors.push(`Concurrent request ${index + 1}: HTTP ${response.status}`);
        return { success: false, responseTime, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      errors.push(`Concurrent request ${index + 1}: ${error.message}`);
      return { success: false, responseTime: 0, error: error.message };
    }
  });

  const requestResults = await Promise.all(requests);

  requestResults.forEach((result, index) => {
    if (result.success) {
      console.log(`✅ Requête ${index + 1}: ${Math.round(result.responseTime)}ms - ${result.productsCount} produits`);
    } else {
      console.log(`❌ Requête ${index + 1}: ${result.error}`);
    }
  });

  const avgResponseTime = results.length > 0 ? results.reduce((a, b) => a + b, 0) / results.length : 0;
  const maxResponseTime = results.length > 0 ? Math.max(...results) : 0;
  const minResponseTime = results.length > 0 ? Math.min(...results) : 0;
  const successRate = (successCount / CONFIG.CONCURRENT_REQUESTS) * 100;

  return {
    name: 'Charge concurrente',
    avgResponseTime,
    maxResponseTime,
    minResponseTime,
    successRate,
    errors,
  };
}

/**
 * Test de recherche avec différents termes
 */
async function testSearchPerformance(): Promise<TestResult> {
  const searchTerms = ['frein', 'moteur', 'suspension', 'amortisseur', 'filtre'];
  const results: number[] = [];
  const errors: string[] = [];
  let successCount = 0;

  console.log('\n🔍 Test de performance: Recherche');
  console.log(`📝 ${searchTerms.length} termes de recherche à tester`);

  for (const term of searchTerms) {
    try {
      const start = performance.now();
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/products/pieces-catalog?search=${encodeURIComponent(term)}&limit=24`, {
        headers: { 'internal-call': 'true' }
      });

      const end = performance.now();
      const responseTime = end - start;

      if (response.ok) {
        const data = await response.json();
        results.push(responseTime);
        successCount++;
        console.log(`✅ "${term}": ${Math.round(responseTime)}ms - ${data.total} résultats`);
      } else {
        errors.push(`Search "${term}": HTTP ${response.status}`);
        console.log(`❌ "${term}": HTTP ${response.status}`);
      }
    } catch (error) {
      errors.push(`Search "${term}": ${error.message}`);
      console.log(`❌ "${term}": ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const avgResponseTime = results.length > 0 ? results.reduce((a, b) => a + b, 0) / results.length : 0;
  const maxResponseTime = results.length > 0 ? Math.max(...results) : 0;
  const minResponseTime = results.length > 0 ? Math.min(...results) : 0;
  const successRate = (successCount / searchTerms.length) * 100;

  return {
    name: 'Recherche',
    avgResponseTime,
    maxResponseTime,
    minResponseTime,
    successRate,
    errors,
  };
}

/**
 * Génère un rapport de performance
 */
function generateReport(results: TestResult[]): void {
  console.log('\n📊 RAPPORT DE PERFORMANCE');
  console.log('=' .repeat(50));

  results.forEach(result => {
    console.log(`\n🎯 ${result.name}:`);
    console.log(`   • Taux de succès: ${result.successRate.toFixed(1)}%`);
    console.log(`   • Temps moyen: ${Math.round(result.avgResponseTime)}ms`);
    console.log(`   • Temps min: ${Math.round(result.minResponseTime)}ms`);
    console.log(`   • Temps max: ${Math.round(result.maxResponseTime)}ms`);
    
    // Évaluation de la performance
    if (result.avgResponseTime < 500) {
      console.log(`   • 🟢 Performance: Excellente`);
    } else if (result.avgResponseTime < 1000) {
      console.log(`   • 🟡 Performance: Bonne`);
    } else if (result.avgResponseTime < CONFIG.MAX_RESPONSE_TIME) {
      console.log(`   • 🟠 Performance: Acceptable`);
    } else {
      console.log(`   • 🔴 Performance: À améliorer`);
    }

    if (result.errors.length > 0) {
      console.log(`   • ❌ Erreurs (${result.errors.length}):`);
      result.errors.slice(0, 3).forEach(error => console.log(`     - ${error}`));
      if (result.errors.length > 3) {
        console.log(`     ... et ${result.errors.length - 3} autres`);
      }
    }
  });

  console.log('\n💡 RECOMMANDATIONS:');
  
  const slowTests = results.filter(r => r.avgResponseTime > 1000);
  if (slowTests.length > 0) {
    console.log('   • Optimiser les requêtes lentes');
    console.log('   • Considérer la mise en cache');
    console.log('   • Ajouter des index sur les colonnes de recherche');
  }

  const lowSuccessTests = results.filter(r => r.successRate < 95);
  if (lowSuccessTests.length > 0) {
    console.log('   • Améliorer la gestion d\'erreurs');
    console.log('   • Vérifier la stabilité de la base de données');
  }

  if (results.every(r => r.avgResponseTime < 1000 && r.successRate > 95)) {
    console.log('   • 🎉 Performance globale excellente !');
    console.log('   • Interface prête pour la production');
  }
}

/**
 * Exécution des tests
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 TESTS DE PERFORMANCE - INTERFACE PRODUITS');
  console.log('=' .repeat(50));
  console.log(`🌐 URL de test: ${CONFIG.API_BASE_URL}`);
  console.log(`⏱️  Démarrage des tests: ${new Date().toLocaleString()}`);

  try {
    const results: TestResult[] = [];
    
    // Test séquentiel du catalogue
    results.push(await testCatalogPerformance());
    
    // Test de charge concurrent
    results.push(await testConcurrentLoad());
    
    // Test de recherche
    results.push(await testSearchPerformance());

    // Génération du rapport
    generateReport(results);

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
    process.exit(1);
  }
}

// Exécution si ce fichier est appelé directement
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n✅ Tests terminés avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Échec des tests:', error);
      process.exit(1);
    });
}

export {
  testCatalogPerformance,
  testConcurrentLoad,
  testSearchPerformance,
  generateReport,
  runAllTests,
};
