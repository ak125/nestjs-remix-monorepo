/**
 * 🧪 SCRIPT DE TEST - SYSTÈME DE MIGRATION URLs PIÈCES
 * 
 * Tests automatisés pour valider le système de redirection 301
 * des anciennes URLs vers la nouvelle architecture
 * 
 * @version 1.0.0
 * @since 2025-09-14
 * @author SEO Migration Team
 */

import { VehiclePartUrlMigrationService } from '../src/modules/vehicles/services/vehicle-part-url-migration.service';

// ====================================
// 🎯 DONNÉES DE TEST
// ====================================

const TEST_URLS = [
  // Exemples fournis par l'utilisateur
  "/pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html",
  "/pieces/filtre-a-air-8/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html",
  "/pieces/filtre-d-habitacle-424/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html",
  
  // Tests additionnels pour validation complète
  "/pieces/plaquettes-de-frein-15/bmw-5/serie-3-e90-1234/320-i-5678.html",
  "/pieces/amortisseurs-35/peugeot-3/208-9876/1-6-hdi-4321.html",
  "/pieces/phares-46/renault-10/clio-5555/1-2-tce-7777.html",
  
  // Tests d'erreur
  "/pieces/categorie-inexistante-999/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html",
  "/pieces/format-invalide",
  "/autre-route/pas-pieces"
];

const EXPECTED_MIGRATIONS = [
  {
    input: "/pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html",
    expected: "/pieces/audi-22/a7-sportback-22059/type-34940/filtres",
    category: "filtres"
  },
  {
    input: "/pieces/filtre-a-air-8/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html",
    expected: "/pieces/audi-22/a7-sportback-22059/type-34940/filtres",
    category: "filtres"
  },
  {
    input: "/pieces/filtre-d-habitacle-424/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html",
    expected: "/pieces/audi-22/a7-sportback-22059/type-34940/filtres",
    category: "filtres"
  }
];

// ====================================
// 🧪 CLASSE DE TEST
// ====================================

class UrlMigrationTester {
  private service: VehiclePartUrlMigrationService;
  private results: {
    total: number;
    passed: number;
    failed: number;
    errors: Array<{test: string, error: string}>;
    details: Array<{test: string, status: 'PASS' | 'FAIL', details: string}>;
  };

