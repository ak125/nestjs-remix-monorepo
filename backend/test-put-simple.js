/**
 * Test simple API PUT /api/brands/:id/seo
 * Usage: node test-put-simple.js
 */

async function testPutBrandSeo() {
  const marqueId = 140; // Renault
  const baseUrl = 'http://localhost:3000/api';

  console.log('🧪 Test API PUT /api/brands/140/seo\n');

  try {
    // 1. GET état actuel
    console.log('📖 GET état actuel...');
    const getRes = await fetch(`${baseUrl}/brands/${marqueId}`);
    const brand = await getRes.json();
    console.log(`Marque: ${brand.marqueNom}`);
    console.log(`SEO actuel:`, brand.seo ? JSON.stringify(brand.seo, null, 2).substring(0, 200) + '...' : 'Pas de SEO');
    console.log('');

    // 2. PUT UPDATE partiel
    console.log('✏️ PUT UPDATE partiel (title + description)...');
    const putRes = await fetch(`${baseUrl}/brands/${marqueId}/seo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sm_title: 'Test API PUT - Renault - Pièces Auto Pas Cher',
        sm_descrip: 'Description mise à jour via API PUT. Catalogue complet pièces Renault avec variables #PrixPasCher#.',
      }),
    });

    const putData = await putRes.json();
    console.log('Réponse PUT:', JSON.stringify(putData, null, 2));

    if (putData.success) {
      console.log('✅ UPDATE réussi\n');

      // 3. Vérifier GET après UPDATE
      console.log('🔍 GET après UPDATE...');
      const getRes2 = await fetch(`${baseUrl}/brands/${marqueId}`);
      const brand2 = await getRes2.json();
      console.log('SEO mis à jour:');
      console.log(`  title: ${brand2.seo?.title}`);
      console.log(`  description: ${brand2.seo?.description?.substring(0, 100)}...`);
      console.log('');

      // 4. PUT UPDATE complet
      console.log('📝 PUT UPDATE complet (tous champs)...');
      const putFullRes = await fetch(`${baseUrl}/brands/${marqueId}/seo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sm_title: 'Pièces Auto Renault | #PrixPasCher# | Automecanik',
          sm_descrip: 'Catalogue complet pièces détachées #VMarque# avec livraison express. Variables: #PrixPasCher#',
          sm_h1: 'Pièces Détachées #VMarque# - Freinage, Distribution, Embrayage',
          sm_content: '<h2>Notre gamme complète pour #VMarque#</h2><p>Découvrez toutes les pièces #PrixPasCher# disponibles en stock.</p><ul><li>Freinage</li><li>Distribution</li><li>Embrayage</li></ul>',
          sm_keywords: 'renault, pieces auto renault, freinage renault, prix pas cher',
        }),
      });

      const putFullData = await putFullRes.json();
      console.log('Réponse PUT complet:', JSON.stringify(putFullData, null, 2).substring(0, 300) + '...');

      if (putFullData.success) {
        console.log('✅ UPDATE complet réussi\n');

        // 5. Vérifier traitement variables
        console.log('🔧 GET final - Vérification traitement variables...');
        const getRes3 = await fetch(`${baseUrl}/brands/${marqueId}`);
        const brand3 = await getRes3.json();
        console.log('SEO final avec variables traitées:');
        console.log(`  title: ${brand3.seo?.title}`);
        console.log(`  description: ${brand3.seo?.description?.substring(0, 100)}...`);
        console.log(`  h1: ${brand3.seo?.h1}`);
        console.log(`  content: ${brand3.seo?.content?.substring(0, 150)}...`);
        console.log(`  contentText: ${brand3.seo?.contentText?.substring(0, 150)}...`);
        console.log('');

        console.log('✅ Tous les tests réussis !');
        process.exit(0);
      } else {
        console.error('❌ UPDATE complet échoué:', putFullData);
        process.exit(1);
      }
    } else {
      console.error('❌ UPDATE partiel échoué:', putData);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error('Vérifiez que le backend tourne sur http://localhost:3000');
    process.exit(1);
  }
}

testPutBrandSeo();
