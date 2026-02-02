#!/usr/bin/env node
// ============================================
// KILL-SWITCH PRODUCTION (P0.5 - 2026-02-02)
// ============================================
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_MUTATION !== '1') {
  console.error('\n⛔ ERREUR: Ce script ne peut pas s\'exécuter en production.');
  console.error('   Pour forcer: ALLOW_PROD_MUTATION=1 node script.js');
  console.error('   Environnement détecté: NODE_ENV=' + process.env.NODE_ENV);
  process.exit(1);
}
// ============================================

/**
 * Script de génération de switches SEO - VERSION ENRICHIE
 *
 * Génère 30 switches UNIQUES et DIVERSIFIÉS par gamme
 * avec contenu adapté au contexte automobile
 *
 * Exécuter: cd backend && node generate_all_seo_switches.js
 * Mode test: node generate_all_seo_switches.js --dry-run
 * Mode limite: node generate_all_seo_switches.js --limit=5
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_URL || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = args.find(a => a.startsWith('--limit='))?.split('=')[1] || null;

// ============================================================================
// CONFIGURATION DES FAMILLES DE PIÈCES
// ============================================================================

const GAMME_CONFIG = {
  // FILTRATION
  'filtre à huile': {
    fonction: 'filtrer les impuretés de l\'huile moteur',
    actions: ['purifier l\'huile', 'protéger le moteur', 'retenir les particules'],
    verbes: ['contrôler', 'remplacer', 'vérifier', 'inspecter']
  },
  'filtre à air': {
    fonction: 'garantir une alimentation en air propre du moteur',
    actions: ['filtrer l\'air', 'optimiser la combustion', 'protéger le moteur'],
    verbes: ['contrôler', 'nettoyer', 'remplacer', 'vérifier']
  },
  'filtre à carburant': {
    fonction: 'purifier le carburant avant injection',
    actions: ['retenir les impuretés', 'protéger les injecteurs', 'optimiser l\'alimentation'],
    verbes: ['remplacer', 'contrôler', 'vérifier', 'changer']
  },
  'filtre d\'habitacle': {
    fonction: 'purifier l\'air de l\'habitacle',
    actions: ['filtrer les pollens', 'retenir les particules', 'assainir l\'air'],
    verbes: ['remplacer', 'changer', 'contrôler', 'nettoyer']
  },
  'fap': {
    fonction: 'filtrer les particules fines du diesel',
    actions: ['réduire les émissions', 'respecter les normes', 'protéger l\'environnement'],
    verbes: ['régénérer', 'nettoyer', 'contrôler', 'remplacer']
  },

  // REFROIDISSEMENT
  'radiateur': {
    fonction: 'assurer le refroidissement optimal du moteur',
    actions: ['évacuer la chaleur', 'réguler la température', 'refroidir le liquide'],
    verbes: ['vérifier', 'contrôler', 'purger', 'remplacer']
  },
  'radiateur de chauffage': {
    fonction: 'chauffer l\'habitacle du véhicule',
    actions: ['diffuser la chaleur', 'réchauffer l\'air', 'assurer le confort thermique'],
    verbes: ['vérifier', 'purger', 'contrôler', 'remplacer']
  },
  'thermostat': {
    fonction: 'réguler la température du moteur',
    actions: ['contrôler le circuit', 'optimiser le refroidissement', 'gérer la température'],
    verbes: ['tester', 'vérifier', 'remplacer', 'contrôler']
  },
  'pompe à eau': {
    fonction: 'faire circuler le liquide de refroidissement',
    actions: ['assurer la circulation', 'refroidir le moteur', 'éviter la surchauffe'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'inspecter']
  },
  'durite': {
    fonction: 'acheminer le liquide de refroidissement',
    actions: ['assurer l\'étanchéité', 'résister à la pression', 'conduire le fluide'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'inspecter']
  },

  // EMBRAYAGE / TRANSMISSION
  'embrayage': {
    fonction: 'transmettre la puissance du moteur à la boîte',
    actions: ['assurer la liaison', 'permettre les changements de vitesse', 'transmettre le couple'],
    verbes: ['vérifier', 'régler', 'remplacer', 'contrôler']
  },
  'volant moteur': {
    fonction: 'absorber les vibrations du moteur',
    actions: ['lisser la rotation', 'stocker l\'énergie', 'réduire les à-coups'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'inspecter']
  },
  'cardan': {
    fonction: 'transmettre la puissance aux roues',
    actions: ['assurer la transmission', 'permettre le débattement', 'transférer le couple'],
    verbes: ['vérifier', 'graisser', 'contrôler', 'remplacer']
  },

  // FREINAGE
  'plaquette': {
    fonction: 'assurer le freinage par friction',
    actions: ['ralentir le véhicule', 'garantir la sécurité', 'dissiper l\'énergie'],
    verbes: ['vérifier', 'mesurer', 'remplacer', 'contrôler']
  },
  'disque': {
    fonction: 'permettre le freinage par friction',
    actions: ['dissiper la chaleur', 'supporter les plaquettes', 'assurer le freinage'],
    verbes: ['vérifier', 'mesurer', 'rectifier', 'remplacer']
  },
  'étrier': {
    fonction: 'exercer la pression de freinage',
    actions: ['serrer les plaquettes', 'convertir la pression', 'assurer le freinage'],
    verbes: ['vérifier', 'purger', 'réviser', 'remplacer']
  },
  'frein': {
    fonction: 'garantir un freinage efficace et sûr',
    actions: ['ralentir le véhicule', 'assurer la sécurité', 'contrôler la vitesse'],
    verbes: ['vérifier', 'régler', 'purger', 'contrôler']
  },

  // SUSPENSION / DIRECTION
  'amortisseur': {
    fonction: 'absorber les chocs de la route',
    actions: ['garantir le confort', 'maintenir l\'adhérence', 'stabiliser le véhicule'],
    verbes: ['vérifier', 'tester', 'remplacer', 'contrôler']
  },
  'ressort': {
    fonction: 'supporter le poids du véhicule',
    actions: ['absorber les irrégularités', 'maintenir la garde au sol', 'assurer le confort'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'inspecter']
  },
  'rotule': {
    fonction: 'permettre l\'articulation de la suspension',
    actions: ['assurer la mobilité', 'guider la roue', 'transmettre les efforts'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'graisser']
  },
  'bras': {
    fonction: 'maintenir la géométrie de suspension',
    actions: ['guider la roue', 'supporter les efforts', 'assurer la tenue de route'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'inspecter']
  },
  'biellette': {
    fonction: 'stabiliser le véhicule en virage',
    actions: ['limiter le roulis', 'améliorer la tenue', 'relier la barre stabilisatrice'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'inspecter']
  },
  'direction': {
    fonction: 'orienter les roues du véhicule',
    actions: ['assurer le braquage', 'garantir la précision', 'transmettre les commandes'],
    verbes: ['vérifier', 'régler', 'contrôler', 'purger']
  },

  // MOTEUR
  'démarreur': {
    fonction: 'lancer le moteur au démarrage',
    actions: ['entraîner le volant', 'permettre le démarrage', 'actionner le moteur'],
    verbes: ['tester', 'vérifier', 'réviser', 'remplacer']
  },
  'alternateur': {
    fonction: 'alimenter le circuit électrique',
    actions: ['recharger la batterie', 'fournir le courant', 'alimenter les équipements'],
    verbes: ['tester', 'vérifier', 'contrôler', 'remplacer']
  },
  'bougie': {
    fonction: 'créer l\'étincelle d\'allumage',
    actions: ['enflammer le mélange', 'assurer l\'allumage', 'optimiser la combustion'],
    verbes: ['vérifier', 'nettoyer', 'régler', 'remplacer']
  },
  'injecteur': {
    fonction: 'doser précisément le carburant',
    actions: ['pulvériser le carburant', 'optimiser la combustion', 'réduire la consommation'],
    verbes: ['nettoyer', 'tester', 'contrôler', 'remplacer']
  },
  'turbo': {
    fonction: 'augmenter la puissance du moteur',
    actions: ['comprimer l\'air', 'améliorer les performances', 'optimiser le rendement'],
    verbes: ['vérifier', 'contrôler', 'réviser', 'remplacer']
  },
  'courroie': {
    fonction: 'synchroniser la distribution du moteur',
    actions: ['entraîner les accessoires', 'assurer la synchronisation', 'transmettre le mouvement'],
    verbes: ['vérifier', 'tendre', 'contrôler', 'remplacer']
  },
  'galet': {
    fonction: 'maintenir la tension de la courroie',
    actions: ['guider la courroie', 'absorber les vibrations', 'assurer la tension'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'inspecter']
  },
  'soupape': {
    fonction: 'contrôler l\'admission et l\'échappement',
    actions: ['réguler les gaz', 'assurer l\'étanchéité', 'optimiser le rendement'],
    verbes: ['vérifier', 'régler', 'rectifier', 'remplacer']
  },
  'joint': {
    fonction: 'assurer l\'étanchéité du moteur',
    actions: ['éviter les fuites', 'résister à la pression', 'maintenir l\'étanchéité'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'inspecter']
  },

  // ÉLECTRIQUE
  'capteur': {
    fonction: 'mesurer les paramètres moteur',
    actions: ['transmettre les données', 'informer le calculateur', 'surveiller le fonctionnement'],
    verbes: ['tester', 'vérifier', 'contrôler', 'remplacer']
  },
  'sonde': {
    fonction: 'analyser les gaz d\'échappement',
    actions: ['mesurer l\'oxygène', 'optimiser le mélange', 'réduire les émissions'],
    verbes: ['tester', 'vérifier', 'contrôler', 'remplacer']
  },
  'vanne egr': {
    fonction: 'recycler les gaz d\'échappement',
    actions: ['réduire les NOx', 'respecter les normes', 'diminuer les émissions'],
    verbes: ['nettoyer', 'vérifier', 'contrôler', 'remplacer']
  },

  // CLIMATISATION
  'compresseur': {
    fonction: 'comprimer le fluide frigorigène',
    actions: ['refroidir l\'habitacle', 'faire circuler le fluide', 'assurer la climatisation'],
    verbes: ['vérifier', 'recharger', 'contrôler', 'remplacer']
  },
  'condenseur': {
    fonction: 'liquéfier le fluide frigorigène',
    actions: ['évacuer la chaleur', 'refroidir le gaz', 'optimiser la climatisation'],
    verbes: ['nettoyer', 'vérifier', 'contrôler', 'remplacer']
  },

  // ÉCLAIRAGE
  'phare': {
    fonction: 'éclairer la route de nuit',
    actions: ['assurer la visibilité', 'illuminer la chaussée', 'garantir la sécurité'],
    verbes: ['régler', 'vérifier', 'nettoyer', 'remplacer']
  },
  'feu': {
    fonction: 'signaler la présence du véhicule',
    actions: ['indiquer les manœuvres', 'assurer la visibilité', 'garantir la sécurité'],
    verbes: ['vérifier', 'remplacer', 'contrôler', 'nettoyer']
  },

  // CARROSSERIE
  'lève-vitre': {
    fonction: 'commander l\'ouverture des vitres',
    actions: ['monter la vitre', 'descendre la vitre', 'assurer le confort'],
    verbes: ['vérifier', 'graisser', 'régler', 'remplacer']
  },
  'essuie-glace': {
    fonction: 'nettoyer le pare-brise',
    actions: ['évacuer l\'eau', 'assurer la visibilité', 'nettoyer la vitre'],
    verbes: ['vérifier', 'remplacer', 'nettoyer', 'ajuster']
  },

  // NOUVELLES CONFIGS (31 gammes manquantes)
  'batterie': {
    fonction: 'alimenter le circuit électrique au démarrage',
    actions: ['stocker l\'énergie', 'alimenter le démarreur', 'fournir le courant'],
    verbes: ['tester', 'recharger', 'contrôler', 'remplacer']
  },
  'échappement': {
    fonction: 'évacuer les gaz brûlés du moteur',
    actions: ['réduire le bruit', 'canaliser les gaz', 'respecter les normes'],
    verbes: ['vérifier', 'contrôler', 'inspecter', 'remplacer']
  },
  'rétroviseur': {
    fonction: 'assurer la visibilité arrière',
    actions: ['voir derrière', 'faciliter les manœuvres', 'garantir la sécurité'],
    verbes: ['régler', 'vérifier', 'nettoyer', 'remplacer']
  },
  'papillon': {
    fonction: 'réguler l\'admission d\'air dans le moteur',
    actions: ['doser l\'air', 'contrôler le régime', 'gérer l\'accélération'],
    verbes: ['nettoyer', 'vérifier', 'réinitialiser', 'remplacer']
  },
  'détendeur': {
    fonction: 'réguler la pression du fluide frigorigène',
    actions: ['abaisser la pression', 'optimiser le refroidissement', 'gérer le débit'],
    verbes: ['vérifier', 'contrôler', 'tester', 'remplacer']
  },
  'cylindre de roue': {
    fonction: 'actionner les mâchoires de frein arrière',
    actions: ['pousser les mâchoires', 'assurer le freinage', 'convertir la pression'],
    verbes: ['vérifier', 'purger', 'réviser', 'remplacer']
  },
  'distribution': {
    fonction: 'synchroniser les soupapes avec le moteur',
    actions: ['assurer la synchronisation', 'entraîner l\'arbre à cames', 'distribuer le mouvement'],
    verbes: ['vérifier', 'contrôler', 'remplacer', 'changer']
  },
  'vase d\'expansion': {
    fonction: 'compenser les variations de volume du liquide',
    actions: ['absorber la dilatation', 'maintenir le niveau', 'évacuer la pression'],
    verbes: ['vérifier', 'contrôler', 'nettoyer', 'remplacer']
  },
  'témoin': {
    fonction: 'signaler l\'usure des plaquettes de frein',
    actions: ['alerter le conducteur', 'indiquer l\'usure', 'prévenir du remplacement'],
    verbes: ['vérifier', 'contrôler', 'tester', 'remplacer']
  },
  'catalyseur': {
    fonction: 'réduire les émissions polluantes',
    actions: ['transformer les gaz nocifs', 'respecter les normes', 'dépolluer l\'échappement'],
    verbes: ['vérifier', 'contrôler', 'nettoyer', 'remplacer']
  },
  'intercooler': {
    fonction: 'refroidir l\'air comprimé par le turbo',
    actions: ['augmenter la densité de l\'air', 'améliorer les performances', 'optimiser la combustion'],
    verbes: ['vérifier', 'nettoyer', 'contrôler', 'remplacer']
  },
  'évaporateur': {
    fonction: 'produire le froid dans l\'habitacle',
    actions: ['absorber la chaleur', 'refroidir l\'air', 'climatiser le véhicule'],
    verbes: ['vérifier', 'nettoyer', 'désinfecter', 'remplacer']
  },
  'evaporateur': {
    fonction: 'produire le froid dans l\'habitacle',
    actions: ['absorber la chaleur', 'refroidir l\'air', 'climatiser le véhicule'],
    verbes: ['vérifier', 'nettoyer', 'désinfecter', 'remplacer']
  },
  'ventilateur': {
    fonction: 'assurer le refroidissement du radiateur',
    actions: ['brasser l\'air', 'évacuer la chaleur', 'réguler la température'],
    verbes: ['vérifier', 'contrôler', 'tester', 'remplacer']
  },
  'carter': {
    fonction: 'contenir l\'huile moteur',
    actions: ['stocker l\'huile', 'assurer l\'étanchéité', 'protéger le moteur'],
    verbes: ['vérifier', 'contrôler', 'nettoyer', 'remplacer']
  },
  'roulement': {
    fonction: 'permettre la rotation libre de la roue',
    actions: ['réduire les frottements', 'supporter la charge', 'assurer la rotation'],
    verbes: ['vérifier', 'contrôler', 'graisser', 'remplacer']
  },
  'faisceau': {
    fonction: 'transmettre le courant aux bougies',
    actions: ['conduire l\'électricité', 'assurer l\'allumage', 'transférer l\'énergie'],
    verbes: ['vérifier', 'tester', 'contrôler', 'remplacer']
  },
  'bobine': {
    fonction: 'générer la haute tension pour les bougies',
    actions: ['transformer le courant', 'créer l\'étincelle', 'alimenter l\'allumage'],
    verbes: ['tester', 'vérifier', 'contrôler', 'remplacer']
  },
  'pressostat': {
    fonction: 'surveiller la pression d\'huile',
    actions: ['mesurer la pression', 'alerter en cas de défaut', 'protéger le moteur'],
    verbes: ['tester', 'vérifier', 'contrôler', 'remplacer']
  },
  'commande': {
    fonction: 'actionner les équipements du véhicule',
    actions: ['commander les fonctions', 'activer les systèmes', 'piloter les équipements'],
    verbes: ['vérifier', 'régler', 'contrôler', 'remplacer']
  },
  'déshydratante': {
    fonction: 'éliminer l\'humidité du circuit de climatisation',
    actions: ['assécher le fluide', 'filtrer les impuretés', 'protéger le circuit'],
    verbes: ['vérifier', 'contrôler', 'changer', 'remplacer']
  },
  'poulie': {
    fonction: 'entraîner les accessoires du moteur',
    actions: ['transmettre le mouvement', 'guider la courroie', 'synchroniser les éléments'],
    verbes: ['vérifier', 'contrôler', 'inspecter', 'remplacer']
  },
  'chaîne': {
    fonction: 'synchroniser la distribution du moteur',
    actions: ['entraîner les arbres', 'assurer la synchronisation', 'distribuer le mouvement'],
    verbes: ['vérifier', 'contrôler', 'tendre', 'remplacer']
  },
  'valve': {
    fonction: 'réguler le ralenti du moteur',
    actions: ['contrôler l\'admission d\'air', 'stabiliser le régime', 'gérer le ralenti'],
    verbes: ['nettoyer', 'vérifier', 'réinitialiser', 'remplacer']
  },
  'neiman': {
    fonction: 'sécuriser le démarrage du véhicule',
    actions: ['autoriser le démarrage', 'bloquer la direction', 'protéger le véhicule'],
    verbes: ['vérifier', 'lubrifier', 'contrôler', 'remplacer']
  },
  'vis': {
    fonction: 'assurer le serrage de la culasse',
    actions: ['maintenir l\'étanchéité', 'résister à la pression', 'fixer les éléments'],
    verbes: ['vérifier', 'contrôler', 'serrer', 'remplacer']
  },
  'sphère': {
    fonction: 'assurer la suspension hydropneumatique',
    actions: ['amortir les chocs', 'réguler la hauteur', 'maintenir le confort'],
    verbes: ['vérifier', 'recharger', 'contrôler', 'remplacer']
  },
  'préchauffage': {
    fonction: 'faciliter le démarrage à froid du diesel',
    actions: ['préchauffer les cylindres', 'gérer les bougies', 'optimiser le démarrage'],
    verbes: ['tester', 'vérifier', 'contrôler', 'remplacer']
  },
  'vilebrequin': {
    fonction: 'entraîner les accessoires depuis le moteur',
    actions: ['transmettre la rotation', 'amortir les vibrations', 'synchroniser les éléments'],
    verbes: ['vérifier', 'contrôler', 'inspecter', 'remplacer']
  },
  'débitmètre': {
    fonction: 'mesurer le débit d\'air entrant dans le moteur',
    actions: ['calculer la masse d\'air', 'informer le calculateur', 'optimiser le mélange'],
    verbes: ['nettoyer', 'tester', 'vérifier', 'remplacer']
  },

  // DÉFAUT
  'default': {
    fonction: 'assurer le bon fonctionnement du véhicule',
    actions: ['garantir la fiabilité', 'optimiser les performances', 'maintenir le véhicule'],
    verbes: ['vérifier', 'contrôler', 'entretenir', 'remplacer']
  }
};

// ============================================================================
// TEMPLATES DE PHRASES SEO
// ============================================================================

// Alias 1: Vérification/Contrôle (10 variations dynamiques)
function generateAlias1(config, gammeName) {
  const verbe = config.verbes[0];
  const templates = [
    `${verbe} l'état`,
    `${verbe} le bon état`,
    `${verbe} l'état de fonctionnement`,
    `${verbe} si défaillant`,
    `${verbe} l'usure`,
    `${config.verbes[1]} régulièrement`,
    `${config.verbes[2]} avant remplacement`,
    `${config.verbes[3] || config.verbes[0]} périodiquement`,
    `faire ${verbe} par un professionnel`,
    `${verbe} selon le carnet d'entretien`
  ];
  return templates;
}

// Alias 2: Garantie/Fonction (10 variations dynamiques)
function generateAlias2(config, gammeName) {
  const action1 = config.actions[0];
  const action2 = config.actions[1];
  const action3 = config.actions[2];

  return [
    `${action1}`,
    `${action2}`,
    `${action3}`,
    `garantir ${config.fonction.split(' ').slice(0, 4).join(' ')}`,
    `assurer ${config.actions[0].split(' ').slice(0, 3).join(' ')}`,
    `optimiser les performances`,
    `améliorer la fiabilité`,
    `prolonger la durée de vie`,
    `maintenir en bon état`,
    `préserver le véhicule`
  ];
}

// Alias 3: Commercial/Prix (10 variations dynamiques)
function generateAlias3(config, gammeName) {
  const fonction = config.fonction;

  return [
    `disponible à prix bas pour ${fonction}`,
    `proposé au meilleur prix pour ${fonction}`,
    `neuf et garanti pour ${fonction}`,
    `de qualité origine pour ${fonction}`,
    `livré rapidement pour ${fonction}`,
    `compatible et homologué pour ${fonction}`,
    `au meilleur rapport qualité-prix pour ${fonction}`,
    `en stock et prêt à expédier pour ${fonction}`,
    `certifié constructeur pour ${fonction}`,
    `économique et fiable pour ${fonction}`
  ];
}

/**
 * Trouve la config appropriée pour une gamme
 */
