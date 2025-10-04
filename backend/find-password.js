/**
 * Tester différents mots de passe pour trouver le bon
 */
const crypto = require('crypto');

const storedHash = 'a2ef1b1b18ecdb1e4d25d3a5cda04b5c';

const passwordsToTest = [
  'admin123',
  'admin',
  'superadmin',
  'password',
  'password123',
  '123456',
  'Admin123',
  'Admin@123',
  'superadmin123',
  'SuperAdmin',
  'SuperAdmin123',
  'test',
  'test123',
  'fafa',
  'autoparts',
  'autoparts123',
  '', // Empty password
];

console.log('🔍 RECHERCHE DU MOT DE PASSE CORRESPONDANT\n');
console.log(`Hash cible: ${storedHash}\n`);
console.log('='.repeat(60));

let found = false;

for (const password of passwordsToTest) {
  const md5 = crypto.createHash('md5').update(password).digest('hex');
  const match = md5 === storedHash;
  
  if (match) {
    console.log(`\n✅ ✅ ✅ TROUVÉ ! ✅ ✅ ✅`);
    console.log(`Mot de passe: "${password}"`);
    console.log(`MD5: ${md5}`);
    console.log('='.repeat(60));
    found = true;
    break;
  } else {
    console.log(`❌ "${password}" → ${md5}`);
  }
}

if (!found) {
  console.log('\n' + '='.repeat(60));
  console.log('❌ Aucun des mots de passe testés ne correspond');
  console.log('\n💡 Le mot de passe pourrait être:');
  console.log('   - Un mot de passe personnalisé');
  console.log('   - Stocké avec un salt différent');
  console.log('   - Besoin de vérifier dans l\'ancien système PHP');
  console.log('='.repeat(60));
}
