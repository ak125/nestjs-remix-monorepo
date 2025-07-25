const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://rwmlhfjqdlmggpvhytqf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquante');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdminExists() {
  try {
    console.log('🔍 Vérification de l\'existence du super admin...');
    
    // Chercher l'admin par email
    const { data: admins, error } = await supabase
      .from('___config_admin')
      .select('*')
      .eq('cnfa_mail', 'superadmin@autoparts.com');
    
    if (error) {
      console.error('❌ Erreur lors de la recherche:', error);
      return;
    }
    
    if (!admins || admins.length === 0) {
      console.log('❌ Super admin non trouvé dans la base !');
      console.log('📝 Exécutez d\'abord le script SQL create-super-admin-level9.sql dans Supabase');
      return;
    }
    
    const admin = admins[0];
    console.log('✅ Super admin trouvé !');
    console.log('📊 Détails:');
    console.log('   ID:', admin.cnfa_id);
    console.log('   Login:', admin.cnfa_login);
    console.log('   Email:', admin.cnfa_mail);
    console.log('   Niveau:', admin.cnfa_level);
    console.log('   Job:', admin.cnfa_job);
    console.log('   Nom:', admin.cnfa_name, admin.cnfa_fname);
    console.log('   Actif:', admin.cnfa_activ === '1' ? 'OUI' : 'NON');
    console.log('   Hash mot de passe:', admin.cnfa_pswd.substring(0, 20) + '...');
    
    // Test du hash bcrypt
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare('SuperAdmin2025!', admin.cnfa_pswd);
    console.log('🔐 Test mot de passe:', isPasswordValid ? '✅ VALIDE' : '❌ INVALIDE');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

checkAdminExists();
