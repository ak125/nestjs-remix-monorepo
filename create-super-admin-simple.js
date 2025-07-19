#!/usr/bin/env node

console.log('🚀 Création d\'un super-admin niveau 9...');

// Données du super-admin
const superAdminData = {
  login: 'super_admin',
  email: 'super.admin@example.com',
  firstName: 'Super',
  lastName: 'Admin',
  phone: '0123456789',
  password: 'SuperAdmin123!'
};

console.log('📋 Données du super-admin:');
console.log('   - Login:', superAdminData.login);
console.log('   - Email:', superAdminData.email);
console.log('   - Nom:', superAdminData.firstName, superAdminData.lastName);
console.log('   - Téléphone:', superAdminData.phone);
console.log('   - Niveau: 9 (Super-Administrator)');

// Simuler la création via API
const http = require('http');

const postData = JSON.stringify({
  login: superAdminData.login,
  email: superAdminData.email,
  firstName: superAdminData.firstName,
  lastName: superAdminData.lastName,
  phone: superAdminData.phone
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/staff/super-admin',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Accept': 'application/json'
  }
};

console.log('\n🌐 Envoi de la requête de création...');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📄 Réponse du serveur:');
    console.log('   - Code de statut:', res.statusCode);
    
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const result = JSON.parse(data);
        console.log('✅ Super-admin créé avec succès!');
        console.log('   - ID:', result.cnfa_id);
        console.log('   - Login:', result.cnfa_login);
        console.log('   - Email:', result.cnfa_mail);
        console.log('   - Niveau:', result.cnfa_level);
        console.log('   - Job:', result.cnfa_job);
        console.log('   - KeyLog:', result.cnfa_keylog);
        console.log('   - Actif:', result.cnfa_activ === '1' ? 'Oui' : 'Non');
        
        console.log('\n🎉 Super-admin niveau 9 créé avec succès!');
        console.log('📝 Vous pouvez maintenant:');
        console.log('   1. Vous connecter avec:', superAdminData.login);
        console.log('   2. Utiliser le mot de passe: SuperAdmin123!');
        console.log('   3. Gérer tous les autres administrateurs');
        console.log('   4. Accéder aux outils de super-admin');
        
      } catch (error) {
        console.log('📄 Réponse brute:', data);
        console.log('❌ Erreur lors du parsing JSON:', error.message);
      }
    } else {
      console.log('❌ Erreur lors de la création:', data);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Erreur de connexion:', error.message);
  console.log('ℹ️  Vérifiez que le serveur NestJS est démarré sur le port 3000');
  console.log('ℹ️  Commande: npm run start:dev');
});

req.write(postData);
req.end();

console.log('\n⏳ Attente de la réponse du serveur...');
