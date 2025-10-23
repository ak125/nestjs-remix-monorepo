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
          // Auto-generate contrast color for accessibility (WCAG AA)
          if (value && value.startsWith('#')) {
            const contrastColor = getContrastColor(value);
            css += `  --color-${category}-${shade}-contrast: ${contrastColor};\n`;
          }
        });
      } else {
        css += `  --color-${category}: ${shades};\n`;
        // Auto-generate contrast for single color values
        if (shades && shades.startsWith('#')) {
          const contrastColor = getContrastColor(shades);
          css += `  --color-${category}-contrast: ${contrastColor};\n`;
        }
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

  // Z-Index
  if (tokens.zIndex) {
    css += '\n  /* Z-Index */\n';
    Object.entries(tokens.zIndex).forEach(([key, value]) => {
      css += `  --z-${key}: ${value};\n`;
    });
  }

  // Transitions
  if (tokens.transitions) {
    css += '\n  /* Transitions */\n';
    Object.entries(tokens.transitions).forEach(([key, value]) => {
      css += `  --transition-${key}: ${value};\n`;
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

// 🎨 Calcul Luminance WCAG
function calculateLuminance(hex) {
  // Conversion HEX → RGB
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;
  
  // Linearize RGB (sRGB → Linear RGB)
  const [rs, gs, bs] = [r, g, b].map(c => 
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  
  // Calculate relative luminance (WCAG formula)
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// 🎨 Calcul Contrast Auto (WCAG AA)
function getContrastColor(hex) {
  const luminance = calculateLuminance(hex);
  // WCAG AA requires 4.5:1 contrast ratio for normal text
  // Threshold ~0.179 ensures sufficient contrast
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

// 🎨 Génération CSS Utilities Sémantiques
function generateUtilities(tokens) {
  let css = `/**
 * 🎨 CSS Utilities Sémantiques - Auto-généré
 * ⚠️  NE PAS MODIFIER MANUELLEMENT
 * Source: src/tokens/design-tokens.json
 * 
 * Usage: @import '@fafa/design-tokens/utilities';
 */

`;

  // === COLORS ===
  if (tokens.colors) {
    css += '/* === COLORS === */\n\n';

    // Primary (brand colors)
    if (tokens.colors.primary) {
      css += '/* Brand Colors (Primary) */\n';
      Object.entries(tokens.colors.primary).forEach(([shade, value]) => {
        css += `.bg-brand-${shade} { background-color: var(--color-primary-${shade}); }\n`;
        css += `.text-brand-${shade} { color: var(--color-primary-${shade}); }\n`;
        css += `.border-brand-${shade} { border-color: var(--color-primary-${shade}); }\n`;
        // Contrast auto utilities
        if (value && value.startsWith('#')) {
          css += `.text-brand-${shade}-contrast { color: var(--color-primary-${shade}-contrast); }\n`;
        }
      });
      css += '\n';
    }

    // Secondary
    if (tokens.colors.secondary) {
      css += '/* Secondary Colors */\n';
      Object.entries(tokens.colors.secondary).forEach(([shade, value]) => {
        css += `.bg-secondary-${shade} { background-color: var(--color-secondary-${shade}); }\n`;
        css += `.text-secondary-${shade} { color: var(--color-secondary-${shade}); }\n`;
        css += `.border-secondary-${shade} { border-color: var(--color-secondary-${shade}); }\n`;
        if (value && value.startsWith('#')) {
          css += `.text-secondary-${shade}-contrast { color: var(--color-secondary-${shade}-contrast); }\n`;
        }
      });
      css += '\n';
    }

    // Accent colors (custom)
    if (tokens.colors.accent) {
      css += '/* Accent Colors (Custom) */\n';
      Object.entries(tokens.colors.accent).forEach(([name, value]) => {
        const kebabName = name.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `.bg-${kebabName} { background-color: var(--color-accent-${name}); }\n`;
        css += `.text-${kebabName} { color: var(--color-accent-${name}); }\n`;
        css += `.border-${kebabName} { border-color: var(--color-accent-${name}); }\n`;
        if (value && value.startsWith('#')) {
          css += `.text-${kebabName}-contrast { color: var(--color-accent-${name}-contrast); }\n`;
        }
      });
      css += '\n';
    }

    // Semantic colors
    if (tokens.colors.semantic) {
      css += '/* Semantic Colors */\n';
      Object.entries(tokens.colors.semantic).forEach(([name, value]) => {
        css += `.bg-${name} { background-color: var(--color-semantic-${name}); }\n`;
        css += `.text-${name} { color: var(--color-semantic-${name}); }\n`;
        css += `.border-${name} { border-color: var(--color-semantic-${name}); }\n`;
        if (value && value.startsWith('#')) {
          css += `.text-${name}-contrast { color: var(--color-semantic-${name}-contrast); }\n`;
        }
      });
      css += '\n';
    }

    // Neutral colors
    if (tokens.colors.neutral) {
      css += '/* Neutral Colors */\n';
      Object.entries(tokens.colors.neutral).forEach(([name, value]) => {
        const kebabName = name.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `.bg-${kebabName} { background-color: var(--color-neutral-${name}); }\n`;
        css += `.text-${kebabName} { color: var(--color-neutral-${name}); }\n`;
        css += `.border-${kebabName} { border-color: var(--color-neutral-${name}); }\n`;
      });
      css += '\n';
    }
  }

  // === SPACING ===
  if (tokens.spacing) {
    css += '/* === SPACING === */\n\n';
    Object.keys(tokens.spacing).forEach(key => {
      css += `.p-space-${key} { padding: var(--spacing-${key}); }\n`;
      css += `.px-space-${key} { padding-left: var(--spacing-${key}); padding-right: var(--spacing-${key}); }\n`;
      css += `.py-space-${key} { padding-top: var(--spacing-${key}); padding-bottom: var(--spacing-${key}); }\n`;
      css += `.m-space-${key} { margin: var(--spacing-${key}); }\n`;
      css += `.mx-space-${key} { margin-left: var(--spacing-${key}); margin-right: var(--spacing-${key}); }\n`;
      css += `.my-space-${key} { margin-top: var(--spacing-${key}); margin-bottom: var(--spacing-${key}); }\n`;
      css += `.gap-space-${key} { gap: var(--spacing-${key}); }\n`;
      css += '\n';
    });
  }

  // === BORDER RADIUS ===
  if (tokens.borderRadius) {
    css += '/* === BORDER RADIUS === */\n\n';
    Object.keys(tokens.borderRadius).forEach(key => {
      css += `.rounded-${key} { border-radius: var(--radius-${key}); }\n`;
    });
    css += '\n';
  }

  // === SHADOWS ===
  if (tokens.shadows) {
    css += '/* === SHADOWS === */\n\n';
    Object.keys(tokens.shadows).forEach(key => {
      css += `.shadow-${key} { box-shadow: var(--shadow-${key}); }\n`;
    });
    css += '\n';
  }

  // === TYPOGRAPHY ===
  if (tokens.typography) {
    css += '/* === TYPOGRAPHY === */\n\n';
    
    if (tokens.typography.fontSize) {
      css += '/* Font Sizes */\n';
      Object.keys(tokens.typography.fontSize).forEach(key => {
        css += `.text-${key} { font-size: var(--font-size-${key}); }\n`;
      });
      css += '\n';
    }

    if (tokens.typography.fontFamily) {
      css += '/* Font Families */\n';
      Object.keys(tokens.typography.fontFamily).forEach(key => {
        css += `.font-${key} { font-family: var(--font-${key}); }\n`;
      });
      css += '\n';
    }
  }

  // === Z-INDEX ===
  if (tokens.zIndex) {
    css += '/* === Z-INDEX === */\n\n';
    Object.keys(tokens.zIndex).forEach(key => {
      css += `.z-${key} { z-index: var(--z-${key}); }\n`;
    });
    css += '\n';
  }

  // === TRANSITIONS ===
  if (tokens.transitions) {
    css += '/* === TRANSITIONS === */\n\n';
    Object.keys(tokens.transitions).forEach(key => {
      css += `.transition-${key} { transition-duration: var(--transition-${key}); }\n`;
    });
    css += '\n';
  }

  return css;
}

// �🎯 Génération Tailwind Config
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
  // CSS Variables
  const cssOutput = generateCSS(tokens);
  writeFileSync(join(stylesDir, 'tokens.css'), cssOutput);
  console.log('✅ Generated: src/styles/tokens.css');

  // CSS Utilities Sémantiques
  const utilitiesOutput = generateUtilities(tokens);
  writeFileSync(join(stylesDir, 'utilities.css'), utilitiesOutput);
  console.log('✅ Generated: src/styles/utilities.css');

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
    zIndex: Object.keys(tokens.zIndex || {}).length,
    transitions: Object.keys(tokens.transitions || {}).length,
  };
  
  const totalTokens = Object.values(stats).reduce((sum, count) => sum + count, 0);

  console.log('\n📊 Statistiques:');
  console.log(`   Colors: ${stats.colors}`);
  console.log(`   Spacing: ${stats.spacing}`);
  console.log(`   Typography: ${stats.typography}`);
  console.log(`   Shadows: ${stats.shadows}`);
  console.log(`   Border Radius: ${stats.borderRadius}`);
  console.log(`   Z-Index: ${stats.zIndex}`);
  console.log(`   Transitions: ${stats.transitions}`);
  console.log(`   ─────────────────`);
  console.log(`   Total: ${totalTokens} tokens`);
  
  console.log('\n🎉 Design tokens built successfully!\n');
} catch (error) {
  console.error('❌ Error building tokens:', error);
  process.exit(1);
}
