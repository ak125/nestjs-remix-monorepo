/**
 * 🔧 Fonctions utilitaires pour la route pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 */

import { detectMalformedSegment as detectSegment } from "@repo/seo-url-contract";
import { logger } from "~/utils/logger";
import {
  type VehicleData,
  type GammeData,
  type SEOEnrichedContent,
  type BlogArticle,
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
 * Sépare un segment d'URL `{alias}-{id}` (ADR-062) en alias et ID.
 * Exemple: "renault-23" => { alias: "renault", id: 23 }
 *
 * L'ID est le dernier élément du segment, et seulement s'il est entièrement
 * numérique. Un chiffre situé ailleurs appartient à l'alias : "1-5-dci" ou
 * "206-sw" ne portent pas d'ID (id 0, alias intact). Ne jamais en fabriquer un :
 * un ID inventé désigne une autre motorisation ou une page qui n'existe pas.
 */
export function parseUrlParam(param: string | undefined): {
  alias: string;
  id: number;
} {
  // Protection contre undefined/null
  if (!param) {
    logger.warn("⚠️ [PARSE-URL] Paramètre undefined ou null reçu");
    return { alias: "undefined", id: 0 };
  }

  const separator = param.lastIndexOf("-");
  const lastElement = param.slice(separator + 1);
  if (/^\d+$/.test(lastElement)) {
    const id = Number(lastElement);
    if (Number.isSafeInteger(id) && id > 0) {
      return { alias: separator > 0 ? param.slice(0, separator) : "", id };
    }
  }

  // Pas d'ID : le segment entier est l'alias
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
    logger.error(errorMsg, {
      source: params.source || "unknown",
      receivedParams: params,
    });

    // 🚨 CRITIQUE: Lancer une erreur pour empêcher le rendu sans données
    throw new Error(
      `IDs véhicule invalides - Page non affichable pour éviter désindexation SEO. ` +
        `Détails: ${errors.join(", ")}`,
    );
  }

  logger.log("✅ [VALIDATION-IDS] Tous les IDs sont valides:", params);
}

/**
 * Détecte les URLs mal formées (historiques / liens externes) AVANT tout appel API.
 * Retourne la raison si mal formée, null si OK.
 *
 * Patterns détectés :
 * - ID répété : "23231-23231" (alias = id)
 * - Alias manquant : "-137004" (commence par -)
 * - null/undefined littéral : "null-32260"
 * - Prefix type- fallback : "type-19052"
 * - Espaces non encodés : "1.3 elx flex-11602"
 * - Accents : caractères accentués dans les segments
 */
export function detectMalformedSegment(...segments: string[]): string | null {
  // Delegates to the shared SoT detector (ADR-062). Preserves skip-empty behavior
  // and the variadic signature used by the route loaders.
  for (const seg of segments) {
    if (!seg) continue;
    const reason = detectSegment(seg);
    if (reason) return reason;
  }
  return null;
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
    name:
      p.nom ||
      ((p.marque || p.brand) && p.reference
        ? `${p.marque || p.brand} - ${p.reference}`
        : p.name || "Pièce"),
    brand: p.marque || p.brand || "Marque inconnue",
    reference: p.reference || "",
    price: p.prix_unitaire || p.prix_ttc || p.price || 0,
    priceFormatted: (p.prix_unitaire || p.prix_ttc || p.price || 0).toFixed(2),
    image: p.image || "",
    images: p.images || [],
    stock: "", // 🚫 Stock masqué selon config (2026-01-20)
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
