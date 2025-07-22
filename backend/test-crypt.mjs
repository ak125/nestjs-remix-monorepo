// Test simple pour valider le hash Unix DES crypt
const testHash = async () => {
  try {
    const crypt = await import('unix-crypt-td-js');
    
    // Le hash stocké dans la base de données
    const storedHash = 'im1wos8Oddj.2';
    console.log('Hash stocké:', storedHash);
    
    // Test avec différents mots de passe possibles
    const testPasswords = ['hello', 'password', 'test', 'admin', '123456', 'root'];
    
    for (const password of testPasswords) {
      console.log(`\n--- Test avec: ${password} ---`);
      
      // Extraction du salt (2 premiers caractères)
      const salt = storedHash.substring(0, 2);
      console.log('Salt:', salt);
      
      // Génération du hash avec le salt
      const generatedHash = crypt.default(password, salt);
      console.log('Hash généré:', generatedHash);
      console.log('Match:', generatedHash === storedHash ? '✅ OUI' : '❌ NON');
    }
  } catch (error) {
    console.error('Erreur:', error);
  }
};

testHash();
