#!/usr/bin/env node

/**
 * 🚀 Migration Automatique vers Design System
 * 
 * Remplace les patterns hardcodés par des composants Alert/Badge
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns à migrer automatiquement
const MIGRATIONS = {
  // Alert patterns
  alerts: [
    {
      pattern: /className=["']([^"']*bg-red-(?:50|100)[^"']*)["']/g,
      replacement: () => '<Alert intent="error"',
      needsImport: 'Alert',
    },
    {
      pattern: /className=["']([^"']*bg-green-(?:50|100)[^"']*)["']/g,
      replacement: () => '<Alert intent="success"',
      needsImport: 'Alert',
    },
    {
      pattern: /className=["']([^"']*bg-yellow-(?:50|100)[^"']*)["']/g,
      replacement: () => '<Alert intent="warning"',
      needsImport: 'Alert',
    },
    {
      pattern: /className=["']([^"']*bg-blue-(?:50|100)[^"']*)["']/g,
      replacement: () => '<Alert intent="info"',
      needsImport: 'Alert',
    },
  ],
  
  // Badge patterns (simple)
  badges: [
    {
      pattern: /<span\s+className=["']([^"']*bg-red-(?:50|100|200)[^"']*)["']>([^<]+)<\/span>/g,
      replacement: (match, classes, text) => `<Badge variant="error">${text}</Badge>`,
      needsImport: 'Badge',
    },
    {
      pattern: /<span\s+className=["']([^"']*bg-green-(?:50|100|200)[^"']*)["']>([^<]+)<\/span>/g,
      replacement: (match, classes, text) => `<Badge variant="success">${text}</Badge>`,
      needsImport: 'Badge',
    },
    {
      pattern: /<span\s+className=["']([^"']*bg-yellow-(?:50|100|200)[^"']*)["']>([^<]+)<\/span>/g,
      replacement: (match, classes, text) => `<Badge variant="warning">${text}</Badge>`,
      needsImport: 'Badge',
    },
    {
      pattern: /<span\s+className=["']([^"']*bg-blue-(?:50|100|200)[^"']*)["']>([^<]+)<\/span>/g,
      replacement: (match, classes, text) => `<Badge variant="info">${text}</Badge>`,
      needsImport: 'Badge',
    },
    {
      pattern: /<span\s+className=["']([^"']*bg-purple-(?:50|100|200)[^"']*)["']>([^<]+)<\/span>/g,
      replacement: (match, classes, text) => `<Badge variant="purple">${text}</Badge>`,
      needsImport: 'Badge',
    },
    {
      pattern: /<span\s+className=["']([^"']*bg-orange-(?:50|100|200)[^"']*)["']>([^<]+)<\/span>/g,
      replacement: (match, classes, text) => `<Badge variant="orange">${text}</Badge>`,
      needsImport: 'Badge',
    },
  ],
};

function findTSXFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findTSXFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') && !file.includes('.test.')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const neededImports = new Set();
  
  // Apply badge migrations
  MIGRATIONS.badges.forEach(({ pattern, replacement, needsImport }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      modified = true;
      neededImports.add(needsImport);
      console.log(`  ✓ ${matches.length} Badge migration(s)`);
    }
  });
  
  // Apply alert migrations (plus complexe, skip pour l'instant)
  
  // Add imports if needed
  if (neededImports.size > 0) {
    const imports = Array.from(neededImports).join(', ');
    
    // Check if import already exists
    if (!content.includes(`from "@fafa/ui"`)) {
      // Find first import and add before it
      const firstImportMatch = content.match(/^import\s/m);
      if (firstImportMatch) {
        const insertPos = firstImportMatch.index;
        content = 
          content.slice(0, insertPos) +
          `import { ${imports} } from "@fafa/ui";\n` +
          content.slice(insertPos);
      }
    } else {
      // Update existing import
      content = content.replace(
        /import\s*\{([^}]*)\}\s*from\s*["']@fafa\/ui["']/,
        (match, currentImports) => {
          const existing = currentImports.split(',').map(s => s.trim()).filter(Boolean);
          const combined = [...new Set([...existing, ...neededImports])];
          return `import { ${combined.join(', ')} } from "@fafa/ui"`;
        }
      );
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
  
  return modified;
}

function main() {
  console.log('🚀 Migration automatique du Design System\n');
  
  const frontendDir = path.join(__dirname, '../frontend/app/routes');
  const files = findTSXFiles(frontendDir);
  
  console.log(`📁 ${files.length} fichiers TSX trouvés\n`);
  
  let migratedCount = 0;
  const migratedFiles = [];
  
  files.forEach(file => {
    const relativePath = path.relative(process.cwd(), file);
    process.stdout.write(`⏳ ${relativePath}...`);
    
    const modified = migrateFile(file);
    
    if (modified) {
      process.stdout.write(` ✅\n`);
      migratedCount++;
      migratedFiles.push(relativePath);
    } else {
      process.stdout.write(` ⏭️  (skip)\n`);
    }
  });
  
  console.log(`\n✨ ${migratedCount} fichiers migrés !\n`);
  
  if (migratedFiles.length > 0) {
    console.log('📝 Fichiers modifiés :');
    migratedFiles.forEach(f => console.log(`   - ${f}`));
    
    console.log('\n💡 Commandes suivantes :');
    console.log('   1. Vérifier les changements : git diff');
    console.log('   2. Tester : npm run dev');
    console.log('   3. Commiter : git add . && git commit -m "chore: Auto-migrate to design system"');
  }
}

main();
