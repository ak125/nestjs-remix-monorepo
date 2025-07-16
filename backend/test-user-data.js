// Script simple pour créer manuellement un utilisateur de test
const testUser = {
  "cst_id": "test_unix_crypt_001",
  "cst_mail": "test@example.com",
  "cst_pswd": "abRcsZmlrrKFA", // Hash Unix DES crypt pour "test123"
  "cst_fname": "Test",
  "cst_name": "User",
  "cst_civility": "Mr.",
  "cst_address": "Test Address",
  "cst_zip_code": "12345",
  "cst_city": "Test City",
  "cst_country": "France",
  "cst_tel": "0123456789",
  "cst_gsm": null,
  "cst_is_pro": "0",
  "cst_rs": null,
  "cst_siret": null,
  "cst_activ": "1",
  "cst_level": "1",
  "cst_is_cpy": "0",
  "cst_keylog": "TEST_KEYLOG"
};

console.log('=== Utilisateur de test créé ===');
console.log('');
console.log('🔑 Informations de connexion:');
console.log('Email: test@example.com');
console.log('Mot de passe: test123');
console.log('Hash Unix DES crypt: abRcsZmlrrKFA');
console.log('');
console.log('📋 Données à insérer dans la base:');
console.log(JSON.stringify(testUser, null, 2));
console.log('');
console.log('💡 Instructions:');
console.log('1. Copiez ces données JSON');
console.log('2. Insérez-les dans votre table ___xtr_customer');
console.log('3. Testez la connexion avec email: test@example.com et mot de passe: test123');
console.log('');
console.log('🚀 Ou utilisez cette requête SQL:');
console.log(`INSERT INTO "___xtr_customer" (${Object.keys(testUser).map(k => `"${k}"`).join(', ')}) VALUES (${Object.values(testUser).map(v => v === null ? 'NULL' : `'${v}'`).join(', ')});`);
