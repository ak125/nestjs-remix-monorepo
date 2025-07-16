const { execSync } = require('child_process');

// Script pour créer l'utilisateur test-user-456 directement avec curl
console.log('🔧 Création de l\'utilisateur test-user-456...');

try {
  // Créer l'utilisateur avec curl directement sur l'API Supabase
  const createUserCommand = `curl -X POST 'http://localhost:54321/rest/v1/___xtr_customer' \
    -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    -H 'Content-Type: application/json' \
    -d '{
      "id": "test-user-456",
      "email": "test2@example.com",
      "firstName": "Test",
      "lastName": "User",
      "password": "$2b$10$nOUIs5kJ7naTuTFkBy1veuK0kSxUFXfuaOKdOKf9xYT0KzJJPjYT2",
      "isPro": false,
      "isActive": true,
      "tel": "+33123456789",
      "address": "123 Rue de Test",
      "city": "Paris",
      "zipCode": "75001",
      "country": "France"
    }'`;

  console.log('📡 Envoi de la requête de création...');
  const result = execSync(createUserCommand, { encoding: 'utf8' });
  console.log('✅ Utilisateur créé avec succès:', result);

  // Vérifier que l'utilisateur a été créé
  console.log('🔍 Vérification de la création...');
  const verifyCommand = `curl -X GET 'http://localhost:54321/rest/v1/___xtr_customer?id=eq.test-user-456' \
    -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'`;

  const verification = execSync(verifyCommand, { encoding: 'utf8' });
  console.log('📋 Résultat de la vérification:', verification);

  if (verification.includes('test-user-456')) {
    console.log('✅ Utilisateur test-user-456 créé et vérifié avec succès !');
  } else {
    console.log('❌ Problème lors de la création de l\'utilisateur');
  }

} catch (error) {
  console.error('❌ Erreur lors de la création de l\'utilisateur:', error.message);
  
  // Essayer de voir si l'utilisateur existe déjà
  try {
    console.log('🔍 Vérification si l\'utilisateur existe déjà...');
    const checkCommand = `curl -X GET 'http://localhost:54321/rest/v1/___xtr_customer?id=eq.test-user-456' \
      -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
      -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4ODQ5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'`;
    
    const existingUser = execSync(checkCommand, { encoding: 'utf8' });
    console.log('📋 Utilisateur existant:', existingUser);
    
    if (existingUser.includes('test-user-456')) {
      console.log('ℹ️ L\'utilisateur existe déjà, pas besoin de le créer');
    } else {
      console.log('❌ L\'utilisateur n\'existe pas et n\'a pas pu être créé');
    }
  } catch (checkError) {
    console.error('❌ Erreur lors de la vérification:', checkError.message);
  }
}
