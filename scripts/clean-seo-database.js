#!/usr/bin/env node

/**
 * 🧹 Script de nettoyage des balises <p> orphelines dans __seo_gamme_car
 * 
 * Usage: node scripts/clean-seo-database.js
 * 
 * Ce script:
 * 1. Se connecte à Supabase
 * 2. Nettoie les <p> orphelines dans h1, title, description, content
 * 3. Affiche un rapport détaillé
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_KEY requis');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Fonction de nettoyage des <p> orphelines (miroir du backend)
 */
function cleanOrphanParagraphs(text) {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  
  // 1. Supprimer les <p> vides
  result = result.replace(/<p>\s*<\/p>/gi, '');
  
  // 2. Supprimer <p>...</p> qui entoure TOUT le contenu
  result = result.replace(/^\s*<p>(.*)<\/p>\s*$/is, '$1');
  
  // 3. Supprimer première <p> avec "pour"
  result = result.replace(/^<p>([^<]+pour\s+[A-Z].+?)<\/p>\s*/i, '$1\n');
  
  // 4. Supprimer première <p> avec marque
  result = result.replace(
    /^<p>([A-Z][^<]+?(?:RENAULT|CITROËN|PEUGEOT|BMW|AUDI|VOLKSWAGEN|MERCEDES|FIAT|ALFA|FORD|OPEL|TOYOTA|NISSAN|HONDA|MAZDA|HYUNDAI|KIA|VOLVO)[^<]+?)<\/p>\s*/i,
    '$1\n'
  );
  
  // Nettoyage ponctuation
  result = result.replace(/\s+,\s+/g, ', ');
  result = result.replace(/(\s+\w+)\s+,\s+/g, '$1 ');
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/\s+\.\s*$/gm, '');
  
  return result;
}

/**
 * Compte les <p> dans un texte
 */
function countPTags(text) {
  if (!text) return 0;
  return (text.match(/<p>/gi) || []).length;
}

/**
 * Nettoie tous les enregistrements SEO
 */
async function cleanSEODatabase() {
  console.log('🧹 Démarrage du nettoyage des balises <p> orphelines...\n');
  
  // 1. Récupérer TOUS les enregistrements
  console.log('📥 Récupération des données...');
  const { data: records, error: fetchError } = await supabase
    .from('__seo_gamme_car')
    .select('id, pg_id, h1, title, description, content');
  
  if (fetchError) {
    console.error('❌ Erreur lors de la récupération:', fetchError);
    return;
  }
  
  console.log(`✅ ${records.length} enregistrements récupérés\n`);
  
  // 2. Statistiques AVANT nettoyage
  const statsBefore = {
    h1: records.filter(r => r.h1 && countPTags(r.h1) > 0).length,
    title: records.filter(r => r.title && countPTags(r.title) > 0).length,
    description: records.filter(r => r.description && countPTags(r.description) > 0).length,
    content: records.filter(r => r.content && countPTags(r.content) > 0).length,
  };
  
  console.log('📊 AVANT nettoyage:');
  console.log(`   H1 avec <p>: ${statsBefore.h1}`);
  console.log(`   Title avec <p>: ${statsBefore.title}`);
  console.log(`   Description avec <p>: ${statsBefore.description}`);
  console.log(`   Content avec <p>: ${statsBefore.content}\n`);
  
  // 3. Nettoyer chaque enregistrement
  console.log('🔄 Nettoyage en cours...');
  let updatedCount = 0;
  const batchSize = 50;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const updates = batch.map(record => {
      const cleanedH1 = cleanOrphanParagraphs(record.h1);
      const cleanedTitle = cleanOrphanParagraphs(record.title);
      const cleanedDescription = cleanOrphanParagraphs(record.description);
      const cleanedContent = cleanOrphanParagraphs(record.content);
      
      // Vérifier si des changements sont nécessaires
      const hasChanges = 
        cleanedH1 !== record.h1 ||
        cleanedTitle !== record.title ||
        cleanedDescription !== record.description ||
        cleanedContent !== record.content;
      
      if (hasChanges) {
        updatedCount++;
        return supabase
          .from('__seo_gamme_car')
          .update({
            h1: cleanedH1,
            title: cleanedTitle,
            description: cleanedDescription,
            content: cleanedContent,
          })
          .eq('id', record.id);
      }
      
      return null;
    }).filter(Boolean);
    
    // Exécuter les mises à jour en parallèle
    if (updates.length > 0) {
      await Promise.all(updates);
      process.stdout.write(`\r   Progression: ${Math.min(i + batchSize, records.length)}/${records.length}`);
    }
  }
  
  console.log(`\n✅ ${updatedCount} enregistrements mis à jour\n`);
  
  // 4. Statistiques APRÈS nettoyage
  const { data: recordsAfter } = await supabase
    .from('__seo_gamme_car')
    .select('h1, title, description, content');
  
  const statsAfter = {
    h1: recordsAfter.filter(r => r.h1 && countPTags(r.h1) > 0).length,
    title: recordsAfter.filter(r => r.title && countPTags(r.title) > 0).length,
    description: recordsAfter.filter(r => r.description && countPTags(r.description) > 0).length,
    content: recordsAfter.filter(r => r.content && countPTags(r.content) > 0).length,
  };
  
  console.log('📊 APRÈS nettoyage:');
  console.log(`   H1 avec <p>: ${statsAfter.h1} (${statsBefore.h1 - statsAfter.h1} nettoyés)`);
  console.log(`   Title avec <p>: ${statsAfter.title} (${statsBefore.title - statsAfter.title} nettoyés)`);
  console.log(`   Description avec <p>: ${statsAfter.description} (${statsBefore.description - statsAfter.description} nettoyés)`);
  console.log(`   Content avec <p>: ${statsAfter.content} (${statsBefore.content - statsAfter.content} nettoyés)\n`);
  
  // 5. Exemples de gamme 479 (Kit embrayage FIAT DOBLO)
  console.log('🔍 Exemple: Gamme 479 (Kit embrayage)');
  const { data: exampleGamme479 } = await supabase
    .from('__seo_gamme_car')
    .select('h1, content')
    .eq('pg_id', 479)
    .limit(1)
    .single();
  
  if (exampleGamme479) {
    console.log(`   H1: ${exampleGamme479.h1?.substring(0, 80)}...`);
    console.log(`   Content: ${exampleGamme479.content?.substring(0, 100)}...`);
    console.log(`   <p> dans H1: ${countPTags(exampleGamme479.h1)}`);
    console.log(`   <p> dans Content: ${countPTags(exampleGamme479.content)}`);
  }
  
  console.log('\n✅ Nettoyage terminé avec succès !');
}

// Exécution
cleanSEODatabase().catch(error => {
  console.error('💥 Erreur fatale:', error);
  process.exit(1);
});
