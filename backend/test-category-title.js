const axios = require('axios');

async function testCategoryAPI() {
    console.log('🔧 Test de l\'API des catégories pour filtre à huile...\n');
    
    try {
        // Test avec différents slugs potentiels pour filtre à huile
        const testSlugs = [
            'filtre-a-huile',
            'filtre-huile',
            'bande-de-filtre-a-huile-de-remplacement',
            'cle-de-filtre-a-huile-boite-de-vi'
        ];
        
        const baseURL = 'http://localhost:3000/api/categories';
        
        for (const slug of testSlugs) {
            console.log(`📋 Test avec slug: ${slug}`);
            
            try {
                const response = await axios.get(`${baseURL}/${slug}`);
                
                if (response.data) {
                    console.log(`✅ Succès pour ${slug}:`);
                    console.log(`   ID: ${response.data.id}`);
                    console.log(`   Name: ${response.data.name}`);
                    console.log(`   Title: ${response.data.title || 'Non défini'}`);
                    console.log(`   Slug: ${response.data.slug}`);
                    console.log('');
                    
                    // Vérifier si le title contient le texte attendu
                    if (response.data.title && response.data.title.includes('Filtre à huile pas cher pour votre véhicule')) {
                        console.log('🎯 TITRE CORRECT TROUVÉ !');
                    }
                    
                } else {
                    console.log(`❌ Pas de données pour ${slug}`);
                }
                
            } catch (error) {
                if (error.response?.status === 404) {
                    console.log(`❌ 404 - Catégorie non trouvée pour ${slug}`);
                } else {
                    console.log(`❌ Erreur pour ${slug}:`, error.message);
                }
            }
            
            console.log('---');
        }
        
    } catch (error) {
        console.error('❌ Erreur générale:', error.message);
    }
}

testCategoryAPI();