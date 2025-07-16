const crypto = require('crypto');

// Test avec le hash original im1wos8Oddj.2
console.log('🔍 Test avec le hash original im1wos8Oddj.2:');
const originalHash = 'im1wos8Oddj.2';
console.log('Hash original:', originalHash);
console.log('Longueur:', originalHash.length);
console.log('');

// Test avec les mots de passe possibles
const testPasswords = ['hello', 'password', 'admin', 'mourad', 'massoussi', 'automecanik', '123456', 'test', '123'];

console.log('🔍 Test SHA-1 avec le hash original:');
testPasswords.forEach(password => {
  const sha1Hash = crypto.createHash('sha1').update(password).digest('hex');
  console.log(`SHA-1 de '${password}': ${sha1Hash}`);
  console.log('Match avec im1wos8Oddj.2:', sha1Hash === originalHash ? '✅ OUI' : '❌ NON');
  console.log('');
});

// Le hash d014cef46c2b35fbdc07b47f104712ce28dfebd9 semble être un hash différent
// Testons si c'est un hash d'un autre type ou d'un autre mot de passe
console.log('🔍 Hash mystère d014cef46c2b35fbdc07b47f104712ce28dfebd9:');
const mysteryHash = 'd014cef46c2b35fbdc07b47f104712ce28dfebd9';

// Test avec d'autres mots de passe possibles
const otherPasswords = [
  'hello123', 'password123', 'admin123', 'mourad123', 'massoussi123',
  'automecanik123', 'seo123', 'gmail123', 'france', 'paris', 'argenteuil',
  'Henri', 'Barbusse', 'henri barbusse', '184', '65535', '0625304215'
];

console.log('🔍 Test avec d\'autres mots de passe:');
otherPasswords.forEach(password => {
  const sha1Hash = crypto.createHash('sha1').update(password).digest('hex');
  console.log(`SHA-1 de '${password}': ${sha1Hash}`);
  console.log('Match avec mystery hash:', sha1Hash === mysteryHash ? '✅ OUI' : '❌ NON');
  console.log('');
});
