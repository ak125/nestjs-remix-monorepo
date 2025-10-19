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
export function parseUrlParam(param: string): { alias: string; id: number } {
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
 * Résolution intelligente des IDs véhicule avec parsing URL
 */
export async function resolveVehicleIds(marqueParam: string, modeleParam: string, typeParam: string) {
  // Parse les paramètres avec IDs
  const marque = parseUrlParam(marqueParam);
  const modele = parseUrlParam(modeleParam);
  const type = parseUrlParam(typeParam);
  
  console.log(`🔍 [V5-RESOLVE] Parsing: marque=${marque.alias}(${marque.id}), modele=${modele.alias}(${modele.id}), type=${type.alias}(${type.id})`);
  
  // Si on a déjà des IDs dans l'URL, les utiliser
  if (marque.id > 0 && modele.id > 0 && type.id > 0) {
    console.log(`✅ [V5-RESOLVE] IDs trouvés dans l'URL`);
    return {
      marqueId: marque.id,
      modeleId: modele.id,
      typeId: type.id
    };
  }
  
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
            console.log(`✅ [V5-RESOLVE] API: ${brand.marque_name} ${modelData.modele_name}`);
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
    console.warn('⚠️ [V5-RESOLVE] API failed:', error);
  }
  
  // Fallback intelligent avec mappings connus
  const knownIds: Record<string, { marqueId: number; typeId: number }> = {
    "renault": { marqueId: 23, typeId: 55593 },
    "peugeot": { marqueId: 19, typeId: 128049 },
    "audi": { marqueId: 3, typeId: 5432 },
    "bmw": { marqueId: 5, typeId: 9876 },
    "volkswagen": { marqueId: 35, typeId: 12345 }
  };
  
  const fallback = knownIds[marque.alias] || knownIds["renault"];
  console.log(`⚠️ [V5-RESOLVE] Fallback pour ${marque.alias}:`, fallback);
  
  return {
    marqueId: fallback.marqueId,
    modeleId: 456,
    typeId: type.id > 0 ? type.id : fallback.typeId
  };
}

/**
 * Récupère l'ID de gamme avec parsing URL intelligent
 */
export async function resolveGammeId(gammeParam: string): Promise<number> {
  // Parse le paramètre pour extraire l'ID s'il existe
  const gamme = parseUrlParam(gammeParam);
  
  // Si on a un ID dans l'URL, l'utiliser
  if (gamme.id > 0) {
    console.log(`✅ [GAMME-ID] ID trouvé dans l'URL pour ${gamme.alias}: ${gamme.id}`);
    return gamme.id;
  }
  
  // Mappings directs avec les IDs réels de la base de données
  const knownGammeMap: Record<string, number> = {
    "freinage": 402,
    "kit-de-distribution": 128, 
    "filtres-a-huile": 75, 
    "filtres-a-air": 76,
    "filtres-a-carburant": 77, 
    "filtres-habitacle": 78,
    "plaquettes-de-frein": 402,
    "disques-de-frein": 403,
    "amortisseurs": 85,
    "courroies": 90
  };
  
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
