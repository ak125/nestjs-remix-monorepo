/**
 * Créer un utilisateur legacy avec MD5 pour tester l'upgrade automatique
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createLegacyAdmin() {
  console.log('\n🔧 CRÉATION D\'UN ADMIN LEGACY (MD5)\n');
  console.log('='.repeat(60));

  const testEmail = 'legacyadmin@autoparts.com';
  const testPassword = 'Legacy123!';
  
  // Générer le hash MD5 (legacy)
  const md5Hash = crypto.createHash('md5').update(testPassword).digest('hex');
  
  console.log(`📧 Email:    ${testEmail}`);
  console.log(`🔑 Password: ${testPassword}`);
  console.log(`🔐 Hash MD5: ${md5Hash}`);
  console.log(`📏 Length:   ${md5Hash.length} (MD5 simple)`);
  console.log();

  // Vérifier si l'utilisateur existe déjà
  const { data: existing } = await supabase
    .from('___config_admin')
    .select('*')
    .eq('cnfa_mail', testEmail);

  if (existing && existing.length > 0) {
    console.log('⚠️  L\'utilisateur existe déjà, mise à jour...');
    
    const { data, error } = await supabase
      .from('___config_admin')
      .update({
        cnfa_pswd: md5Hash,
        cnfa_activ: '1',
      })
      .eq('cnfa_mail', testEmail)
      .select();

    if (error) {
      console.error('❌ Erreur de mise à jour:', error.message);
      return;
    }
    
    console.log('✅ Utilisateur mis à jour avec MD5 legacy');
  } else {
    console.log('✨ Création d\'un nouvel utilisateur legacy...');
    
    const { data, error } = await supabase
      .from('___config_admin')
      .insert([
        {
          cnfa_id: `adm_legacy_${Date.now()}`,
          cnfa_login: 'legacyadmin',
          cnfa_pswd: md5Hash,
          cnfa_mail: testEmail,
          cnfa_level: '9',
          cnfa_name: 'Admin',
          cnfa_fname: 'Legacy',
          cnfa_activ: '1',
          cnfa_job: 'Test',
        },
      ])
      .select();

    if (error) {
      console.error('❌ Erreur de création:', error.message);
      return;
    }
    
    console.log('✅ Utilisateur legacy créé avec succès');
  }

  console.log('\n' + '='.repeat(60));
  console.log('🧪 POUR TESTER L\'UPGRADE AUTOMATIQUE:');
  console.log('='.repeat(60));
  console.log(`
1. Se connecter (cela déclenchera l'upgrade automatique):
   
curl -X POST http://localhost:3000/authenticate \\
  -H "Content-Type: application/json" \\
  -d '{"email":"${testEmail}","password":"${testPassword}"}'

2. Vérifier que le hash a été upgradé vers bcrypt:

node check-superadmin-hash.js
  `);
}

createLegacyAdmin().catch(console.error);
