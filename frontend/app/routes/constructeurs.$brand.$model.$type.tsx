// 🚗 Page détail véhicule - Logique métier PHP intégrée
//
// Rôle SEO : R1 - ROUTER
// Intention : Sélection de pièces pour un véhicule spécifique

import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
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
import { Error404, Error410 } from "../components/errors";
import {
  ModelContentV1Display,
  type ModelContentV1Data,
} from "../components/model";
import { HtmlContent } from "../components/seo/HtmlContent";
import { hierarchyApi } from "../services/api/hierarchy.api";
import { brandColorsService } from "../services/brand-colors.service";
import { stripHtmlForMeta } from "../utils/seo-clean.utils";
import { normalizeTypeAlias } from "../utils/url-builder.utils";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "constructeurs",
  }),
};

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

interface _MetaTagsAriane {
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

// ========================================
// 🚀 RPC OPTIMISÉ - Transformation des données
// ========================================

/**
 * Transforme la réponse RPC en LoaderData
 * Compatible avec la structure existante de la page
 */
function transformRpcToLoaderData(
  rpcData: any,
  params: { brand: string; model: string; type: string },
): LoaderData {
  const v = rpcData.vehicle;
  const seoCustom = rpcData.seo_custom;

  // Parsing des paramètres URL (pour fallback)
  const brandParts = params.brand.split("-");
  const marque_id = parseInt(brandParts[brandParts.length - 1]) || 0;
  const marque_alias = brandParts.slice(0, -1).join("-");

  const modelParts = params.model.split("-");
  const modele_id = parseInt(modelParts[modelParts.length - 1]) || 0;
  const modele_alias = modelParts.slice(0, -1).join("-");

  const typeWithoutHtml = params.type.replace(".html", "");
  const typeParts = typeWithoutHtml.split("-");
  const type_id = parseInt(typeParts[typeParts.length - 1]) || 0;

  // Formatage de la date (logique PHP)
  let type_date = "";
  if (!v.type_year_to) {
    type_date = `du ${v.type_month_from}/${v.type_year_from}`;
  } else {
    type_date = `de ${v.type_year_from} à ${v.type_year_to}`;
  }

  // Données véhicule
  const vehicleData: VehicleData = {
    marque_id: v.marque_id || marque_id,
    marque_alias: v.marque_alias || marque_alias,
    marque_name: v.marque_name,
    marque_name_meta: v.marque_name_meta || v.marque_name,
    marque_name_meta_title: v.marque_name_meta_title || v.marque_name,
    marque_logo: v.marque_logo || `${v.marque_alias}.webp`,
    marque_relfollow: v.marque_relfollow || 1,
    modele_id: v.modele_id || modele_id,
    modele_alias: v.modele_alias || modele_alias,
    modele_name: v.modele_name,
    modele_name_meta: v.modele_name_meta || v.modele_name,
    modele_relfollow: v.modele_relfollow || 1,
    modele_pic: v.modele_pic,
    type_id: v.type_id || type_id,
    type_alias: normalizeTypeAlias(v.type_alias, v.type_name),
    type_name: v.type_name,
    type_name_meta: v.type_name_meta || v.type_name,
    type_power_ps: v.type_power_ps,
    type_body: v.type_body,
    type_fuel: v.type_fuel,
    type_month_from: v.type_month_from,
    type_year_from: v.type_year_from,
    type_month_to: v.type_month_to,
    type_year_to: v.type_year_to,
    type_relfollow: v.type_relfollow || 1,
    power: v.type_power_ps,
    date: type_date,
    motor_codes: rpcData.motor_codes || [],
    motor_codes_formatted: (rpcData.motor_codes || []).join(", "),
    mine_codes: rpcData.mine_codes || [],
    mine_codes_formatted: (rpcData.mine_codes || []).join(", "),
    cnit_codes: rpcData.cnit_codes || [],
    cnit_codes_formatted: (rpcData.cnit_codes || []).join(", "),
    power_formatted: v.type_power_ps ? `${v.type_power_ps} ch` : "",
    cylinder_cm3: v.type_liter
      ? Math.round(parseFloat(v.type_liter) * 1000)
      : undefined,
    production_date_formatted: type_date,
  };

  // Système SEO avec switch dynamique
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
    return options[typeId % options.length];
  };

