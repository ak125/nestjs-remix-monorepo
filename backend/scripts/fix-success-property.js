#!/usr/bin/env node

/**
 * Script pour ajouter automatiquement "success: true," aux objets de retour
 * qui contiennent data, total, page, limit mais pas success
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/modules/vehicles/services/data/vehicle-models.service.ts',
  'src/modules/vehicles/services/data/vehicle-types.service.ts',
  'src/modules/vehicles/services/search/vehicle-mine.service.ts',
  'src/modules/vehicles/services/search/vehicle-search.service.ts',
];

function addSuccessProperty(content) {
  // Pattern pour trouver les retours qui ont data, total, page, limit mais pas success
  const pattern = /return\s*\{(\s*)data:\s*([^,]+),(\s*)total:\s*([^,]+),(\s*)page:\s*([^,]+),(\s*)limit:\s*([^}]+)\}/g;
  
  let modified = false;
  const newContent = content.replace(pattern, (match, ws1, dataValue, ws2, totalValue, ws3, pageValue, ws4, limitValue) => {
    // Vérifier si 'success' n'est pas déjà présent dans le match
    if (!match.includes('success:')) {
      modified = true;
      return `return {${ws1}success: true,${ws1}data: ${dataValue},${ws2}total: ${totalValue},${ws3}page: ${pageValue},${ws4}limit: ${limitValue}}`;
    }
    return match;
  });
  
  return { newContent, modified };
}

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Fichier non trouvé: ${filePath}`);
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const { newContent, modified } = addSuccessProperty(content);
  
  if (modified) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`✅ Modifié: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  Pas de changements: ${filePath}`);
    return false;
  }
}

console.log('🔧 Ajout automatique de "success: true" dans les services vehicles...\n');

let totalModified = 0;
filesToFix.forEach(file => {
  if (processFile(file)) {
    totalModified++;
  }
});

console.log(`\n🎉 Terminé ! ${totalModified} fichier(s) modifié(s)`);
console.log('💡 N\'oubliez pas de lancer Prettier pour formater les fichiers modifiés');
