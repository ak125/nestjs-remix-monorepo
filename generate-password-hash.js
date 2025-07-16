// 🔧 GÉNÉRATEUR DE HASH BCRYPT POUR MOT DE PASSE
const bcrypt = require('bcrypt');

async function generatePasswordHash() {
  const password = 'password123';
  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('🔐 Mot de passe:', password);
    console.log('🔑 Hash bcrypt:', hash);
    
    // Vérifier que le hash fonctionne
    const isValid = await bcrypt.compare(password, hash);
    console.log('✅ Validation:', isValid);
    
    console.log('\n📝 Requête SQL à exécuter :');
    console.log(`UPDATE "___xtr_customer" SET cst_pswd = '${hash}' WHERE cst_id = 'test-user-456';`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

generatePasswordHash();
