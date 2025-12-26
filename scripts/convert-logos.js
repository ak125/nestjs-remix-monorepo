#!/usr/bin/env node
/**
 * Script de conversion des logos SVG en WebP
 * Génère toutes les variantes nécessaires pour usage web optimal
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../frontend/public');

const VARIANTS = [
  // Logo navbar (texte seul avec compteur dans O)
  { input: 'logo-navbar.svg', output: 'logo-navbar.webp', width: 220, height: 36 },
  { input: 'logo-navbar.svg', output: 'logo-navbar@2x.webp', width: 440, height: 72 },

  // Logo complet (avec tagline)
  { input: 'logo-automecanik.svg', output: 'logo-automecanik.webp', width: 310, height: 60 },
  { input: 'logo-automecanik.svg', output: 'logo-automecanik@2x.webp', width: 620, height: 120 },

  // Icônes PWA (depuis logo complet)
  { input: 'logo-automecanik.svg', output: 'icon-512.webp', width: 512, height: 512 },
  { input: 'logo-automecanik.svg', output: 'icon-192.webp', width: 192, height: 192 },

  // Open Graph / Social Media
  { input: 'logo-automecanik.svg', output: 'logo-og.webp', width: 1200, height: 630 },
];

async function checkDependencies() {
  const tools = ['convert', 'magick', 'inkscape', 'rsvg-convert'];
  
  for (const tool of tools) {
    try {
      await execAsync(`which ${tool}`);
      console.log(`✅ Trouvé: ${tool}`);
      return tool;
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

async function installSharp() {
  console.log('📦 Installation de sharp (bibliothèque de conversion)...');
  try {
    await execAsync('npm install sharp --no-save', { cwd: path.join(__dirname, '..') });
    console.log('✅ Sharp installé avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur installation sharp:', error.message);
    return false;
  }
}

async function convertWithSharp() {
  console.log('🔧 Utilisation de sharp pour la conversion...');
  
  try {
    const sharp = require('sharp');
    
    for (const variant of VARIANTS) {
      const inputPath = path.join(PUBLIC_DIR, variant.input);
      const outputPath = path.join(PUBLIC_DIR, variant.output);
      
      console.log(`  Converting: ${variant.input} → ${variant.output} (${variant.width}×${variant.height})`);
      
      await sharp(inputPath)
        .resize(variant.width, variant.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 90, lossless: false })
        .toFile(outputPath);
      
      console.log(`  ✅ ${variant.output}`);
    }
    
    console.log('\n🎉 Conversion terminée avec succès !');
    return true;
  } catch (error) {
    console.error('❌ Erreur avec sharp:', error.message);
    return false;
  }
}

async function convertWithImageMagick(tool) {
  console.log(`🔧 Utilisation de ${tool} pour la conversion...`);
  
  for (const variant of VARIANTS) {
    const inputPath = path.join(PUBLIC_DIR, variant.input);
    const outputPath = path.join(PUBLIC_DIR, variant.output);
    
    console.log(`  Converting: ${variant.input} → ${variant.output}`);
    
    const cmd = tool === 'magick' 
      ? `magick -background none -resize ${variant.width}x${variant.height} "${inputPath}" "${outputPath}"`
      : `convert -background none -resize ${variant.width}x${variant.height} "${inputPath}" "${outputPath}"`;
    
    try {
      await execAsync(cmd);
      console.log(`  ✅ ${variant.output}`);
    } catch (error) {
      console.error(`  ❌ Erreur: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Conversion terminée !');
}

async function main() {
  console.log('🚀 Conversion des logos SVG → WebP\n');
  
  // Vérifier les outils système
  const systemTool = await checkDependencies();
  
  if (systemTool) {
    await convertWithImageMagick(systemTool);
    return;
  }
  
  console.log('⚠️  Aucun outil système trouvé (ImageMagick, Inkscape, etc.)\n');
  
  // Essayer sharp
  try {
    require('sharp');
    await convertWithSharp();
  } catch (error) {
    console.log('📦 Sharp n\'est pas installé. Installation...\n');
    const installed = await installSharp();
    
    if (installed) {
      await convertWithSharp();
    } else {
      console.error('\n❌ Impossible de convertir les logos.');
      console.error('Solutions possibles:');
      console.error('  1. Installer ImageMagick: apt-get install imagemagick');
      console.error('  2. Installer Inkscape: apt-get install inkscape');
      console.error('  3. Installer sharp: npm install sharp');
      process.exit(1);
    }
  }
}

main().catch(console.error);
