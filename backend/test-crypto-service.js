/**
 * Test du PasswordCryptoService pour valider la migration
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Simuler la classe PasswordCryptoService
class TestPasswordCrypto {
  constructor() {
    this.LEGACY_SALT = 'im10tech7';
    this.BCRYPT_ROUNDS = 10;
  }

  async validatePassword(plainPassword, hashedPassword) {
    try {
      console.log(`\n🔍 validatePassword(plainPassword, "${hashedPassword}")`);
      console.log(`   Length: ${hashedPassword.length}`);
      
      // Format bcrypt moderne ($2a$, $2b$, $2y$)
      if (hashedPassword.startsWith('$2')) {
        console.log('   Format: bcrypt');
        const isValid = await bcrypt.compare(plainPassword, hashedPassword);
        console.log(`   Result: ${isValid}`);
        return { isValid, format: 'bcrypt' };
      }

      // Format MD5 simple (32 caractères hex)
      if (hashedPassword.length === 32 && /^[a-f0-9]{32}$/i.test(hashedPassword)) {
        console.log('   Format: MD5');
        const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
        const isValid = md5Hash === hashedPassword;
        console.log(`   Generated MD5: ${md5Hash}`);
        console.log(`   Stored hash:   ${hashedPassword}`);
        console.log(`   Result: ${isValid}`);
        return { isValid, format: 'md5' };
      }

      // Format legacy MD5+crypt avec sel "im10tech7" (13 caractères)
      if (hashedPassword.length === 13) {
        console.log('   Format: MD5+crypt (legacy)');
        const isValid = this.verifyLegacyPassword(plainPassword, hashedPassword);
        return { isValid, format: 'md5-crypt' };
      }

      // Plain text
      if (plainPassword === hashedPassword) {
        console.log('   Format: plain text ⚠️');
        return { isValid: true, format: 'plain' };
      }

      console.log('   Format: UNKNOWN ❌');
      return { isValid: false, format: 'unknown' };
    } catch (error) {
      console.error('   Error:', error.message);
      return { isValid: false, format: 'unknown' };
    }
  }

  verifyLegacyPassword(plainPassword, hashedPassword) {
    try {
      // Reproduire : crypt(md5($password), "im10tech7")
      const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
      console.log(`   Plain password: "${plainPassword}"`);
      console.log(`   MD5 of password: ${md5Hash}`);
      
      const legacyHash = this.phpCrypt(md5Hash, this.LEGACY_SALT);
      console.log(`   Generated legacy: ${legacyHash}`);
      console.log(`   Stored hash:      ${hashedPassword}`);
      
      const isValid = legacyHash === hashedPassword;
      console.log(`   Result: ${isValid}`);
      return isValid;
    } catch (error) {
      console.error('   Error verifying legacy:', error.message);
      return false;
    }
  }

  phpCrypt(password, salt) {
    // PROBLÈME : Utilise SHA256 au lieu de DES crypt
    const hash = crypto
      .createHash('sha256')
      .update(salt + password)
      .digest('base64')
      .substring(0, 13);
    console.log(`   phpCrypt("${password.substring(0, 20)}...", "${salt}") = ${hash}`);
    return hash;
  }
}

// Tests
async function runTests() {
  const service = new TestPasswordCrypto();
  
  console.log('='.repeat(60));
  console.log('TEST DU PASSWORD CRYPTO SERVICE');
  console.log('='.repeat(60));

  // Test 1: bcrypt
  console.log('\n📌 TEST 1: Bcrypt moderne');
  const bcryptHash = await bcrypt.hash('password123', 10);
  await service.validatePassword('password123', bcryptHash);
  await service.validatePassword('wrongpassword', bcryptHash);

  // Test 2: MD5 simple
  console.log('\n📌 TEST 2: MD5 simple');
  const md5Hash = crypto.createHash('md5').update('admin123').digest('hex');
  await service.validatePassword('admin123', md5Hash);
  await service.validatePassword('wrongpassword', md5Hash);

  // Test 3: MD5+crypt legacy (le problème!)
  console.log('\n📌 TEST 3: MD5+crypt legacy (PROBLÈME)');
  const md5OfPassword = crypto.createHash('md5').update('admin123').digest('hex');
  const legacyHash = service.phpCrypt(md5OfPassword, 'im10tech7');
  await service.validatePassword('admin123', legacyHash);
  
  console.log('\n📌 TEST 4: Hash réel de la base de données');
  console.log('   Si tu as le hash réel de superadmin, teste-le ici:');
  // Remplace par le vrai hash depuis la DB
  const realHash = 'imZjfHWyIJJBC'; // Exemple, remplace par le vrai
  console.log(`   Hash réel: ${realHash}`);
  await service.validatePassword('admin123', realHash);

  console.log('\n' + '='.repeat(60));
  console.log('CONCLUSION:');
  console.log('='.repeat(60));
  console.log('Le problème est que phpCrypt() utilise SHA256+base64');
  console.log('alors que PHP crypt() utilise DES encryption.');
  console.log('\n💡 SOLUTION: Utiliser "unix-crypt-td-js" ou similaire');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
