#!/usr/bin/env node

/**
 * Script de validation de contraste WCAG AA/AAA
 * 
 * Teste automatiquement tous les tokens de couleur pour vérifier
 * que les combinaisons texte/fond respectent les ratios WCAG.
 * 
 * Standards:
 * - WCAG AA: ratio ≥ 4.5:1 (texte normal), ≥ 3:1 (texte large)
 * - WCAG AAA: ratio ≥ 7:1 (texte normal), ≥ 4.5:1 (texte large)
 * 
 * Usage:
 *   npm run test:contrast
 *   npm run test:contrast -- --level AAA
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction de calcul de luminance relative (WCAG)
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Fonction de calcul du ratio de contraste
function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

// Convertir HEX en RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Charger les thèmes
function loadTheme(themeName: string) {
  const themePath = resolve(__dirname, `../../packages/theme-${themeName}/src/styles/theme-${themeName}.css`);
  const themeFile = readFileSync(themePath, 'utf-8');
  
  const colors: Record<string, string> = {};
  
  // Parser les variables CSS
  const cssVarRegex = /--([a-z-]+):\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/g;
  let match;
  
  while ((match = cssVarRegex.exec(themeFile)) !== null) {
    colors[match[1]] = match[2];
  }
  
  return colors;
}

// Tester une combinaison texte/fond
function testCombination(
  textColor: string,
  bgColor: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): { pass: boolean; ratio: number; required: number } {
  const ratio = getContrastRatio(textColor, bgColor);
  
  let required: number;
  if (level === 'AAA') {
    required = isLargeText ? 4.5 : 7;
  } else {
    required = isLargeText ? 3 : 4.5;
  }
  
  return {
    pass: ratio >= required,
    ratio: Math.round(ratio * 100) / 100,
    required,
  };
}

// Main
function main() {
  const args = process.argv.slice(2);
  const level = args.includes('--level') 
    ? (args[args.indexOf('--level') + 1] as 'AA' | 'AAA') 
    : 'AA';
  
  console.log(`\n🎨 Test de contraste WCAG ${level}\n`);
  console.log('━'.repeat(80));
  
  const themes = ['vitrine', 'admin'];
  const violations: Array<{
    theme: string;
    combination: string;
    ratio: number;
    required: number;
  }> = [];
  
  for (const themeName of themes) {
    console.log(`\n📋 Thème: ${themeName}`);
    console.log('─'.repeat(80));
    
    const colors = loadTheme(themeName);
    
    // Combinaisons critiques à tester
    const combinations = [
      { text: 'text-primary', bg: 'bg-primary', label: 'Texte primaire sur fond primaire' },
      { text: 'text-secondary', bg: 'bg-primary', label: 'Texte secondaire sur fond primaire' },
      { text: 'text-inverse', bg: 'color-primary-600', label: 'Texte inverse sur bouton primaire' },
      { text: 'text-primary', bg: 'bg-secondary', label: 'Texte primaire sur fond secondaire' },
      { text: 'color-error', bg: 'bg-primary', label: 'Texte erreur sur fond primaire' },
      { text: 'color-success', bg: 'bg-primary', label: 'Texte succès sur fond primaire' },
      { text: 'color-warning', bg: 'bg-primary', label: 'Texte warning sur fond primaire' },
      { text: 'text-primary', bg: 'color-primary-50', label: 'Texte sur info box' },
    ];
    
    for (const combo of combinations) {
      const textColor = colors[combo.text];
      const bgColor = colors[combo.bg];
      
      if (!textColor || !bgColor) {
        console.log(`  ⚠️  ${combo.label}: couleur manquante`);
        continue;
      }
      
      const result = testCombination(textColor, bgColor, level);
      
      if (result.pass) {
        console.log(`  ✅ ${combo.label}: ${result.ratio}:1 (≥ ${result.required}:1)`);
      } else {
        console.log(`  ❌ ${combo.label}: ${result.ratio}:1 (< ${result.required}:1)`);
        violations.push({
          theme: themeName,
          combination: combo.label,
          ratio: result.ratio,
          required: result.required,
        });
      }
    }
  }
  
  console.log('\n' + '━'.repeat(80));
  
  if (violations.length === 0) {
    console.log('\n✅ Tous les tests de contraste passent WCAG ' + level + '\n');
    process.exit(0);
  } else {
    console.log(`\n❌ ${violations.length} violation(s) de contraste détectée(s):\n`);
    
    for (const v of violations) {
      console.log(`  • ${v.theme} - ${v.combination}`);
      console.log(`    Ratio: ${v.ratio}:1 (requis: ${v.required}:1)`);
    }
    
    console.log('\n💡 Suggestions:');
    console.log('  - Ajuster les couleurs dans les fichiers theme-*.css');
    console.log('  - Utiliser un outil comme https://webaim.org/resources/contrastchecker/');
    console.log('  - Augmenter la luminosité du texte ou assombrir le fond\n');
    
    process.exit(1);
  }
}

main();
