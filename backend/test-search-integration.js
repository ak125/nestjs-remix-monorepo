#!/usr/bin/env node

/**
 * 🧪 Script de Tests Fonctionnels - Intégration Graduelle
 * 
 * Ce script teste l'intégration progressive du service de recherche amélioré
 * et mesure les performances par rapport au service existant.
 */

const axios = require('axios').default;
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEST_QUERIES = [
  'filtre',
  'huile',
  'bougie',
  'plaquettes',
  'amortisseur',
  'courroie',
  'test-invalid-query-#@$%',
  '', // Test vide
];

class SearchTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      basicService: {},
      enhancedService: {},
      comparison: {},
      errors: [],
    };
  }

  /**
   * 🚀 Lancer tous les tests
   */
  async runAllTests() {
    console.log('🧪 === TESTS FONCTIONNELS - INTÉGRATION GRADUELLE ===\n');

    try {
      // Test de santé des services
      await this.testHealthChecks();
      
      // Tests de performance comparatifs
      await this.testPerformanceComparison();
      
      // Tests de validation des endpoints
      await this.testEndpointValidation();
      
      // Tests de charge basiques
      await this.testBasicLoad();
      
      // Génération du rapport
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Erreur durant les tests:', error.message);
      this.results.errors.push({
        test: 'global',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 🏥 Test de santé des services
   */
  async testHealthChecks() {
    console.log('📋 1. Test de santé des services...');
    
    try {
      const healthResponse = await axios.get(`${BASE_URL}/api/search/health`, {
        timeout: 5000,
      });
      
      console.log('✅ Health check réussi');
      console.log('   Status:', healthResponse.data.status);
      
      if (healthResponse.data.services) {
        console.log('   Services:');
        console.log('     - Basic:', healthResponse.data.services.basic?.status);
        console.log('     - Enhanced:', healthResponse.data.services.enhanced?.status);
        
        this.results.healthCheck = {
          status: 'success',
          data: healthResponse.data,
        };
      }
      
    } catch (error) {
      console.log('❌ Health check échoué:', error.message);
      this.results.healthCheck = {
        status: 'failed',
        error: error.message,
      };
    }
    
    console.log('');
  }

  /**
   * ⚡ Tests de performance comparatifs
   */
  async testPerformanceComparison() {
    console.log('📊 2. Tests de performance comparatifs...');
    
    for (const query of TEST_QUERIES.slice(0, 5)) { // Premiers 5 termes
      if (!query.trim()) continue;
      
      console.log(`   Test: "${query}"`);
      
      try {
        // Test service basique
        const basicStart = Date.now();
        const basicResponse = await axios.get(`${BASE_URL}/api/search`, {
          params: { q: query, limit: 20 },
          timeout: 10000,
        });
        const basicTime = Date.now() - basicStart;
        
        // Test service amélioré
        const enhancedStart = Date.now();
        const enhancedResponse = await axios.get(`${BASE_URL}/api/search/enhanced`, {
          params: { q: query, limit: 20 },
          timeout: 10000,
        });
        const enhancedTime = Date.now() - enhancedStart;
        
        // Comparaison
        const improvement = ((basicTime - enhancedTime) / basicTime * 100).toFixed(1);
        
        console.log(`     Basic: ${basicTime}ms (${basicResponse.data.items?.length || 0} résultats)`);
        console.log(`     Enhanced: ${enhancedTime}ms (${enhancedResponse.data.items?.length || 0} résultats)`);
        console.log(`     Amélioration: ${improvement}%`);
        
        // Stockage des résultats
        this.results.basicService[query] = {
          responseTime: basicTime,
          resultCount: basicResponse.data.items?.length || 0,
          service: basicResponse.data.service || 'basic',
        };
        
        this.results.enhancedService[query] = {
          responseTime: enhancedTime,
          resultCount: enhancedResponse.data.items?.length || 0,
          service: enhancedResponse.data.service || 'enhanced',
          features: enhancedResponse.data.features || [],
        };
        
      } catch (error) {
        console.log(`     ❌ Erreur: ${error.message}`);
        this.results.errors.push({
          test: 'performance',
          query,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    console.log('');
  }

  /**
   * 🔍 Tests de validation des endpoints
   */
  async testEndpointValidation() {
    console.log('🔗 3. Validation des endpoints...');
    
    const endpoints = [
      { path: '/api/search', params: { q: 'test' } },
      { path: '/api/search/health', params: {} },
      { path: '/api/search/enhanced', params: { q: 'test' } },
      { path: '/api/search/instant', params: { q: 'test' } },
      { path: '/api/search/mine', params: { code: 'test' } },
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${BASE_URL}${endpoint.path}`, {
          params: endpoint.params,
          timeout: 5000,
        });
        
        console.log(`   ✅ ${endpoint.path} - Status: ${response.status}`);
        
      } catch (error) {
        const status = error.response?.status || 'timeout';
        console.log(`   ❌ ${endpoint.path} - Status: ${status}`);
        
        this.results.errors.push({
          test: 'endpoint-validation',
          endpoint: endpoint.path,
          error: error.message,
          status,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    console.log('');
  }

  /**
   * 🚀 Tests de charge basiques
   */
  async testBasicLoad() {
    console.log('🔥 4. Tests de charge basiques...');
    
    const concurrentRequests = 5;
    const testQuery = 'filtre';
    
    try {
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}/api/search/enhanced`, {
          params: { q: testQuery, limit: 10 },
          timeout: 15000,
        });
        const time = Date.now() - start;
        
        return {
          requestId: i + 1,
          responseTime: time,
          resultCount: response.data.items?.length || 0,
          fromCache: response.data.fromCache || false,
        };
      });
      
      const results = await Promise.all(promises);
      
      const avgTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const cacheHits = results.filter(r => r.fromCache).length;
      
      console.log(`   Requêtes simultanées: ${concurrentRequests}`);
      console.log(`   Temps moyen: ${avgTime.toFixed(0)}ms`);
      console.log(`   Cache hits: ${cacheHits}/${concurrentRequests}`);
      
      this.results.loadTest = {
        concurrentRequests,
        averageResponseTime: Math.round(avgTime),
        cacheHitRate: ((cacheHits / concurrentRequests) * 100).toFixed(1),
        results,
      };
      
    } catch (error) {
      console.log(`   ❌ Test de charge échoué: ${error.message}`);
      this.results.errors.push({
        test: 'load-test',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
    
    console.log('');
  }

  /**
   * 📊 Génération du rapport de tests
   */
  async generateReport() {
    console.log('📋 5. Génération du rapport...');
    
    // Calcul des métriques globales
    const basicTimes = Object.values(this.results.basicService).map(r => r.responseTime);
    const enhancedTimes = Object.values(this.results.enhancedService).map(r => r.responseTime);
    
    const avgBasic = basicTimes.length > 0 
      ? basicTimes.reduce((a, b) => a + b, 0) / basicTimes.length 
      : 0;
    const avgEnhanced = enhancedTimes.length > 0 
      ? enhancedTimes.reduce((a, b) => a + b, 0) / enhancedTimes.length 
      : 0;
    
    this.results.summary = {
      totalTests: TEST_QUERIES.length,
      successfulTests: Object.keys(this.results.basicService).length,
      totalErrors: this.results.errors.length,
      performance: {
        basicServiceAvg: Math.round(avgBasic),
        enhancedServiceAvg: Math.round(avgEnhanced),
        improvement: avgBasic > 0 ? ((avgBasic - avgEnhanced) / avgBasic * 100).toFixed(1) : 0,
      },
    };
    
    // Sauvegarde du rapport
    const reportPath = path.join(__dirname, 'search-integration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log('✅ Rapport généré:', reportPath);
    console.log('\n📊 === RÉSUMÉ DES TESTS ===');
    console.log(`Tests réussis: ${this.results.summary.successfulTests}/${this.results.summary.totalTests}`);
    console.log(`Erreurs: ${this.results.summary.totalErrors}`);
    console.log(`Performance basique: ${this.results.summary.performance.basicServiceAvg}ms`);
    console.log(`Performance améliorée: ${this.results.summary.performance.enhancedServiceAvg}ms`);
    console.log(`Amélioration: ${this.results.summary.performance.improvement}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ Erreurs détectées:');
      this.results.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.test}: ${error.error}`);
      });
    }
  }
}

// Exécution des tests
if (require.main === module) {
  const runner = new SearchTestRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = SearchTestRunner;