  // SEO (priorité aux données personnalisées)
  let seoTitle: string;
  let seoDescription: string;
  let seoKeywords: string;
  let h1: string;
  let content: string;
  let content2: string;

  if (seoCustom) {
    seoTitle =
      seoCustom.mta_title ||
      `Pièces ${vehicleData.marque_name_meta_title} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta}`;
    seoDescription = seoCustom.mta_descrip || "";
    seoKeywords =
      seoCustom.mta_keywords ||
      `${vehicleData.marque_name_meta}, ${vehicleData.modele_name_meta}, ${vehicleData.type_name_meta}`;
    h1 =
      seoCustom.mta_h1 ||
      `${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name} ${vehicleData.type_power_ps} ch ${type_date}`;
    content = seoCustom.mta_content || "";
    content2 = "";
  } else {
    const comp_switch_title = getSeoSwitch(1, type_id);
    const comp_switch_desc = getSeoSwitch(2, type_id);
    const comp_switch_content1 = getSeoSwitch(10, type_id);
    const comp_switch_content2 = getSeoSwitch(11, type_id);
    const comp_switch_content3 = getSeoSwitch(12, type_id);

    seoTitle = `Pièces ${vehicleData.marque_name_meta_title} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta} ${comp_switch_title}`;
    seoDescription = `Catalogue pièces détachées pour ${vehicleData.marque_name_meta} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta} ${vehicleData.type_power_ps} ch ${type_date} neuves ${comp_switch_desc}`;
    seoKeywords = `${vehicleData.marque_name_meta}, ${vehicleData.modele_name_meta}, ${vehicleData.type_name_meta}, ${vehicleData.type_power_ps} ch, ${type_date}`;
    h1 = `${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name} ${vehicleData.type_power_ps} ch ${type_date}`;
    content = `${comp_switch_content1} pour le modèle <b>${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_body}</b> <strong>${type_date}</strong> de motorisation <strong>${vehicleData.type_name} ${vehicleData.type_power_ps}</strong> ch.`;
    content2 = `${comp_switch_content2} du catalogue sont compatibles au modèle de la voiture <strong>${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name}</strong> que vous avez sélectionné. Choisissez les pièces correspondantes à votre recherche dans les gammes disponibles et choisissez un article proposé par ${comp_switch_content3}.`;
  }

  // Canonical URL (uses normalizeTypeAlias to handle null, empty, or "null" string values)
  const canonicalLink = `https://www.automecanik.com/constructeurs/${vehicleData.marque_alias}-${vehicleData.marque_id}/${vehicleData.modele_alias}-${vehicleData.modele_id}/${vehicleData.type_alias}-${vehicleData.type_id}.html`;

  // Catalogue (depuis RPC)
  const catalogFamilies: CatalogFamily[] = (
    rpcData.catalog?.families || []
  ).map((f: any) => ({
    mf_id: parseInt(f.mf_id),
    mf_name: f.mf_name,
    mf_description: f.mf_description || `Système ${f.mf_name.toLowerCase()}`,
    mf_pic: f.mf_pic || `${f.mf_name.toLowerCase()}.webp`,
    gammes: (f.gammes || []).map((g: any) => ({
      pg_id: g.pg_id,
      pg_alias: g.pg_alias,
      pg_name: g.pg_name,
    })),
  }));

  // Pièces populaires (depuis RPC)
  const generateSeoContent = (
    pgName: string,
    vd: VehicleData,
    tid: number,
  ): string => {
    const switches = ["Achetez", "Trouvez", "Commandez", "Choisissez"];
    const qualities = ["d'origine", "de qualité", "certifiées", "garanties"];
    return `${switches[tid % switches.length]} ${pgName} ${vd.marque_name_meta} ${vd.modele_name_meta} ${vd.type_name_meta}, ${qualities[(tid + 1) % qualities.length]} à prix bas.`;
  };

