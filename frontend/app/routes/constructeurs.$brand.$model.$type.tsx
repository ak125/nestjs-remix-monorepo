// 🚗 Page détail véhicule - Logique métier PHP intégrée

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Car,
  Package,
  Shield,
  Truck,
  HeadphonesIcon,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Fuel,
  Gauge,
  Calendar,
  Info,
  Star,
  Award,
  RotateCcw,
  FileText,
} from "lucide-react";
import { useState, useEffect } from "react";
import { HtmlContent } from "../components/seo/HtmlContent";
import {
  catalogFamiliesApi,
  type CatalogFamily as ApiCatalogFamily,
} from "../services/api/catalog-families.api";
import { hierarchyApi } from "../services/api/hierarchy.api";
import { brandColorsService } from "../services/brand-colors.service";
import { ModelContentV1Display, type ModelContentV1Data } from "../components/model";

// 🔄 Cache mémoire simple pour éviter les rechargements inutiles
const loaderCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

// 📝 Types de données (structure PHP + API /full)
interface VehicleData {
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;
  marque_logo: string;
  marque_relfollow: number;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_name_meta: string;
  modele_relfollow: number;
  modele_pic?: string;
  type_id: number;
  type_alias: string;
  type_name: string;
  type_name_meta: string;
  type_power_ps: string;
  type_body: string;
  type_fuel: string;
  type_month_from: string;
  type_year_from: string;
  type_month_to: string | null;
  type_year_to: string | null;
  type_relfollow: number;
  power: string;
  date: string;
  // 🔧 Codes moteur (depuis API /full)
  motor_codes?: string[];
  motor_codes_formatted?: string;
  // 🔧 Types mines / CNIT (depuis API /full)
  mine_codes?: string[];
  mine_codes_formatted?: string;
  cnit_codes?: string[];
  cnit_codes_formatted?: string;
  // 📊 Données techniques formatées
  power_formatted?: string;
  cylinder_cm3?: number;
  production_date_formatted?: string;
}

interface CatalogFamily {
  mf_id: number;
  mf_name: string;
  mf_description: string;
  mf_pic: string;
  gammes: CatalogGamme[];
}

interface CatalogGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
}

interface PopularPart {
  cgc_pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_img: string;
  addon_content: string;
}

interface MetaTagsAriane {
  mta_id: number;
  mta_title: string;
  mta_descrip: string;
  mta_keywords: string;
  mta_ariane: string;
  mta_h1: string;
  mta_content: string;
  mta_alias: string;
  mta_relfollow: number;
}

interface SEOData {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  content: string;
  content2: string;
  robots: string;
  canonical: string;
}

interface LoaderData {
  vehicle: VehicleData;
  catalogFamilies: CatalogFamily[];
  popularParts: PopularPart[];
  seo: SEOData;
  breadcrumb: {
    items?: Array<{ name: string; url: string }>;
    // Legacy support
    brand: string;
    model: string;
    type: string;
  };
  // V1 Content - Encyclopedic content for model pages (optional)
  modelContentV1?: ModelContentV1Data | null;
}

// ⚡ Contrôle de revalidation pour éviter les rechargements inutiles
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate: _defaultShouldRevalidate,
}: any) {
  // Ne recharger que si l'URL change vraiment ou si c'est une soumission de formulaire
  if (formMethod && formMethod !== "GET") {
    return true;
  }

  // Ne recharger que si les paramètres de route changent
  return currentUrl.pathname !== nextUrl.pathname;
}

