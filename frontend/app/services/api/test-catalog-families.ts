// Test rapide de l'API Catalog Families
import { catalogFamiliesApi } from './catalog-families.api';

async function testCatalogApi() {
  try {
    console.log('🧪 Test de récupération des familles...');
    const families = await catalogFamiliesApi.getCatalogFamilies();
    
    console.log(`✅ ${families.length} familles récupérées`);
    
    // Test génération pièces populaires
    console.log('🧪 Test génération pièces populaires...');
    const popularParts = catalogFamiliesApi.generatePopularParts(
      families, 
      'BMW Série 1 (F21) 1.1 4 D', 
      115277
    );
    
    console.log(`✅ ${popularParts.length} pièces populaires générées:`);
    popularParts.forEach((part, i) => {
      console.log(`  ${i+1}. ${part.pg_name} (${part.pg_alias})`);
    });
    
  } catch (error) {
    console.error('❌ Erreur test:', error);
  }
}

if (typeof window === 'undefined') {
  // Node.js environment
  testCatalogApi();
}