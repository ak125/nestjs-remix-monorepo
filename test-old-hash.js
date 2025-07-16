const bcrypt = require('bcrypt');

async function testOldHash() {
  const password = 'password123';
  const oldHash = '$2b$10$XRuTpPvLjLrIJuP2JGmDC.zdi476MP5Guxg.fIhUPDg7areE0W27G';
  
  try {
    console.log('🔍 Test de l\'ancien hash...');
    const isValid = await bcrypt.compare(password, oldHash);
    console.log('✅ Ancien hash valide pour "password123":', isValid);
    
    // Test avec d'autres mots de passe possibles
    const testPasswords = ['password', 'test123', 'admin', 'test'];
    
    console.log('\n🔍 Test avec d\'autres mots de passe...');
    for (const testPwd of testPasswords) {
      const isValidTest = await bcrypt.compare(testPwd, oldHash);
      console.log(`  "${testPwd}": ${isValidTest}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

testOldHash();