// 🔄 Loader avec logique métier PHP convertie
export async function loader({ params, request }: LoaderFunctionArgs) {
  // 🔍 Vérifier le cache d'abord
  const cacheKey = `${params.brand}-${params.model}-${params.type}`;
  const cached = loaderCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("✅ [CACHE HIT] Données véhicule en cache:", cacheKey);
    return json(cached.data);
  }

  console.log("🔄 Vehicle detail loader appelé avec params:", params);

  // Validation stricte des paramètres
  const { brand, model, type } = params;
  console.log("🔍 Paramètres destructurés:", { brand, model, type });

  if (!brand || !model || !type) {
    console.error("❌ Paramètres manquants:", { brand, model, type });
    throw new Response("Paramètres manquants", { status: 400 });
  }

  // ⚠️ Validation assouplie : brand et model doivent avoir un tiret, mais pas type
  // Type peut être soit "{alias}-{id}.html" soit juste "{id}.html"
  if (!brand.includes("-") || !model.includes("-")) {
    console.error("❌ Format de paramètres invalide pour brand/model");
    throw new Response("URL invalide", { status: 400 });
  }

  console.log(
    "✅ Tous les paramètres sont présents, génération des données...",
  );

  // === PARSING DES PARAMÈTRES (logique PHP adaptée) ===
  const brandParts = brand.split("-");
  const marque_id = parseInt(brandParts[brandParts.length - 1]) || 0;
  const marque_alias = brandParts.slice(0, -1).join("-");

  const modelParts = model.split("-");
  const modele_id = parseInt(modelParts[modelParts.length - 1]) || 0;
  const modele_alias = modelParts.slice(0, -1).join("-");

  // Type parsing: support des formats "{alias}-{id}.html" ET "{id}.html"
  const typeWithoutHtml = type.replace(".html", "");
  const typeParts = typeWithoutHtml.split("-");
  const type_id = parseInt(typeParts[typeParts.length - 1]) || 0;
  // 🔥 FIX: type_alias doit être SANS l'ID final
  const type_alias = typeParts.slice(0, -1).join("-") || typeWithoutHtml;

  // === APPEL API /full POUR RÉCUPÉRER TOUTES LES DONNÉES (codes moteur, mines, etc.) ===
  console.log(`🔍 Appel API /full pour type_id=${type_id}`);
  const baseUrl = process.env.BACKEND_URL || "http://localhost:3000";

  // 🛡️ ROBUSTESSE: Fetch avec retry pour éviter erreurs temporaires
  let vehicleResponse: Response | null = null;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries && !vehicleResponse?.ok) {
    try {
      vehicleResponse = await fetch(
        `${baseUrl}/api/vehicles/types/${type_id}/full`,
        {
          headers: { "internal-call": "true" },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (vehicleResponse.ok) break;
    } catch (error) {
      const currentRetry = ++retryCount;
      console.warn(
        `⚠️ [VEHICLE-API] Tentative ${currentRetry}/${maxRetries + 1} échouée:`,
        error,
      );

      if (currentRetry > maxRetries) {
        console.error("❌ [VEHICLE-API] Backend inaccessible après retries");
        throw new Response("Service temporairement indisponible", {
          status: 503,
          headers: { "Retry-After": "30" },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * currentRetry));
    }
  }

  if (!vehicleResponse?.ok) {
    console.error("❌ API error:", vehicleResponse?.status);
    throw new Response("Véhicule non trouvé", { status: 404 });
  }

  const apiData = await vehicleResponse.json();
  console.log("✅ Données API /full reçues:", JSON.stringify(apiData, null, 2));

  // === APPEL API POUR RÉCUPÉRER LES META TAGS ARIANE ===
  let metaTagsData: MetaTagsAriane | null = null;
  try {
    const metaTagsResponse = await fetch(
      `${baseUrl}/api/vehicles/meta-tags/${type_id}`,
      { headers: { "internal-call": "true" } },
    );

    if (metaTagsResponse.ok) {
      const metaTagsJson = await metaTagsResponse.json();
      metaTagsData = metaTagsJson.data;
      console.log("✅ Meta tags ariane trouvés:", metaTagsData);
    } else {
      console.log("ℹ️ Pas de meta tags ariane pour ce véhicule");
    }
  } catch (error) {
    console.log("⚠️ Erreur récupération meta tags:", error);
  }

  // === APPEL API POUR RÉCUPÉRER LE CONTENU V1 (encyclopédique) ===
  let modelContentV1: ModelContentV1Data | null = null;
  try {
    const v1Response = await fetch(
      `${baseUrl}/api/blog/model-content-v1/${marque_alias}/${modele_alias}`,
      { headers: { "internal-call": "true" } },
    );

    if (v1Response.ok) {
      const v1Json = await v1Response.json();
      if (v1Json.success && v1Json.data) {
        modelContentV1 = v1Json.data;
        console.log("✅ Contenu V1 trouvé pour:", marque_alias, modele_alias);
      }
    } else {
      console.log("ℹ️ Pas de contenu V1 pour ce modèle");
    }
  } catch (error) {
    console.log("⚠️ Erreur récupération contenu V1:", error);
  }

  // L'API /full retourne un objet plat (pas un tableau)
  const vehicleRecord = apiData.data;

  if (!vehicleRecord || !apiData.success) {
    console.error("❌ Aucun véhicule trouvé dans la réponse API /full:", apiData);
    throw new Response("Véhicule non trouvé", { status: 404 });
  }

  // === EXTRACTION DES DONNÉES (structure plate de l'API /full) ===
  const marque_name = vehicleRecord.marque_name;
  const marque_alias_api = vehicleRecord.marque_alias;
  const modele_name = vehicleRecord.modele_name;
  const modele_pic = vehicleRecord.modele_pic;
  const modele_alias_api = vehicleRecord.modele_alias;
  const type_name = vehicleRecord.type_name;
  const type_power_ps = vehicleRecord.type_power_ps;
  const type_fuel = vehicleRecord.type_fuel;
  const type_body = vehicleRecord.type_body;
  const type_month_from = vehicleRecord.type_month_from;
  const type_year_from = vehicleRecord.type_year_from;
  const type_month_to = vehicleRecord.type_month_to;
  const type_year_to = vehicleRecord.type_year_to;

  // 🔧 Codes moteur et types mines (nouveaux champs API /full)
  const motor_codes = vehicleRecord.motor_codes || [];
  const motor_codes_formatted = vehicleRecord.motor_codes_formatted || "";
  const mine_codes = vehicleRecord.mine_codes || [];
  const mine_codes_formatted = vehicleRecord.mine_codes_formatted || "";
  const cnit_codes = vehicleRecord.cnit_codes || [];
  const cnit_codes_formatted = vehicleRecord.cnit_codes_formatted || "";
  const power_formatted = vehicleRecord.power_formatted || "";
  const cylinder_cm3 = vehicleRecord.cylinder_cm3 || null;
  const production_date_formatted = vehicleRecord.production_date_formatted || "";

  // Vérification des données critiques
  if (!marque_name || !modele_name || !type_name || !type_power_ps) {
    console.error("❌ Données API /full incomplètes:", {
      marque_name,
      modele_name,
      type_name,
      type_power_ps,
      fullResponse: apiData,
    });
    throw new Response("Données véhicule incomplètes", { status: 500 });
  }

  // === FORMATAGE DE LA DATE (logique PHP exacte) ===
  let type_date = "";
  if (!type_year_to) {
    type_date = `du ${type_month_from}/${type_year_from}`;
  } else {
    type_date = `de ${type_year_from} à ${type_year_to}`;
  }

  // === DONNÉES VÉHICULE SELON STRUCTURE PHP (avec power et date pour affichage) ===
  const vehicleData: VehicleData = {
    marque_id,
    marque_alias: marque_alias_api || marque_alias, // Priorité aux données API
    marque_name,
    marque_name_meta: marque_name,
    marque_name_meta_title: marque_name,
    marque_logo: `${marque_alias_api || marque_alias}.webp`,
    marque_relfollow: 1,
    modele_id,
    modele_alias: modele_alias_api || modele_alias, // Priorité aux données API
    modele_name,
    modele_name_meta: modele_name,
    modele_relfollow: 1,
    modele_pic: modele_pic, // Nouveau champ pour l'image
    type_id,
    type_alias,
    type_name,
    type_name_meta: type_name,
    type_power_ps,
    type_body,
    type_fuel,
    type_month_from,
    type_year_from,
    type_month_to,
    type_year_to,
    type_relfollow: 1,
    power: type_power_ps,
    date: type_date,
    // 🔧 Codes moteur et types mines (depuis API /full)
    motor_codes,
    motor_codes_formatted,
    mine_codes,
    mine_codes_formatted,
    cnit_codes,
    cnit_codes_formatted,
    power_formatted,
    cylinder_cm3,
    production_date_formatted,
  };

  // === SYSTÈME SEO AVEC SWITCH DYNAMIQUE (logique PHP adaptée) ===
  const getSeoSwitch = (alias: number, typeId: number): string => {
    const switches: Record<number, string[]> = {
      1: ["à prix discount", "pas cher", "à mini prix", "en promotion"],
      2: ["et équipements", "et accessoires", "neuves", "d'origine"],
      10: [
        "Toutes les pièces auto",
        "Trouvez toutes les pièces",
        "Catalogue complet",
        "Pièces détachées",
      ],
      11: [
        "Toutes les références",
        "L'ensemble des pièces",
        "Toutes les gammes",
        "Tous les produits",
      ],
      12: [
        "nos fournisseurs certifiés",
        "nos partenaires agréés",
        "nos distributeurs",
        "nos fournisseurs",
      ],
    };

    const options = switches[alias] || [""];
    const index = typeId % options.length;
    return options[index];
  };

  // === META TAGS ARIANE - PRIORITÉ SUR LES VALEURS PAR DÉFAUT ===
  let seoTitle: string;
  let seoDescription: string;
  let seoKeywords: string;
  let h1: string;
  let content: string;
  let content2: string;

  if (metaTagsData) {
    // Utiliser les meta tags de la table ___meta_tags_ariane
    console.log("🏷️ Utilisation des meta tags ariane personnalisés");
    seoTitle =
      metaTagsData.mta_title ||
      `Pièces ${vehicleData.marque_name_meta_title} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta}`;
    seoDescription = metaTagsData.mta_descrip || "";
    seoKeywords =
      metaTagsData.mta_keywords ||
      `${vehicleData.marque_name_meta}, ${vehicleData.modele_name_meta}, ${vehicleData.type_name_meta}`;
    h1 =
      metaTagsData.mta_h1 ||
      `${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name} ${vehicleData.type_power_ps} ch ${type_date}`;
    content = metaTagsData.mta_content || "";
    content2 = ""; // La table n'a qu'un seul champ content
  } else {
    // SEO avec système de switch (reprend la logique PHP exacte)
    console.log(
      "📝 Génération des meta tags par défaut avec système de switch",
    );
    const comp_switch_title = getSeoSwitch(1, type_id);
    const comp_switch_desc = getSeoSwitch(2, type_id);
    const comp_switch_content1 = getSeoSwitch(10, type_id);
    const comp_switch_content2 = getSeoSwitch(11, type_id);
    const comp_switch_content3 = getSeoSwitch(12, type_id);

    seoTitle = `Pièces ${vehicleData.marque_name_meta_title} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta} ${comp_switch_title}`;
    seoDescription = `Catalogue pièces détachées pour ${vehicleData.marque_name_meta} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta} ${vehicleData.type_power_ps} ch ${type_date} neuves ${comp_switch_desc}`;
    seoKeywords = `${vehicleData.marque_name_meta}, ${vehicleData.modele_name_meta}, ${vehicleData.type_name_meta}, ${vehicleData.type_power_ps} ch, ${type_date}`;

    // H1 et contenu (logique PHP exacte)
    h1 = `${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name} ${vehicleData.type_power_ps} ch ${type_date}`;
    content = `${comp_switch_content1} pour le modèle <b>${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_body}</b> <strong>${type_date}</strong> de motorisation <strong>${vehicleData.type_name} ${vehicleData.type_power_ps}</strong> ch.`;
    content2 = `${comp_switch_content2} du catalogue sont compatibles au modèle de la voiture <strong>${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name}</strong> que vous avez sélectionné. Choisissez les pièces correspondantes à votre recherche dans les gammes disponibles et choisissez un article proposé par ${comp_switch_content3}.`;
  }

  // === GÉNÉRATION CANONIQUE (logique PHP) ===
  const canonicalLink = `https://domain.com/constructeurs/${vehicleData.marque_alias}-${vehicleData.marque_id}/${vehicleData.modele_alias}-${vehicleData.modele_id}/${vehicleData.type_alias}-${vehicleData.type_id}.html`;

  // === GÉNÉRATION DES CATALOGUES V3 HYBRIDE (approche optimisée 3-étapes) ===
  let catalogFamilies: CatalogFamily[] = [];
  let popularParts: PopularPart[] = [];
  let queryType = "UNKNOWN";
  let seoValid = false;
  let seoValidation = { familyCount: 0, gammeCount: 0, isIndexable: false };

  try {
    // 🚀 NOUVEAU V4: Service hybride ultime avec cache intelligent + requêtes parallèles
    console.log(
      `🚀 [V4 ULTIMATE] Récupération des familles pour type_id: ${type_id}...`,
    );
    const hybridResult =
      await catalogFamiliesApi.getCatalogFamiliesForVehicleV4(type_id);

    // Extraction des données hybrides
    catalogFamilies = hybridResult.catalog.map((family: ApiCatalogFamily) => ({
      mf_id: family.mf_id,
      mf_name: family.mf_name,
      mf_description:
        family.mf_description || `Système ${family.mf_name.toLowerCase()}`,
      mf_pic: family.mf_pic || `${family.mf_name.toLowerCase()}.webp`,
      gammes: family.gammes.map((gamme) => ({
        pg_id: gamme.pg_id,
        pg_alias: gamme.pg_alias,
        pg_name: gamme.pg_name,
      })),
    }));

    popularParts = hybridResult.popularParts.map((part: any) => ({
      cgc_pg_id: part.cgc_pg_id,
      pg_alias: part.pg_alias,
      pg_name: part.pg_name,
      pg_name_meta: part.pg_name_meta,
      pg_img: part.pg_img || "no.webp", // ✅ Ajout de la propriété manquante
      addon_content: part.addon_content,
    }));

    queryType = hybridResult.queryType;
    seoValid = hybridResult.seoValid;
    seoValidation = hybridResult.seoValidation;

    console.log(
      `✅ [V4 ULTIMATE] ${catalogFamilies.length} familles (${queryType}), ${popularParts.length} pièces populaires, SEO: ${seoValid}, Cache: ${hybridResult.performance?.source || "N/A"}`,
    );
  } catch (error) {
    console.error(
      "❌ [V4 ULTIMATE] Erreur, fallback vers données simulées:",
      error,
    );

    // Fallback vers les données simulées en cas d'erreur totale
    queryType = "SIMULATION_FALLBACK";
    seoValid = false;
    seoValidation = { familyCount: 0, gammeCount: 0, isIndexable: false };
    catalogFamilies = [
      {
        mf_id: 1,
        mf_name: "Freinage",
        mf_description: "Système de freinage",
        mf_pic: "freinage.webp",
        gammes: [
          {
            pg_id: 101,
            pg_alias: "disques-frein",
            pg_name: "Disques de frein",
          },
          {
            pg_id: 102,
            pg_alias: "plaquettes",
            pg_name: "Plaquettes de frein",
          },
        ],
      },
      {
        mf_id: 2,
        mf_name: "Moteur",
        mf_description: "Système moteur",
        mf_pic: "moteur.webp",
        gammes: [
          { pg_id: 201, pg_alias: "filtres-huile", pg_name: "Filtres à huile" },
          { pg_id: 202, pg_alias: "bougies", pg_name: "Bougies d'allumage" },
        ],
      },
    ];
  }

  // === VALIDATION ROBOTS (logique PHP avec données réelles de l'API) ===
  // 🎯 Utilise seoValidation depuis l'API au lieu des valeurs mock
  const realFamilyCount = seoValidation.familyCount;
  const realGammeCount = seoValidation.gammeCount;

  let pageRobots = "index, follow";
  let _relfollow = 1; // Préfixé avec _ pour indiquer intentionnellement inutilisé

  // Logique de validation SEO (exactement comme dans le PHP)
  if (
    vehicleData.marque_relfollow &&
    vehicleData.modele_relfollow &&
    vehicleData.type_relfollow
  ) {
    if (realFamilyCount < 3) {
      pageRobots = "noindex, nofollow";
      _relfollow = 0;
    } else if (realGammeCount < 5) {
      pageRobots = "noindex, nofollow";
      _relfollow = 0;
    }
  } else {
    pageRobots = "noindex, nofollow";
    _relfollow = 0;
  }

  console.log(
    `🔍 [SEO VALIDATION] familyCount=${realFamilyCount}, gammeCount=${realGammeCount}, robots=${pageRobots}`,
  );

  // === CONSTRUCTION DU CONTENU SEO ET DES DONNÉES ===
  const generateSeoContent = (
    pgName: string,
    vehicleData: VehicleData,
    typeId: number,
  ): string => {
    const switches = ["Achetez", "Trouvez", "Commandez", "Choisissez"];
    const qualities = ["d'origine", "de qualité", "certifiées", "garanties"];
    const switchIndex = typeId % switches.length;
    const qualityIndex = (typeId + 1) % qualities.length;

    return `${switches[switchIndex]} ${pgName} ${vehicleData.marque_name_meta} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta}, ${qualities[qualityIndex]} à prix bas.`;
  };

  // 🎯 Fallback pièces populaires si l'API V3 hybride n'en a pas fourni
  if (popularParts.length === 0) {
    console.log(
      "⚠️ [V3 HYBRIDE] Aucune pièce populaire reçue, génération fallback...",
    );

    try {
      const vehicleName = `${vehicleData.marque_name_meta} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta}`;
      popularParts = catalogFamiliesApi.generatePopularParts(
        catalogFamilies,
        vehicleName,
        type_id,
      );
      console.log(
        `✅ [FALLBACK] ${popularParts.length} pièces populaires générées depuis les familles`,
      );
    } catch (error) {
      console.error(
        "❌ [FALLBACK] Erreur génération pièces populaires:",
        error,
      );

      // Fallback manuel total
      popularParts = [
        {
          cgc_pg_id: 101,
          pg_alias: "disques-frein",
          pg_name: "Disques de frein",
          pg_name_meta: "disques de frein",
          pg_img: "disques-frein.webp",
          addon_content: generateSeoContent(
            "disques de frein",
            vehicleData,
            type_id,
          ),
        },
        {
          cgc_pg_id: 201,
          pg_alias: "filtres-huile",
          pg_name: "Filtres à huile",
          pg_name_meta: "filtres à huile",
          pg_img: "filtres-huile.webp",
          addon_content: generateSeoContent(
            "filtres à huile",
            vehicleData,
            type_id + 1,
          ),
        },
        {
          cgc_pg_id: 301,
          pg_alias: "amortisseurs",
          pg_name: "Amortisseurs",
          pg_name_meta: "amortisseurs",
          pg_img: "amortisseurs.webp",
          addon_content: generateSeoContent(
            "amortisseurs",
            vehicleData,
            type_id + 2,
          ),
        },
      ];
    }
  }

  // === CONSTRUCTION DES DONNÉES FINALES ===
  const loaderData: LoaderData = {
    vehicle: vehicleData,
    catalogFamilies,
    popularParts,
    seo: {
      title: seoTitle,
      description: seoDescription,
      keywords: seoKeywords,
      h1,
      content,
      content2,
      robots: pageRobots,
      canonical: canonicalLink,
    },
    breadcrumb: {
      items: [
        { name: "Accueil", url: "/" },
        { name: "Constructeurs", url: "/constructeurs" },
        {
          name: vehicleData.marque_name,
          url: `/constructeurs/${vehicleData.marque_alias}-${vehicleData.marque_id}.html`,
        },
        {
          name: `${vehicleData.modele_name} ${vehicleData.type_name}`,
          url: "",
        },
      ],
      // Legacy support
      brand: vehicleData.marque_name,
      model: vehicleData.modele_name,
      type: vehicleData.type_name,
    },
    // V1 Content - Encyclopedic content (optional, placed after catalog)
    modelContentV1,
  };

  console.log("✅ Données générées avec succès:", {
    vehicleData: vehicleData.marque_name + " " + vehicleData.modele_name,
    catalogFamiliesCount: catalogFamilies.length,
    popularPartsCount: popularParts.length,
  });

  console.log("✅ Données générées, mise en cache:", cacheKey);

  // Mettre en cache
  loaderCache.set(cacheKey, {
    data: loaderData,
    timestamp: Date.now(),
  });

  // Nettoyer les vieux caches (garder max 50 entrées)
  if (loaderCache.size > 50) {
    const oldestKey = Array.from(loaderCache.keys())[0];
    loaderCache.delete(oldestKey);
  }

  return json(loaderData);
}

// � Générer le breadcrumb structuré Schema.org
// 🚗 Génère le schema @graph complet: Car + BreadcrumbList
function generateVehicleSchema(vehicle: any, breadcrumb: any) {
  const baseUrl = "https://www.automecanik.com";
  const canonicalUrl = `${baseUrl}/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      // 1️⃣ Car - Véhicule complet avec toutes les specs
      {
        "@type": "Car",
        "@id": `${canonicalUrl}#vehicle`,
        name: `${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`,
        brand: { "@type": "Brand", name: vehicle.marque_name },
        manufacturer: { "@type": "Organization", name: vehicle.marque_name },
        model: vehicle.modele_name,
        vehicleConfiguration: vehicle.type_name,
        // 📅 Année modèle
        ...(vehicle.type_year_from && { vehicleModelDate: vehicle.type_year_from }),
        // 🔧 Moteur
        vehicleEngine: {
          "@type": "EngineSpecification",
          name: vehicle.type_name,
          ...(vehicle.type_power_ps && {
            enginePower: {
              "@type": "QuantitativeValue",
              value: parseInt(vehicle.type_power_ps),
              unitCode: "HP",
            },
          }),
        },
        // ⛽ Carburant
        ...(vehicle.type_fuel && { fuelType: vehicle.type_fuel }),
        // 🚗 Carrosserie
        ...(vehicle.type_body && { bodyType: vehicle.type_body }),
        // 📅 Période de production
        ...(vehicle.type_year_from && {
          additionalProperty: [{
            "@type": "PropertyValue",
            name: "Période de production",
            value: vehicle.type_year_to
              ? `${vehicle.type_year_from}-${vehicle.type_year_to}`
              : `depuis ${vehicle.type_year_from}`,
          }],
        }),
        url: canonicalUrl,
      },
      // 2️⃣ BreadcrumbList - Fil d'ariane
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: `${baseUrl}/` },
          { "@type": "ListItem", position: 2, name: "Constructeurs", item: `${baseUrl}/constructeurs` },
          { "@type": "ListItem", position: 3, name: breadcrumb.brand, item: `${baseUrl}/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html` },
          { "@type": "ListItem", position: 4, name: `${breadcrumb.model} ${breadcrumb.type}`, item: canonicalUrl },
        ],
      },
      // 3️⃣ Product avec AggregateOffer - Prix min/max des pièces pour SEO
      {
        "@type": "Product",
        "@id": `${canonicalUrl}#product`,
        name: `Pièces détachées ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`,
        description: `Catalogue de pièces auto pour ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}. Livraison rapide et garantie 1 an.`,
        brand: { "@type": "Brand", name: vehicle.marque_name },
        category: "Pièces automobiles",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: "4.50",
          highPrice: "500.00",
          offerCount: 100,
          availability: "https://schema.org/InStock",
          seller: {
            "@type": "Organization",
            name: "Automecanik",
            url: "https://www.automecanik.com",
          },
        },
      },
    ],
  };
}

