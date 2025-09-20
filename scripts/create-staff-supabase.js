#!/usr/bin/env node

/**
 * Script pour créer des utilisateurs staff de test directement via Supabase
 * Utilise les vraies informations de configuration
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase réelle
const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

async function createStaffUsers() {
  try {
    console.log('🚀 Connexion à Supabase...');
    console.log('🔗 URL:', supabaseUrl);

    // Utiliser la clé service role pour bypass les RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('✅ Client Supabase initialisé');

    // Test de connexion
    console.log('\n🔍 Test de connexion...');
    const { data: tables, error: testError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Erreur de connexion:', testError);
      return;
    }

    console.log('✅ Connexion Supabase réussie');

    // 1. Vérifier si les utilisateurs existent déjà
    console.log('\n🔍 Vérification des utilisateurs existants...');
    
    const { data: existingUsers } = await supabase
      .from('users')
      .select('email')
      .in('email', ['staff-test@example.com', 'admin-test@example.com']);

    if (existingUsers && existingUsers.length > 0) {
      console.log('⚠️ Utilisateurs déjà existants:', existingUsers.map(u => u.email));
      
      // Supprimer les utilisateurs existants
      for (const user of existingUsers) {
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('email', user.email);
          
        if (deleteError) {
          console.error(`❌ Erreur suppression ${user.email}:`, deleteError);
        } else {
          console.log(`🗑️ Utilisateur ${user.email} supprimé`);
        }
      }
    }

    // 2. Créer un utilisateur staff niveau 8
    console.log('\n👤 Création utilisateur staff...');
    const { data: staffUser, error: staffError } = await supabase
      .from('users')
      .insert({
        email: 'staff-test@example.com',
        firstName: 'Staff',
        lastName: 'Test',
        phone: '+33123456789',
        level: 8,
        isPro: false,
        civility: 'M.',
        isActive: true,
        password: '$2b$10$dummy.hash.for.test.user.123456789',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (staffError) {
      console.error('❌ Erreur création staff:', staffError);
    } else {
      console.log('✅ Utilisateur staff créé:', {
        id: staffUser.id,
        email: staffUser.email,
        level: staffUser.level
      });
    }

    // 3. Créer un utilisateur admin niveau 9
    console.log('\n👑 Création utilisateur admin...');
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .insert({
        email: 'admin-test@example.com',
        firstName: 'Admin',
        lastName: 'Test',
        phone: '+33123456780',
        level: 9,
        isPro: false,
        civility: 'M.',
        isActive: true,
        password: '$2b$10$dummy.hash.for.admin.test.123456789',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (adminError) {
      console.error('❌ Erreur création admin:', adminError);
    } else {
      console.log('✅ Utilisateur admin créé:', {
        id: adminUser.id,
        email: adminUser.email,
        level: adminUser.level
      });
    }

    // 4. Vérifier si la table staff existe et créer des entrées
    console.log('\n📊 Vérification table staff...');
    const { data: staffTable, error: staffTableError } = await supabase
      .from('staff')
      .select('id')
      .limit(1);

    if (staffTableError) {
      console.log('⚠️ Table staff non trouvée:', staffTableError.message);
      console.log('💡 La table staff peut être créée manuellement si nécessaire');
    } else {
      console.log('✅ Table staff trouvée');
      
      if (staffUser) {
        const { data: staffEntry, error: staffEntryError } = await supabase
          .from('staff')
          .insert({
            email: 'staff-test@example.com',
            firstName: 'Staff',
            lastName: 'Test',
            department: 'IT',
            role: 'Developer',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .select()
          .single();

        if (staffEntryError) {
          console.error('❌ Erreur création entrée staff:', staffEntryError);
        } else {
          console.log('✅ Entrée staff créée:', staffEntry);
        }
      }
    }

    // 5. Vérification finale
    console.log('\n📋 Vérification finale...');
    const { data: finalUsers, error: finalError } = await supabase
      .from('users')
      .select('id, email, firstName, lastName, level, isActive')
      .gte('level', 7)
      .order('level', { ascending: false });

    if (finalError) {
      console.error('❌ Erreur vérification finale:', finalError);
    } else {
      console.log('✅ Utilisateurs staff/admin en base:');
      finalUsers.forEach(user => {
        console.log(`   📧 ${user.email} - ${user.firstName} ${user.lastName} (niveau ${user.level})`);
      });
    }

    console.log('\n🎉 Script terminé avec succès !');
    console.log('📧 Staff: staff-test@example.com (niveau 8)');
    console.log('📧 Admin: admin-test@example.com (niveau 9)');
    console.log('🔑 Mot de passe: 123456 (hash dummy pour les tests)');

  } catch (error) {
    console.error('💥 Erreur globale:', error);
    process.exit(1);
  }
}

createStaffUsers();
