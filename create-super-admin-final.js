#!/usr/bin/env node

console.log('🚀 Création d\'un super-admin niveau 9 (basé sur l\'analyse PHP)...');

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Lire l'analyse PHP pour comprendre la structure
const phpAnalysisDir = '/workspaces/TEMPLATE_MCP_COMPLETE/php-analysis';
const staffAnalysisPath = path.join(phpAnalysisDir, 'staff-analysis.json');

if (fs.existsSync(staffAnalysisPath)) {
  const staffAnalysis = JSON.parse(fs.readFileSync(staffAnalysisPath, 'utf8'));
  
  console.log('📋 Structure de la table ___config_admin:');
  console.log('   - Table:', staffAnalysis.tables.primary);
  console.log('   - Champs:', Object.keys(staffAnalysis.businessLogic.fields).join(', '));
  console.log('   - Niveaux:', Object.keys(staffAnalysis.businessLogic.authorization.levels).join(', '));
  
  // Créer les données du super-admin selon la structure PHP
  const superAdminData = {
    cnfa_id: Date.now(),
    cnfa_login: 'super_admin',
    cnfa_pswd: bcrypt.hashSync('SuperAdmin123!', 10),
    cnfa_mail: 'super.admin@example.com',
    cnfa_keylog: `SUPER_ADMIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    cnfa_level: 9,
    cnfa_job: 'Super Administrator',
    cnfa_name: 'Admin',
    cnfa_fname: 'Super',
    cnfa_tel: '0123456789',
    cnfa_activ: '1',
    s_id: 'super_admin_dept'
  };
  
  console.log('\n🎯 Super-admin créé (simulation):');
  console.log('   - ID:', superAdminData.cnfa_id);
  console.log('   - Login:', superAdminData.cnfa_login);
  console.log('   - Email:', superAdminData.cnfa_mail);
  console.log('   - Niveau:', superAdminData.cnfa_level);
  console.log('   - Job:', superAdminData.cnfa_job);
  console.log('   - Nom complet:', superAdminData.cnfa_fname, superAdminData.cnfa_name);
  console.log('   - Téléphone:', superAdminData.cnfa_tel);
  console.log('   - Actif:', superAdminData.cnfa_activ === '1' ? 'Oui' : 'Non');
  console.log('   - KeyLog:', superAdminData.cnfa_keylog);
  console.log('   - Département:', superAdminData.s_id);
  
  // Sauvegarder dans un fichier pour référence
  const superAdminFile = path.join(__dirname, 'super-admin-created.json');
  fs.writeFileSync(superAdminFile, JSON.stringify(superAdminData, null, 2));
  
  console.log('\n✅ Super-admin créé avec succès!');
  console.log('📄 Données sauvegardées dans:', superAdminFile);
  
  console.log('\n🔐 Informations de connexion:');
  console.log('   - Login:', superAdminData.cnfa_login);
  console.log('   - Mot de passe: SuperAdmin123!');
  console.log('   - Niveau: 9 (Super-Administrateur)');
  
  console.log('\n🎉 Permissions du super-admin niveau 9:');
  const permissions = staffAnalysis.businessLogic.authorization.levels['9'];
  console.log('   - Description:', permissions);
  console.log('   - Peut gérer: Tous les administrateurs de niveau 7 et 8');
  console.log('   - Accès: Outils super-admin, gestion des paiements');
  console.log('   - Fonctions: Création/modification/suppression de tous les admins');
  
  console.log('\n🚀 Prochaines étapes:');
  console.log('1. Intégrer ce super-admin dans la base de données');
  console.log('2. Tester la connexion avec ces identifiants');
  console.log('3. Implémenter les fonctionnalités de super-admin');
  console.log('4. Créer l\'interface de gestion des administrateurs');
  
} else {
  console.log('❌ Fichier d\'analyse PHP non trouvé');
  console.log('   Chemin attendu:', staffAnalysisPath);
}
