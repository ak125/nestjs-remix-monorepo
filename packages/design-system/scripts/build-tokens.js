#!/usr/bin/env node
/**
 * 🎨 Design Tokens Builder
 * 
 * Génère automatiquement :
 * - src/styles/tokens.css (CSS Variables)
 * - src/tokens/generated.ts (TypeScript types & values)
 * - dist/tailwind.tokens.js (config Tailwind)
 * 
 * Usage: node scripts/build-tokens.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 📦 Chargement des tokens sources
const tokensPath = join(__dirname, '../src/tokens/design-tokens.json');

if (!existsSync(tokensPath)) {
  console.error('❌ Erreur: design-tokens.json non trouvé');
  console.error(`   Chemin attendu: ${tokensPath}`);
  process.exit(1);
}

const tokensContent = readFileSync(tokensPath, 'utf8');
let tokens;

try {
  tokens = JSON.parse(tokensContent);
} catch (error) {
  console.error('❌ Erreur: JSON invalide dans design-tokens.json');
  console.error(error.message);
  process.exit(1);
}

// Validation basique de la structure
const requiredKeys = ['colors', 'spacing', 'typography', 'shadows', 'borderRadius'];
const missingKeys = requiredKeys.filter(key => !tokens[key]);

if (missingKeys.length > 0) {
  console.warn(`⚠️  Attention: Clés manquantes dans design-tokens.json: ${missingKeys.join(', ')}`);
}

// 🎨 Génération CSS Variables
function generateCSS(tokens) {
  let css = `/**
 * 🎨 Design Tokens - Auto-généré
 * ⚠️  NE PAS MODIFIER MANUELLEMENT
 * Source: src/tokens/design-tokens.json
 */

:root {
`;

  // Colors
  if (tokens.colors) {
    css += '\n  /* Colors */\n';
    Object.entries(tokens.colors).forEach(([category, shades]) => {
      if (typeof shades === 'object') {
        Object.entries(shades).forEach(([shade, value]) => {
          css += `  --color-${category}-${shade}: ${value};\n`;
        });
      } else {
        css += `  --color-${category}: ${shades};\n`;
      }
    });
  }

  // Spacing
  if (tokens.spacing) {
    css += '\n  /* Spacing */\n';
    Object.entries(tokens.spacing).forEach(([key, value]) => {
      css += `  --spacing-${key}: ${value};\n`;
    });
  }

  // Typography
  if (tokens.typography) {
    css += '\n  /* Typography */\n';
    if (tokens.typography.fontFamily) {
      Object.entries(tokens.typography.fontFamily).forEach(([key, value]) => {
        css += `  --font-${key}: ${value};\n`;
      });
    }
    if (tokens.typography.fontSize) {
      Object.entries(tokens.typography.fontSize).forEach(([key, value]) => {
        css += `  --font-size-${key}: ${value};\n`;
      });
    }
    if (tokens.typography.lineHeight) {
      Object.entries(tokens.typography.lineHeight).forEach(([key, value]) => {
        css += `  --line-height-${key}: ${value};\n`;
      });
    }
  }

  // Shadows
  if (tokens.shadows) {
    css += '\n  /* Shadows */\n';
    Object.entries(tokens.shadows).forEach(([key, value]) => {
      css += `  --shadow-${key}: ${value};\n`;
    });
  }

  // Border Radius
  if (tokens.borderRadius) {
    css += '\n  /* Border Radius */\n';
    Object.entries(tokens.borderRadius).forEach(([key, value]) => {
      css += `  --radius-${key}: ${value};\n`;
    });
  }

  css += '}\n';
  return css;
}

// 📝 Génération TypeScript
function generateTS(tokens) {
  let ts = `/**
 * 🎨 Design Tokens - Auto-généré
 * ⚠️  NE PAS MODIFIER MANUELLEMENT
 * Source: src/tokens/design-tokens.json
 */

export const designTokens = ${JSON.stringify(tokens, null, 2)} as const;

export type DesignTokens = typeof designTokens;

// Type helpers
export type ColorToken = keyof typeof designTokens.colors;
export type SpacingToken = keyof typeof designTokens.spacing;
export type TypographyToken = keyof typeof designTokens.typography;
`;

  return ts;
}

// 🎯 Génération Tailwind Config
function generateTailwindTokens(tokens) {
  const config = {
    colors: {},
    spacing: {},
    fontFamily: {},
    fontSize: {},
    boxShadow: {},
    borderRadius: {},
  };

  // Colors
  if (tokens.colors) {
    Object.entries(tokens.colors).forEach(([category, shades]) => {
      if (typeof shades === 'object') {
        config.colors[category] = shades;
      } else {
        config.colors[category] = shades;
      }
    });
  }

  // Spacing
  if (tokens.spacing) {
    config.spacing = tokens.spacing;
  }

  // Typography
  if (tokens.typography) {
    if (tokens.typography.fontFamily) {
      config.fontFamily = tokens.typography.fontFamily;
    }
    if (tokens.typography.fontSize) {
      config.fontSize = tokens.typography.fontSize;
    }
  }

  // Shadows
  if (tokens.shadows) {
    config.boxShadow = tokens.shadows;
  }

  // Border Radius
  if (tokens.borderRadius) {
    config.borderRadius = tokens.borderRadius;
  }

  return `/**
 * 🎯 Tailwind Tokens - Auto-généré
 * ⚠️  NE PAS MODIFIER MANUELLEMENT
 */
module.exports = ${JSON.stringify(config, null, 2)};
`;
}

// 📁 Création des dossiers si nécessaire
const stylesDir = join(__dirname, '../src/styles');
const tokensDir = join(__dirname, '../src/tokens');
const distDir = join(__dirname, '../dist');

[stylesDir, tokensDir, distDir].forEach((dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// ✍️ Écriture des fichiers
try {
  // CSS
  const cssOutput = generateCSS(tokens);
  writeFileSync(join(stylesDir, 'tokens.css'), cssOutput);
  console.log('✅ Generated: src/styles/tokens.css');

  // TypeScript
  const tsOutput = generateTS(tokens);
  writeFileSync(join(tokensDir, 'generated.ts'), tsOutput);
  console.log('✅ Generated: src/tokens/generated.ts');

  // Tailwind
  const tailwindOutput = generateTailwindTokens(tokens);
  writeFileSync(join(distDir, 'tailwind.tokens.js'), tailwindOutput);
  console.log('✅ Generated: dist/tailwind.tokens.js');

  // Stats
  const stats = {
    colors: Object.keys(tokens.colors || {}).length,
    spacing: Object.keys(tokens.spacing || {}).length,
    typography: Object.keys(tokens.typography || {}).length,
    shadows: Object.keys(tokens.shadows || {}).length,
    borderRadius: Object.keys(tokens.borderRadius || {}).length,
  };
  
  const totalTokens = Object.values(stats).reduce((sum, count) => sum + count, 0);

  console.log('\n📊 Statistiques:');
  console.log(`   Colors: ${stats.colors}`);
  console.log(`   Spacing: ${stats.spacing}`);
  console.log(`   Typography: ${stats.typography}`);
  console.log(`   Shadows: ${stats.shadows}`);
  console.log(`   Border Radius: ${stats.borderRadius}`);
  console.log(`   ─────────────────`);
  console.log(`   Total: ${totalTokens} tokens`);
  
  console.log('\n🎉 Design tokens built successfully!\n');
} catch (error) {
  console.error('❌ Error building tokens:', error);
  process.exit(1);
}