function getConfigForGamme(gammeName) {
  const nameLower = gammeName.toLowerCase();

  // Chercher une correspondance exacte ou partielle
  for (const [keyword, config] of Object.entries(GAMME_CONFIG)) {
    if (keyword !== 'default' && nameLower.includes(keyword)) {
      return { config, keyword };
    }
  }

  // Recherche par mots-clés individuels
  const words = nameLower.split(/[\s-]+/);
  for (const word of words) {
    if (word.length > 3) {
      for (const [keyword, config] of Object.entries(GAMME_CONFIG)) {
        if (keyword !== 'default' && keyword.includes(word)) {
          return { config, keyword };
        }
      }
    }
  }

  return { config: GAMME_CONFIG.default, keyword: 'default' };
}

/**
 * Génère les 30 switches pour une gamme
 */
function generateSwitchesForGamme(pgId, gammeName) {
  const { config, keyword } = getConfigForGamme(gammeName);
  const switches = [];

  // Alias 1: 10 switches de vérification
  const alias1 = generateAlias1(config, gammeName);
  alias1.forEach(content => {
    switches.push({
      sgcs_pg_id: pgId,
      sgcs_alias: '1',
      sgcs_content: content
    });
  });

  // Alias 2: 10 switches de fonction/garantie
  const alias2 = generateAlias2(config, gammeName);
  alias2.forEach(content => {
    switches.push({
      sgcs_pg_id: pgId,
      sgcs_alias: '2',
      sgcs_content: content
    });
  });

  // Alias 3: 10 switches commerciaux
  const alias3 = generateAlias3(config, gammeName);
  alias3.forEach(content => {
    switches.push({
      sgcs_pg_id: pgId,
      sgcs_alias: '3',
      sgcs_content: content
    });
  });

  return { switches, keyword, config };
}

