require('dotenv').config();

const createTestUser = async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🔧 Configuration:');
  console.log('URL:', SUPABASE_URL);
  console.log('Service Key présente:', SUPABASE_SERVICE_KEY ? 'OUI' : 'NON');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variables d\'environnement manquantes');
    return;
  }
  
  // D'abord vérifier si l'utilisateur existe
  try {
    console.log('🔍 Vérification de l\'utilisateur existant...');
    const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/___xtr_customer?cst_mail=eq.test@example.com`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    
    if (checkResponse.ok) {
      const users = await checkResponse.json();
      console.log('✅ Utilisateurs existants:', users.length);
      if (users.length > 0) {
        console.log('Utilisateur trouvé:', users[0]);
        console.log('🎯 Vous pouvez maintenant tester la connexion avec:');
        console.log('Email: test@example.com');
        console.log('Mot de passe: test123');
        return;
      }
    } else {
      console.error('❌ Erreur vérification:', checkResponse.status, checkResponse.statusText);
    }
  } catch (error) {
    console.error('❌ Erreur vérification:', error);
  }
  
  // Créer l'utilisateur s'il n'existe pas
  const userData = {
    'cst_id': 'test_unix_crypt_001',
    'cst_mail': 'test@example.com',
    'cst_pswd': 'abRcsZmlrrKFA', // Hash Unix DES crypt pour "test123"
    'cst_fname': 'Test',
    'cst_name': 'User',
    'cst_civility': 'Mr.',
    'cst_address': 'Test Address',
    'cst_zip_code': '12345',
    'cst_city': 'Test City',
    'cst_country': 'France',
    'cst_tel': '0123456789',
    'cst_gsm': null,
    'cst_is_pro': '0',
    'cst_rs': null,
    'cst_siret': null,
    'cst_activ': '1',
    'cst_level': '1',
    'cst_is_cpy': '0',
    'cst_keylog': 'TEST_KEYLOG'
  };
  
  try {
    console.log('🔄 Création de l\'utilisateur...');
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
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Utilisateur créé avec succès:', result);
      console.log('🎯 Vous pouvez maintenant tester la connexion avec:');
      console.log('Email: test@example.com');
      console.log('Mot de passe: test123');
    } else {
      console.error('❌ Erreur:', response.status, response.statusText);
      const error = await response.text();
      console.error('Détails:', error);
    }
  } catch (error) {
    console.error('❌ Erreur réseau:', error);
  }
};

createTestUser().catch(console.error);