  const popularParts: PopularPart[] = (rpcData.popular_parts || []).map(
    (p: any, idx: number) => ({
      cgc_pg_id: p.pg_id,
      pg_alias: p.pg_alias,
      pg_name: p.pg_name,
      pg_name_meta: p.pg_name_meta || p.pg_name.toLowerCase(),
      pg_img: p.pg_img || "no.webp",
      addon_content: generateSeoContent(p.pg_name, vehicleData, type_id + idx),
    }),
  );

  // Validation SEO pour robots
  const seoValidation = rpcData.seo_validation || {};
  let pageRobots = "index, follow";
  if (!seoValidation.is_indexable) {
    pageRobots = "noindex, nofollow";
  }

  // Blog content - RPC returns simple bsm_* fields, but ModelContentV1Data expects full structure
  // For now, set to null. To get full model content, a separate API call would be needed.
  const modelContentV1: ModelContentV1Data | null = null;

  return {
    vehicle: vehicleData,
    catalogFamilies,
    popularParts,
    seo: {
      title: seoTitle,
      description: stripHtmlForMeta(seoDescription),
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
      brand: vehicleData.marque_name,
      model: vehicleData.modele_name,
      type: vehicleData.type_name,
    },
    modelContentV1,
  };
}

// 🚀 Loader optimisé avec RPC (remplace 4 appels API → 1 seul)
export async function loader({ params }: LoaderFunctionArgs) {
  // 🔍 Vérifier le cache mémoire d'abord
  const cacheKey = `${params.brand}-${params.model}-${params.type}`;
  const cached = loaderCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("✅ [CACHE HIT] Données véhicule en cache:", cacheKey);
    return json(cached.data);
  }

  console.log("🚀 [RPC] Vehicle detail loader avec params:", params);

  // Validation des paramètres
  const { brand, model, type } = params;

  if (!brand || !model || !type) {
    console.error("❌ Paramètres manquants:", { brand, model, type });
    throw new Response("Paramètres manquants", { status: 400 });
  }

  // 🔄 SEO: URLs legacy sans ID (ex: /constructeurs/mazda/mazda-6/...) → 301 redirect
  // Raison: 412 est traité comme 4xx par Google → désindexation
  // 301 préserve le PageRank et guide vers la page marque existante
  if (!brand.includes("-") || !model.includes("-")) {
    console.log("🔄 [301] Format legacy détecté, redirect vers page marque:", {
      brand,
      model,
      type,
    });

    // Extraire le nom de la marque (sans ID si présent)
    const brandAlias = brand.replace(/-\d+$/, "").toLowerCase();

    // 301 redirect vers la page marque principale
    return redirect(`/constructeurs/${brandAlias}.html`, 301);
  }

  // Parsing du type_id
  const typeWithoutHtml = type.replace(".html", "");
  const typeParts = typeWithoutHtml.split("-");
  const type_id = parseInt(typeParts[typeParts.length - 1]) || 0;

  const baseUrl = getInternalApiUrl("");

  // ========================================
  // 🚀 APPEL RPC OPTIMISÉ (1 seul appel au lieu de 4)
  // ========================================
  console.log(`⚡ [RPC] Appel page-data-rpc pour type_id=${type_id}`);

  let rpcResponse: Response;
  let rpcResult: any;

  try {
    rpcResponse = await fetch(
      `${baseUrl}/api/vehicles/types/${type_id}/page-data-rpc`,
      {
        headers: { "internal-call": "true" },
        signal: AbortSignal.timeout(10000), // 10s timeout (augmenté de 5s pour fiabilité)
      },
    );

    if (!rpcResponse.ok) {
      console.error(
        `❌ [RPC] Erreur HTTP ${rpcResponse.status} pour type_id=${type_id}`,
      );
      throw new Response("Service indisponible", { status: 500 });
    }

    rpcResult = await rpcResponse.json();
  } catch (error) {
    // Gestion spécifique des timeouts - retourne 503 pour que Google réessaye
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      console.error(`⏱️ [RPC] Timeout 10s pour type_id=${type_id}`);
      throw new Response("Service temporairement indisponible", {
        status: 503,
      });
    }
    // Re-throw Response errors (déjà formatés)
    if (error instanceof Response) {
      throw error;
    }
    // Autres erreurs
    console.error(`❌ [RPC] Erreur fetch pour type_id=${type_id}:`, error);
    throw new Response("Erreur serveur", { status: 500 });
  }

  if (!rpcResult.success || !rpcResult.data?.vehicle) {
    console.error("❌ [RPC] Données invalides:", rpcResult);
    throw new Response("Véhicule supprimé du catalogue", { status: 410 });
  }

  console.log(
    `✅ [RPC] Données reçues en ${rpcResult._performance?.totalTime?.toFixed(0) || "N/A"}ms`,
  );

  // ========================================
  // 🔄 CANONICALIZATION: 301 redirect si URL non-canonique
  // ========================================
  const v = rpcResult.data.vehicle;
  const canonicalTypeAlias = normalizeTypeAlias(v.type_alias, v.type_name);
  const urlTypeAlias = typeParts.slice(0, -1).join("-"); // Tout sauf l'ID

  // Si l'alias dans l'URL ne correspond pas à l'alias canonique → 301
  if (urlTypeAlias && urlTypeAlias !== canonicalTypeAlias) {
    const canonicalUrl = `/constructeurs/${brand}/${model}/${canonicalTypeAlias}-${type_id}.html`;
    console.log(
      `🔄 [301] Redirect "${urlTypeAlias}" → "${canonicalTypeAlias}"`,
    );
    return redirect(canonicalUrl, 301);
  }

  // ========================================
  // 🔄 TRANSFORMATION RPC → LoaderData
  // ========================================
  const loaderData = transformRpcToLoaderData(rpcResult.data, {
    brand,
    model,
    type,
  });

  // Mettre en cache mémoire
  loaderCache.set(cacheKey, {
    data: loaderData,
    timestamp: Date.now(),
  });

  // Nettoyer les vieux caches (garder max 50 entrées)
  if (loaderCache.size > 50) {
    const oldestKey = Array.from(loaderCache.keys())[0];
    loaderCache.delete(oldestKey);
  }

  console.log("✅ [RPC] Données générées:", {
    vehicle: `${loaderData.vehicle.marque_name} ${loaderData.vehicle.modele_name}`,
    families: loaderData.catalogFamilies.length,
    parts: loaderData.popularParts.length,
  });

  return json(loaderData);
}

