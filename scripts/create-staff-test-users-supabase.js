#!/usr/bin/env node

/**
 * Script pour créer des utilisateurs de test directement via Supabase
 * Utilise les vraies configurations du projet
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration depuis le .env
const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

async function createTestUsers() {
  try {
    console.log('🚀 Création d\'utilisateurs de test avec Supabase...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 1. Créer un utilisateur admin niveau 9
    console.log('👑 Création admin...');
    const adminResult = await supabase
      .from('users')
      .insert({
        email: 'admin@test.com',
        name: 'Super Admin',
        password: '$2b$10$dummy.hash.for.admin', // Hash dummy
      })
      .select()
      .single();

    if (adminResult.error) {
      console.log('ℹ️ Admin existe déjà ou erreur:', adminResult.error.message);
    } else {
      console.log('✅ Admin créé:', adminResult.data);
    }

    // 2. Créer quelques utilisateurs staff
    console.log('👥 Création staff...');
    
    const staffMembers = [
      {
        email: 'staff1@test.com',
        firstName: 'Jean',
        lastName: 'Dupont',
        department: 'IT',
        role: 'Développeur',
        isActive: true,
      },
      {
        email: 'staff2@test.com',
        firstName: 'Marie',
        lastName: 'Martin',
        department: 'RH',
        role: 'Manager RH',
        isActive: true,
      },
      {
        email: 'staff3@test.com',
        firstName: 'Pierre',
        lastName: 'Bernard',
        department: 'Finance',
        role: 'Comptable',
        isActive: false,
      },
    ];

    for (const staff of staffMembers) {
      const staffResult = await supabase
        .from('staff')
        .insert(staff)
        .select()
        .single();

      if (staffResult.error) {
        console.log(`ℹ️ Staff ${staff.email} existe déjà ou erreur:`, staffResult.error.message);
      } else {
        console.log(`✅ Staff créé: ${staffResult.data.email}`);
      }
    }

    // 3. Tester la récupération
    console.log('\n📊 Test de récupération...');
    
    const testStaff = await supabase
      .from('staff')
      .select('*');

    if (testStaff.error) {
      console.error('❌ Erreur test:', testStaff.error);
    } else {
      console.log(`✅ ${testStaff.data.length} membres du staff trouvés:`);
      testStaff.data.forEach(s => {
        console.log(`  - ${s.firstName} ${s.lastName} (${s.department}) - ${s.isActive ? 'Actif' : 'Inactif'}`);
      });
    }

    console.log('\n🎉 Données de test créées avec succès !');
    console.log('🔗 Vous pouvez maintenant tester l\'API Staff:');
    console.log('   GET http://localhost:3000/api/admin/staff');
    console.log('   GET http://localhost:3000/api/admin/staff/stats');

  } catch (error) {
    console.error('💥 Erreur:', error);
  }
}

// Exécuter seulement si c'est le script principal
if (require.main === module) {
  createTestUsers().then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { createTestUsers };
