#!/usr/bin/env node

/**
 * Script de création d'un utilisateur normal pour les tests
 * Usage: node scripts/create-test-user.js
 */

const bcrypt = require('bcrypt');
const { createHash } = require('crypto');

// Configuration Supabase (à adapter selon votre environnement)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztzxtixohjsdlmkqudfn.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0enh0aXhvaGpzZGxta3F1ZGZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzIxMDQ0MSwiZXhwIjoyMDQ4Nzg2NDQxfQ.Tfa8EYnqpyInxDKfUxHUqFp-dJ_p8Uj1cFEH4MQzNhA';

async function createTestUser() {
  try {
    console.log('🚀 Création de l\'utilisateur de test...');

    // Données de l'utilisateur
    const userData = {
      cst_id: 'usr_auto_' + Date.now(),
      cst_mail: 'auto@example.com',
      cst_pswd: await bcrypt.hash('123456', 10),
      cst_fname: 'Auto',
      cst_name: 'Utilisateur',
      cst_address: '123 Rue de Test',
      cst_city: 'Test City',
      cst_zip_code: '12345',
      cst_country: 'France',
      cst_tel: '0123456789',
      cst_is_pro: '0', // Utilisateur normal (pas pro)
      cst_activ: '1',  // Actif
      cst_level: '1',  // Niveau utilisateur normal
      cst_civility: 'M.',
      cst_keylog: null,
      cst_gsm: null,
      cst_is_cpy: null,
      cst_rs: null,
      cst_siret: null,
      cst_password_changed_at: new Date().toISOString()
    };

    console.log('📝 Données utilisateur:', {
      email: userData.cst_mail,
      id: userData.cst_id,
      level: userData.cst_level,
      isPro: userData.cst_is_pro === '1'
    });

    // Appel à l'API Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/___xtr_customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Erreur lors de la création:', response.status, error);
      return;
    }

    const createdUser = await response.json();
    console.log('✅ Utilisateur créé avec succès !');
    console.log('📧 Email:', userData.cst_mail);
    console.log('🔑 Mot de passe:', '123456');
    console.log('👤 ID:', userData.cst_id);
    console.log('🎯 Niveau:', userData.cst_level, '(utilisateur normal)');

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécution du script
createTestUser();
