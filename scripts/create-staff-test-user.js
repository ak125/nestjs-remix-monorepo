#!/usr/bin/env node

/**
 * Script pour créer un utilisateur staff de test directement en base
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (utilise les variables d'environnement ou des valeurs par défaut)
const supabaseUrl = process.env.SUPABASE_URL || 'https://uvbinrwyuwdjyudvqvnx.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2YmluCmd5dXdkanlmemlhcSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM3MjQ2NDEwLCJleHAiOjIwNTI4MjI0MTB9.abc123';

async function createStaffUser() {
  try {
    console.log('🚀 Création d\'un utilisateur staff de test...');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Créer un utilisateur normal niveau 8 (staff)
    const userResult = await supabase
      .from('users')
      .insert({
        email: 'staff-test@example.com',
        firstName: 'Staff',
        lastName: 'Test',
        phone: '0123456789',
        level: 8,
        isPro: false,
        civility: 'M.',
        isActive: true,
        password: '$2b$10$dummy.hash.for.test', // Hash dummy
      })
      .select()
      .single();

    if (userResult.error) {
      console.error('❌ Erreur création utilisateur:', userResult.error);
      return;
    }

    console.log('✅ Utilisateur staff créé:', userResult.data);

    // 2. Créer une entrée dans la table staff
    const staffResult = await supabase
      .from('staff')
      .insert({
        email: 'staff-test@example.com',
        firstName: 'Staff',
        lastName: 'Test',
        department: 'IT',
        role: 'Developer',
        isActive: true,
      })
      .select()
      .single();

    if (staffResult.error) {
      console.error('❌ Erreur création staff:', staffResult.error);
    } else {
      console.log('✅ Entrée staff créée:', staffResult.data);
    }

    // 3. Créer un admin niveau 9
    const adminResult = await supabase
      .from('users')
      .insert({
        email: 'admin-test@example.com',
        firstName: 'Admin',
        lastName: 'Test',
        phone: '0123456780',
        level: 9,
        isPro: false,
        civility: 'M.',
        isActive: true,
        password: '$2b$10$dummy.hash.for.admin.test',
      })
      .select()
      .single();

    if (adminResult.error) {
      console.error('❌ Erreur création admin:', adminResult.error);
    } else {
      console.log('✅ Utilisateur admin créé:', adminResult.data);
    }

    console.log('\n🎉 Utilisateurs de test créés avec succès !');
    console.log('📧 Staff: staff-test@example.com (niveau 8)');
    console.log('📧 Admin: admin-test@example.com (niveau 9)');

  } catch (error) {
    console.error('💥 Erreur:', error);
  }
}

createStaffUser();
