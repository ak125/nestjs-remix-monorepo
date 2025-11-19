/**
 * 🔧 Fonctions utilitaires pour la route pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 */

import { type VehicleData, type GammeData, type SEOEnrichedContent, type FAQItem, type BlogArticle, type GuideContent } from '../types/pieces-route.types';

/**
 * Convertit un slug en titre formaté
 * Exemple: "freinage-avant" => "Freinage Avant"
 */
export function toTitleCaseFromSlug(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Parse les paramètres d'URL avec IDs (format: nom-id ou nom-id-id)
 * Exemple: "renault-23" => { alias: "renault", id: 23 }
 */
export function parseUrlParam(param: string | undefined): { alias: string; id: number } {
  // Protection contre undefined/null
  if (!param) {
    console.warn('⚠️ [PARSE-URL] Paramètre undefined ou null reçu');
    return { alias: 'undefined', id: 0 };
  }
  
  const parts = param.split('-');
  
  // Chercher le dernier nombre dans l'URL
  for (let i = parts.length - 1; i >= 0; i--) {
    const id = parseInt(parts[i]);
    if (!isNaN(id) && id > 0) {
      const alias = parts.slice(0, i).join('-');
      return { alias, id };
    }
  }
  
  // Fallback si pas d'ID trouvé
  return { alias: param, id: 0 };
}

/**
 * ✅ VALIDATION STRICTE - Vérifie que tous les IDs sont présents et valides
 * Lance une erreur explicite si un ID manque pour éviter les désindexations
 */
export function validateVehicleIds(params: {
  marqueId: number;
  modeleId: number;
  typeId: number;
  gammeId: number;
  source?: string;
}): void {
  const errors: string[] = [];
  
  if (!params.marqueId || params.marqueId <= 0) {
    errors.push(`marqueId invalide: ${params.marqueId}`);
  }
  if (!params.modeleId || params.modeleId <= 0) {
    errors.push(`modeleId invalide: ${params.modeleId}`);
  }
  if (!params.typeId || params.typeId <= 0) {
    errors.push(`typeId invalide: ${params.typeId}`);
  }
  if (!params.gammeId || params.gammeId <= 0) {
    errors.push(`gammeId invalide: ${params.gammeId}`);
  }
  
  if (errors.length > 0) {
    const errorMsg = `❌ [VALIDATION-IDS] IDs manquants ou invalides:\n${errors.join('\n')}`;
    console.error(errorMsg, {
      source: params.source || 'unknown',
      receivedParams: params
    });
    
    // 🚨 CRITIQUE: Lancer une erreur pour empêcher le rendu sans données
    throw new Error(
      `IDs véhicule invalides - Page non affichable pour éviter désindexation SEO. ` +
      `Détails: ${errors.join(', ')}`
    );
  }
  
  console.log('✅ [VALIDATION-IDS] Tous les IDs sont valides:', params);
}

/**
 * Formatage intelligent des noms de gammes
 */
export function formatGammeName(gamme: GammeData): string {
  if (!gamme.name) return '';
  
  // Mappage pour les noms commerciaux intelligents 
  const nameMap: Record<string, string> = {
    'Filtres à huile': 'Filtres à huile',
    'Plaquettes de frein': 'Plaquettes de frein',
    'Disques de frein': 'Disques de frein',
    'Filtres à air': 'Filtres à air',
    'Courroies d\'accessoires': 'Courroies d\'accessoires',
    'Amortisseurs': 'Amortisseurs'
  };
  
  return nameMap[gamme.name] || gamme.name;
}

/**
 * Génération contenu SEO enrichi V5
 */
export function generateSEOContent(vehicle: VehicleData, gamme: GammeData): SEOEnrichedContent {
  const brandModel = `${vehicle.marque} ${vehicle.modele} ${vehicle.type}`;
  
  return {
    h1: `${gamme.name} pour ${brandModel} - Guide Complet 2024`,
    h2Sections: [
      `Pourquoi choisir nos ${gamme.name} ?`,
      `Installation et compatibilité ${brandModel}`,
      `Guide d'achat ${gamme.name}`,
      `Conseils d'entretien professionnel`,
      `Questions fréquentes`
    ],
    longDescription: `
      Découvrez notre sélection exclusive de ${gamme.name} spécialement conçus pour ${brandModel}. 
      Notre catalogue propose plus de 50 références de qualité OEM et aftermarket premium, 
      garantissant une compatibilité parfaite et des performances optimales pour votre véhicule.
      
      Nos ${gamme.name} sont rigoureusement sélectionnés auprès des meilleurs fabricants européens 
      (BOSCH, MANN-FILTER, FEBI BILSTEIN, VALEO) et bénéficient de garanties constructeur étendues. 
      Profitez de tarifs jusqu'à 40% moins chers qu'en concession, sans aucun compromis sur la qualité.
    `.trim(),
    technicalSpecs: [
      `Compatibilité vérifiée avec ${brandModel}`,
      'Pièces certifiées aux normes européennes CE',
      'Garantie constructeur 2 ans minimum',
      'Livraison express 24-48h partout en France',
      'Support technique spécialisé 6j/7'
    ],
    compatibilityNotes: `
      Ces ${gamme.name} sont spécifiquement adaptés à votre ${brandModel}. 
      Notre équipe technique vérifie la compatibilité par numéro de châssis (VIN) 
      pour garantir un ajustement parfait et éviter tout risque d'erreur.
    `.trim(),
    installationTips: [
      'Consultez toujours le manuel technique du véhicule avant intervention',
      'Utilisez exclusivement des outils calibrés et adaptés',
      'Respectez scrupuleusement les couples de serrage recommandés',
      'Effectuez un contrôle qualité complet après installation',
      'Programmez un essai routier pour valider le bon fonctionnement'
    ]
  };
}

/**
 * FAQ dynamique V5
 */
export function generateFAQ(vehicle: VehicleData, gamme: GammeData): FAQItem[] {
  const brandModel = `${vehicle.marque} ${vehicle.modele}`;
  
  return [
    {
      id: 'compatibility',
      question: `Ces ${gamme.name} sont-ils garantis compatibles avec mon ${brandModel} ?`,
      answer: `Absolument ! Tous nos ${gamme.name} sont rigoureusement sélectionnés et testés pour votre ${brandModel}. Notre équipe technique vérifie la compatibilité par numéro de châssis pour éliminer tout risque d'erreur.`,
      schema: true
    },
    {
      id: 'quality',
      question: `Quelle garantie sur la qualité de vos ${gamme.name} ?`,
      answer: `Nos ${gamme.name} proviennent exclusivement de fabricants OEM et aftermarket premium (BOSCH, MANN-FILTER, FEBI). Garantie constructeur 2 ans minimum + garantie satisfait ou remboursé 30 jours.`,
      schema: true
    },
    {
      id: 'delivery',
      question: `Quels sont vos délais de livraison ?`,
      answer: `Expédition sous 24h pour 90% de nos ${gamme.name} en stock. Livraison express 24-48h en France métropolitaine. Livraison gratuite dès 50€ d'achat.`,
      schema: true
    }
  ];
}

/**
 * Articles de blog pertinents
 */
export function generateRelatedArticles(vehicle: VehicleData, gamme: GammeData): BlogArticle[] {
  const brandModel = `${vehicle.marque} ${vehicle.modele}`;
  
  return [
    {
      id: 'maintenance-guide',
      title: `Guide d'entretien ${gamme.name} ${brandModel} : Les secrets des pros`,
      excerpt: `Découvrez les techniques d'entretien professionnelles pour maximiser la durée de vie de vos ${gamme.name} et éviter les pannes coûteuses.`,
      slug: `entretien-${gamme.alias}-${vehicle.marque.toLowerCase()}-${vehicle.modele.toLowerCase()}`,
      image: `/blog/images/guide-${gamme.alias}-maintenance.webp`,
      date: new Date().toISOString().split('T')[0],
      readTime: 8
    },
    {
      id: 'diagnostic-problems',
      title: `Diagnostic des pannes ${gamme.name} : Symptômes et solutions`,
      excerpt: `Apprenez à identifier les premiers signes d'usure et les pannes courantes sur ${brandModel}. Guide complet avec photos et solutions.`,
      slug: `diagnostic-pannes-${gamme.alias}`,
      image: `/blog/images/diagnostic-${gamme.alias}.webp`,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      readTime: 12
    }
  ];
}

/**
 * Génère le guide d'achat
 */
export function generateBuyingGuide(vehicle: VehicleData, gamme: GammeData): GuideContent {
  return {
    title: `Guide d'achat ${gamme.name}`,
    content: `Pour choisir les bons ${gamme.name} pour votre ${vehicle.marque} ${vehicle.modele}, suivez nos conseils d'experts.`,
    tips: [
      'Vérifiez la compatibilité avec votre numéro de châssis',
      'Privilégiez les marques reconnues pour la fiabilité',
      'Comparez les garanties proposées',
      'Consultez les avis clients avant achat'
    ],
    warnings: [
      'Attention aux contrefaçons sur les sites non spécialisés',
      'Une pièce moins chère peut coûter plus cher à long terme'
    ]
  };
}

/**
 * Résout les IDs du véhicule depuis les alias ou depuis l'URL
 */
export async function resolveVehicleIds(marqueParam: string, modeleParam: string, typeParam: string) {
  // Validation des paramètres
  if (!marqueParam || !modeleParam || !typeParam) {
    console.error(`❌ [RESOLVE-VEHICLE] Paramètres invalides:`, { marqueParam, modeleParam, typeParam });
    throw new Error(`Paramètres véhicule invalides ou manquants`);
  }
  
  // Parse les paramètres avec IDs
  const marque = parseUrlParam(marqueParam);
  const modele = parseUrlParam(modeleParam);
  const type = parseUrlParam(typeParam);
  
  // ✅ PRIORITÉ 1: Si on a déjà tous les IDs dans l'URL, les valider
  if (marque.id > 0 && modele.id > 0 && type.id > 0) {
    // Validation préventive de l'existence du type
    try {
      const validationResponse = await fetch(
        `http://localhost:3000/api/catalog/integrity/validate-type/${type.id}`,
        { method: 'GET' }
      );
      
      if (validationResponse.ok) {
        const validationData = await validationResponse.json();
        if (validationData.exists) {
          return {
            marqueId: marque.id,
            modeleId: modele.id,
            typeId: type.id
          };
        } else {
          console.error(`❌ [VALIDATE-TYPE] Type ID ${type.id} invalide ou n'existe pas`);
          throw new Error(`Type de véhicule invalide (ID: ${type.id})`);
        }
      } else {
        // Validation endpoint non accessible (404/500), utiliser les IDs quand même
        console.warn(`⚠️ [VALIDATE-TYPE] Validation endpoint retourné ${validationResponse.status}, utilisation des IDs parsés`);
        return {
          marqueId: marque.id,
          modeleId: modele.id,
          typeId: type.id
        };
      }
    } catch (error) {
      console.warn(`⚠️ [VALIDATE-TYPE] Erreur validation type ${type.id}:`, error);
      // Continuer avec l'ID si la validation échoue (éviter de bloquer)
      return {
        marqueId: marque.id,
        modeleId: modele.id,
        typeId: type.id
      };
    }
  }
  
  console.warn(`⚠️ [RESOLVE-VEHICLE] IDs manquants dans l'URL, tentative résolution API...`);
  
  try {
    // Sinon essayer l'API de résolution
    const brandsResponse = await fetch(`http://localhost:3000/api/vehicles/brands?search=${marque.alias}&limit=1`);
    if (brandsResponse.ok) {
      const brandsData = await brandsResponse.json();
      const brand = brandsData.data?.[0];
      
      if (brand) {
        const modelsResponse = await fetch(`http://localhost:3000/api/vehicles/brands/${brand.marque_id}/models`);
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          const modelData = modelsData.data?.find((m: any) => 
            m.modele_alias === modele.alias || 
            m.modele_name.toLowerCase().includes(modele.alias)
          );
          
          if (modelData) {
            return {
              marqueId: brand.marque_id,
              modeleId: modelData.modele_id,
              typeId: type.id > 0 ? type.id : 55593
            };
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ [RESOLVE-VEHICLE] Erreur appel API:', error);
  }
  
  // ❌ Si aucune résolution possible, retourner une erreur
  // Ne plus utiliser de fallback avec des IDs invalides
  console.error(`❌ [RESOLVE-VEHICLE] Impossible de résoudre les IDs pour: marque=${marque.alias}, modele=${modele.alias}, type=${type.alias}`);
  throw new Error(`Véhicule introuvable: ${marque.alias} ${modele.alias} ${type.alias}`);
}

/**
 * Récupère l'ID de gamme avec parsing URL intelligent
 */
export async function resolveGammeId(gammeParam: string): Promise<number> {
  // Parse le paramètre pour extraire l'ID s'il existe
  const gamme = parseUrlParam(gammeParam);
  
  // Mappings directs avec les IDs réels de la base de données
  // ⚠️ Ces mappings sont pour les routes SANS ID dans l'URL
  // Les routes avec ID (ex: courroie-d-accessoire-10) utilisent directement l'ID
  const knownGammeMap: Record<string, number> = {
    "freinage": 402,
    "plaquettes-de-frein": 402,
    "plaquette-de-frein": 402,
    "disques-de-frein": 403,
    "disque-de-frein": 403,
    "kit-de-distribution": 128,
    "filtres-a-huile": 75,
    "filtres-a-air": 76,
    "filtres-a-carburant": 77,
    "filtres-habitacle": 78,
    "amortisseurs": 854,  // ✅ CORRIGÉ: ID réel de la gamme Amortisseur
    "amortisseur": 854     // ✅ CORRIGÉ: ID réel de la gamme Amortisseur
  };
  
  // Si on a un ID dans l'URL, le valider avant de l'utiliser
  if (gamme.id > 0) {
    console.log(`✅ [GAMME-ID] ID trouvé dans l'URL pour ${gamme.alias}: ${gamme.id}`);
    
    // 🛡️ VALIDATION: Vérifier que cet ID existe dans la base
    try {
      // ✅ TIMEOUT 5 secondes pour éviter blocage
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('http://localhost:3000/api/catalog/gammes', {
        signal: controller.signal,
        headers: { 
          'Accept': 'application/json',
          'Cache-Control': 'max-age=3600' // Cache 1h
        }
      });
      
      clearTimeout(timeoutId);
      
      // ✅ Vérifier le status HTTP
      if (!response.ok) {
        console.warn(`⚠️ [GAMME-ID] API returned ${response.status}, using ID directly: ${gamme.id}`);
        return gamme.id;
      }
      
      const data = await response.json();
      
      // ✅ Vérifier que c'est un array (évite crash si erreur Supabase)
      if (!Array.isArray(data)) {
        console.error(`❌ [GAMME-ID] Invalid response format (expected array):`, data);
        return gamme.id;
      }
      
      const gammes = data;
      const gammeExists = gammes.some((g: any) => g.id === gamme.id);
      
      if (!gammeExists) {
        console.error(`❌ [GAMME-ID] ID ${gamme.id} n'existe pas dans la base, utilisation du mapping`);
        // Fallback sur le mapping par alias
        const fallbackId = knownGammeMap[gamme.alias];
        if (fallbackId) {
          console.log(`✅ [GAMME-ID] Fallback mapping trouvé pour ${gamme.alias}: ${fallbackId}`);
          return fallbackId;
        }
      } else {
        return gamme.id;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error(`⏱️ [GAMME-ID] Timeout after 5s, using ID directly: ${gamme.id}`);
        } else {
          console.error(`❌ [GAMME-ID] Erreur validation ID ${gamme.id}:`, error.message);
        }
      }
      // En cas d'erreur, utiliser l'ID tel quel (évite de casser le site)
      return gamme.id;
    }
  }
  
  const gammeId = knownGammeMap[gamme.alias];
  
  if (gammeId) {
    console.log(`✅ [GAMME-ID] Mapping trouvé pour ${gamme.alias}: ${gammeId}`);
    return gammeId;
  }
  
  console.log(`⚠️ [GAMME-ID] Pas de mapping pour ${gamme.alias}, utilisation ID test: 402`);
  return 402;
}

/**
 * 🔧 Utilitaire pour slugifier les textes
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
