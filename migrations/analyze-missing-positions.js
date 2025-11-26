#!/usr/bin/env node
/**
 * 🔍 Analyser les 44 pièces sans position
 * 
 * Script pour identifier pourquoi certaines plaquettes n'ont pas 
 * le critère "Côté d'assemblage" (pc_cri_id=100)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../backend/.env' });

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 Analyse des pièces sans position détectée\n');
  console.log('='.repeat(80));

  // 1. Charger toutes les relations pour le véhicule de test
  const { data: relations } = await client
    .from('pieces_relation_type')
    .select('rtp_piece_id')
    .eq('rtp_type_id', 18376)
    .eq('rtp_pg_id', 402)
    .limit(100);

  const pieceIds = relations.map(r => r.rtp_piece_id.toString());
  console.log(`\n📊 Total pièces dans la relation: ${pieceIds.length}`);

  // 2. Identifier les pièces avec et sans le critère 100
  const { data: withCote100 } = await client
    .from('pieces_criteria')
    .select('pc_piece_id')
    .in('pc_piece_id', pieceIds)
    .eq('pc_cri_id', 100);

  const piecesWithCote = new Set(withCote100?.map(c => c.pc_piece_id) || []);
  const piecesWithoutCote = pieceIds.filter(id => !piecesWithCote.has(id));

  console.log(`✅ Pièces AVEC critère 100 (Côté d'assemblage): ${piecesWithCote.size}`);
  console.log(`❌ Pièces SANS critère 100: ${piecesWithoutCote.length}`);

  if (piecesWithoutCote.length === 0) {
    console.log('\n✅ Toutes les pièces ont le critère position !');
    return;
  }

  // 3. Analyser les critères des pièces sans position
  console.log(`\n📋 Analyse des ${Math.min(10, piecesWithoutCote.length)} premières pièces sans position...\n`);

  const { data: allCriteria } = await client
    .from('pieces_criteria')
    .select('pc_piece_id, pc_cri_id, pc_cri_value, pc_display')
    .in('pc_piece_id', piecesWithoutCote.slice(0, 10));

  // Charger les noms des critères
  const uniqueCriIds = [...new Set(allCriteria?.map(c => c.pc_cri_id) || [])];
  const { data: criteriaLinks } = await client
    .from('pieces_criteria_link')
    .select('pcl_cri_id, pcl_cri_criteria, pcl_cri_unit')
    .in('pcl_cri_id', uniqueCriIds);

  const criteriaMap = new Map(
    criteriaLinks?.map(link => [link.pcl_cri_id, link]) || []
  );

  // 4. Afficher les critères par pièce
  const piecesCriteria = {};
  allCriteria?.forEach(crit => {
    if (!piecesCriteria[crit.pc_piece_id]) {
      piecesCriteria[crit.pc_piece_id] = [];
    }
    const link = criteriaMap.get(crit.pc_cri_id);
    piecesCriteria[crit.pc_piece_id].push({
      id: crit.pc_cri_id,
      name: link?.pcl_cri_criteria || `critère ${crit.pc_cri_id}`,
      value: crit.pc_cri_value,
      unit: link?.pcl_cri_unit || '',
      display: crit.pc_display
    });
  });

  // Afficher les résultats
  for (const [pieceId, criteria] of Object.entries(piecesCriteria)) {
    console.log(`\n🔧 Pièce ID: ${pieceId}`);
    
    if (criteria.length === 0) {
      console.log('  ⚠️  AUCUN critère trouvé pour cette pièce');
    } else {
      console.log(`  📌 ${criteria.length} critères:`);
      criteria.forEach(crit => {
        const displayIcon = crit.display === '1' ? '✅' : '❌';
        const positionKeywords = ['avant', 'arrière', 'arriere', 'gauche', 'droit', 'essieu', 'axle', 'front', 'rear', 'left', 'right'];
        const hasPosition = positionKeywords.some(kw => 
          crit.value.toLowerCase().includes(kw) || crit.name.toLowerCase().includes(kw)
        );
        const positionIcon = hasPosition ? '🎯' : '  ';
        
        console.log(`     ${displayIcon} ${positionIcon} [${crit.id}] ${crit.name}: "${crit.value}" ${crit.unit}`);
      });
    }
  }

  // 5. Statistiques des critères utilisés
  console.log('\n\n📊 Distribution des critères sur les pièces SANS position:\n');
  const critStats = {};
  allCriteria?.forEach(crit => {
    const link = criteriaMap.get(crit.pc_cri_id);
    const name = link?.pcl_cri_criteria || `critère ${crit.pc_cri_id}`;
    critStats[crit.pc_cri_id] = {
      name,
      count: (critStats[crit.pc_cri_id]?.count || 0) + 1,
      values: critStats[crit.pc_cri_id]?.values || new Set()
    };
    critStats[crit.pc_cri_id].values.add(crit.pc_cri_value);
  });

  Object.entries(critStats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([id, stat]) => {
      const valuesPreview = Array.from(stat.values).slice(0, 3).join(', ');
      console.log(`  [${id}] ${stat.name}: ${stat.count} occurrences`);
      console.log(`      Exemples: ${valuesPreview}`);
    });

  // 6. Recherche de critères alternatifs pour la position
  console.log('\n\n🔎 Recherche de critères contenant des mots-clés de position...\n');
  
  const positionRelatedCriteria = [];
  for (const [id, stat] of Object.entries(critStats)) {
    const positionKeywords = ['avant', 'arrière', 'arriere', 'gauche', 'droit', 'essieu', 'axle', 'front', 'rear', 'left', 'right', 'côté', 'cote', 'position', 'montage'];
    const hasPositionInName = positionKeywords.some(kw => 
      stat.name.toLowerCase().includes(kw)
    );
    const hasPositionInValues = Array.from(stat.values).some(val => 
      positionKeywords.some(kw => val.toLowerCase().includes(kw))
    );
    
    if (hasPositionInName || hasPositionInValues) {
      positionRelatedCriteria.push({
        id,
        name: stat.name,
        count: stat.count,
        values: Array.from(stat.values)
      });
    }
  }

  if (positionRelatedCriteria.length > 0) {
    console.log('✅ Critères alternatifs trouvés contenant des informations de position:');
    positionRelatedCriteria.forEach(crit => {
      console.log(`\n  🎯 [${crit.id}] ${crit.name} (${crit.count} occurrences)`);
      console.log(`     Valeurs: ${crit.values.join(', ')}`);
    });
  } else {
    console.log('❌ Aucun critère alternatif trouvé');
    console.log('   → Ces pièces n\'ont probablement pas d\'information de position dans les critères');
    console.log('   → Solution: utiliser la migration SQL depuis piece_name');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analyse terminée\n');
}

main().catch(console.error);
