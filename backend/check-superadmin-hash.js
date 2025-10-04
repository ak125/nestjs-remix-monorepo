/**
 * Vérifier le hash réel du superadmin dans la base de données
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'OK' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSuperadmin() {
  console.log('\n🔍 VÉRIFICATION DU HASH SUPERADMIN\n');
  console.log('='.repeat(60));

  // Chercher dans ___config_admin (colonnes cnfa_*)
  const emailToCheck = process.argv[2] || 'superadmin@autoparts.com';
  console.log(`Checking email: ${emailToCheck}\n`);
  
  const { data: admins, error: adminError } = await supabase
    .from('___config_admin')
    .select('*')
    .eq('cnfa_mail', emailToCheck);

  if (adminError) {
    console.error('❌ Erreur admin:', adminError.message);
  } else if (admins && admins.length > 0) {
    console.log('\n✅ Trouvé dans ___config_admin:');
    displayUserInfo(admins[0], 'cnfa');
    return;
  }
  
  // Essayer dans ___xtr_customer (colonnes cst_*)
  const { data: customers, error: customerError } = await supabase
    .from('___xtr_customer')
    .select('cst_id, cst_mail, cst_pswd, cst_name, cst_fname, cst_level')
    .eq('cst_mail', 'superadmin@autoparts.com');
  
  if (customerError) {
    console.error('❌ Erreur customer:', customerError.message);
    console.log('\n❌ superadmin@autoparts.com introuvable dans les deux tables');
    return;
  }
  
  if (customers && customers.length > 0) {
    console.log('\n✅ Trouvé dans ___xtr_customer:');
    displayUserInfo(customers[0], 'cst');
  } else {
    console.log('\n❌ superadmin@autoparts.com introuvable');
  }
}

function displayUserInfo(user, prefix) {
  const email = user[`${prefix}_mail`];
  const firstName = user[`${prefix}_fname`] || '';
  const lastName = user[`${prefix}_name`] || user[`${prefix}_nom`] || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const id = user[`${prefix}_id`];
  const level = user[`${prefix}_level`];
  const hash = user[`${prefix}_pswd`];
  
  console.log(`
📧 Email:     ${email}
👤 Nom:       ${fullName || '(vide)'}
🔑 ID:        ${id}
👮 Level:     ${level}

🔐 HASH PASSWORD:
   Hash:      "${hash}"
   Longueur:  ${hash?.length || 0} caractères
   
📊 ANALYSE DU FORMAT:
`);
  
  if (!hash) {
    console.log('   ❌ Pas de hash (NULL)');
  } else if (hash.startsWith('$2')) {
    console.log('   ✅ Format: bcrypt moderne');
    console.log('   Préfixe:', hash.substring(0, 7));
  } else if (hash.length === 32 && /^[a-f0-9]{32}$/i.test(hash)) {
    console.log('   ✅ Format: MD5 simple (32 caractères hex)');
  } else if (hash.length === 40 && /^[a-f0-9]{40}$/i.test(hash)) {
    console.log('   ✅ Format: SHA1 (40 caractères hex)');
  } else if (hash.length === 13) {
    console.log('   ✅ Format: MD5+crypt legacy (13 caractères)');
    console.log('   Sel probable:', hash.substring(0, 9));
  } else {
    console.log('   ⚠️  Format: INCONNU');
    console.log('   Caractères:', hash.split('').map(c => c.charCodeAt(0)).join(', '));
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 TESTS À FAIRE:');
  console.log('='.repeat(60));
  
  const crypto = require('crypto');
  const plainPassword = 'admin123';
  
  console.log(`\n1️⃣  MD5 simple de "${plainPassword}":`);
  const md5 = crypto.createHash('md5').update(plainPassword).digest('hex');
  console.log('   ', md5);
  console.log('   Match:', md5 === hash ? '✅ OUI' : '❌ NON');
  
  console.log(`\n2️⃣  SHA1 simple de "${plainPassword}":`);
  const sha1 = crypto.createHash('sha1').update(plainPassword).digest('hex');
  console.log('   ', sha1);
  console.log('   Match:', sha1 === hash ? '✅ OUI' : '❌ NON');
  
  if (hash.length === 13) {
    console.log(`\n3️⃣  MD5+crypt legacy avec sel "im10tech7":`);
    const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
    console.log('   MD5 du password:', md5Hash);
    
    // Test avec unix-crypt-td-js
    try {
      const { crypt } = require('unix-crypt-td-js');
      const salt = hash.substring(0, 2);
      const cryptResult = crypt(md5Hash, salt);
      console.log('   crypt() avec sel "' + salt + '":', cryptResult);
      console.log('   Match:', cryptResult === hash ? '✅ OUI' : '❌ NON');
    } catch (e) {
      console.log('   ⚠️  unix-crypt-td-js non disponible');
    }
  }
}

checkSuperadmin().catch(console.error);
