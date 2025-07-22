// Script pour créer un utilisateur de test avec hash Unix DES crypt
import('unix-crypt-td-js').then(async (crypt) => {
  // Configuration
  const testPassword = 'test123';
  const testEmail = 'test@example.com';
  const salt = 'ab'; // Salt simple pour le test
  
  // Génération du hash Unix DES crypt
  const hashedPassword = crypt.default(testPassword, salt);
  
  console.log('=== Création utilisateur de test ===');
  console.log('Email:', testEmail);
  console.log('Mot de passe:', testPassword);
  console.log('Hash généré:', hashedPassword);
  console.log('Longueur du hash:', hashedPassword.length);
  
  // Données de l'utilisateur à créer
  const userData = {
    cst_id: `test_${Date.now()}`,
    cst_mail: testEmail,
    cst_pswd: hashedPassword,
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
    cst_level: '1',
    cst_is_cpy: '0',
    cst_keylog: 'TEST_KEYLOG'
  };
  
  // Configuration Supabase (remplacez par vos vraies valeurs)
  const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_KEY';
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_URL.includes('YOUR_')) {
    console.error('❌ Veuillez configurer SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
    console.log('Données à insérer manuellement:');
    console.log(JSON.stringify(userData, null, 2));
    return;
  }
  
  try {
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
      console.log('✅ Utilisateur créé avec succès:');
      console.log(result);
      console.log('\\n🔑 Vous pouvez maintenant tester la connexion avec:');
      console.log('Email:', testEmail);
      console.log('Mot de passe:', testPassword);
    } else {
      console.error('❌ Erreur lors de la création:', response.status, response.statusText);
      const error = await response.text();
      console.error('Détails:', error);
    }
  } catch (error) {
    console.error('❌ Erreur réseau:', error);
  }
}).catch(error => {
  console.error('❌ Erreur import:', error);
});
