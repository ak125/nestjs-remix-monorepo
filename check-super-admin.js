const fs = require('fs');
const path = require('path');

console.log('🔍 Vérification des super-admins existants...');

// Lire les analyses PHP existantes
const phpAnalysisDir = '/workspaces/TEMPLATE_MCP_COMPLETE/php-analysis';

if (fs.existsSync(phpAnalysisDir)) {
  console.log('✅ Dossier php-analysis trouvé');
  
  // Lire l'analyse staff
  const staffAnalysisPath = path.join(phpAnalysisDir, 'staff-analysis.json');
  if (fs.existsSync(staffAnalysisPath)) {
    const staffAnalysis = JSON.parse(fs.readFileSync(staffAnalysisPath, 'utf8'));
    console.log('📋 Analyse staff chargée:');
    console.log('   - Table principale:', staffAnalysis.tables.primary);
    console.log('   - Niveaux d\'accès:', staffAnalysis.businessLogic.authorization.levels);
    
    console.log('\n🎯 Niveaux d\'administration détectés:');
    Object.entries(staffAnalysis.businessLogic.authorization.levels).forEach(([level, desc]) => {
      console.log(`   - Niveau ${level}: ${desc}`);
    });
  }
  
  // Lire l'analyse orders pour comprendre la structure
  const ordersAnalysisPath = path.join(phpAnalysisDir, 'orders-complete-analysis.json');
  if (fs.existsSync(ordersAnalysisPath)) {
    const ordersAnalysis = JSON.parse(fs.readFileSync(ordersAnalysisPath, 'utf8'));
    console.log('\n📊 Tables identifiées dans l\'analyse orders:');
    if (ordersAnalysis.tables) {
      ordersAnalysis.tables.forEach(table => {
        console.log(`   - ${table}`);
      });
    }
  }
} else {
  console.log('❌ Dossier php-analysis non trouvé');
}

// Vérifier les utilisateurs existants via l'API locale
console.log('\n🌐 Test de connexion à l\'API locale...');

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/users?level=7',
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const users = JSON.parse(data);
        console.log('✅ Utilisateurs niveau 7+ trouvés:', users.length);
        users.forEach(user => {
          console.log(`   - ${user.email} (niveau ${user.level})`);
        });
      } catch (error) {
        console.log('📄 Réponse API:', data);
      }
    } else {
      console.log('❌ Erreur API:', res.statusCode, data);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Erreur connexion:', error.message);
  console.log('ℹ️  Le serveur NestJS doit être démarré pour cette vérification');
});

req.end();

console.log('\n📋 Résumé des vérifications:');
console.log('1. ✅ Analyses PHP existantes utilisées');
console.log('2. 🔍 Niveaux d\'accès identifiés (7, 8, 9)');
console.log('3. 🌐 Test API locale en cours...');
console.log('\n💡 Si aucun super-admin n\'existe, exécuter:');
console.log('   node create-super-admin.js');
