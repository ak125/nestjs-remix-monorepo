/**
 * Script pour vérifier les sections h2 et h3 de l'article support-moteur
 */

const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

async function checkSections() {
  try {
    console.log('🔍 Vérification des sections h2 et h3\n');
    
    // 1. Récupérer l'article complet
    const articleRes = await fetch(`${baseUrl}/api/blog/article/by-gamme/support-moteur`);
    const articleData = await articleRes.json();
    const article = articleData.data;
    
    console.log(`📄 Article: ${article.title}`);
    console.log(`   Legacy ID: ${article.legacy_id}`);
    console.log(`   Type: ${article.type}`);
    console.log(`   Sections: ${article.sections?.length || 0}\n`);
    
    if (article.sections && article.sections.length > 0) {
      console.log('📋 Sections chargées:');
      article.sections.forEach((section, index) => {
        const indent = section.level === 3 ? '    ' : '  ';
        console.log(`${indent}${index + 1}. [H${section.level}] ${section.title}`);
        console.log(`${indent}   Anchor: ${section.anchor}`);
      });
    } else {
      console.log('⚠️  Aucune section trouvée !');
    }
    
    // Compter les h2 et h3
    const h2Count = article.sections?.filter(s => s.level === 2).length || 0;
    const h3Count = article.sections?.filter(s => s.level === 3).length || 0;
    
    console.log(`\n📊 Résumé:`);
    console.log(`   - H2: ${h2Count}`);
    console.log(`   - H3: ${h3Count}`);
    console.log(`   - Total: ${h2Count + h3Count}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkSections();
