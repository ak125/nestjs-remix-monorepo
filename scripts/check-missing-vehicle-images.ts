/**
 * 🔍 Script de vérification des images de véhicules manquantes
 * 
 * Vérifie quelles images de modèles existent dans Supabase Storage
 * et identifie celles qui sont manquantes pour upload.
 * 
 * Usage: npx ts-node scripts/check-missing-vehicle-images.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ModelImage {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  modele_pic: string | null;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
}

async function checkMissingImages() {
  console.log('🔍 Vérification des images de véhicules manquantes...\n');

  // 1. Récupérer tous les modèles avec leurs marques
  const { data: models, error } = await supabase
    .from('auto_modele')
    .select(`
      modele_id,
      modele_name,
      modele_alias,
      modele_pic,
      modele_display,
      modele_marque_id,
      auto_marque!inner (
        marque_id,
        marque_name,
        marque_alias
      )
    `)
    .eq('modele_display', 1)
    .order('marque_alias');

  if (error) {
    console.error('❌ Erreur récupération modèles:', error);
    return;
  }

  if (!models || models.length === 0) {
    console.log('⚠️ Aucun modèle trouvé');
    return;
  }

  console.log(`✅ ${models.length} modèles trouvés\n`);

  // 2. Grouper par marque
  const modelsByBrand = models.reduce((acc, model: any) => {
    const marque = model.auto_marque;
    const brandAlias = marque.marque_alias || 'unknown';
    
    if (!acc[brandAlias]) {
      acc[brandAlias] = {
        marque_name: marque.marque_name,
        marque_alias: brandAlias,
        models: []
      };
    }
    
    acc[brandAlias].models.push({
      modele_id: model.modele_id,
      modele_name: model.modele_name,
      modele_alias: model.modele_alias,
      modele_pic: model.modele_pic,
      marque_id: marque.marque_id,
      marque_name: marque.marque_name,
      marque_alias: brandAlias
    });
    
    return acc;
  }, {} as Record<string, { marque_name: string; marque_alias: string; models: ModelImage[] }>);

  // 3. Vérifier l'existence des images dans Supabase Storage
  const results: {
    total: number;
    withImage: number;
    withNoWebp: number;
    missingImage: number;
    byBrand: Record<string, { total: number; missing: number; missingFiles: string[] }>;
  } = {
    total: 0,
    withImage: 0,
    withNoWebp: 0,
    missingImage: 0,
    byBrand: {}
  };

  for (const [brandAlias, brandData] of Object.entries(modelsByBrand)) {
    console.log(`\n📁 ${brandData.marque_name} (${brandAlias})`);
    console.log('─'.repeat(60));

    results.byBrand[brandAlias] = {
      total: brandData.models.length,
      missing: 0,
      missingFiles: []
    };

    for (const model of brandData.models) {
      results.total++;

      if (!model.modele_pic || model.modele_pic === '') {
        console.log(`  ❌ ${model.modele_name} → PAS D'IMAGE DÉFINIE`);
        results.missingImage++;
        results.byBrand[brandAlias].missing++;
        results.byBrand[brandAlias].missingFiles.push(`${model.modele_alias || model.modele_name}.webp`);
      } else if (model.modele_pic === 'no.webp') {
        console.log(`  ⚠️  ${model.modele_name} → no.webp (placeholder)`);
        results.withNoWebp++;
        results.byBrand[brandAlias].missing++;
        results.byBrand[brandAlias].missingFiles.push(`${model.modele_alias || model.modele_name}.webp`);
      } else {
        // Vérifier si l'image existe dans Supabase Storage
        const imagePath = `constructeurs-automobiles/marques-concepts/${brandAlias}/${model.modele_pic}`;
        
        try {
          const { data: fileData, error: fileError } = await supabase
            .storage
            .from('uploads')
            .list(`constructeurs-automobiles/marques-concepts/${brandAlias}`, {
              search: model.modele_pic
            });

          if (fileError || !fileData || fileData.length === 0) {
            console.log(`  🔴 ${model.modele_name} → ${model.modele_pic} (FICHIER MANQUANT)`);
            results.missingImage++;
            results.byBrand[brandAlias].missing++;
            results.byBrand[brandAlias].missingFiles.push(model.modele_pic);
          } else {
            console.log(`  ✅ ${model.modele_name} → ${model.modele_pic}`);
            results.withImage++;
          }
        } catch (err) {
          console.log(`  🔴 ${model.modele_name} → ${model.modele_pic} (ERREUR VÉRIFICATION)`);
          results.missingImage++;
          results.byBrand[brandAlias].missing++;
          results.byBrand[brandAlias].missingFiles.push(model.modele_pic);
        }
      }
    }
  }

  // 4. Afficher le résumé
  console.log('\n\n📊 RÉSUMÉ GLOBAL');
  console.log('═'.repeat(60));
  console.log(`Total modèles:           ${results.total}`);
  console.log(`Images OK:               ${results.withImage} (${Math.round(results.withImage / results.total * 100)}%)`);
  console.log(`no.webp (placeholder):   ${results.withNoWebp}`);
  console.log(`Images manquantes:       ${results.missingImage} (${Math.round(results.missingImage / results.total * 100)}%)`);

  console.log('\n📋 DÉTAIL PAR MARQUE');
  console.log('═'.repeat(60));
  
  Object.entries(results.byBrand)
    .filter(([_, data]) => data.missing > 0)
    .sort((a, b) => b[1].missing - a[1].missing)
    .forEach(([brand, data]) => {
      console.log(`\n${brand}: ${data.missing}/${data.total} manquantes`);
      console.log(`  Fichiers à uploader:`);
      data.missingFiles.forEach(file => {
        console.log(`    - constructeurs-automobiles/marques-concepts/${brand}/${file}`);
      });
    });

  console.log('\n✅ Vérification terminée\n');
}

checkMissingImages().catch(console.error);
