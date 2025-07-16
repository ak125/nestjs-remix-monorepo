const bcrypt = require('bcrypt');

const hash = '$2b$10$XRuTpPvLjLrIJuP2JGmDC.zdi476MP5Guxg.fIhUPDg7areE0W27G';
const password = 'test123';

console.log('🔍 Test du hash bcrypt:');
console.log('Hash:', hash);
console.log('Password:', password);

bcrypt.compare(password, hash)
  .then(result => {
    console.log('✅ Résultat:', result);
    if (result) {
      console.log('✅ Hash fonctionne correctement');
    } else {
      console.log('❌ Hash ne fonctionne pas');
    }
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
  });
