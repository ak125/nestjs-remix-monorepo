#!/usr/bin/env node
/**
 * Script de population de la table __seo_gamme_car_switch
 * 
 * Ce script génère des switches SEO de qualité pour les gammes identifiées
 * dans le template comme nécessitant des switches SGCS (alias 1, 2, 3)
 * 
 * Exécuter: cd backend && node populate_seo_gamme_car_switch.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_URL || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

console.log(`🔑 Utilisation de: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON_KEY'}`);

const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

/**
 * Données de switches pour chaque gamme
 * Structure: { pg_id: { alias: [contents...] } }
 */
const switchesData = {
  // Rotule de suspension (2462)
  2462: {
    1: [
      "vérifier l'état",
      "contrôler l'état",
      "vérifier le bon état",
      "contrôler le bon état",
      "vérifier l'état de fonctionnement",
      "contrôler l'état de fonctionnement",
      "vérifier si hs",
      "contrôler si usée",
      "vérifier l'état d'usure",
      "contrôler le niveau d'usure"
    ],
    2: [
      "assurer une bonne liaison",
      "garantir une liaison optimale",
      "assurer le bon fonctionnement",
      "garantir le bon fonctionnement",
      "assurer une liaison entre les éléments",
      "garantir la liaison mécanique",
      "assurer la connexion des organes",
      "garantir l'articulation",
      "assurer le pivot",
      "garantir la rotation"
    ],
    3: [
      "Diesel 105 ch pour faire une liaison optimale entre les bras de suspension, le moyeu, le pivot et les roues",
      "Essence 110 ch pour garantir la suspension de masses suspendues et non suspendues du véhicule",
      "TDI 100 ch pour assurer la liaison entre le triangle de suspension et le moyeu de roue",
      "HDI 90 ch pour faire le lien entre les bras de suspension et l'ensemble roue/moyeu",
      "CDTI 105 ch pour garantir l'articulation entre le triangle et le porte fusée",
      "DCI 85 ch pour assurer la mobilité de l'ensemble de suspension",
      "TDCI 95 ch pour garantir la liaison rotule entre organes de suspension",
      "D 100 ch pour faire une articulation mobile entre les éléments de suspension",
      "TD 90 ch pour assurer le mouvement du système de suspension",
      "DTI 110 ch pour garantir la suspension verticale du véhicule"
    ]
  },
  
  // Rotule de direction (2066)
  2066: {
    1: [
      "vérifier l'état",
      "contrôler l'état",
      "vérifier le bon état",
      "contrôler le bon état",
      "vérifier l'état de fonctionnement",
      "contrôler l'état de fonctionnement",
      "vérifier si hs",
      "contrôler si usée",
      "vérifier l'état d'usure",
      "contrôler le niveau d'usure"
    ],
    2: [
      "assurer la direction",
      "garantir la précision de direction",
      "assurer le bon fonctionnement de la direction",
      "garantir la liaison de direction",
      "assurer une direction précise",
      "garantir l'orientation des roues",
      "assurer le braquage des roues",
      "garantir la maniabilité",
      "assurer la transmission de direction",
      "garantir le contrôle directionnel"
    ],
    3: [
      "Diesel 105 ch pour faire la liaison entre la crémaillère de direction et les roues avant",
      "Essence 110 ch pour garantir la transmission des mouvements de direction aux roues",
      "TDI 100 ch pour assurer le braquage précis des roues directrices",
      "HDI 90 ch pour faire le lien entre le système de direction et les moyeux de roue",
      "CDTI 105 ch pour garantir l'orientation des roues avant du véhicule",
      "DCI 85 ch pour assurer la manœuvrabilité du véhicule",
      "TDCI 95 ch pour garantir la précision de la direction assistée",
      "D 100 ch pour faire une articulation entre la direction et les roues",
      "TD 90 ch pour assurer le contrôle directionnel du véhicule",
      "DTI 110 ch pour garantir la liaison rotule de la direction"
    ]
  },
  
  // Bras de suspension (273)
  273: {
    1: [
      "vérifier l'état",
      "contrôler l'état",
      "vérifier le bon état",
      "contrôler le bon état",
      "vérifier l'état de fonctionnement",
      "contrôler l'état de fonctionnement",
      "vérifier si hs",
      "contrôler si usé",
      "vérifier l'état d'usure",
      "contrôler le niveau d'usure"
    ],
    2: [
      "assurer la liaison",
      "garantir la connexion",
      "assurer le maintien",
      "garantir le support",
      "assurer la liaison mécanique",
      "garantir la fixation",
      "assurer l'ancrage",
      "garantir l'assemblage",
      "assurer la structure",
      "garantir la tenue"
    ],
    3: [
      "Diesel 105 ch pour faire la liaison entre le châssis et les roues",
      "Essence 110 ch pour garantir la suspension et l'amortissement du véhicule",
      "TDI 100 ch pour assurer la connexion entre la caisse et les trains roulants",
      "HDI 90 ch pour faire le lien entre le berceau et l'ensemble de suspension",
      "CDTI 105 ch pour garantir le support des masses suspendues",
      "DCI 85 ch pour assurer la liaison triangulée de la suspension",
      "TDCI 95 ch pour garantir le guidage vertical des roues",
      "D 100 ch pour faire une connexion rigide entre organes de suspension",
      "TD 90 ch pour assurer le maintien de la géométrie de suspension",
      "DTI 110 ch pour garantir la liaison châssis/roue du véhicule"
    ]
  },
  
  // Étrier de frein (78)
  78: {
    1: [
      "vérifier l'état",
      "contrôler l'état",
      "vérifier le bon état",
      "contrôler le bon état",
      "vérifier l'état de fonctionnement",
      "contrôler l'état de fonctionnement",
      "vérifier si hs",
      "contrôler si grippé",
      "vérifier l'état d'usure",
      "contrôler les pistons"
    ],
    2: [
      "assurer le freinage",
      "garantir l'efficacité de freinage",
      "assurer la pression hydraulique",
      "garantir le serrage des plaquettes",
      "assurer le freinage optimal",
      "garantir la décélération",
      "assurer le freinage en toute sécurité",
      "garantir l'arrêt du véhicule",
      "assurer la puissance de freinage",
      "garantir le système de freinage"
    ],
    3: [
      "Diesel 105 ch pour faire le serrage des plaquettes sur le disque de frein",
      "Essence 110 ch pour garantir le freinage efficace et en toute sécurité",
      "TDI 100 ch pour assurer la conversion hydraulique en force mécanique",
      "HDI 90 ch pour faire la pression sur les plaquettes de frein",
      "CDTI 105 ch pour garantir le système de freinage à disque",
      "DCI 85 ch pour assurer le pincement du disque de frein",
      "TDCI 95 ch pour garantir la décélération du véhicule",
      "D 100 ch pour faire le serrage hydraulique sur les disques",
      "TD 90 ch pour assurer le freinage des roues avant",
      "DTI 110 ch pour garantir l'arrêt en toute sécurité du véhicule"
    ]
  },
  
  // Barre stabilisatrice (274)
  274: {
    1: [
      "vérifier l'état",
      "contrôler l'état",
      "vérifier le bon état",
      "contrôler le bon état",
      "vérifier l'état de fonctionnement",
      "contrôler l'état de fonctionnement",
      "vérifier si hs",
      "contrôler si usée",
      "vérifier l'état d'usure",
      "contrôler les silent-blocs"
    ],
    2: [
      "assurer la stabilité",
      "garantir l'anti-roulis",
      "assurer la tenue de route",
      "garantir la stabilité en virage",
      "assurer l'équilibre",
      "garantir le confort",
      "assurer l'anti-roulis",
      "garantir la stabilité latérale",
      "assurer le maintien",
      "garantir la liaison anti-roulis"
    ],
    3: [
      "Diesel 105 ch pour faire l'anti-roulis en réduisant l'inclinaison en virage",
      "Essence 110 ch pour garantir la stabilité latérale du véhicule",
      "TDI 100 ch pour assurer la limitation du roulis en courbe",
      "HDI 90 ch pour faire la liaison anti-dévers entre les deux cotés",
      "CDTI 105 ch pour garantir la tenue de route optimale",
      "DCI 85 ch pour assurer l'équilibre de caisse en virage",
      "TDCI 95 ch pour garantir le confort et la sécurité",
      "D 100 ch pour faire la répartition des forces en virage",
      "TD 90 ch pour assurer la compensation du transfert de masse",
      "DTI 110 ch pour garantir la stabilité directionnelle du véhicule"
    ]
  }
};

