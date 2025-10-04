/**
 * Test direct du PasswordCryptoService
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { crypt } = require('unix-crypt-td-js');

// Reproduire la classe PasswordCryptoService
class PasswordCryptoService {
  constructor() {
    this.LEGACY_SALT = 'im10tech7';
    this.BCRYPT_ROUNDS = 10;
  }

  async validatePassword(plainPassword, hashedPassword) {
    console.log(`\n🔍 validatePassword("${plainPassword}", "${hashedPassword}")`);
    console.log(`   Hash length: ${hashedPassword.length}`);
    
    try {
      // Format bcrypt moderne
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
        console.log(`   Generated: ${md5Hash}`);
        console.log(`   Stored:    ${hashedPassword}`);
        console.log(`   Result: ${isValid}`);
        return { isValid, format: 'md5' };
      }

      // Format legacy MD5+crypt
      if (hashedPassword.length === 13) {
        console.log('   Format: MD5+crypt');
        const isValid = this.verifyLegacyPassword(plainPassword, hashedPassword);
        return { isValid, format: 'md5-crypt' };
      }

      console.log('   Format: unknown');
      return { isValid: false, format: 'unknown' };
    } catch (error) {
      console.error('   Error:', error.message);
      return { isValid: false, format: 'unknown' };
    }
  }

  verifyLegacyPassword(plainPassword, hashedPassword) {
    try {
      const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
      console.log(`     MD5 of password: ${md5Hash}`);
      
      const salt = hashedPassword.substring(0, 2);
      const legacyHash = crypt(md5Hash, salt);
      console.log(`     crypt() with salt "${salt}": ${legacyHash}`);
      console.log(`     Stored hash: ${hashedPassword}`);
      
      const isValid = legacyHash === hashedPassword;
      console.log(`     Result: ${isValid}`);
      return isValid;
    } catch (error) {
      console.error('     Error:', error.message);
      return false;
    }
  }
}

// Tests
async function runTests() {
  const service = new PasswordCryptoService();
  
  console.log('='.repeat(70));
  console.log('TEST DIRECT DU PASSWORD CRYPTO SERVICE');
  console.log('='.repeat(70));

  // Test 1: Bcrypt (testlogin)
  console.log('\n📌 TEST 1: testlogin@autoparts.com (bcrypt)');
  const bcryptHash = await bcrypt.hash('password123', 10);
  console.log(`Generated bcrypt hash: ${bcryptHash}`);
  await service.validatePassword('password123', bcryptHash);
  await service.validatePassword('wrongpassword', bcryptHash);

  // Test 2: MD5 simple (superadmin)
  console.log('\n📌 TEST 2: superadmin@autoparts.com (MD5)');
  const md5Hash = 'a2ef1b1b18ecdb1e4d25d3a5cda04b5c';  // Hash réel de la DB
  await service.validatePassword('admin123', md5Hash);
  await service.validatePassword('password', md5Hash);
  await service.validatePassword('superadmin', md5Hash);

  console.log('\n' + '='.repeat(70));
}

runTests().catch(console.error);
