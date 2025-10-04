/**
 * Créer un utilisateur test dans ___config_admin avec bcrypt
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestAdmin() {
  console.log('\n🔧 CRÉATION D\'UN ADMIN TEST\n');
  console.log('='.repeat(60));

  const testEmail = 'testadmin@autoparts.com';
  const testPassword = 'Test123456!';
  
  // Générer le hash bcrypt
  const bcryptHash = await bcrypt.hash(testPassword, 10);
  
  console.log(`📧 Email:    ${testEmail}`);
  console.log(`🔑 Password: ${testPassword}`);
  console.log(`🔐 Hash:     ${bcryptHash}`);
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
        cnfa_pswd: bcryptHash,
        cnfa_activ: '1',
      })
      .eq('cnfa_mail', testEmail)
      .select();

    if (error) {
      console.error('❌ Erreur de mise à jour:', error.message);
      return;
    }
    
    console.log('✅ Utilisateur mis à jour avec succès');
  } else {
    console.log('✨ Création d\'un nouvel utilisateur...');
    
    const { data, error } = await supabase
      .from('___config_admin')
      .insert([
        {
          cnfa_id: `adm_test_${Date.now()}`,
          cnfa_login: 'testadmin',
          cnfa_pswd: bcryptHash,
          cnfa_mail: testEmail,
          cnfa_level: '9',
          cnfa_name: 'Admin',
          cnfa_fname: 'Test',
          cnfa_activ: '1',
          cnfa_job: 'Test',
        },
      ])
      .select();

    if (error) {
      console.error('❌ Erreur de création:', error.message);
      return;
    }
    
    console.log('✅ Utilisateur créé avec succès');
  }

  console.log('\n' + '='.repeat(60));
  console.log('🧪 POUR TESTER:');
  console.log('='.repeat(60));
  console.log(`
curl -X POST http://localhost:3000/authenticate \\
  -H "Content-Type: application/json" \\
  -d '{"email":"${testEmail}","password":"${testPassword}"}'
  `);
}

createTestAdmin().catch(console.error);
