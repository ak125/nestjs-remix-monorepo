#!/usr/bin/env node

/**
 * Script pour créer des utilisateurs de test directement via Supabase
 * Utilise la même configuration que l'application backend
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

// Utiliser la même configuration que l'app (Context7)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwmlhfjqdlmggpvhytqf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function createTestUsers() {
  try {
    console.log('🚀 Création d\'utilisateurs de test via Supabase...');
    console.log('🔗 URL Supabase:', SUPABASE_URL);

    if (!SUPABASE_SERVICE_KEY) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY non défini');
      console.log('ℹ️  Essayons avec la clé anonyme pour tester la connexion...');
    }

    // Créer le client Supabase avec la service key pour bypasser RLS
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3bWxoZmpxZGxtZ2dwdmh5dHFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzI0MDc5NCwiZXhwIjoyMDUyODE2Nzk0fQ.dummy-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Hasher les mots de passe
    const passwordHash = await bcrypt.hash('123456', 10);

    console.log('🔐 Hash généré pour le mot de passe test');

    // 1. Créer un utilisateur staff (niveau 8)
    console.log('\n📝 Création utilisateur staff...');
    const staffUser = {
      email: 'staff-test@example.com',
      firstName: 'Staff',
      lastName: 'Test',
      phone: '0123456789',
      level: 8,
      isPro: false,
      civility: 'M.',
      isActive: true,
      password: passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: staffData, error: staffError } = await supabase
      .from('users')
      .insert(staffUser)
      .select()
      .single();

    if (staffError) {
      console.error('❌ Erreur création staff:', staffError);
    } else {
      console.log('✅ Utilisateur staff créé:', staffData);
    }

    // 2. Créer une entrée dans la table staff correspondante
    console.log('\n📝 Création entrée table staff...');
    const staffEntry = {
      email: 'staff-test@example.com',
      firstName: 'Staff',
      lastName: 'Test',
      department: 'IT',
      role: 'Developer',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: staffEntryData, error: staffEntryError } = await supabase
      .from('staff')
      .insert(staffEntry)
      .select()
      .single();

    if (staffEntryError) {
      console.error('❌ Erreur création entrée staff:', staffEntryError);
    } else {
      console.log('✅ Entrée staff créée:', staffEntryData);
    }

    // 3. Créer un utilisateur admin (niveau 9)
    console.log('\n📝 Création utilisateur admin...');
    const adminUser = {
      email: 'admin-test@example.com',
      firstName: 'Admin',
      lastName: 'Test',
      phone: '0123456780',
      level: 9,
      isPro: false,
      civility: 'M.',
      isActive: true,
      password: passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .insert(adminUser)
      .select()
      .single();

    if (adminError) {
      console.error('❌ Erreur création admin:', adminError);
    } else {
      console.log('✅ Utilisateur admin créé:', adminData);
    }

    // 4. Créer un utilisateur normal pour les tests
    console.log('\n📝 Création utilisateur normal...');
    const normalUser = {
      email: 'user-test@example.com',
      firstName: 'User',
      lastName: 'Test',
      phone: '0123456781',
      level: 1,
      isPro: false,
      civility: 'M.',
      isActive: true,
      password: passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert(normalUser)
      .select()
      .single();

    if (userError) {
      console.error('❌ Erreur création utilisateur normal:', userError);
    } else {
      console.log('✅ Utilisateur normal créé:', userData);
    }

    console.log('\n🎉 Création des utilisateurs terminée !');
    console.log('📧 Staff: staff-test@example.com (niveau 8) - mot de passe: 123456');
    console.log('📧 Admin: admin-test@example.com (niveau 9) - mot de passe: 123456');
    console.log('📧 User: user-test@example.com (niveau 1) - mot de passe: 123456');

    // 5. Vérifier le nombre total d'utilisateurs
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\n📊 Total utilisateurs en base: ${count}`);
    }

  } catch (error) {
    console.error('💥 Erreur générale:', error);
  }
}

// Vérifier si bcrypt est disponible
try {
  require.resolve('bcrypt');
  createTestUsers();
} catch (e) {
  console.error('❌ bcrypt non disponible. Installation...');
  console.log('💡 Exécutez: npm install bcrypt @supabase/supabase-js');
}
