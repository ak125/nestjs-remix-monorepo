const crypto = require('crypto');

// Le hash stocké pour automecanik.seo@gmail.com
const storedHash = 'd014cef46c2b35fbdc07b47f104712ce28dfebd9';
console.log('Hash stocké:', storedHash);
console.log('Longueur:', storedHash.length);
console.log('');

// Test avec différents mots de passe possibles
const testPasswords = [
  'hello', 'password', 'admin', 'mourad', 'massoussi', 'automecanik', 
  '123456', 'test', 'seo', 'gmail', 'mouradmassoussi', 'argenteuil',
  'MOURAD', 'MASSOUSSI', 'Mourad', 'Massoussi', 'mouradmass',
  'Hello', 'Password', 'Test123', 'admin123', 'user123'
];

console.log('🔍 Test des mots de passe courants:');
testPasswords.forEach(password => {
  const sha1Hash = crypto.createHash('sha1').update(password).digest('hex');
  console.log(`SHA-1 de '${password}': ${sha1Hash}`);
  console.log('Match:', sha1Hash === storedHash ? '✅ OUI' : '❌ NON');
  console.log('');
});

// Test avec des variations de 123
console.log('🔍 Test avec variations de 123:');
const variations123 = ['123', '1234', '12345', '123456789', '0123', '123!'];
variations123.forEach(password => {
  const sha1Hash = crypto.createHash('sha1').update(password).digest('hex');
  console.log(`SHA-1 de '${password}': ${sha1Hash}`);
  console.log('Match:', sha1Hash === storedHash ? '✅ OUI' : '❌ NON');
  console.log('');
});

console.log('🔍 Hash de référence pour "123":', crypto.createHash('sha1').update('123').digest('hex'));
console.log('🔍 Hash stocké               :', storedHash);
console.log('🔍 Correspondance            :', crypto.createHash('sha1').update('123').digest('hex') === storedHash ? '✅ OUI' : '❌ NON');
