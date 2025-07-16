const bcrypt = require('bcrypt');

async function testAuth() {
  console.log('🔍 Test d\'authentification');
  
  // Simuler ce qui se passe dans validatePassword
  const userInput = 'test123';
  const storedHash = '$2b$10$XRuTpPvLjLrIJuP2JGmDC.zdi476MP5Guxg.fIhUPDg7areE0W27G';
  
  console.log('📝 Données:');
  console.log('  - Mot de passe saisi:', userInput);
  console.log('  - Hash stocké:', storedHash);
  
  // Test 1: Comparaison directe (ancien système)
  console.log('\n🔍 Test 1: Comparaison directe');
  const directMatch = userInput === storedHash;
  console.log('  - Résultat:', directMatch);
  
  // Test 2: SHA-1 hash
  console.log('\n🔍 Test 2: SHA-1 hash');
  const crypto = require('crypto');
  const sha1Hash = crypto.createHash('sha1').update(userInput).digest('hex');
  console.log('  - SHA-1 calculé:', sha1Hash);
  const sha1Match = sha1Hash === storedHash;
  console.log('  - Résultat:', sha1Match);
  
  // Test 3: bcrypt
  console.log('\n🔍 Test 3: bcrypt');
  try {
    const bcryptResult = await bcrypt.compare(userInput, storedHash);
    console.log('  - Résultat:', bcryptResult);
    
    if (bcryptResult) {
      console.log('✅ Authentification réussie avec bcrypt');
    } else {
      console.log('❌ Authentification échouée avec bcrypt');
    }
  } catch (error) {
    console.error('❌ Erreur bcrypt:', error);
  }
  
  // Test 4: Unix DES crypt (pour un hash de 13 caractères)
  console.log('\n🔍 Test 4: Unix DES crypt');
  if (storedHash.length === 13) {
    console.log('  - Hash de longueur 13 détecté');
    try {
      const crypt = require('unix-crypt-td-js');
      const salt = storedHash.substring(0, 2);
      const cryptResult = crypt(userInput, salt);
      console.log('  - Résultat Unix DES:', cryptResult === storedHash);
    } catch (error) {
      console.error('  - Erreur Unix DES:', error);
    }
  } else {
    console.log('  - Hash ne correspond pas au format Unix DES (longueur:', storedHash.length, ')');
  }
}

testAuth();