// �🎯 Meta function avec SEO optimisé (logique PHP)
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Page non trouvée" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }

  return [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { name: "keywords", content: data.seo.keywords },
    { name: "robots", content: data.seo.robots },
    { name: "canonical", href: data.seo.canonical },
    { property: "og:title", content: data.seo.title },
    { property: "og:description", content: data.seo.description },
    { property: "og:type", content: "website" },
    // 🚗 JSON-LD @graph: Car + BreadcrumbList pour rich snippets Google
    {
      "script:ld+json": generateVehicleSchema(data.vehicle, data.breadcrumb),
    },
  ];
};

// 🎨 Composant principal avec logique PHP intégrée
export default function VehicleDetailPage() {
  const data = useLoaderData<LoaderData>();
  const { vehicle, catalogFamilies, popularParts, seo, breadcrumb, modelContentV1 } = data;

  // État pour gérer l'expansion des familles (comme page index)
  const [expandedFamilies, setExpandedFamilies] = useState<Set<number>>(
    new Set(),
  );

  console.log("🚗 Page véhicule rendue avec logique PHP:", {
    vehicle:
      vehicle.marque_name + " " + vehicle.modele_name + " " + vehicle.type_name,
    families: catalogFamilies.length,
    popular: popularParts.length,
    seoTitle: seo.title,
  });

  // Récupérer le gradient de marque dynamique
  const brandColor = brandColorsService.getBrandGradient(vehicle.marque_alias);
  const brandPrimary = brandColorsService.getBrandPrimaryColor(
    vehicle.marque_alias,
  );

  // State pour gérer l'erreur de chargement d'image
  const [imageError, setImageError] = useState(false);

  // 🎯 FAQ dynamique - état et données
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  // FAQ items dynamiques basés sur le véhicule
  const faqItems = [
    {
      question: `Quelles pièces sont compatibles avec ma ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name} ?`,
      answer: `Toutes les pièces proposées sur cette page sont 100% compatibles avec votre ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name} ${vehicle.type_power_ps} ch. Nous vérifions systématiquement la compatibilité avec les références constructeur.`,
    },
    {
      question: `Comment être sûr que la pièce correspond à mon ${vehicle.modele_name} ?`,
      answer: `Chaque pièce affichée est filtrée selon les caractéristiques exactes de votre véhicule : motorisation ${vehicle.type_name}, puissance ${vehicle.type_power_ps} ch, années ${vehicle.type_year_from}-${vehicle.type_year_to || "aujourd'hui"}. En cas de doute, notre service client peut vérifier la compatibilité avec votre numéro de châssis.`,
    },
    {
      question: `Quel est le délai de livraison pour les pièces ${vehicle.marque_name} ?`,
      answer: `La majorité des pièces pour ${vehicle.marque_name} ${vehicle.modele_name} sont expédiées sous 24-48h. Les pièces en stock sont livrées en 2-4 jours ouvrés. Pour les pièces sur commande, comptez 5-7 jours ouvrés.`,
    },
    {
      question: `Les pièces sont-elles garanties ?`,
      answer: `Oui, toutes nos pièces bénéficient d'une garantie de 1 an. Les pièces d'origine constructeur ${vehicle.marque_name} et les équipementiers premium (Bosch, Valeo, TRW...) sont garanties selon les conditions du fabricant.`,
    },
    {
      question: `Puis-je retourner une pièce si elle ne convient pas ?`,
      answer: `Absolument. Vous disposez de 30 jours pour retourner toute pièce non montée et dans son emballage d'origine. Le remboursement est effectué sous 5 jours ouvrés après réception.`,
    },
  ];

  // Effet pour afficher le CTA sticky au scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCta(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🍞 Fil d'Ariane - Au-dessus du hero */}
      <nav
        className="bg-white border-b border-gray-200 py-3"
        aria-label="Breadcrumb"
      >
        <div className="container mx-auto px-4">
          <ol
            className="flex items-center gap-2 text-sm"
            itemScope
            itemType="https://schema.org/BreadcrumbList"
          >
            <li
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              <a
                href="/"
                itemProp="item"
                className="hover:underline"
                style={{ color: brandPrimary }}
              >
                <span itemProp="name">Accueil</span>
              </a>
              <meta itemProp="position" content="1" />
            </li>
            <li>
              <span className="text-gray-400">→</span>
            </li>
            <li
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              <a
                href={`/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html`}
                itemProp="item"
                className="hover:underline"
                style={{ color: brandPrimary }}
              >
                <span itemProp="name">{breadcrumb.brand}</span>
              </a>
              <meta itemProp="position" content="2" />
            </li>
            <li>
              <span className="text-gray-400">→</span>
            </li>
            <li
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              <span itemProp="name" className="font-semibold text-gray-900">
                {breadcrumb.model} {breadcrumb.type}
              </span>
              <meta itemProp="position" content="3" />
            </li>
          </ol>
        </div>
      </nav>

      {/* 🚗 Hero Section - Design UI/UX Expert Premium */}
      <section
        className="relative overflow-hidden text-white py-8 md:py-10"
        style={brandColor}
      >
        {/* Effets d'arrière-plan optimisés */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.12) 0%, transparent 45%),
                           radial-gradient(circle at 80% 70%, rgba(0,0,0,0.18) 0%, transparent 45%)`,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute top-0 right-0 w-[700px] h-[700px] bg-white/[0.025] rounded-full blur-3xl animate-[pulse_15s_ease-in-out_infinite]"
          aria-hidden="true"
        ></div>

        <div className="relative z-10 container mx-auto px-4 max-w-7xl">
          {/* Hero Grid - Layout optimal */}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
            {/* Zone de contenu principale */}
            <div className="space-y-6">
              {/* Header typographique */}
              <header className="animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight mb-2 tracking-tight">
                  <span className="bg-gradient-to-br from-white via-white to-white/85 bg-clip-text text-transparent drop-shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                    {vehicle.marque_name} {vehicle.modele_name}{" "}
                    {vehicle.type_name} {vehicle.type_power_ps} ch de{" "}
                    {vehicle.type_year_from} à{" "}
                    {vehicle.type_year_to || "aujourd'hui"}
                  </span>
                </h1>
              </header>

              {/* Specs Grid - Badges horizontaux compacts */}
              <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 ease-out">
                {/* Carburant */}
                <div className="group bg-white/[0.12] backdrop-blur-2xl rounded-xl px-3 py-2 border border-white/25 shadow hover:bg-white/[0.16] hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⛽</span>
                    <span className="text-sm font-bold text-white">
                      {vehicle.type_fuel}
                    </span>
                  </div>
                </div>

                {/* Puissance */}
                <div className="group bg-gradient-to-br from-white/[0.22] via-white/[0.16] to-white/[0.08] backdrop-blur-2xl rounded-xl px-3 py-2 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    <div>
                      <div className="text-2xl font-black text-white leading-none">
                        {vehicle.type_power_ps}
                      </div>
                      <div className="text-white/70 text-[9px] uppercase tracking-wider font-bold">
                        chevaux
                      </div>
                    </div>
                  </div>
                </div>

                {/* Période */}
                <div className="group bg-white/[0.12] backdrop-blur-2xl rounded-xl px-3 py-2 border border-white/25 shadow hover:bg-white/[0.16] hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <span className="text-xs font-bold text-white whitespace-nowrap">
                      {vehicle.type_year_from}–{vehicle.type_year_to || "Auj."}
                    </span>
                  </div>
                </div>

                {/* Carrosserie */}
                <div className="group bg-white/[0.12] backdrop-blur-2xl rounded-xl px-3 py-2 border border-white/25 shadow hover:bg-white/[0.16] hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚗</span>
                    <span className="text-xs font-semibold text-white/95">
                      {vehicle.type_body}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Premium - Sidebar optimisée */}
            <div className="lg:sticky lg:top-8 animate-in fade-in slide-in-from-right-8 duration-700 delay-150 ease-out">
              <div className="relative group">
                {/* Effet halo lumineux */}
                <div className="absolute -inset-3 bg-gradient-to-br from-white/[0.22] via-white/[0.12] to-transparent rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-700"></div>

                {/* Container carte */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-white/[0.18] via-white/[0.12] to-white/[0.06] backdrop-blur-2xl rounded-2xl p-2.5 border border-white/30 shadow-[0_12px_48px_rgba(0,0,0,0.15)]">
                    <div className="relative overflow-hidden rounded-xl">
                      {!imageError &&
                      vehicle.modele_pic &&
                      vehicle.modele_pic !== "no.webp" ? (
                        <>
                          <img
                            src={`https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-concepts/${vehicle.marque_alias}/${vehicle.modele_pic}`}
                            alt={`${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name} - ${vehicle.type_year_from} à ${vehicle.type_year_to || "aujourd'hui"}`}
                            className="w-full h-52 object-cover group-hover:scale-[1.05] transition-transform duration-500 ease-out"
                            loading="eager"
                            onError={() => setImageError(true)}
                          />
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent"></div>
                        </>
                      ) : (
                        <div className="w-full h-52 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-col gap-2">
                          <Car
                            className="w-16 h-16 text-gray-400"
                            strokeWidth={1.5}
                            aria-label={`Image ${vehicle.marque_name} ${vehicle.modele_name} non disponible`}
                          />
                          <p className="text-xs text-gray-500 font-medium">
                            Image non disponible
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Description SEO (logique PHP avec switches) */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="prose max-w-none">
            <HtmlContent html={seo.content} trackLinks={true} />
            <HtmlContent html={seo.content2} trackLinks={true} />
          </div>
        </div>

        {/* 📦 CATALOGUE PRINCIPAL - Design inspiré de la page index */}
        {catalogFamilies.length > 0 && (
          <div className="mb-16">
            {/* Header impactant */}
            <div className="text-center mb-12 animate-in fade-in duration-700">
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">
                Catalogue de pièces auto
              </h2>
              <div className="h-1 w-16 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-6"></div>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto font-medium">
                Trouvez la pièce exacte pour votre{" "}
                <span className="font-bold" style={{ color: brandPrimary }}>
                  {vehicle.marque_name} {vehicle.modele_name}{" "}
                  {vehicle.type_name}
                </span>{" "}
                • {vehicle.type_power_ps} ch • {vehicle.type_year_from}-
                {vehicle.type_year_to || "Auj."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {catalogFamilies.map((family, index) => {
                const familyColor = hierarchyApi.getFamilyColor(
                  family as unknown as Parameters<
                    typeof hierarchyApi.getFamilyColor
                  >[0],
                );
                const familyImage = hierarchyApi.getFamilyImage(
                  family as unknown as Parameters<
                    typeof hierarchyApi.getFamilyImage
                  >[0],
                );
                const isExpanded = expandedFamilies.has(family.mf_id);
                const displayedGammes = isExpanded
                  ? family.gammes
                  : family.gammes.slice(0, 5);

                return (
                  <div
                    key={family.mf_id}
                    className="group bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 overflow-hidden"
                  >
                    {/* Image header avec gradient léger */}
                    <div
                      className={`relative h-36 overflow-hidden bg-gradient-to-br ${familyColor}`}
                    >
                      <img
                        src={familyImage}
                        alt={family.mf_name}
                        className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />

                      {/* Badge nombre de gammes */}
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-semibold text-gray-700 shadow-sm">
                        {family.gammes.length} pièces
                      </div>
                    </div>

                    {/* Titre */}
                    <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900 text-base">
                        {family.mf_name}
                      </h3>
                    </div>

                    {/* Liste des gammes - 5 premiers ou tous */}
                    <div className="p-4">
                      <div className="space-y-1.5 mb-3 max-h-80 overflow-y-auto">
                        {displayedGammes.map((gamme) => (
                          <a
                            key={gamme.pg_id}
                            href={`/pieces/${gamme.pg_alias}-${gamme.pg_id}/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`}
                            className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md px-2 py-1.5 transition-all duration-200 group/item"
                          >
                            <span className="w-1 h-1 bg-gray-400 rounded-full group-hover/item:bg-blue-600 transition-colors" />
                            <span className="font-medium line-clamp-1 flex-1">
                              {gamme.pg_name}
                            </span>
                            <svg
                              className="h-3 w-3 text-gray-400 opacity-0 group-hover/item:opacity-100 transition-opacity"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </a>
                        ))}
                      </div>

                      {/* Bouton voir plus/moins si > 5 gammes */}
                      {family.gammes.length > 5 && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedFamilies);
                            if (isExpanded) {
                              newExpanded.delete(family.mf_id);
                            } else {
                              newExpanded.add(family.mf_id);
                            }
                            setExpandedFamilies(newExpanded);
                          }}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-1.5"
                        >
                          {isExpanded ? (
                            <>
                              Voir moins
                              <svg
                                className="h-3 w-3 rotate-180"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </>
                          ) : (
                            <>
                              +{family.gammes.length - 5} pièces
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🔥 Pièces populaires - Design moderne amélioré */}
        {popularParts.length > 0 && (
          <div className="mb-12">
            {/* Header moderne avec gradient et stats */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 mb-8 border border-blue-100 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="p-3 rounded-xl shadow-lg"
                    style={{ backgroundColor: brandPrimary }}
                  >
                    <Award size={32} strokeWidth={2} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                      Pièces auto {vehicle.marque_name} les plus vendues
                    </h2>
                    <p className="text-gray-600 text-sm mt-1">
                      Top {popularParts.length} pièces certifiées pour{" "}
                      {vehicle.modele_name} {vehicle.type_name}
                    </p>
                  </div>
                </div>
                {/* Stats rapides */}
                <div className="flex gap-4">
                  <div className="text-center bg-white/70 backdrop-blur px-4 py-2 rounded-lg">
                    <div
                      className="text-2xl font-bold"
                      style={{ color: brandPrimary }}
                    >
                      {popularParts.length}
                    </div>
                    <div className="text-xs text-gray-500">Best-sellers</div>
                  </div>
                  <div className="text-center bg-white/70 backdrop-blur px-4 py-2 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      1 an
                    </div>
                    <div className="text-xs text-gray-500">Garantie</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {popularParts.map((part, index) => (
                <div
                  key={part.cgc_pg_id}
                  className="group bg-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 overflow-hidden relative"
                >
                  {/* Badge ranking */}
                  <div className="absolute top-3 left-3 z-20">
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-lg ${
                        index === 0
                          ? "bg-gradient-to-r from-yellow-400 to-amber-500"
                          : index === 1
                            ? "bg-gradient-to-r from-gray-400 to-slate-500"
                            : index === 2
                              ? "bg-gradient-to-r from-orange-400 to-amber-600"
                              : "bg-gray-600"
                      }`}
                    >
                      <Star size={12} fill="currentColor" />
                      <span>#{index + 1}</span>
                    </div>
                  </div>

                  {/* Badge "Populaire" */}
                  <div className="absolute top-3 right-3 z-10">
                    <div
                      className="px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-md flex items-center gap-1"
                      style={{ backgroundColor: brandPrimary }}
                    >
                      <CheckCircle size={12} />
                      <span>Compatible</span>
                    </div>
                  </div>

                  {/* Image gamme */}
                  <div className="p-6 bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
                    {part.pg_img && part.pg_img !== "no.webp" ? (
                      <img
                        src={`https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/${part.pg_img}`}
                        alt={part.pg_name_meta}
                        className="w-full h-36 object-contain rounded-lg group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget
                            .nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div className="hidden flex-col items-center justify-center w-full h-36 text-gray-400">
                      <Package size={48} strokeWidth={1.5} />
                      <span className="text-xs mt-2 text-gray-500">
                        Image indisponible
                      </span>
                    </div>
                  </div>

                  {/* Contenu */}
                  <div className="p-5 border-t border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-2 text-base line-clamp-2 min-h-[3rem] group-hover:text-blue-600 transition-colors">
                      {part.pg_name}
                    </h3>

                    <div className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[2.5rem]">
                      <HtmlContent
                        html={part.addon_content}
                        trackLinks={true}
                      />
                    </div>

                    {/* Badges de confiance mini */}
                    <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-full">
                        <Truck size={12} /> 24-48h
                      </span>
                      <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                        <Shield size={12} /> Garanti
                      </span>
                    </div>

                    {/* CTA moderne */}
                    <a
                      href={`/pieces/${part.pg_alias}-${part.cgc_pg_id}/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white transition-all hover:brightness-110 hover:shadow-lg group-hover:scale-[1.02] active:scale-[0.98]"
                      style={{ backgroundColor: brandPrimary }}
                    >
                      <span>Voir les pièces</span>
                      <span className="group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 📋 Fiche technique du véhicule */}
        <div className="mb-12">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Info size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Fiche technique</h2>
                  <p className="text-gray-300 text-sm">
                    {vehicle.marque_name} {vehicle.modele_name}{" "}
                    {vehicle.type_name}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${brandPrimary}20` }}
                  >
                    <Car size={20} style={{ color: brandPrimary }} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">
                      Carrosserie
                    </div>
                    <div className="font-semibold text-gray-900">
                      {vehicle.type_body || "Non spécifié"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${brandPrimary}20` }}
                  >
                    <Fuel size={20} style={{ color: brandPrimary }} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">
                      Carburant
                    </div>
                    <div className="font-semibold text-gray-900">
                      {vehicle.type_fuel || "Non spécifié"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${brandPrimary}20` }}
                  >
                    <Gauge size={20} style={{ color: brandPrimary }} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">
                      Puissance
                    </div>
                    <div className="font-semibold text-gray-900">
                      {vehicle.type_power_ps} ch
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${brandPrimary}20` }}
                  >
                    <Calendar size={20} style={{ color: brandPrimary }} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase">
                      Période
                    </div>
                    <div className="font-semibold text-gray-900">
                      {vehicle.type_year_from} -{" "}
                      {vehicle.type_year_to || "aujourd'hui"}
                    </div>
                  </div>
                </div>
                {/* 🔧 Code(s) moteur - COMMENTÉ: En attente import table link_typ_eng (liaison type_id ↔ eng_id)
                {vehicle.motor_codes_formatted && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${brandPrimary}20` }}
                    >
                      <Cog size={20} style={{ color: brandPrimary }} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase">
                        Code(s) Moteur
                      </div>
                      <div className="font-semibold text-gray-900">
                        {vehicle.motor_codes_formatted}
                      </div>
                    </div>
                  </div>
                )}
                */}
                {/* 🔧 Type Mine / CNIT - affiché uniquement si disponible */}
                {(vehicle.mine_codes_formatted ||
                  vehicle.cnit_codes_formatted) && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${brandPrimary}20` }}
                    >
                      <FileText size={20} style={{ color: brandPrimary }} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase">
                        Type Mine / CNIT
                      </div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {vehicle.mine_codes_formatted}
                        {vehicle.mine_codes_formatted &&
                          vehicle.cnit_codes_formatted &&
                          " / "}
                        {vehicle.cnit_codes_formatted}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ❓ FAQ dynamique avec Schema.org */}
        <div className="mb-12">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: brandPrimary }}
                >
                  <HeadphonesIcon size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Questions fréquentes
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Tout savoir sur les pièces pour votre {vehicle.modele_name}
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ Schema.org JSON-LD */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: faqItems.map((item) => ({
                    "@type": "Question",
                    name: item.question,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: item.answer,
                    },
                  })),
                }),
              }}
            />

            <div className="divide-y divide-gray-100">
              {faqItems.map((item, index) => (
                <div key={index} className="group">
                  <button
                    onClick={() =>
                      setOpenFaqIndex(openFaqIndex === index ? null : index)
                    }
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-900 pr-4">
                      {item.question}
                    </span>
                    <div
                      className="flex-shrink-0 p-1 rounded-full"
                      style={{
                        backgroundColor:
                          openFaqIndex === index ? brandPrimary : "#e5e7eb",
                      }}
                    >
                      {openFaqIndex === index ? (
                        <ChevronUp size={18} className="text-white" />
                      ) : (
                        <ChevronDown size={18} className="text-gray-500" />
                      )}
                    </div>
                  </button>
                  {openFaqIndex === index && (
                    <div className="px-5 pb-5 text-gray-600 animate-in slide-in-from-top-2 duration-200">
                      <div
                        className="pl-4 border-l-2"
                        style={{ borderColor: brandPrimary }}
                      >
                        {item.answer}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 📚 Contenu V1 - Guide encyclopédique du modèle (APRÈS catalogue et FAQ) */}
        {modelContentV1 && (
          <div className="mb-12">
            <ModelContentV1Display
              content={modelContentV1}
              collapsedByDefault={false}
            />
          </div>
        )}

        {/* 🛡️ Badges de confiance */}
        <div className="mb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex p-3 rounded-full bg-green-100 mb-3">
                <Shield size={28} className="text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900">Garantie 1 an</h3>
              <p className="text-sm text-gray-500 mt-1">
                Sur toutes nos pièces
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex p-3 rounded-full bg-blue-100 mb-3">
                <Truck size={28} className="text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900">Livraison 24-48h</h3>
              <p className="text-sm text-gray-500 mt-1">Expédition rapide</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex p-3 rounded-full bg-purple-100 mb-3">
                <HeadphonesIcon size={28} className="text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900">Conseil expert</h3>
              <p className="text-sm text-gray-500 mt-1">Service client dédié</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex p-3 rounded-full bg-orange-100 mb-3">
                <RotateCcw size={28} className="text-orange-600" />
              </div>
              <h3 className="font-bold text-gray-900">Retour 30 jours</h3>
              <p className="text-sm text-gray-500 mt-1">
                Satisfait ou remboursé
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 CTA Sticky - Apparaît au scroll */}
      {showStickyCta && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl py-3 px-4 animate-in slide-in-from-bottom duration-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:flex items-center gap-3">
              <Car size={24} style={{ color: brandPrimary }} />
              <div>
                <div className="font-bold text-gray-900 text-sm">
                  {vehicle.marque_name} {vehicle.modele_name}
                </div>
                <div className="text-xs text-gray-500">
                  {vehicle.type_name} - {vehicle.type_power_ps} ch
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-1 sm:flex-none">
              <a
                href="#catalogue"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:brightness-110 hover:shadow-lg"
                style={{ backgroundColor: brandPrimary }}
              >
                <Package size={18} />
                <span>Voir le catalogue</span>
              </a>
              <a
                href="/contact"
                className="hidden md:flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border-2 transition-all hover:bg-gray-50"
                style={{ borderColor: brandPrimary, color: brandPrimary }}
              >
                <HeadphonesIcon size={18} />
                <span>Assistance</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer avec liens utiles */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Navigation</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <a href="/" className="hover:text-blue-300">
                    Accueil
                  </a>
                </li>
                <li>
                  <a
                    href={`/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html`}
                    className="hover:text-blue-300"
                  >
                    Modèles {vehicle.marque_name}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Informations véhicule</h4>
              <ul className="space-y-1 text-sm">
                <li>Marque: {vehicle.marque_name}</li>
                <li>Modèle: {vehicle.modele_name}</li>
                <li>Motorisation: {vehicle.type_name}</li>
                <li>Puissance: {vehicle.type_power_ps} ch</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Assistance</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <a href="/contact" className="hover:text-blue-300">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="/aide" className="hover:text-blue-300">
                    Aide
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// 🔥 Error Boundary pour capturer les erreurs de rendu
export function ErrorBoundary() {
  console.error("🔥🔥🔥 ERROR BOUNDARY TRIGGERED 🔥🔥🔥");
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          ❌ Erreur de chargement de la page véhicule
        </h1>
        <p className="text-gray-700 mb-4">
          Une erreur s'est produite lors du chargement des informations du
          véhicule.
        </p>
        <div className="bg-gray-100 p-4 rounded">
          <p className="text-sm text-gray-600">
            Vérifiez la console pour plus de détails.
          </p>
        </div>
        <div className="mt-6">
          <a
            href="/constructeurs"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Retour aux constructeurs
          </a>
        </div>
      </div>
    </div>
  );
}
