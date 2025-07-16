#!/usr/bin/env node

/**
 * Script de test de la migration
 */

const { execSync } = require('child_process');

console.log('🧪 Test de la migration...');

try {
  console.log('📦 Installation des dépendances...');
  execSync('npm install', { stdio: 'inherit' });
  
  console.log('🔨 Compilation TypeScript...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('✅ Migration validée avec succès !');
} catch (error) {
  console.error('❌ Erreur lors des tests:', error.message);
  process.exit(1);
}
