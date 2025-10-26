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

  // Spacing Fluid (for responsive sections)
  if (tokens.spacingFluid) {
    css += '\n  /* Spacing Fluid (Responsive) */\n';
    Object.entries(tokens.spacingFluid).forEach(([key, value]) => {
      css += `  --spacing-fluid-${key}: ${value};\n`;
    });
  }

  // Layout (Grid, Container, Breakpoints)
  if (tokens.layout) {
    css += '\n  /* Layout */\n';
    
    if (tokens.layout.container) {
      css += '\n  /* Container Max-Widths */\n';
      Object.entries(tokens.layout.container).forEach(([key, value]) => {
        css += `  --container-${key}: ${value};\n`;
      });
    }
    
    if (tokens.layout.grid) {
      css += '\n  /* Grid System */\n';
      if (tokens.layout.grid.columns) {
        Object.entries(tokens.layout.grid.columns).forEach(([key, value]) => {
          css += `  --grid-columns-${key}: ${value};\n`;
        });
      }
      if (tokens.layout.grid.gutter) {
        Object.entries(tokens.layout.grid.gutter).forEach(([key, value]) => {
          css += `  --grid-gutter-${key}: ${value};\n`;
        });
      }
    }
    
    if (tokens.layout.breakpoints) {
      css += '\n  /* Breakpoints */\n';
      Object.entries(tokens.layout.breakpoints).forEach(([key, value]) => {
        css += `  --breakpoint-${key}: ${value};\n`;
      });
    }
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
    if (tokens.typography.fontSizeFluid) {
      Object.entries(tokens.typography.fontSizeFluid).forEach(([key, value]) => {
        css += `  --font-size-fluid-${key}: ${value};\n`;
      });
    }
    if (tokens.typography.lineHeight) {
      Object.entries(tokens.typography.lineHeight).forEach(([key, value]) => {
        css += `  --line-height-${key}: ${value};\n`;
      });
    }
    if (tokens.typography.letterSpacing) {
      Object.entries(tokens.typography.letterSpacing).forEach(([key, value]) => {
        css += `  --letter-spacing-${key}: ${value};\n`;
      });
    }
    if (tokens.typography.maxWidth) {
      Object.entries(tokens.typography.maxWidth).forEach(([key, value]) => {
        css += `  --max-width-${key}: ${value};\n`;
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
  
  // 🎨 SHADCN/UI COMPATIBILITY
  // Ajout automatique des variables shadcn après les tokens principaux
  css += `
/* ========================================
   SHADCN/UI COMPATIBILITY
   Ces variables permettent aux composants shadcn
   de continuer à fonctionner sans modification
   ======================================== */
:root {
  /* Layout */
  --background: 0 0% 100%;             /* Blanc */
  --foreground: 222.2 84% 4.9%;        /* Texte principal */

  /* Card */
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;

  /* Popover */
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;

  /* Primary (référence nos tokens) */
  --primary: 9 100% 59%;               /* Équivalent HSL de #FF3B30 */
  --primary-foreground: 0 0% 0%;       /* Texte sur primary */

  /* Secondary */
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;

  /* Muted */
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;

  /* Accent */
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;

  /* Destructive */
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;

  /* Border & Input */
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 9 100% 59%;                  /* Focus ring = primary */

  /* Charts */
  --chart-1: 12 76% 61%;
  --chart-2: 173 58% 39%;
  --chart-3: 197 37% 24%;
  --chart-4: 43 74% 66%;
  --chart-5: 27 87% 67%;

  /* Radius (référence notre token) */
  --radius: var(--radius-lg);
}

/* ========================================
   DARK MODE
   ======================================== */
.dark {
  /* Layout */
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;

  /* Card */
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;

  /* Popover */
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;

  /* Primary */
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;

  /* Secondary */
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;

  /* Muted */
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;

  /* Accent */
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;

  /* Destructive */
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;

  /* Border & Input */
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;

  /* Charts */
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
}
`;
  
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

  // === SPACING FLUID (Responsive Sections) ===
  if (tokens.spacingFluid) {
    css += '/* === SPACING FLUID (Responsive) === */\n\n';
    Object.keys(tokens.spacingFluid).forEach(key => {
      css += `.p-${key} { padding: var(--spacing-fluid-${key}); }\n`;
      css += `.py-${key} { padding-top: var(--spacing-fluid-${key}); padding-bottom: var(--spacing-fluid-${key}); }\n`;
      css += `.pt-${key} { padding-top: var(--spacing-fluid-${key}); }\n`;
      css += `.pb-${key} { padding-bottom: var(--spacing-fluid-${key}); }\n`;
      css += `.m-${key} { margin: var(--spacing-fluid-${key}); }\n`;
      css += `.my-${key} { margin-top: var(--spacing-fluid-${key}); margin-bottom: var(--spacing-fluid-${key}); }\n`;
      css += `.mt-${key} { margin-top: var(--spacing-fluid-${key}); }\n`;
      css += `.mb-${key} { margin-bottom: var(--spacing-fluid-${key}); }\n`;
      if (key.startsWith('gap-')) {
        css += `.${key} { gap: var(--spacing-fluid-${key}); }\n`;
      }
      css += '\n';
    });
  }

  // === LAYOUT (Container & Grid) ===
  if (tokens.layout) {
    css += '/* === LAYOUT === */\n\n';
    
    // Container utilities
    if (tokens.layout.container) {
      css += '/* Container Max-Widths */\n';
      css += `.container {\n`;
      css += `  width: 100%;\n`;
      css += `  margin-left: auto;\n`;
      css += `  margin-right: auto;\n`;
      css += `  padding-left: var(--spacing-md);\n`;
      css += `  padding-right: var(--spacing-md);\n`;
      css += `}\n\n`;
      
      Object.entries(tokens.layout.container).forEach(([key, value]) => {
        if (key !== 'full') {
          css += `.container-${key} { max-width: var(--container-${key}); }\n`;
          // Responsive container
          css += `@media (min-width: ${value}) {\n`;
          css += `  .container { max-width: var(--container-${key}); }\n`;
          css += `}\n\n`;
        }
      });
    }
    
    // Grid utilities
    if (tokens.layout.grid) {
      css += '/* Grid System */\n';
      css += `.grid-container {\n`;
      css += `  display: grid;\n`;
      css += `  width: 100%;\n`;
      css += `  gap: var(--grid-gutter-mobile);\n`;
      css += `  grid-template-columns: repeat(var(--grid-columns-mobile), 1fr);\n`;
      css += `}\n\n`;
      
      if (tokens.layout.breakpoints) {
        // Tablet
        css += `@media (min-width: ${tokens.layout.breakpoints.sm}) {\n`;
        css += `  .grid-container {\n`;
        css += `    gap: var(--grid-gutter-tablet);\n`;
        css += `    grid-template-columns: repeat(var(--grid-columns-tablet), 1fr);\n`;
        css += `  }\n`;
        css += `}\n\n`;
        
        // Desktop
        css += `@media (min-width: ${tokens.layout.breakpoints.lg}) {\n`;
        css += `  .grid-container {\n`;
        css += `    gap: var(--grid-gutter-desktop);\n`;
        css += `    grid-template-columns: repeat(var(--grid-columns-desktop), 1fr);\n`;
        css += `  }\n`;
        css += `}\n\n`;
        
        // Wide
        css += `@media (min-width: ${tokens.layout.breakpoints['2xl']}) {\n`;
        css += `  .grid-container-wide {\n`;
        css += `    grid-template-columns: repeat(var(--grid-columns-wide), 1fr);\n`;
        css += `  }\n`;
        css += `}\n\n`;
      }
      
      // Grid span utilities
      css += '/* Grid Column Spans */\n';
      for (let i = 1; i <= 16; i++) {
        css += `.col-span-${i} { grid-column: span ${i} / span ${i}; }\n`;
      }
      css += '\n';
      
      // Grid row utilities
      css += '/* Grid Row Spans */\n';
      for (let i = 1; i <= 6; i++) {
        css += `.row-span-${i} { grid-row: span ${i} / span ${i}; }\n`;
      }
      css += '\n';
    }
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
    spacingFluid: Object.keys(tokens.spacingFluid || {}).length,
    layout: tokens.layout ? 
      (Object.keys(tokens.layout.container || {}).length + 
       Object.keys(tokens.layout.grid?.columns || {}).length +
       Object.keys(tokens.layout.grid?.gutter || {}).length +
       Object.keys(tokens.layout.breakpoints || {}).length) : 0,
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
  console.log(`   Spacing Fluid: ${stats.spacingFluid}`);
  console.log(`   Layout (Grid/Container): ${stats.layout}`);
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
