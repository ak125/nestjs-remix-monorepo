/**
 * 🔧 Pieces Loader Utilities
 * Fonctions utilitaires pour le loader de la route pièces
 * Extrait pour réduire la taille du fichier route
 */

import { type CatalogueMameFamille } from "../components/pieces/PiecesCatalogueFamille";
import { type GammeData, type VehicleData } from "../types/pieces-route.types";
import { toTitleCaseFromSlug } from "./pieces-route.utils";

// URL de base Supabase pour les images catalogue (sans transformation, $0)
const SUPABASE_CATALOGUE_URL =
  "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue";

/**
 * Paramètres pour construire les données véhicule
 */
interface BuildVehicleParams {
  vehicleInfo:
    | {
        typeName?: string;
        modelePic?: string;
        marqueName?: string;
        modeleName?: string;
        marqueAlias?: string;
        modeleAlias?: string;
        typeAlias?: string;
        motorCodesFormatted?: string;
        mineCodesFormatted?: string;
        cnitCodesFormatted?: string;
        typePowerPs?: number;
        typeEngine?: string;
        typeBody?: string;
        typeDateStart?: string;
        typeDateEnd?: string;
      }
    | null
    | undefined;
  vehicleIds: {
    marqueId: number;
    modeleId: number;
    typeId: number;
  };
  urlParams: {
    marqueAlias: string;
    modeleAlias: string;
    typeAlias: string;
  };
}

/**
 * Construit les données VehicleData depuis la réponse batch-loader
 *
 * @param params - Paramètres contenant vehicleInfo, vehicleIds et urlParams
 * @returns VehicleData complète
 */
export function buildVehicleData(params: BuildVehicleParams): VehicleData {
  const { vehicleInfo, vehicleIds, urlParams } = params;

  const typeName =
    vehicleInfo?.typeName || toTitleCaseFromSlug(urlParams.typeAlias);
  const modelePic = vehicleInfo?.modelePic || undefined;

  return {
    marque:
      vehicleInfo?.marqueName || toTitleCaseFromSlug(urlParams.marqueAlias),
    modele:
      vehicleInfo?.modeleName || toTitleCaseFromSlug(urlParams.modeleAlias),
    type: toTitleCaseFromSlug(urlParams.typeAlias),
    typeName,
    typeId: vehicleIds.typeId,
    marqueId: vehicleIds.marqueId,
    modeleId: vehicleIds.modeleId,
    marqueAlias: vehicleInfo?.marqueAlias || urlParams.marqueAlias,
    modeleAlias: vehicleInfo?.modeleAlias || urlParams.modeleAlias,
    typeAlias: vehicleInfo?.typeAlias || urlParams.typeAlias,
    modelePic,
    // 🔧 V7: Codes moteur et types mines (depuis batch-loader vehicleInfo)
    motorCodesFormatted: vehicleInfo?.motorCodesFormatted,
    mineCodesFormatted: vehicleInfo?.mineCodesFormatted,
    cnitCodesFormatted: vehicleInfo?.cnitCodesFormatted,
    // 📊 Specs techniques supplémentaires
    typePowerPs: vehicleInfo?.typePowerPs,
    typeFuel: vehicleInfo?.typeEngine, // typeEngine contient le type de carburant
    typeBody: vehicleInfo?.typeBody,
    // 📅 Dates de production (pour JSON-LD vehicleModelDate)
    typeDateStart: vehicleInfo?.typeDateStart,
    typeDateEnd: vehicleInfo?.typeDateEnd,
  };
}

/**
 * Construit les données GammeData depuis les paramètres URL
 *
 * @param gammeId - ID de la gamme
 * @param gammeAlias - Alias de la gamme depuis l'URL
 * @returns GammeData complète
 */
export function buildGammeData(gammeId: number, gammeAlias: string): GammeData {
  const gammeName = toTitleCaseFromSlug(gammeAlias);

  return {
    id: gammeId,
    name: gammeName,
    alias: gammeAlias,
    description: `${gammeName} de qualité pour votre véhicule`,
    image: undefined,
  };
}

/**
 * Construit les informations de compatibilité pour le véhicule
 *
 * @param vehicle - Données véhicule
 * @returns Objet compatibilityInfo pour le loader
 */
export function buildCompatibilityInfo(vehicle: VehicleData) {
  return {
    engines: [vehicle.type],
    years: "2010-2024",
    notes: [
      "Vérifiez la référence d'origine avant commande",
      "Compatible avec toutes les versions du moteur",
    ],
  };
}

/**
 * Interface pour la hiérarchie des gammes
 */
export interface HierarchyData {
  families?: Array<{
    id?: number;
    name?: string;
    image?: string | null;
    gammes?: Array<{
      id: string | number;
      name: string;
      alias: string;
      image?: string | null;
    }>;
  }>;
}

/**
 * Construit la promesse pour le catalogue de la même famille
 * Trouve la famille contenant la gamme actuelle et retourne les autres gammes
 *
 * @param gammeId - ID de la gamme actuelle
 * @param hierarchyPromise - Promise de la hiérarchie des gammes
 * @returns Promise<CatalogueMameFamille | null>
 */
export function buildCataloguePromise(
  gammeId: number,
  hierarchyPromise: Promise<HierarchyData | null>,
): Promise<CatalogueMameFamille | null> {
  return hierarchyPromise
    .then((hierarchyData) => {
      if (!hierarchyData?.families) return null;

      // Trouver la famille contenant la gamme actuelle
      const family = hierarchyData.families.find((f) =>
        f.gammes?.some(
          (g) => (typeof g.id === "string" ? parseInt(g.id) : g.id) === gammeId,
        ),
      );

      if (!family || !family.gammes) return null;

      // Filtrer les autres gammes (exclure la gamme actuelle)
      const otherGammes = family.gammes.filter(
        (g) => (typeof g.id === "string" ? parseInt(g.id) : g.id) !== gammeId,
      );

      return {
        title: `Catalogue ${family.name}`,
        family: {
          mf_id: family.id || 0,
          mf_name: family.name || "",
          mf_pic: family.image || null,
        },
        items: otherGammes.map((g) => ({
          name: g.name,
          link: `/pieces/${g.alias}-${g.id}.html`,
          image: g.image
            ? `${SUPABASE_CATALOGUE_URL}/${g.image}?width=200&quality=85&t=31536000`
            : `${SUPABASE_CATALOGUE_URL}/${g.alias}.webp?width=200&quality=85&t=31536000`,
          description: `Automecanik vous conseille de contrôler l'état du ${g.name.toLowerCase()} de votre véhicule`,
        })),
      };
    })
    .catch(() => null); // 🛡️ Fallback si hierarchy timeout ou erreur
}
