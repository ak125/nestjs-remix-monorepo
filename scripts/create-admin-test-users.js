#!/usr/bin/env node

/**
 * Script pour créer des utilisateurs admin de test dans la table ___config_admin
 * Utilise la vraie structure de la base de données legacy
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration depuis le .env
const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

async function createAdminTestUsers() {
  try {
    console.log('🚀 Création d\'utilisateurs admin de test dans ___config_admin...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Données de test pour le personnel administratif
    const adminUsers = [
      {
        cnfa_id: 'admin-001',
        cnfa_login: 'admin',
        cnfa_pswd: '$2b$10$dummy.hash.for.admin',
        cnfa_mail: 'admin@test.com',
        cnfa_keylog: '',
        cnfa_level: '9',
        cnfa_job: 'Administrateur Système',
        cnfa_name: 'Admin',
        cnfa_fname: 'Super',
        cnfa_tel: '0123456789',
        cnfa_activ: '1',
      },
      {
        cnfa_id: 'staff-001',
        cnfa_login: 'jdupont',
        cnfa_pswd: '$2b$10$dummy.hash.for.staff',
        cnfa_mail: 'jean.dupont@test.com',
        cnfa_keylog: '',
        cnfa_level: '7',
        cnfa_job: 'Développeur Senior',
        cnfa_name: 'Dupont',
        cnfa_fname: 'Jean',
        cnfa_tel: '0123456788',
        cnfa_activ: '1',
      },
      {
        cnfa_id: 'staff-002',
        cnfa_login: 'mmartin',
        cnfa_pswd: '$2b$10$dummy.hash.for.staff',
        cnfa_mail: 'marie.martin@test.com',
        cnfa_keylog: '',
        cnfa_level: '8',
        cnfa_job: 'Manager RH',
        cnfa_name: 'Martin',
        cnfa_fname: 'Marie',
        cnfa_tel: '0123456787',
        cnfa_activ: '1',
      },
      {
        cnfa_id: 'staff-003',
        cnfa_login: 'pbernard',
        cnfa_pswd: '$2b$10$dummy.hash.for.staff',
        cnfa_mail: 'pierre.bernard@test.com',
        cnfa_keylog: '',
        cnfa_level: '7',
        cnfa_job: 'Comptable',
        cnfa_name: 'Bernard',
        cnfa_fname: 'Pierre',
        cnfa_tel: '0123456786',
        cnfa_activ: '0', // Inactif
      },
    ];

    console.log(`👥 Création de ${adminUsers.length} utilisateurs admin...`);

    for (const admin of adminUsers) {
      const result = await supabase
        .from('___config_admin')
        .insert(admin)
        .select()
        .single();

      if (result.error) {
        if (result.error.code === '23505') { // Duplicate key
          console.log(`ℹ️ Admin ${admin.cnfa_mail} existe déjà`);
        } else {
          console.log(`⚠️ Erreur pour ${admin.cnfa_mail}:`, result.error.message);
        }
      } else {
        console.log(`✅ Admin créé: ${result.data.cnfa_fname} ${result.data.cnfa_name} (${result.data.cnfa_job})`);
      }
    }

    // 3. Tester la récupération
    console.log('\n📊 Test de récupération du staff...');
    
    const testStaff = await supabase
      .from('___config_admin')
      .select('*')
      .order('cnfa_fname');

    if (testStaff.error) {
      console.error('❌ Erreur test:', testStaff.error);
    } else {
      console.log(`✅ ${testStaff.data.length} membres du staff trouvés:`);
      testStaff.data.forEach(s => {
        const isActive = s.cnfa_activ === '1';
        const level = s.cnfa_level || '0';
        console.log(`  - ${s.cnfa_fname} ${s.cnfa_name} (${s.cnfa_job}) - Niveau ${level} - ${isActive ? 'Actif' : 'Inactif'}`);
      });
    }

    console.log('\n🎉 Données de test créées avec succès !');
    console.log('🔗 Vous pouvez maintenant tester l\'API Staff:');
    console.log('   GET http://localhost:3000/api/admin/staff');
    console.log('   GET http://localhost:3000/api/admin/staff/stats');
    console.log('\n📧 Comptes de test créés:');
    console.log('   - admin@test.com (Niveau 9 - Admin)');
    console.log('   - jean.dupont@test.com (Niveau 7 - Staff)');
    console.log('   - marie.martin@test.com (Niveau 8 - Staff)');
    console.log('   - pierre.bernard@test.com (Niveau 7 - Staff inactif)');

  } catch (error) {
    console.error('💥 Erreur:', error);
  }
}

// Exécuter seulement si c'est le script principal
if (require.main === module) {
  createAdminTestUsers().then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { createAdminTestUsers };
