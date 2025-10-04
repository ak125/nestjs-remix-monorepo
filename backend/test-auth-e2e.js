/**
 * 🧪 Test E2E Authentification
 * Usage: node backend/test-auth-e2e.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cxpojprgwgubzjyqzmoq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzU2NTI1NCwiZXhwIjoyMDM5MTQxMjU0fQ.uF5Bg0LMhxCU85D2LtIhIDp_OPhSNWNGGQ0b9CG6kxY'
);

async function testAuth() {
  console.log('\n🧪 Test E2E Authentification\n');

  // Test 1: Utilisateur bcrypt moderne
  console.log('1️⃣  Test utilisateur bcrypt (testlogin)...');
  const response1 = await fetch('http://localhost:3000/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=testlogin@autoparts.com&password=password123',
    redirect: 'manual',
  });
  console.log(`   HTTP ${response1.status} - ${response1.headers.get('set-cookie') ? '✅ Cookie créé' : '❌ Pas de cookie'}`);

  // Test 2: Admin MD5
  console.log('2️⃣  Test admin MD5 (superadmin)...');
  const response2 = await fetch('http://localhost:3000/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=superadmin@autoparts.com&password=superadmin',
    redirect: 'manual',
  });
  console.log(`   HTTP ${response2.status} - ${response2.headers.get('set-cookie') ? '✅ Cookie créé' : '❌ Pas de cookie'}`);

  // Test 3: Échantillon legacy
  console.log('3️⃣  Test utilisateur legacy...');
  const { data: legacyUsers } = await supabase
    .from('___xtr_customer')
    .select('cst_mail, cst_pswd')
    .neq('cst_pswd', '')
    .limit(1);

  if (legacyUsers && legacyUsers[0]) {
    const format = legacyUsers[0].cst_pswd.startsWith('$2') ? 'bcrypt' :
                   legacyUsers[0].cst_pswd.length === 32 ? 'MD5' :
                   legacyUsers[0].cst_pswd.length === 13 ? 'MD5+crypt' : 'unknown';
    console.log(`   Format détecté: ${format} (${legacyUsers[0].cst_mail})`);
  }

  // Test 4: Vérifier needsRehash
  console.log('4️⃣  Test needsRehash logic...');
  const { data: users } = await supabase
    .from('___xtr_customer')
    .select('cst_id, cst_mail, cst_pswd')
    .limit(10);

  let needsUpgrade = 0;
  users?.forEach(u => {
    // Simuler needsRehash
    const isLegacy = !u.cst_pswd.startsWith('$2');
    const isOldBcrypt = u.cst_pswd.match(/^\$2[aby]\$(\d+)\$/) && 
                        parseInt(u.cst_pswd.match(/^\$2[aby]\$(\d+)\$/)[1]) < 10;
    
    if (isLegacy || isOldBcrypt) {
      needsUpgrade++;
    }
  });

  console.log(`   ${needsUpgrade}/${users?.length || 0} utilisateurs nécessitent un upgrade`);

  console.log('\n✅ Tests E2E terminés\n');
}

testAuth().catch(console.error);
