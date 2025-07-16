// Script pour créer l'utilisateur test2@example.com avec l'ID test-user-456
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SupabaseRestService } from './src/database/supabase-rest.service';

async function createTestUser456() {
  console.log('=== Création utilisateur test-user-456 ===');
  
  try {
    // Créer l'application NestJS
    const app = await NestFactory.create(AppModule, {
      logger: false // Désactiver les logs pour plus de clarté
    });
    const supabaseService = app.get(SupabaseRestService);
    
    // Données de test pour test-user-456
    const testEmail = 'test2@example.com';
    const testPassword = 'test123';
    const unixCryptHash = 'abRcsZmlrrKFA'; // Hash Unix DES crypt pour 'test123'
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await supabaseService.findUserByEmail(testEmail);
    if (existingUser) {
      console.log('❌ Un utilisateur avec cet email existe déjà');
      console.log('Utilisateur existant:', existingUser);
      await app.close();
      return;
    }
    
    // Insérer directement avec l'ID spécifique test-user-456
    const userData = {
      cst_id: 'test-user-456', // ID spécifique pour les tests
      cst_mail: testEmail,
      cst_pswd: unixCryptHash,
      cst_fname: 'TestCorrigé',
      cst_name: 'User456',
      cst_civility: 'Mr.',
      cst_address: '123 Rue Test Corrigée',
      cst_zip_code: '75001',
      cst_city: 'Paris',
      cst_country: 'France',
      cst_tel: '0123456789',
      cst_gsm: null,
      cst_is_pro: '0',
      cst_rs: null,
      cst_siret: null,
      cst_activ: '1',
      cst_level: 1,
      cst_is_cpy: '0',
      cst_keylog: 'TEST_KEYLOG_456'
    };
    
    // Utiliser fetch directement pour insérer avec le hash personnalisé
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      headers['apikey'] = process.env.SUPABASE_SERVICE_ROLE_KEY;
      headers['Authorization'] = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
    } else {
      console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY non définie, tentative sans clé');
    }
    
    console.log('📡 Tentative d\'insertion dans la base de données...');
    console.log('URL:', `${process.env.SUPABASE_URL}/rest/v1/___xtr_customer`);
    console.log('Données à insérer:', {
      cst_id: userData.cst_id,
      cst_mail: userData.cst_mail,
      cst_fname: userData.cst_fname,
      cst_name: userData.cst_name
    });
    
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/___xtr_customer`, {
      method: 'POST',
      headers,
      body: JSON.stringify(userData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Utilisateur test-user-456 créé avec succès!');
      console.log('');
      console.log('🔑 Identifiants de test:');
      console.log(`Email: ${testEmail}`);
      console.log(`Mot de passe: ${testPassword}`);
      console.log(`ID: test-user-456`);
      console.log(`Hash: ${unixCryptHash}`);
      console.log('');
      console.log('🎉 Les erreurs 404 devraient maintenant être résolues!');
      
      // Test de validation
      console.log('\\n=== Test de validation ===');
      const isValid = await supabaseService.validatePassword(testPassword, unixCryptHash);
      console.log('Validation du mot de passe:', isValid ? '✅ Succès' : '❌ Échec');
      
      // Test de récupération
      console.log('\\n=== Test de récupération ===');
      const retrievedUser = await supabaseService.findUserByEmail(testEmail);
      if (retrievedUser) {
        console.log('✅ Utilisateur récupéré avec succès');
        console.log('ID récupéré:', retrievedUser.cst_id);
        console.log('Email récupéré:', retrievedUser.cst_mail);
        console.log('Nom récupéré:', retrievedUser.cst_fname, retrievedUser.cst_name);
      } else {
        console.log('❌ Impossible de récupérer l\'utilisateur');
      }
      
    } else {
      console.error('❌ Erreur lors de la création:', response.status, response.statusText);
      const error = await response.text();
      console.error('Détails:', error);
    }
    
    await app.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

createTestUser456();
