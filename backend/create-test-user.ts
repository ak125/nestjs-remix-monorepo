// Script pour insérer un utilisateur de test via le service NestJS
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SupabaseRestService } from './src/database/supabase-rest.service';

async function createTestUser() {
  console.log('=== Création utilisateur de test ===');
  
  try {
    // Créer l'application NestJS
    const app = await NestFactory.create(AppModule);
    const supabaseService = app.get(SupabaseRestService);
    
    // Données de test
    const testEmail = 'test@example.com';
    const testPassword = 'test123';
    const unixCryptHash = 'abRcsZmlrrKFA'; // Hash Unix DES crypt généré
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await supabaseService.findUserByEmail(testEmail);
    if (existingUser) {
      console.log('❌ Un utilisateur avec cet email existe déjà');
      await app.close();
      return;
    }
    
    // Insérer directement avec le hash Unix DES crypt
    const userData = {
      cst_id: `test_${Date.now()}`,
      cst_mail: testEmail,
      cst_pswd: unixCryptHash,
      cst_fname: 'Test',
      cst_name: 'User',
      cst_civility: 'Mr.',
      cst_address: 'Test Address',
      cst_zip_code: '12345',
      cst_city: 'Test City',
      cst_country: 'France',
      cst_tel: '0123456789',
      cst_gsm: null,
      cst_is_pro: '0',
      cst_rs: null,
      cst_siret: null,
      cst_activ: '1',
      cst_level: 1,
      cst_is_cpy: '0',
      cst_keylog: 'TEST_KEYLOG'
    };
    
    // Utiliser fetch directement pour insérer avec le hash personnalisé
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      headers['apikey'] = process.env.SUPABASE_SERVICE_ROLE_KEY;
      headers['Authorization'] = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
    }
    
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/___xtr_customer`, {
      method: 'POST',
      headers,
      body: JSON.stringify(userData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Utilisateur créé avec succès:');
      console.log(`Email: ${testEmail}`);
      console.log(`Mot de passe: ${testPassword}`);
      console.log(`Hash: ${unixCryptHash}`);
      console.log('');
      console.log('🔑 Vous pouvez maintenant tester la connexion avec ces identifiants');
      
      // Test de validation
      console.log('\\n=== Test de validation ===');
      const isValid = await supabaseService.validatePassword(testPassword, unixCryptHash);
      console.log('Validation du mot de passe:', isValid ? '✅ Succès' : '❌ Échec');
      
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

createTestUser();
