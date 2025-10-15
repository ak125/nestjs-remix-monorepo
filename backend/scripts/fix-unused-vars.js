#!/usr/bin/env node

/**
 * Script pour corriger automatiquement les variables non utilisées
 * en les préfixant avec _ selon la convention ESLint
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 Correction automatique des variables non utilisées...\n');

// Exécuter le lint et capturer la sortie
let lintOutput;
try {
  execSync('npm run lint 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
} catch (error) {
  lintOutput = error.stdout || error.stderr || '';
}

// Parser les warnings
const warnings = [];
const lines = lintOutput.split('\n');
let currentFile = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Détecter le fichier
  if (line.startsWith('/')) {
    currentFile = line.trim();
    continue;
  }
  
  // Détecter les warnings de variables non utilisées
  const warningMatch = line.match(/^\s+(\d+):(\d+)\s+warning\s+'([^']+)' is (assigned a value but never used|defined but never used)/);
  
  if (warningMatch && currentFile) {
    const [_, lineNum, col, varName, type] = warningMatch;
    
    // Ignorer les variables déjà préfixées avec _
    if (!varName.startsWith('_')) {
      warnings.push({
        file: currentFile,
        line: parseInt(lineNum),
        col: parseInt(col),
        varName,
        type
      });
    }
  }
}

console.log(`📊 Trouvé ${warnings.length} warnings à corriger\n`);

// Grouper par fichier
const fileWarnings = warnings.reduce((acc, w) => {
  if (!acc[w.file]) acc[w.file] = [];
  acc[w.file].push(w);
  return {};
}, {});

let fixed = 0;
let errors = 0;

// Traiter chaque fichier
Object.entries(fileWarnings).forEach(([file, fileWarnings]) => {
  try {
    if (!fs.existsSync(file)) {
      console.log(`⚠️  Fichier non trouvé: ${file}`);
      return;
    }
    
    let content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    // Trier par numéro de ligne décroissant pour ne pas décaler les lignes
    fileWarnings.sort((a, b) => b.line - a.line);
    
    fileWarnings.forEach(warning => {
      const lineIndex = warning.line - 1;
      if (lineIndex < 0 || lineIndex >= lines.length) return;
      
      const line = lines[lineIndex];
      const varName = warning.varName;
      
      // Patterns de remplacement sûrs
      let newLine = line;
      let modified = false;
      
      // catch (error) → catch (_error)
      if (line.includes(`catch (${varName})`)) {
        newLine = line.replace(`catch (${varName})`, `catch (_${varName})`);
        modified = true;
      }
      // const varName = → const _varName =
      else if (line.match(new RegExp(`\\bconst\\s+${varName}\\s*[=:]`))) {
        newLine = line.replace(new RegExp(`\\bconst\\s+${varName}\\b`), `const _${varName}`);
        modified = true;
      }
      // let varName = → let _varName =
      else if (line.match(new RegExp(`\\blet\\s+${varName}\\s*=`))) {
        newLine = line.replace(new RegExp(`\\blet\\s+${varName}\\b`), `let _${varName}`);
        modified = true;
      }
      // Destructuring: { varName, ... }
      else if (line.match(new RegExp(`\\{[^}]*\\b${varName}\\b[^}]*\\}`))) {
        // Plus complexe, on préfère le skip pour éviter les bugs
        console.log(`⚠️  Skip destructuring: ${file}:${warning.line} (${varName})`);
      }
      // Import { VarName }
      else if (line.match(new RegExp(`import\\s*\\{[^}]*\\b${varName}\\b`))) {
        newLine = line.replace(
          new RegExp(`(\\b${varName}\\b)([,}])`),
          `type ${varName} as _${varName}$2`
        );
        modified = true;
      }
      
      if (modified) {
        lines[lineIndex] = newLine;
        fixed++;
      }
    });
    
    // Sauvegarder si modifié
    const newContent = lines.join('\n');
    if (newContent !== content) {
      fs.writeFileSync(file, newContent, 'utf-8');
      console.log(`✅ ${file} (${fileWarnings.length} corrections)`);
    }
    
  } catch (error) {
    console.log(`❌ Erreur avec ${file}: ${error.message}`);
    errors++;
  }
});

console.log(`\n📊 Résumé:`);
console.log(`   ✅ ${fixed} warnings corrigés`);
console.log(`   ❌ ${errors} erreurs`);
console.log(`\n🔍 Relancez 'npm run lint' pour vérifier`);
