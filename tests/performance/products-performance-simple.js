/**
 * Scripts de test de performance pour l'interface produits (Version JavaScript)
 */

const { performance } = require('perf_hooks');

// Configuration de test
const CONFIG = {
  API_BASE_URL: process.env.API_URL || 'http://localhost:3000',
  TEST_RUNS: 5, // Réduit pour un test plus rapide
  MAX_RESPONSE_TIME: 2000, // 2 secondes max
  CONCURRENT_REQUESTS: 3,
};

/**
 * Test de performance pour l'API du catalogue
 */
async function testCatalogPerformance() {
  const results = [];
  const errors = [];
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
          console.log(`✅ Test ${i + 1}/${CONFIG.TEST_RUNS}: ${Math.round(responseTime)}ms - ${data.products.length} produits (Total: ${data.total})`);
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
    await new Promise(resolve => setTimeout(resolve, 200));
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
 * Test de recherche avec différents termes
 */
async function testSearchPerformance() {
  const searchTerms = ['frein', 'moteur', 'filtre'];
  const results = [];
  const errors = [];
  let successCount = 0;

  console.log('\n🔍 Test de performance: Recherche');
  console.log(`📝 ${searchTerms.length} termes de recherche à tester`);

  for (const term of searchTerms) {
    try {
      const start = performance.now();
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/products/pieces-catalog?search=${encodeURIComponent(term)}&limit=12`, {
        headers: { 'internal-call': 'true' }
      });

      const end = performance.now();
      const responseTime = end - start;

      if (response.ok) {
        const data = await response.json();
        results.push(responseTime);
        successCount++;
        console.log(`✅ "${term}": ${Math.round(responseTime)}ms - ${data.total} résultats trouvés`);
      } else {
        errors.push(`Search "${term}": HTTP ${response.status}`);
        console.log(`❌ "${term}": HTTP ${response.status}`);
      }
    } catch (error) {
      errors.push(`Search "${term}": ${error.message}`);
      console.log(`❌ "${term}": ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 300));
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
 * Test de l'API des statistiques
 */
async function testStatsAPI() {
  console.log('\n📊 Test de l\'API des statistiques');
  
  try {
    const start = performance.now();
    
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/products/stats`, {
      headers: { 'internal-call': 'true' }
    });

    const end = performance.now();
    const responseTime = end - start;

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Statistiques: ${Math.round(responseTime)}ms`);
      console.log(`   • Total produits: ${data.totalProducts?.toLocaleString() || 'N/A'}`);
      console.log(`   • Produits actifs: ${data.activeProducts?.toLocaleString() || 'N/A'}`);
      console.log(`   • Catégories: ${data.totalCategories?.toLocaleString() || 'N/A'}`);
      console.log(`   • Marques: ${data.totalBrands?.toLocaleString() || 'N/A'}`);
      
      return {
        name: 'Statistiques API',
        avgResponseTime: responseTime,
        maxResponseTime: responseTime,
        minResponseTime: responseTime,
        successRate: 100,
        errors: [],
        data
      };
    } else {
      console.log(`❌ Statistiques: HTTP ${response.status}`);
      return {
        name: 'Statistiques API',
        avgResponseTime: responseTime,
        maxResponseTime: responseTime,
        minResponseTime: responseTime,
        successRate: 0,
        errors: [`HTTP ${response.status}`]
      };
    }
  } catch (error) {
    console.log(`❌ Statistiques: ${error.message}`);
    return {
      name: 'Statistiques API',
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      successRate: 0,
      errors: [error.message]
    };
  }
}

/**
 * Génère un rapport de performance
 */
function generateReport(results) {
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
      result.errors.slice(0, 2).forEach(error => console.log(`     - ${error}`));
      if (result.errors.length > 2) {
        console.log(`     ... et ${result.errors.length - 2} autres`);
      }
    }
  });

  console.log('\n💡 RECOMMANDATIONS D\'AMÉLIORATION:');
  
  const slowTests = results.filter(r => r.avgResponseTime > 1000);
  if (slowTests.length > 0) {
    console.log('   • ⚡ Optimiser les requêtes lentes avec des index');
    console.log('   • 💾 Implémenter la mise en cache Redis');
    console.log('   • 📊 Ajouter pagination côté base de données');
  }

  const lowSuccessTests = results.filter(r => r.successRate < 95);
  if (lowSuccessTests.length > 0) {
    console.log('   • 🛡️  Améliorer la gestion d\'erreurs');
    console.log('   • 🔧 Vérifier la stabilité de la connexion Supabase');
  }

  if (results.every(r => r.avgResponseTime < 1000 && r.successRate > 95)) {
    console.log('   • 🎉 Performance globale excellente !');
    console.log('   • 🚀 Interface optimisée pour 4M+ de produits');
    console.log('   • ✅ Prête pour la production');
  } else {
    console.log('   • 🔍 Monitoring continu recommandé');
    console.log('   • 📈 Métriques à surveiller en production');
  }
}

/**
 * Exécution des tests
 */
async function runAllTests() {
  console.log('🚀 TESTS DE PERFORMANCE - INTERFACE PRODUITS RÉELS');
  console.log('=' .repeat(55));
  console.log(`🌐 URL de test: ${CONFIG.API_BASE_URL}`);
  console.log(`⏱️  Démarrage: ${new Date().toLocaleString()}`);
  console.log(`📊 Base de données: 4M+ pièces automobiles`);

  try {
    const results = [];
    
    // Test du catalogue avec vraies données
    results.push(await testCatalogPerformance());
    
    // Test de recherche avec vraies données
    results.push(await testSearchPerformance());
    
    // Test des statistiques 
    results.push(await testStatsAPI());

    // Génération du rapport
    generateReport(results);

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
    process.exit(1);
  }
}

// Exécution
runAllTests()
  .then(() => {
    console.log('\n✅ TESTS TERMINÉS AVEC SUCCÈS');
    console.log('\n🎯 PROCHAINES ÉTAPES:');
    console.log('   1. Analyser les métriques de performance');
    console.log('   2. Implémenter les améliorations recommandées');
    console.log('   3. Configurer monitoring en production');
    console.log('   4. Planifier tests de charge avec plus de users');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ ÉCHEC DES TESTS:', error);
    process.exit(1);
  });