/**
 * Fonction principale
 */
async function main() {
  console.log('\n🚀 GÉNÉRATION DES SWITCHES SEO - VERSION ENRICHIE');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY-RUN (simulation)' : '✍️ INSERTION RÉELLE'}`);
  if (LIMIT) console.log(`Limite: ${LIMIT} gammes`);

  // 1. Récupérer les gammes avec templates mais sans switches
  console.log('\n📊 Analyse des gammes...');

  const { data: templates } = await supabase
    .from('__seo_gamme_car')
    .select('sgc_pg_id, sgc_h1, sgc_content');

  const { data: existingSwitches } = await supabase
    .from('__seo_gamme_car_switch')
    .select('sgcs_pg_id');

  const gammesWithSwitches = new Set(existingSwitches.map(s => s.sgcs_pg_id));

  const templatesNeedingSwitches = templates.filter(t => {
    const fullText = (t.sgc_h1 || '') + (t.sgc_content || '');
    return fullText.includes('#CompSwitch') && !gammesWithSwitches.has(String(t.sgc_pg_id));
  });

  console.log(`   Templates avec #CompSwitch: ${templates.filter(t => ((t.sgc_h1 || '') + (t.sgc_content || '')).includes('#CompSwitch')).length}`);
  console.log(`   Gammes avec switches: ${gammesWithSwitches.size}`);
  console.log(`   Gammes à traiter: ${templatesNeedingSwitches.length}`);

  // 2. Récupérer les noms des gammes
  const pgIds = templatesNeedingSwitches.map(t => parseInt(t.sgc_pg_id));

  const { data: gammes } = await supabase
    .from('pieces_gamme')
    .select('pg_id, pg_name')
    .in('pg_id', pgIds);

  const gammeMap = new Map(gammes.map(g => [g.pg_id, g.pg_name]));

  // 3. Limiter si demandé
  let gammesToProcess = templatesNeedingSwitches;
  if (LIMIT) {
    gammesToProcess = gammesToProcess.slice(0, parseInt(LIMIT));
  }

  console.log(`\n📦 Génération pour ${gammesToProcess.length} gammes...`);
  console.log('-'.repeat(60));

  // 4. Récupérer le prochain ID disponible
  const { data: maxIdData } = await supabase
    .from('__seo_gamme_car_switch')
    .select('sgcs_id')
    .order('sgcs_id', { ascending: false })
    .limit(1);

  let currentId = maxIdData?.[0] ? parseInt(maxIdData[0].sgcs_id) + 1 : 1;

  // 5. Générer et insérer les switches
  let totalGenerated = 0;
  let totalInserted = 0;
  let errors = 0;
  const configStats = {};

  for (const template of gammesToProcess) {
    const pgId = parseInt(template.sgc_pg_id);
    const gammeName = gammeMap.get(pgId) || `Gamme #${pgId}`;

    const { switches, keyword, config } = generateSwitchesForGamme(pgId, gammeName);
    totalGenerated += switches.length;

    // Stats par config
    configStats[keyword] = (configStats[keyword] || 0) + 1;

    console.log(`\n✏️ pg_id=${pgId} - ${gammeName}`);
    console.log(`   Config: ${keyword}`);
    console.log(`   Fonction: ${config.fonction.substring(0, 50)}...`);

    if (DRY_RUN) {
      console.log(`   Exemples:`);
      console.log(`     Alias 1: "${switches[0].sgcs_content}"`);
      console.log(`     Alias 2: "${switches[10].sgcs_content}"`);
      console.log(`     Alias 3: "${switches[20].sgcs_content.substring(0, 60)}..."`);
    } else {
      for (const sw of switches) {
        const { error } = await supabase
          .from('__seo_gamme_car_switch')
          .insert({
            sgcs_id: currentId,
            ...sw
          });

        if (error) {
          console.log(`   ❌ Erreur ID ${currentId}: ${error.message}`);
          errors++;
        } else {
          totalInserted++;
        }
        currentId++;
      }
      console.log(`   ✅ ${switches.length} switches insérés`);
    }
  }

  // 6. Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(`Gammes traitées: ${gammesToProcess.length}`);
  console.log(`Switches générés: ${totalGenerated}`);
  if (!DRY_RUN) {
    console.log(`Switches insérés: ${totalInserted}`);
    console.log(`Erreurs: ${errors}`);
  }

  console.log('\n📈 Répartition par config:');
  Object.entries(configStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([config, count]) => {
      console.log(`   ${config}: ${count} gammes`);
    });

  console.log('\n✅ Terminé!');

  if (DRY_RUN) {
    console.log('\n💡 Pour exécuter réellement:');
    console.log('   node generate_all_seo_switches.js');
  }
}

main().catch(console.error);
