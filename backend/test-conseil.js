/**
 * Script de test pour vérifier les conseils dans la base
 */

const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

async function testConseil() {
  try {
    console.log('🔍 Test de l\'endpoint conseil...\n');
    
    // Test 1: support-moteur (pg_id: 247)
    console.log('📋 Test pg_id=247 (support-moteur):');
    const res1 = await fetch(`${baseUrl}/api/blog/conseil/247`);
    const data1 = await res1.json();
    console.log('  Résultat:', JSON.stringify(data1, null, 2));
    
    // Test 2: Vérifier quelques autres pg_id
    const testIds = [1, 2, 10, 50, 100, 200];
    console.log('\n🔍 Test de plusieurs pg_id:');
    
    for (const pg_id of testIds) {
      const res = await fetch(`${baseUrl}/api/blog/conseil/${pg_id}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        console.log(`  ✅ pg_id=${pg_id}: ${data.data.title}`);
      } else {
        console.log(`  ⚠️  pg_id=${pg_id}: Aucun conseil`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testConseil();
