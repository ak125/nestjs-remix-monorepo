#!/usr/bin/env node
/**
 * 🔗 Ajoute des liens internes aux templates SEO qui en manquent
 * 
 * Usage: node scripts/add-missing-links.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapping des gammes connexes suggérées
// Format: pg_id -> [liste des pg_id de gammes liées]
const SUGGESTED_LINKS = {
  // Galet enrouleur -> courroie accessoire, poulie, tendeur
  312: [323, 324, 1067],
  
  // Agrégat de freinage -> plaquettes, disques, étrier
  415: [4, 5, 6],
  
  // Filtre de boîte auto -> huile boîte, joint
  416: [420, 421],
  
  // Colonne de direction -> crémaillère, rotule direction
  1211: [286, 2066],
  
  // Neiman -> contacteur, antivol
  1367: [1368, 1369],
  
  // Lève-vitre -> moteur lève-vitre, interrupteur
  1561: [1562, 1563],
  
  // Kit distribution + pompe eau -> courroie distrib, pompe eau, galet
  3096: [17, 378, 312]
};

async function addMissingLinks() {
  console.log('🔗 AJOUT DE LIENS INTERNES MANQUANTS\n');
  console.log('='.repeat(50));

  // Templates sans liens
  const noLinksPgIds = Object.keys(SUGGESTED_LINKS).map(Number);
  
  const { data: templates, error } = await supabase
    .from('__seo_gamme_car')
    .select('sgc_pg_id, sgc_content, sgc_h1')
    .in('sgc_pg_id', noLinksPgIds);

  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  console.log(`📋 ${templates.length} templates à traiter\n`);

  for (const template of templates) {
    const pgId = template.sgc_pg_id;
    const suggestedGammes = SUGGESTED_LINKS[pgId];
    
    if (!suggestedGammes || suggestedGammes.length === 0) {
      console.log(`⏭️ pg=${pgId}: Aucune suggestion`);
      continue;
    }

    // Vérifier si les gammes suggérées existent
    const { data: validGammes } = await supabase
      .from('pieces_gamme')
      .select('PG_ID, PG_NAME')
      .in('PG_ID', suggestedGammes);

    if (!validGammes || validGammes.length === 0) {
      console.log(`⚠️ pg=${pgId}: Gammes suggérées non trouvées`);
      continue;
    }

    // Construire le texte de liens à ajouter
    const linkPatterns = validGammes.map((g, idx) => {
      // Utiliser des formules différentes pour A/B testing
      const formulaIdx = (idx * 10) + 1;
      return `#LinkGammeCar_${g.PG_ID}#`;
    }).join(' et de ');

    // Ajouter les liens à la fin du contenu
    const currentContent = template.sgc_content || '';
    
    // Vérifier s'il y a déjà des liens
    if (/#LinkGammeCar_\d+#/.test(currentContent)) {
      console.log(`✅ pg=${pgId}: A déjà des liens`);
      continue;
    }

    // Ajouter une phrase avec les liens
    const linkText = `<br/>Nous vous conseillons également de ${linkPatterns}.`;
    const newContent = currentContent + linkText;

    // Mettre à jour
    const { error: updateError } = await supabase
      .from('__seo_gamme_car')
      .update({ sgc_content: newContent })
      .eq('sgc_pg_id', pgId);

    if (updateError) {
      console.log(`❌ pg=${pgId}: ${updateError.message}`);
    } else {
      console.log(`✅ pg=${pgId}: Ajouté ${validGammes.length} lien(s) - ${validGammes.map(g => g.PG_NAME).join(', ')}`);
    }
  }

  console.log('\n🔄 N\'oubliez pas de vider le cache: docker exec redis-dev redis-cli FLUSHDB');
}

addMissingLinks().then(() => process.exit(0)).catch(console.error);
