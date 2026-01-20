/**
 * 🔧 Fonctions utilitaires pour la route pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 */

import {
  type VehicleData,
  type GammeData,
  type SEOEnrichedContent,
  type FAQItem,
  type BlogArticle,
  type GuideContent,
  type PieceData,
} from "../types/pieces-route.types";

/**
 * Convertit un slug en titre formaté
 * Exemple: "freinage-avant" => "Freinage Avant"
 */
export function toTitleCaseFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Parse les paramètres d'URL avec IDs (format: nom-id ou nom-id-id)
 * Exemple: "renault-23" => { alias: "renault", id: 23 }
 */
export function parseUrlParam(param: string | undefined): {
  alias: string;
  id: number;
} {
  // Protection contre undefined/null
  if (!param) {
    console.warn("⚠️ [PARSE-URL] Paramètre undefined ou null reçu");
    return { alias: "undefined", id: 0 };
  }

  const parts = param.split("-");

  // Chercher le dernier nombre dans l'URL
  for (let i = parts.length - 1; i >= 0; i--) {
    const id = parseInt(parts[i]);
    if (!isNaN(id) && id > 0) {
      const alias = parts.slice(0, i).join("-");
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
  gammeId?: number; // 🛡️ Optionnel - validation déléguée au RM V2 RPC si absent
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
  // 🛡️ gammeId optionnel - si fourni, valider; sinon, déléguer au RM V2 RPC
  if (
    params.gammeId !== undefined &&
    (!params.gammeId || params.gammeId <= 0)
  ) {
    errors.push(`gammeId invalide: ${params.gammeId}`);
  }

  if (errors.length > 0) {
    const errorMsg = `❌ [VALIDATION-IDS] IDs manquants ou invalides:\n${errors.join("\n")}`;
    console.error(errorMsg, {
      source: params.source || "unknown",
      receivedParams: params,
    });

    // 🚨 CRITIQUE: Lancer une erreur pour empêcher le rendu sans données
    throw new Error(
      `IDs véhicule invalides - Page non affichable pour éviter désindexation SEO. ` +
        `Détails: ${errors.join(", ")}`,
    );
  }

  console.log("✅ [VALIDATION-IDS] Tous les IDs sont valides:", params);
}

/**
 * Formatage intelligent des noms de gammes
 */
export function formatGammeName(gamme: GammeData): string {
  if (!gamme.name) return "";

  // Mappage pour les noms commerciaux intelligents
  const nameMap: Record<string, string> = {
    "Filtres à huile": "Filtres à huile",
    "Plaquettes de frein": "Plaquettes de frein",
    "Disques de frein": "Disques de frein",
    "Filtres à air": "Filtres à air",
    "Courroies d'accessoires": "Courroies d'accessoires",
    Amortisseurs: "Amortisseurs",
  };

  return nameMap[gamme.name] || gamme.name;
}

/**
 * Génération contenu SEO enrichi V5
 */
export function generateSEOContent(
  vehicle: VehicleData,
  gamme: GammeData,
): SEOEnrichedContent {
  const brandModel = `${vehicle.marque} ${vehicle.modele} ${vehicle.type}`;

  return {
    h1: `${gamme.name} pour ${brandModel} - Guide Complet 2024`,
    h2Sections: [
      `Pourquoi choisir nos ${gamme.name} ?`,
      `Installation et compatibilité ${brandModel}`,
      `Guide d'achat ${gamme.name}`,
      `Conseils d'entretien professionnel`,
      `Questions fréquentes`,
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
      "Pièces certifiées aux normes européennes CE",
      "Garantie constructeur 1 an",
      "Livraison express 24-48h partout en France",
      "Support technique spécialisé 6j/7",
    ],
    compatibilityNotes: `
      Ces ${gamme.name} sont spécifiquement adaptés à votre ${brandModel}. 
      Notre équipe technique vérifie la compatibilité par numéro de châssis (VIN) 
      pour garantir un ajustement parfait et éviter tout risque d'erreur.
    `.trim(),
    installationTips: [
      "Consultez toujours le manuel technique du véhicule avant intervention",
      "Utilisez exclusivement des outils calibrés et adaptés",
      "Respectez scrupuleusement les couples de serrage recommandés",
      "Effectuez un contrôle qualité complet après installation",
      "Programmez un essai routier pour valider le bon fonctionnement",
    ],
  };
}

/**
 * FAQ dynamique V5
 */
export function generateFAQ(vehicle: VehicleData, gamme: GammeData): FAQItem[] {
  const brandModel = `${vehicle.marque} ${vehicle.modele}`;

  return [
    {
      id: "compatibility",
      question: `Ces ${gamme.name} sont-ils garantis compatibles avec mon ${brandModel} ?`,
      answer: `Absolument ! Tous nos ${gamme.name} sont rigoureusement sélectionnés et testés pour votre ${brandModel}. Notre équipe technique vérifie la compatibilité par numéro de châssis pour éliminer tout risque d'erreur.`,
      schema: true,
    },
    {
      id: "quality",
      question: `Quelle garantie sur la qualité de vos ${gamme.name} ?`,
      answer: `Nos ${gamme.name} proviennent exclusivement de fabricants OEM et aftermarket premium (BOSCH, MANN-FILTER, FEBI). Garantie constructeur 1 an + garantie satisfait ou remboursé 30 jours.`,
      schema: true,
    },
    {
      id: "delivery",
      question: `Quels sont vos délais de livraison ?`,
      answer: `Expédition sous 24h pour 90% de nos ${gamme.name} en stock. Livraison express 24-48h en France métropolitaine. Livraison gratuite dès 50€ d'achat.`,
      schema: true,
    },
  ];
}

/**
 * Articles de blog pertinents
 */
export function generateRelatedArticles(
  vehicle: VehicleData,
  gamme: GammeData,
): BlogArticle[] {
  const brandModel = `${vehicle.marque} ${vehicle.modele}`;

  return [
    {
      id: "maintenance-guide",
      title: `Guide d'entretien ${gamme.name} ${brandModel} : Les secrets des pros`,
      excerpt: `Découvrez les techniques d'entretien professionnelles pour maximiser la durée de vie de vos ${gamme.name} et éviter les pannes coûteuses.`,
      slug: `entretien-${gamme.alias}-${vehicle.marque.toLowerCase()}-${vehicle.modele.toLowerCase()}`,
      image: `/blog/images/guide-${gamme.alias}-maintenance.webp`,
      date: new Date().toISOString().split("T")[0],
      readTime: 8,
    },
    {
      id: "diagnostic-problems",
      title: `Diagnostic des pannes ${gamme.name} : Symptômes et solutions`,
      excerpt: `Apprenez à identifier les premiers signes d'usure et les pannes courantes sur ${brandModel}. Guide complet avec photos et solutions.`,
      slug: `diagnostic-pannes-${gamme.alias}`,
      image: `/blog/images/diagnostic-${gamme.alias}.webp`,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      readTime: 12,
    },
  ];
}

/**
 * Génère le guide d'achat
 */
export function generateBuyingGuide(
  vehicle: VehicleData,
  gamme: GammeData,
): GuideContent {
  return {
    title: `Guide d'achat ${gamme.name}`,
    content: `Pour choisir les bons ${gamme.name} pour votre ${vehicle.marque} ${vehicle.modele}, suivez nos conseils d'experts.`,
    tips: [
      "Vérifiez la compatibilité avec votre numéro de châssis",
      "Privilégiez les marques reconnues pour la fiabilité",
      "Comparez les garanties proposées",
      "Consultez les avis clients avant achat",
    ],
    warnings: [
      "Attention aux contrefaçons sur les sites non spécialisés",
      "Une pièce moins chère peut coûter plus cher à long terme",
    ],
  };
}

/**
 * Résout les IDs du véhicule depuis les alias ou depuis l'URL
 */
export async function resolveVehicleIds(
  marqueParam: string,
  modeleParam: string,
  typeParam: string,
) {
  // Validation des paramètres
  if (!marqueParam || !modeleParam || !typeParam) {
    console.error(`❌ [RESOLVE-VEHICLE] Paramètres invalides:`, {
      marqueParam,
      modeleParam,
      typeParam,
    });
    throw new Error(`Paramètres véhicule invalides ou manquants`);
  }

  // Parse les paramètres avec IDs
  const marque = parseUrlParam(marqueParam);
  const modele = parseUrlParam(modeleParam);
  const type = parseUrlParam(typeParam);

  // ✅ PRIORITÉ 1: Si on a déjà tous les IDs dans l'URL, les retourner directement
  // 🚀 LCP OPTIMIZATION: Le RM V2 RPC fait déjà la validation en interne
  // Supprimer l'appel redondant à validate-type (économise ~80ms)
  if (marque.id > 0 && modele.id > 0 && type.id > 0) {
    return {
      marqueId: marque.id,
      modeleId: modele.id,
      typeId: type.id,
    };
  }

  console.warn(
    `⚠️ [RESOLVE-VEHICLE] IDs manquants dans l'URL, tentative résolution API...`,
  );

  try {
    // Sinon essayer l'API de résolution
    const brandsResponse = await fetch(
      `http://localhost:3000/api/vehicles/brands?search=${marque.alias}&limit=1`,
    );
    if (brandsResponse.ok) {
      const brandsData = await brandsResponse.json();
      const brand = brandsData.data?.[0];

      if (brand) {
        const modelsResponse = await fetch(
          `http://localhost:3000/api/vehicles/brands/${brand.marque_id}/models`,
        );
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          const modelData = modelsData.data?.find(
            (m: any) =>
              m.modele_alias === modele.alias ||
              m.modele_name.toLowerCase().includes(modele.alias),
          );

          if (modelData) {
            // 🛡️ SEO: Retourner les IDs même si typeId=0
            // Le RM V2 RPC validera et retournera 404 si nécessaire
            return {
              marqueId: brand.marque_id,
              modeleId: modelData.modele_id,
              typeId: type.id, // Peut être 0 → RM V2 retournera 404
            };
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ [RESOLVE-VEHICLE] Erreur appel API:", error);
  }

  // 🛡️ Fallback: Retourner les IDs parsés depuis l'URL (peuvent être 0 si invalides)
  // Note: Le RM V2 RPC validera ensuite et retournera 404 HTTP si IDs inexistants en DB
  // Ceci est le comportement attendu pour les URLs malformées ou obsolètes
  console.warn(
    `⚠️ [RESOLVE-VEHICLE] Fallback IDs URL: marque=${marque.alias}(${marque.id}), modele=${modele.alias}(${modele.id}), type=${type.alias}(${type.id})`,
  );
  return {
    marqueId: marque.id,
    modeleId: modele.id,
    typeId: type.id, // RM V2 retournera 404 si 0
  };
}

/**
 * Récupère l'ID de gamme avec parsing URL intelligent
 * 🔧 Fix SEO: API fallback dynamique si alias non trouvé dans la map statique
 */
export async function resolveGammeId(gammeParam: string): Promise<number> {
  // Parse le paramètre pour extraire l'ID s'il existe
  const gamme = parseUrlParam(gammeParam);

  // Mappings directs avec les IDs réels de la base de données
  // ⚠️ Ces mappings sont pour les routes SANS ID dans l'URL
  // Les routes avec ID (ex: courroie-d-accessoire-10) utilisent directement l'ID
  const knownGammeMap: Record<string, number> = {
    freinage: 402,
    "plaquettes-de-frein": 402,
    "plaquette-de-frein": 402,
    "disques-de-frein": 403,
    "disque-de-frein": 403,
    "kit-de-distribution": 128,
    "filtres-a-huile": 75,
    "filtres-a-air": 76,
    "filtres-a-carburant": 77,
    "filtres-habitacle": 78,
    amortisseurs: 854,
    amortisseur: 854,
  };

  // 🚀 LCP OPTIMIZATION: Si on a un ID dans l'URL, le retourner directement
  // Le RM V2 RPC fait déjà la validation de l'existence de la gamme en interne
  // Supprimer l'appel redondant à /api/catalog/gammes (économise ~50-100ms)
  if (gamme.id > 0) {
    console.log(
      `✅ [GAMME-ID] ID trouvé dans l'URL: ${gamme.id} (validation déléguée au RM V2)`,
    );
    return gamme.id;
  }

  const gammeId = knownGammeMap[gamme.alias];

  if (gammeId) {
    console.log(`✅ [GAMME-ID] Mapping trouvé pour ${gamme.alias}: ${gammeId}`);
    return gammeId;
  }

  // 🔍 API fallback: Chercher dans la base de données si alias non trouvé localement
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const response = await fetch(
      `${backendUrl}/api/catalog/gammes/by-alias/${encodeURIComponent(gamme.alias)}`,
    );

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data?.id) {
        console.log(
          `✅ [GAMME-ID] API fallback trouvé pour ${gamme.alias}: ${result.data.id}`,
        );
        return result.data.id;
      }
    }

    console.warn(
      `⚠️ [GAMME-ID] API fallback: alias "${gamme.alias}" non trouvé en base`,
    );
  } catch (error) {
    console.error(`❌ [GAMME-ID] Erreur API fallback:`, error);
  }

  // 🛡️ Sécurité SEO: Ne pas retourner un ID incorrect si gamme inconnue
  // Le RM V2 RPC gérera la validation et retournera 404 si nécessaire
  console.error(
    `❌ [GAMME-ID] Gamme inconnue: ${gamme.alias} - retour 0 pour validation RM V2`,
  );
  return 0; // Le RM V2 RPC validera et retournera 404 si gamme inexistante
}

/**
 * 🔧 Utilitaire pour slugifier les textes
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * 🎯 Dérive le nombre d'étoiles depuis la qualité (OE/EQUIV/ECO)
 * Utilisé quand nb_stars n'est pas disponible (ex: données RM V2)
 */
function getStarsFromQuality(quality: string | undefined): number | undefined {
  if (!quality) return undefined;
  switch (quality.toUpperCase()) {
    case "OE":
      return 5;
    case "EQUIV":
      return 4;
    case "ECO":
      return 3;
    default:
      return undefined;
  }
}

/**
 * 🔄 Convertit un objet pièce de l'API vers le type PieceData
 * Évite la duplication du mapping dans la route
 */
export function mapApiPieceToData(p: any): PieceData {
  return {
    id: p.id,
    name: p.nom || p.name || "Pièce",
    brand: p.marque || p.brand || "Marque inconnue",
    reference: p.reference || "",
    price: p.prix_unitaire || p.prix_ttc || p.price || 0,
    priceFormatted: (p.prix_unitaire || p.prix_ttc || p.price || 0).toFixed(2),
    image: p.image || "",
    images: p.images || [],
    stock: p.dispo ? "En stock" : "Sur commande",
    quality: p.qualite || p.quality || "",
    // ✅ FIX 2026-01-18: Dériver stars depuis quality si nb_stars absent (RM V2)
    stars:
      p.stars ??
      (p.nb_stars
        ? parseInt(p.nb_stars)
        : getStarsFromQuality(p.quality || p.qualite)),
    side: p.filtre_side || undefined,
    description: p.description || "",
    url: p.url || "",
    marque_id: p.marque_id,
    marque_logo: p.marque_logo,
  };
}

/**
 * Mappe un tableau de pièces depuis RM V2 vers PieceData[]
 */
export function mapBatchPiecesToData(batchPieces: any[]): PieceData[] {
  return (batchPieces || []).map(mapApiPieceToData);
}

/**
 * Calcule les statistiques de prix (min, max) depuis un tableau de pièces
 */
export function calculatePriceStats(pieces: PieceData[]): {
  minPrice: number;
  maxPrice: number;
} {
  const prices = pieces.map((p) => p.price).filter((p) => p > 0);
  return {
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
  };
}

/**
 * Merge SEO content généré avec données RM V2
 * Priorise les données RM si présentes, sinon fallback sur généré
 */
export function mergeSeoContent(
  generated: SEOEnrichedContent,
  batchSeo:
    | {
        content?: string;
        h1?: string;
        data?: { content?: string; h1?: string };
      }
    | undefined,
): SEOEnrichedContent {
  if (!batchSeo) {
    return generated;
  }

  const content = batchSeo.content || batchSeo.data?.content;
  const h1 = batchSeo.h1 || batchSeo.data?.h1;

  return {
    h1: h1 || generated.h1,
    h2Sections: generated.h2Sections,
    longDescription: content || generated.longDescription,
    technicalSpecs: generated.technicalSpecs,
    compatibilityNotes: generated.compatibilityNotes,
    installationTips: generated.installationTips,
  };
}
