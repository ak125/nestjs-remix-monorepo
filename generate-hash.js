const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'password123';
  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('🔐 Hash généré pour "password123":');
    console.log(hash);
    console.log('');
    
    // Vérifier que le hash fonctionne
    const isValid = await bcrypt.compare(password, hash);
    console.log('✅ Vérification du hash:', isValid);
    
    // Générer le script SQL
    console.log('');
    console.log('📝 Script SQL à exécuter dans Supabase:');
    console.log('-------------------------------------------');
    console.log(`UPDATE "___xtr_customer"`);
    console.log(`SET cst_pswd = '${hash}'`);
    console.log(`WHERE cst_id = 'test-user-456';`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

generateHash();
