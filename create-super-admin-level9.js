const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://rwmlhfjqdlmggpvhytqf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquante');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSuperAdmin() {
  try {
    console.log('🔧 Création d\'un Super Admin Level 9...');
    
    // Données du super admin
    const email = 'superadmin@autoparts.com';
    const password = 'SuperAdmin2025!';
    const login = 'superadmin';
    
    // Génération d'un ID unique
    const adminId = `adm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Génération d'un keylog unique
    const keylog = crypto.randomBytes(16).toString('hex');
    
    // Données à insérer
    const adminData = {
      cnfa_id: adminId,
      cnfa_login: login,
      cnfa_pswd: hashedPassword,
      cnfa_mail: email,
      cnfa_keylog: keylog,
      cnfa_level: '9', // Super Admin niveau 9
      cnfa_job: 'Super Administrator',
      cnfa_name: 'Super',
      cnfa_fname: 'Admin',
      cnfa_tel: '+33 1 00 00 00 00',
      cnfa_activ: '1' // Actif
    };
    
    console.log('📝 Données à insérer:', {
      id: adminData.cnfa_id,
      login: adminData.cnfa_login,
      email: adminData.cnfa_mail,
      level: adminData.cnfa_level,
      job: adminData.cnfa_job,
      active: adminData.cnfa_activ
    });
    
    // Vérifier si l'admin existe déjà
    const { data: existingAdmin, error: checkError } = await supabase
      .from('___config_admin')
      .select('cnfa_mail, cnfa_login')
      .or(`cnfa_mail.eq.${email},cnfa_login.eq.${login}`);
    
    if (checkError) {
      console.error('❌ Erreur lors de la vérification:', checkError);
      return;
    }
    
    if (existingAdmin && existingAdmin.length > 0) {
      console.log('⚠️ Un admin avec cet email ou login existe déjà:', existingAdmin);
      return;
    }
    
    // Insérer le nouvel admin
    const { data, error } = await supabase
      .from('___config_admin')
      .insert([adminData])
      .select();
    
    if (error) {
      console.error('❌ Erreur lors de la création:', error);
      return;
    }
    
    console.log('✅ Super Admin créé avec succès !');
    console.log('📧 Email:', email);
    console.log('🔑 Mot de passe:', password);
    console.log('👤 Login:', login);
    console.log('🎖️ Niveau:', '9 (Super Admin)');
    console.log('🆔 ID:', adminId);
    console.log('');
    console.log('🔐 Informations de connexion:');
    console.log(`   Email: ${email}`);
    console.log(`   Mot de passe: ${password}`);
    console.log('');
    console.log('⚡ L\'admin peut maintenant se connecter via /auth/login');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécuter la création
createSuperAdmin();