  constructor() {
    this.service = new VehiclePartUrlMigrationService();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      details: []
    };
  }

  /**
   * 🔍 Test du parsing d'URLs
   */
  testUrlParsing() {
    console.log("\\n🔍 === TEST PARSING URLs ===");
    
    TEST_URLS.forEach((url, index) => {
      this.results.total++;
      
      try {
        const parsed = this.service.parseLegacyPartUrl(url);
        
        if (parsed) {
          console.log(`✅ Test ${index + 1}: ${url}`);
          console.log(`   → Catégorie: ${parsed.category} (${parsed.categoryId})`);
          console.log(`   → Véhicule: ${parsed.brand}-${parsed.brandId} ${parsed.model}-${parsed.modelId} ${parsed.type}-${parsed.typeId}`);
          
          this.results.passed++;
          this.results.details.push({
            test: `Parse ${url}`,
            status: 'PASS',
            details: `Catégorie: ${parsed.category}, Véhicule: ${parsed.brand} ${parsed.model} ${parsed.type}`
          });
        } else {
          console.log(`❌ Test ${index + 1}: ${url} - Parsing échoué`);
          this.results.failed++;
          this.results.details.push({
            test: `Parse ${url}`,
            status: 'FAIL',
            details: 'Parsing échoué'
          });
        }
      } catch (error) {
        console.error(`💥 Test ${index + 1}: ${url} - Erreur:`, error);
        this.results.failed++;
        this.results.errors.push({
          test: `Parse ${url}`,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * 🔄 Test des migrations complètes
   */
  testCompleteMigrations() {
    console.log("\\n🔄 === TEST MIGRATIONS COMPLÈTES ===");
    
    EXPECTED_MIGRATIONS.forEach((test, index) => {
      this.results.total++;
      
      try {
        const result = this.service.migratePartUrl(test.input);
        
        if (result && result.newUrl === test.expected) {
          console.log(`✅ Migration ${index + 1}: SUCCÈS`);
          console.log(`   Input:    ${test.input}`);
          console.log(`   Expected: ${test.expected}`);
          console.log(`   Actual:   ${result.newUrl}`);
          console.log(`   Category: ${result.metadata.legacy_category} → ${result.metadata.modern_category}`);
          
          this.results.passed++;
          this.results.details.push({
            test: `Migration ${test.input}`,
            status: 'PASS',
            details: `${test.input} → ${result.newUrl}`
          });
        } else {
          console.log(`❌ Migration ${index + 1}: ÉCHEC`);
          console.log(`   Input:    ${test.input}`);
          console.log(`   Expected: ${test.expected}`);
          console.log(`   Actual:   ${result?.newUrl || 'null'}`);
          
          this.results.failed++;
          this.results.details.push({
            test: `Migration ${test.input}`,
            status: 'FAIL',
            details: `Expected ${test.expected}, got ${result?.newUrl || 'null'}`
          });
        }
      } catch (error) {
        console.error(`💥 Migration ${index + 1}: Erreur:`, error);
        this.results.failed++;
        this.results.errors.push({
          test: `Migration ${test.input}`,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * 📊 Test des statistiques
   */
  testServiceStats() {
    console.log("\\n📊 === TEST STATISTIQUES ===");
    
    try {
      const stats = this.service.getMappingStats();
      
      console.log(`✅ Statistiques récupérées:`);
      console.log(`   Total mappings: ${stats.total_mappings}`);
      console.log(`   Catégories modernes: ${stats.categories_count}`);
      console.log(`   Échantillon mappings:`);
      
      stats.legacy_categories.slice(0, 5).forEach(cat => {
        console.log(`     ${cat.name} (${cat.id}) → ${cat.modern_equivalent}`);
      });
      
      this.results.passed++;
      this.results.details.push({
        test: 'Service Stats',
        status: 'PASS',
        details: `${stats.total_mappings} mappings, ${stats.categories_count} catégories`
      });
      
    } catch (error) {
      console.error(`💥 Erreur stats:`, error);
      this.results.failed++;
      this.results.errors.push({
        test: 'Service Stats',
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    this.results.total++;
  }

  /**
   * 🚗 Test génération redirections véhicule
   */
  testVehicleRedirections() {
    console.log("\\n🚗 === TEST REDIRECTIONS VÉHICULE ===");
    
    try {
      const redirections = this.service.generateVehicleRedirections(
        'audi', 22, 'a7-sportback', 22059, '3-0-tfsi-quattro', 34940
      );
      
      console.log(`✅ Redirections générées: ${redirections.length}`);
      console.log(`   Échantillon (3 premières):`);
      
      redirections.slice(0, 3).forEach((redirect, index) => {
        console.log(`     ${index + 1}. ${redirect.source} → ${redirect.destination}`);
      });
      
      // Vérifier que nos exemples sont inclus
      const expectedRedirects = [
        '/pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html',
        '/pieces/filtre-a-air-8/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html',
        '/pieces/filtre-d-habitacle-424/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html'
      ];
      
      const found = expectedRedirects.filter(expected => 
        redirections.some(r => r.source === expected)
      );
      
      if (found.length === expectedRedirects.length) {
        console.log(`✅ Tous les exemples utilisateur sont inclus`);
        this.results.passed++;
        this.results.details.push({
          test: 'Vehicle Redirections',
          status: 'PASS',
          details: `${redirections.length} redirections générées, exemples inclus`
        });
      } else {
        console.log(`❌ Exemples manquants: ${expectedRedirects.length - found.length}`);
        this.results.failed++;
        this.results.details.push({
          test: 'Vehicle Redirections',
          status: 'FAIL',
          details: `${found.length}/${expectedRedirects.length} exemples trouvés`
        });
      }
      
    } catch (error) {
      console.error(`💥 Erreur redirections véhicule:`, error);
      this.results.failed++;
      this.results.errors.push({
        test: 'Vehicle Redirections',
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    this.results.total++;
  }

  /**
   * 📋 Affichage du rapport final
   */
  displayReport() {
    console.log("\\n" + "=".repeat(60));
    console.log("📋 RAPPORT FINAL DES TESTS");
    console.log("=".repeat(60));
    
    console.log(`\\n📊 RÉSUMÉ:`);
    console.log(`   Total tests: ${this.results.total}`);
    console.log(`   ✅ Réussis: ${this.results.passed}`);
    console.log(`   ❌ Échoués: ${this.results.failed}`);
    console.log(`   📈 Taux de réussite: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
    
    if (this.results.errors.length > 0) {
      console.log(`\\n💥 ERREURS (${this.results.errors.length}):`);
      this.results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.test}: ${error.error}`);
      });
    }
    
    if (this.results.failed > 0) {
      console.log(`\\n❌ TESTS ÉCHOUÉS:`);
      this.results.details
        .filter(d => d.status === 'FAIL')
        .forEach((detail, index) => {
          console.log(`   ${index + 1}. ${detail.test}: ${detail.details}`);
        });
    }
    
    console.log(`\\n🎯 CONCLUSION:`);
    if (this.results.failed === 0) {
      console.log(`   🎉 TOUS LES TESTS SONT PASSÉS ! Le système de migration est opérationnel.`);
    } else {
      console.log(`   ⚠️  ${this.results.failed} test(s) en échec. Révision nécessaire.`);
    }
    
    console.log("\\n" + "=".repeat(60));
  }

  /**
   * 🚀 Lance tous les tests
   */
  async runAllTests() {
    console.log("🧪 DÉMARRAGE DES TESTS SYSTÈME MIGRATION URLs PIÈCES");
    console.log("Date:", new Date().toISOString());
    
    this.testUrlParsing();
    this.testCompleteMigrations();
    this.testServiceStats();
    this.testVehicleRedirections();
    
    this.displayReport();
    
    return {
      success: this.results.failed === 0,
      total: this.results.total,
      passed: this.results.passed,
      failed: this.results.failed,
      rate: (this.results.passed / this.results.total) * 100
    };
  }
}

// ====================================
// 🎯 EXÉCUTION DES TESTS
// ====================================

if (require.main === module) {
  const tester = new UrlMigrationTester();
  
  tester.runAllTests()
    .then(results => {
      console.log(`\\n🏁 Tests terminés: ${results.passed}/${results.total} (${results.rate.toFixed(1)}%)`);
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error("💥 Erreur fatale lors des tests:", error);
      process.exit(1);
    });
}

export { UrlMigrationTester };