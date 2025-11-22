#!/usr/bin/env node
/**
 * 🧪 Test intégration SEO marque
 * Vérifie que l'endpoint /api/brands/brand/:brand retourne le SEO enrichi
 */

const http = require('http');

const API_URL = 'http://localhost:3000';
const TEST_BRANDS = ['renault', 'peugeot', 'citroen'];

console.log('🧪 Test intégration SEO marque\n');
console.log('🔍 Tests sur endpoint: GET /api/brands/brand/:brand\n');

async function testBrandSeo(brandSlug) {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}/api/brands/brand/${brandSlug}`;
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (err) {
          reject(new Error(`Parse error: ${err.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function runTests() {
  for (const brand of TEST_BRANDS) {
    try {
      console.log(`\n📦 Test marque: ${brand}`);
      console.log('─'.repeat(60));
      
      const result = await testBrandSeo(brand);
      
      if (!result.success) {
        console.log(`❌ Erreur: ${result.message}`);
        continue;
      }
      
      const { data } = result;
      const { seo } = data;
      
      console.log(`✅ Marque trouvée: ${data.name} (ID ${data.id})`);
      
      if (seo) {
        console.log(`\n🎯 SEO enrichi:`);
        console.log(`   Title: ${seo.title?.substring(0, 80) || 'N/A'}`);
        console.log(`   Description: ${seo.description?.substring(0, 100) || 'N/A'}...`);
        console.log(`   H1: ${seo.h1 || 'N/A'}`);
        console.log(`   Keywords: ${seo.keywords?.substring(0, 60) || 'N/A'}`);
        
        // Vérifier variables remplacées
        const hasVariables = [seo.title, seo.description, seo.h1, seo.content]
          .some(text => text && text.includes('#'));
        
        if (hasVariables) {
          console.log(`\n⚠️  Variables non remplacées détectées`);
        } else {
          console.log(`\n✅ Toutes les variables SEO remplacées`);
        }
      } else {
        console.log(`\n⚠️  Pas de données SEO retournées`);
      }
      
    } catch (err) {
      console.log(`❌ Erreur test ${brand}: ${err.message}`);
    }
  }
  
  console.log('\n✅ Tests terminés\n');
}

// Vérifier serveur disponible
http.get(`${API_URL}/api/health`, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Serveur backend disponible\n');
    runTests().catch(console.error);
  } else {
    console.log('❌ Serveur backend non disponible (status:', res.statusCode, ')');
    console.log('💡 Lancer: cd backend && npm run dev\n');
  }
}).on('error', (err) => {
  console.log('❌ Serveur backend non disponible');
  console.log('💡 Lancer: cd backend && npm run dev\n');
});
