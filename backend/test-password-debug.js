#!/usr/bin/env node
const crypto = require('crypto');
const bcrypt = require('bcrypt');

console.log('🔍 Test de validation des mots de passe\n');

// Test 1: MD5 simple (pour superadmin)
const password1 = 'admin123';
const md5Simple = crypto.createHash('md5').update(password1).digest('hex');
console.log(`1️⃣  MD5 simple de "${password1}": ${md5Simple}`);

// Test 2: MD5 + crypt legacy
function phpCrypt(str, salt) {
  const crypto = require('crypto');
  // Simuler crypt() de PHP avec DES
  const hash = crypto.createHash('md5').update(salt + str).digest('hex');
  return salt + hash.substring(0, 11);
}

const md5Hash = crypto.createHash('md5').update(password1).digest('hex');
const salt = 'im10tech7';
const legacyHash = phpCrypt(md5Hash, salt);
console.log(`2️⃣  Legacy (MD5+crypt) de "${password1}": ${legacyHash}`);

// Test 3: bcrypt
async function testBcrypt() {
  const bcryptHash = await bcrypt.hash('password123', 10);
  console.log(`3️⃣  bcrypt de "password123": ${bcryptHash}`);
  
  // Test de validation
  const isValid = await bcrypt.compare('password123', '$2b$10$ILdHWVWRJB1qG5mvH1vqWOoLT8apmVOGXj3zVkw3qNr5JaRZPNigu');
  console.log(`4️⃣  Validation bcrypt testlogin: ${isValid}`);
}

testBcrypt().catch(console.error);

console.log('\n📊 Formats attendus:');
console.log('   - bcrypt: commence par $2b$ (60 chars)');
console.log('   - MD5 simple: 32 caractères hexadécimaux');
console.log('   - Legacy: 13 caractères (sel + hash tronqué)');