/**
 * Fonction principale de population
 */
async function populateSwitches() {
  console.log('\n🚀 DÉBUT DE LA POPULATION DE __seo_gamme_car_switch');
  console.log('='.repeat(80));

  let totalInserted = 0;
  let errors = 0;
  let currentId = 1;

  // Récupérer le prochain ID disponible
  const { data: maxIdData } = await supabase
    .from('__seo_gamme_car_switch')
    .select('sgcs_id')
    .order('sgcs_id', { ascending: false })
    .limit(1);

  if (maxIdData && maxIdData.length > 0) {
    currentId = parseInt(maxIdData[0].sgcs_id) + 1;
  }

  console.log(`   Prochain ID disponible: ${currentId}\n`);

  for (const [pgId, aliasSwitches] of Object.entries(switchesData)) {
    console.log(`\n📦 Traitement pg_id=${pgId}`);
    
    // Récupérer le nom de la gamme
    const { data: gamme } = await supabase
      .from('pieces_gamme')
      .select('pg_name')
      .eq('pg_id', parseInt(pgId))
      .limit(1);
    
    const gammeName = gamme?.[0]?.pg_name || 'Inconnu';
    console.log(`   ${gammeName}`);

    for (const [alias, contents] of Object.entries(aliasSwitches)) {
      console.log(`\n   📝 Alias ${alias}: ${contents.length} switches`);

      for (let i = 0; i < contents.length; i++) {
        const content = contents[i];
        
        // Insérer le switch avec l'ID explicite
        const { error } = await supabase
          .from('__seo_gamme_car_switch')
          .insert({
            sgcs_id: currentId,
            sgcs_pg_id: parseInt(pgId),
            sgcs_alias: alias,
            sgcs_content: content
          });

        if (error) {
          console.log(`   ❌ Erreur insertion (ID ${currentId}): ${error.message}`);
          errors++;
        } else {
          totalInserted++;
          const preview = content.length > 60 ? content.substring(0, 60) + '...' : content;
          console.log(`   ✅ ${(i + 1).toString().padStart(2)}. [ID ${currentId}] ${preview}`);
        }
        
        currentId++;
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`✅ POPULATION TERMINÉE`);
  console.log(`   Total inséré: ${totalInserted} switches`);
  console.log(`   Erreurs: ${errors}`);
  console.log('='.repeat(80));

  // Vérification finale
  console.log('\n🔍 VÉRIFICATION POST-INSERTION:');
  console.log('-'.repeat(80));

  for (const pgId of Object.keys(switchesData)) {
    const { data: switches, error } = await supabase
      .from('__seo_gamme_car_switch')
      .select('sgcs_alias')
      .eq('sgcs_pg_id', parseInt(pgId));

    if (error) {
      console.log(`❌ pg_id=${pgId}: Erreur - ${error.message}`);
    } else {
      const byAlias = {};
      switches.forEach(sw => {
        const alias = String(sw.sgcs_alias);
        byAlias[alias] = (byAlias[alias] || 0) + 1;
      });

      console.log(`✅ pg_id=${pgId}: ${switches.length} total`);
      Object.entries(byAlias)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .forEach(([alias, count]) => {
          console.log(`   Alias ${alias}: ${count} switches`);
        });
    }
  }

  console.log('\n💡 PROCHAINES ÉTAPES:');
  console.log('   1. Vérifier: node check_all_seo_tables.js');
  console.log('   2. Mettre à jour gamme-unified.service.ts');
  console.log('   3. Tester avec type_id=17484, pg_id=2462\n');
}

/**
 * Fonction de nettoyage (optionnelle)
 */
async function cleanTable() {
  console.log('🗑️  Nettoyage de la table __seo_gamme_car_switch...');
  
  const { error } = await supabase
    .from('__seo_gamme_car_switch')
    .delete()
    .gte('sgcs_id', 0);

  if (error) {
    console.log(`❌ Erreur nettoyage: ${error.message}`);
  } else {
    console.log('✅ Table nettoyée');
  }
}

// Exécution
const args = process.argv.slice(2);

if (args.includes('--clean')) {
  cleanTable().then(() => populateSwitches());
} else if (args.includes('--clean-only')) {
  cleanTable();
} else {
  populateSwitches();
}