// 🚗 Générer le breadcrumb structuré Schema.org
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
        ...(vehicle.type_year_from && {
          vehicleModelDate: vehicle.type_year_from,
        }),
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
          additionalProperty: [
            {
              "@type": "PropertyValue",
              name: "Période de production",
              value: vehicle.type_year_to
                ? `${vehicle.type_year_from}-${vehicle.type_year_to}`
                : `depuis ${vehicle.type_year_from}`,
            },
          ],
        }),
        url: canonicalUrl,
      },
      // 2️⃣ BreadcrumbList - Fil d'ariane
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: `${baseUrl}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Constructeurs",
            item: `${baseUrl}/constructeurs`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: breadcrumb.brand,
            item: `${baseUrl}/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html`,
          },
          {
            "@type": "ListItem",
            position: 4,
            name: `${breadcrumb.model} ${breadcrumb.type}`,
            item: canonicalUrl,
          },
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

// 🎯 Meta function avec SEO optimisé (logique PHP)
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Page non trouvée" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }

  const result: any[] = [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { name: "keywords", content: data.seo.keywords },
    { name: "robots", content: data.seo.robots },
    { tagName: "link", rel: "canonical", href: data.seo.canonical },
    { property: "og:title", content: data.seo.title },
    { property: "og:description", content: data.seo.description },
    { property: "og:type", content: "website" },
    // 🚗 JSON-LD @graph: Car + BreadcrumbList pour rich snippets Google
    {
      "script:ld+json": generateVehicleSchema(data.vehicle, data.breadcrumb),
    },
  ];

  // ✅ Migration /img/* : Preload via proxy Caddy
  if (data.vehicle?.modele_pic && data.vehicle.modele_pic !== "no.webp") {
    result.push({
      tagName: "link",
      rel: "preload",
      as: "image",
      href: `/img/uploads/constructeurs-automobiles/marques-modeles/${data.vehicle.marque_alias}/${data.vehicle.modele_pic}`,
    });
  }

  return result;
};

// 🎨 Composant principal avec logique PHP intégrée
export default function VehicleDetailPage() {
  const data = useLoaderData<any>(); // any pour supporter LoaderData et 412 response

  // ⚠️ Tous les hooks doivent être appelés avant tout return conditionnel
  const [expandedFamilies, setExpandedFamilies] = useState<Set<number>>(
    new Set(),
  );
  const [imageError, setImageError] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  // Effet pour afficher le CTA sticky au scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCta(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const {
    vehicle,
    catalogFamilies,
    popularParts,
    seo,
    breadcrumb,
    modelContentV1,
  } = data as LoaderData;

  // Récupérer le gradient de marque dynamique
  const brandColor = brandColorsService.getBrandGradient(vehicle.marque_alias);
  const _brandPrimary = brandColorsService.getBrandPrimaryColor(
    vehicle.marque_alias,
  );

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

  return (
    <div
      className="min-h-screen bg-gray-50"
      data-brand={vehicle.marque_alias?.toLowerCase()}
    >
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
                className="hover:underline text-brand"
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
                className="hover:underline text-brand"
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
                            src={`/img/uploads/constructeurs-automobiles/marques-modeles/${vehicle.marque_alias}/${vehicle.modele_pic}`}
                            alt={`${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name} - ${vehicle.type_year_from} à ${vehicle.type_year_to || "aujourd'hui"}`}
                            width={400}
                            height={208}
                            className="w-full h-52 object-cover group-hover:scale-[1.05] transition-transform duration-500 ease-out"
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
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
                <span className="font-bold text-brand">
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
                  <div className="p-3 rounded-xl shadow-lg bg-brand">
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
                    <div className="text-2xl font-bold text-brand">
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
                    <div className="px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-md flex items-center gap-1 bg-brand">
                      <CheckCircle size={12} />
                      <span>Compatible</span>
                    </div>
                  </div>

                  {/* Image gamme */}
                  <div className="p-6 bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
                    {part.pg_img && part.pg_img !== "no.webp" ? (
                      <img
                        src={`/img/uploads/articles/gammes-produits/catalogue/${part.pg_img}`}
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
                    {/* eslint-disable-next-line no-restricted-syntax -- Intentional hidden fallback */}
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
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white transition-all hover:brightness-110 hover:shadow-lg group-hover:scale-[1.02] active:scale-[0.98] bg-brand"
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
                  <div className="p-2 rounded-lg bg-brand-light">
                    <Car size={20} className="text-brand" />
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
                  <div className="p-2 rounded-lg bg-brand-light">
                    <Fuel size={20} className="text-brand" />
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
                  <div className="p-2 rounded-lg bg-brand-light">
                    <Gauge size={20} className="text-brand" />
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
                  <div className="p-2 rounded-lg bg-brand-light">
                    <Calendar size={20} className="text-brand" />
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
                {/* 🔧 Type Mine / CNIT - affiché uniquement si disponible */}
                {(vehicle.mine_codes_formatted ||
                  vehicle.cnit_codes_formatted) && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="p-2 rounded-lg bg-brand-light">
                      <FileText size={20} className="text-brand" />
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
                <div className="p-2 rounded-lg bg-brand">
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
                      className={`flex-shrink-0 p-1 rounded-full ${openFaqIndex === index ? "bg-brand" : "bg-gray-200"}`}
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
                      <div className="pl-4 border-l-2 border-brand">
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
              <Car size={24} className="text-brand" />
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
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:brightness-110 hover:shadow-lg bg-brand"
              >
                <Package size={18} />
                <span>Voir le catalogue</span>
              </a>
              <a
                href="/contact"
                className="hidden md:flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border-2 transition-all hover:bg-gray-50 border-brand text-brand"
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
  const error = useRouteError();

  // Handle 410 - Vehicle removed from catalog (SEO: Google will deindex faster)
  if (isRouteErrorResponse(error) && error.status === 410) {
    return (
      <Error410
        url={typeof window !== "undefined" ? window.location.href : undefined}
      />
    );
  }

  // Handle 404 - Generic not found
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <Error404
        url={typeof window !== "undefined" ? window.location.href : undefined}
      />
    );
  }

  // Generic error for other cases
  console.error("🔥 ERROR BOUNDARY:", error);
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
