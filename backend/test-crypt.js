const { execSync } = require('child_process');

// Test avec openssl pour voir si c'est un hash DES standard
try {
  const storedHash = 'im1wos8Oddj.2';
  console.log('Hash stocké:', storedHash);
  console.log('Salt:', storedHash.substring(0, 2));
  
  // Essayons d'utiliser le crypt() system call si disponible
  const crypt = require('unix-crypt-td-js');
  
  const testPasswords = [
    'hello', 'world', 'password', 'secret', 'admin', 'root', 'test',
    'user', 'pass', 'login', 'client', 'guest', 'demo', 'public',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
    'ab', 'abc', '123', '12', '1234',
    'customer', 'cst', 'usr', 'mail', 'email'
  ];
  
  for (const password of testPasswords) {
    const hash = crypt(password, storedHash.substring(0, 2));
    console.log(`Test "${password}" -> "${hash}" (match: ${hash === storedHash})`);
    
    if (hash === storedHash) {
      console.log(`\\n🎉 TROUVÉ! Mot de passe: "${password}"`);
      break;
    }
  }
} catch (error) {
  console.error('Erreur:', error);
}
