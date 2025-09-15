#!/usr/bin/env node
// 🖼️ Script de redimensionnement d'images avec Sharp

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_BASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/familles-produits/';
const OUTPUT_DIR = '/tmp/images-resized';

// Images de familles à traiter
const familyImages = [
  'Filtres.webp',
  'Freinage.webp', 
  'Moteur.webp',
  'Climatisation.webp',
  'Allumage.webp',
  'Direction.webp',
  'Transmission.webp',
];

// Variants à générer
const variants = [
  { name: 'thumbnail', width: 150, height: 150, quality: 80 },
  { name: 'card', width: 300, height: 200, quality: 85 },
  { name: 'hero', width: 600, height: 400, quality: 90 },
];

async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  return Buffer.from(buffer);
}

async function resizeImage(inputBuffer, width, height, quality = 85) {
  return await sharp(inputBuffer)
    .resize(width, height, { fit: 'cover' })
    .webp({ quality })
    .toBuffer();
}

async function processImage(imageName) {
  console.log(`🖼️ Traitement de ${imageName}...`);
  
  try {
    // Télécharger l'image originale
    const imageUrl = `${SUPABASE_BASE_URL}${imageName}`;
    const originalPath = path.join(OUTPUT_DIR, `original_${imageName}`);
    
    console.log(`📥 Téléchargement: ${imageUrl}`);
    const originalBuffer = await downloadImage(imageUrl, originalPath);
    console.log(`✅ Original: ${originalBuffer.length} bytes`);
    
    // Analyser l'image originale
    const metadata = await sharp(originalBuffer).metadata();
    console.log(`📊 Dimensions originales: ${metadata.width}x${metadata.height}`);
    
    const results = [];
    
    // Générer les variants
    for (const variant of variants) {
      console.log(`🔧 Génération ${variant.name}: ${variant.width}x${variant.height}...`);
      
      const resizedBuffer = await resizeImage(
        originalBuffer,
        variant.width, 
        variant.height,
        variant.quality
      );
      
      const baseName = imageName.replace('.webp', '');
      const variantName = `${baseName}_${variant.name}.webp`;
      const variantPath = path.join(OUTPUT_DIR, variantName);
      
      fs.writeFileSync(variantPath, resizedBuffer);
      
      const compressionRatio = Math.round((1 - resizedBuffer.length / originalBuffer.length) * 100);
      
      results.push({
        variant: variant.name,
        size: `${variant.width}x${variant.height}`,
        quality: variant.quality,
        originalSize: originalBuffer.length,
        newSize: resizedBuffer.length,
        compression: `${compressionRatio}%`,
        file: variantPath
      });
      
      console.log(`✅ ${variant.name}: ${resizedBuffer.length} bytes (${compressionRatio}% compression)`);
    }
    
    return {
      image: imageName,
      original: {
        size: `${metadata.width}x${metadata.height}`,
        bytes: originalBuffer.length,
        file: originalPath
      },
      variants: results
    };
    
  } catch (error) {
    console.error(`❌ Erreur ${imageName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Démarrage du traitement d\'images...');
  
  // Créer le dossier de sortie
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Dossier créé: ${OUTPUT_DIR}`);
  }
  
  const results = [];
  
  // Traiter chaque image
  for (const imageName of familyImages) {
    const result = await processImage(imageName);
    if (result) {
      results.push(result);
    }
  }
  
  // Résumé
  console.log('\n📋 RÉSUMÉ DU TRAITEMENT:');
  console.log(`✅ Images traitées: ${results.length}/${familyImages.length}`);
  
  for (const result of results) {
    console.log(`\n🖼️ ${result.image}:`);
    console.log(`   Original: ${result.original.size} (${result.original.bytes} bytes)`);
    for (const variant of result.variants) {
      console.log(`   ${variant.variant}: ${variant.size} (${variant.newSize} bytes, ${variant.compression} compression)`);
    }
  }
  
  console.log(`\n📁 Tous les fichiers sont dans: ${OUTPUT_DIR}`);
}

if (require.main === module) {
  main().catch(console.error);
}