// 🚗 Page détail véhicule - Logique métier PHP intégrée
//
// Rôle SEO : R8 - VEHICLE (sélection pièces pour un véhicule spécifique)
// Intention : Sélection de pièces pour un véhicule spécifique

import {
  defer,
  redirect,
  type LinksFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  type ShouldRevalidateFunctionArgs,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import {
  Award,
  Car,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  HeadphonesIcon,
  Info,
  Package,
  RotateCcw,
  Search,
  Shield,
  Star,
  Truck,
} from "lucide-react";
import { useState, useEffect } from "react";
import brandColorsStyles from "~/styles/brand-colors.css?url";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { ErrorGeneric } from "../components/errors";
import { ModelContentV1Display } from "../components/model";
import { HtmlContent } from "../components/seo/HtmlContent";
import {
  AntiErrorsSection,
  BreadcrumbSection,
  FAMILY_MICRO_DESCRIPTIONS,
  generateVehicleSchema,
  HeroSection,
  HowtoSection,
  R8EnrichedSection,
  SeoIntroSection,
  transformRpcToLoaderData,
  TrustSection,
  type LoaderData,
} from "../components/vehicle/r8";
import { hierarchyApi } from "../services/api/hierarchy.api";
import { brandColorsService } from "../services/brand-colors.service";
import { isValidImagePath } from "../utils/image-optimizer";
import { detectMalformedSegment } from "../utils/pieces-route.utils";
import { normalizeTypeAlias } from "../utils/url-builder.utils";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R8_VEHICLE, {
    clusterId: "constructeurs",
  }),
};

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: brandColorsStyles },
];

// 🔄 Cache mémoire simple pour éviter les rechargements inutiles
const loaderCache = new Map<string, { data: LoaderData; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

// 📡 INC-2026-007 — Comble le blindspot __error_logs : notifie le backend
// avant chaque throw 503 du loader. Fire-and-forget, jamais bloquant.
async function notify503ToErrorLog(
  url: string,
  subject: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) return;

  try {
    await fetch(`${getInternalApiUrl("")}/api/internal/error-log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": internalKey,
      },
      body: JSON.stringify({
        status: 503,
        url,
        subject,
        message,
        metadata,
      }),
      signal: AbortSignal.timeout(500), // ne jamais bloquer le loader
    }).catch(() => {});
  } catch {
    // best-effort, jamais bloquant
  }
}

// Types, transform, schema, constants moved to components/vehicle/r8/
// - r8.types.ts        : VehicleData, CatalogFamily, PopularPart, SEOData, R8Block, R8Content, LoaderData
// - r8-transform.ts    : transformRpcToLoaderData (RPC → LoaderData, pure)
// - r8-schema.ts       : generateVehicleSchema (Car + BreadcrumbList JSON-LD)
// - r8-constants.ts    : FAMILY_MICRO_DESCRIPTIONS

// ⚡ Contrôle de revalidation pour éviter les rechargements inutiles
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate: _defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // Ne recharger que si l'URL change vraiment ou si c'est une soumission de formulaire
  if (formMethod && formMethod !== "GET") {
    return true;
  }

  // Ne recharger que si les paramètres de route changent
  return currentUrl.pathname !== nextUrl.pathname;
}

// 🚀 Loader optimisé avec RPC (remplace 4 appels API → 1 seul)
export async function loader({ params }: LoaderFunctionArgs) {
  // 🔍 Vérifier le cache mémoire d'abord
  const cacheKey = `${params.brand}-${params.model}-${params.type}`;
  const cached = loaderCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.log("✅ [CACHE HIT] Données véhicule en cache:", cacheKey);
    return defer(cached.data as unknown as Record<string, unknown>);
  }

  logger.log("🚀 [RPC] Vehicle detail loader avec params:", params);

  // Validation des paramètres
  const { brand, model, type } = params;

  if (!brand || !model || !type) {
    logger.error("❌ Paramètres manquants:", { brand, model, type });
    throw new Response("Paramètres manquants", { status: 400 });
  }

  // 🛑 SEO: URLs legacy sans ID (ex: /constructeurs/mazda/mazda-6/...) → 410 Gone
  // L'ancien 301 redirige vers /constructeurs/mazda.html qui retourne 404 (regex ID échoue)
  // 410 dit à Google "cette URL n'existe plus" → désindexation propre
  if (!brand.includes("-") || !model.includes("-")) {
    logger.log("🛑 [410] Format legacy sans ID, URL obsolète:", {
      brand,
      model,
      type,
    });
    throw new Response("URL obsolète - format sans identifiant", {
      status: 410,
    });
  }

  // 🛑 SEO: URLs mal formées (null, ID répété, espaces, accents) → 404
  // Économise l'appel RPC pour ~2k URLs historiques constructeurs
  const malformedReason = detectMalformedSegment(brand, model, type);
  if (malformedReason) {
    logger.log(
      `🚫 [404] URL constructeur mal formée (${malformedReason}): ${brand}/${model}/${type}`,
    );
    throw new Response(JSON.stringify({ reason: malformedReason }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "X-Robots-Tag": "noindex, follow",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Parsing du type_id
  const typeWithoutHtml = type.replace(".html", "");
  const typeParts = typeWithoutHtml.split("-");
  const type_id = parseInt(typeParts[typeParts.length - 1]) || 0;

  const baseUrl = getInternalApiUrl("");

  // ── Redirect 301 : ancien type_id TecDoc (>= 100K) → nouveau massdoc ──
  if (type_id >= 100000) {
    try {
      const remapRes = await fetch(
        `${baseUrl}/api/vehicles/types/${type_id}/resolve-remap`,
        {
          headers: { "internal-call": "true" },
          signal: AbortSignal.timeout(3000),
        },
      );
      if (remapRes.ok) {
        const remap = await remapRes.json();
        if (remap.found) {
          logger.log(
            `🔄 [REMAP 301] type_id ${type_id} → ${remap.canonicalUrl}`,
          );
          return redirect(remap.canonicalUrl, 301);
        }
      }
    } catch {
      // Fallback : continue vers le flux normal → 410 naturel
    }
  }

  // ========================================
  // 🚀 APPEL RPC OPTIMISÉ (1 seul appel au lieu de 4)
  // ========================================
  logger.log(`⚡ [RPC] Appel page-data-rpc pour type_id=${type_id}`);

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
      logger.error(
        `❌ [RPC] Erreur HTTP ${rpcResponse.status} pour type_id=${type_id}`,
      );
      // Mapper le code HTTP backend vers le bon status frontend
      if (rpcResponse.status === 404) {
        throw new Response("Véhicule non trouvé", { status: 404 });
      }
      if (rpcResponse.status === 410) {
        throw new Response("Véhicule supprimé du catalogue", { status: 410 });
      }
      // Vrais erreurs serveur → 503 (Google réessaye) au lieu de 500
      await notify503ToErrorLog(
        `/constructeurs/${brand}/${model}/${type}`,
        "LOADER_503_BACKEND_RPC_ERROR",
        `Backend page-data-rpc returned HTTP ${rpcResponse.status} for type_id=${type_id}`,
        { type_id, backend_status: rpcResponse.status },
      );
      throw new Response("Service temporairement indisponible", {
        status: 503,
      });
    }

    rpcResult = await rpcResponse.json();
  } catch (error) {
    // Gestion spécifique des timeouts - retourne 503 pour que Google réessaye
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      logger.error(`⏱️ [RPC] Timeout 10s pour type_id=${type_id}`);
      await notify503ToErrorLog(
        `/constructeurs/${brand}/${model}/${type}`,
        "LOADER_503_RPC_TIMEOUT",
        `Backend page-data-rpc timeout (10s) for type_id=${type_id}`,
        { type_id, timeout_ms: 10000 },
      );
      throw new Response("Service temporairement indisponible", {
        status: 503,
      });
    }
    // Re-throw Response errors (déjà formatés)
    if (error instanceof Response) {
      throw error;
    }
    // Autres erreurs → 503 (Google réessaye) au lieu de 500
    logger.error(`❌ [RPC] Erreur fetch pour type_id=${type_id}:`, error);
    await notify503ToErrorLog(
      `/constructeurs/${brand}/${model}/${type}`,
      "LOADER_503_RPC_FETCH_ERROR",
      `Backend page-data-rpc fetch failed for type_id=${type_id}: ${error instanceof Error ? error.message : String(error)}`,
      { type_id, error_name: error instanceof Error ? error.name : "unknown" },
    );
    throw new Response("Service temporairement indisponible", { status: 503 });
  }

  if (!rpcResult.success || !rpcResult.data?.vehicle) {
    logger.error("❌ [RPC] Données invalides:", rpcResult);
    // 503 et non 410 : le véhicule peut exister mais le service a échoué.
    // 410 causerait une désindexation Google permanente.
    await notify503ToErrorLog(
      `/constructeurs/${brand}/${model}/${type}`,
      "LOADER_503_RPC_INVALID_PAYLOAD",
      `Backend returned 200 but payload invalid for type_id=${type_id}`,
      {
        type_id,
        payload_success: rpcResult.success,
        has_vehicle: !!rpcResult.data?.vehicle,
      },
    );
    throw new Response("Service temporairement indisponible", { status: 503 });
  }

  logger.log(
    `✅ [RPC] Données reçues en ${rpcResult._performance?.totalTime?.toFixed(0) || "N/A"}ms`,
  );

  // ========================================
  // 🔄 CANONICALIZATION: 301 redirect si URL non-canonique
  // Vérifie les 3 segments (brand, model, type) contre les alias DB
  // ========================================
  const v = rpcResult.data.vehicle;
  const canonicalBrand = `${v.marque_alias}-${v.marque_id}`;
  const canonicalModel = `${v.modele_alias}-${v.modele_id}`;
  const canonicalTypeAlias = normalizeTypeAlias(v.type_alias, v.type_name);
  const canonicalType = `${canonicalTypeAlias}-${type_id}`;

  if (
    brand !== canonicalBrand ||
    model !== canonicalModel ||
    typeWithoutHtml !== canonicalType
  ) {
    const canonicalUrl = `/constructeurs/${canonicalBrand}/${canonicalModel}/${canonicalType}.html`;
    logger.log(`🔄 [301] Full canonical redirect → ${canonicalUrl}`);
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

  logger.log("✅ [RPC] Données générées:", {
    vehicle: `${loaderData.vehicle.marque_name} ${loaderData.vehicle.modele_name}`,
    families: loaderData.catalogFamilies.length,
    parts: loaderData.popularParts.length,
  });

  return defer(loaderData as unknown as Record<string, unknown>);
}

// 🎯 Meta function avec SEO optimisé (logique PHP)
export const meta: MetaFunction<typeof loader> = ({ data: rawData }) => {
  const data = rawData as LoaderData | undefined;
  if (!data) {
    return [
      { title: "Page non trouvée" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }

  // R8 enriched meta override (only if indexed R8 content exists)
  const seoTitle = data.r8Content?.metaTitle || data.seo.title;
  const seoDescription =
    data.r8Content?.metaDescription || data.seo.description;

  const result: Record<string, unknown>[] = [
    { title: seoTitle },
    { name: "description", content: seoDescription },
    { name: "keywords", content: data.seo.keywords },
    { name: "robots", content: data.seo.robots },
    { tagName: "link", rel: "canonical", href: data.seo.canonical },
    { property: "og:title", content: seoTitle },
    { property: "og:description", content: seoDescription },
    { property: "og:url", content: data.seo.canonical },
    { property: "og:type", content: "website" },
    {
      property: "og:image",
      content: "https://www.automecanik.com/images/og/selection.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/images/og/selection.webp",
    },
    // 🚗 JSON-LD @graph: Car + BreadcrumbList pour rich snippets Google
    {
      "script:ld+json": generateVehicleSchema(data.vehicle, data.breadcrumb),
    },
  ];

  // ✅ Migration /img/* : Preload via proxy Caddy
  if (isValidImagePath(data.vehicle?.modele_pic)) {
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
  const data = useLoaderData<LoaderData>();

  // ⚠️ Tous les hooks doivent être appelés avant tout return conditionnel
  const [expandedFamilies, setExpandedFamilies] = useState<Set<number>>(
    new Set(),
  );
  const [imageError, setImageError] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "compact">("cards");

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
    r8Content,
  } = data;

  // Récupérer le gradient de marque dynamique
  const _brandColor = brandColorsService.getBrandGradient(vehicle.marque_alias);
  const _brandPrimary = brandColorsService.getBrandPrimaryColor(
    vehicle.marque_alias,
  );

  // R8 FAQ: parse dedicated_faq block ("**q**\na\n\n**q**\na" format)
  const r8FaqBlock = r8Content?.blocks.find((b) => b.type === "dedicated_faq");
  const r8FaqParsed: Array<{ question: string; answer: string }> = [];
  if (r8FaqBlock?.renderedText) {
    for (const pair of r8FaqBlock.renderedText.split("\n\n").filter(Boolean)) {
      const lines = pair.split("\n");
      const q = (lines[0] || "").replace(/^\*\*|\*\*$/g, "").trim();
      const a = lines.slice(1).join(" ").trim();
      if (q && a) r8FaqParsed.push({ question: q, answer: a });
    }
  }

  // FAQ: use R8 dedicated FAQ if >= 2 items, else fallback to template
  const defaultFaqItems = [
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

  // Add carte grise FAQ to defaults if CNIT/mine codes exist
  if (vehicle.mine_codes_formatted || vehicle.cnit_codes_formatted) {
    defaultFaqItems.push({
      question: `Comment trouver le type mine ou CNIT sur ma carte grise ?`,
      answer: `Le type mine se trouve en case D.2 de votre carte grise (format ancien : lettres+chiffres). Le CNIT (Code National d'Identification du Type) est le format actuel. Pour votre ${vehicle.marque_name} ${vehicle.modele_name}, les codes connus sont : ${[vehicle.mine_codes_formatted, vehicle.cnit_codes_formatted].filter(Boolean).join(", ")}. Utilisez ces codes pour confirmer la compatibilité des pièces.`,
    });
  }

  const faqItems = r8FaqParsed.length >= 2 ? r8FaqParsed : defaultFaqItems;

  return (
    <div
      className="min-h-screen bg-gray-50"
      data-brand={vehicle.marque_alias?.toLowerCase()}
    >
      <BreadcrumbSection vehicle={vehicle} breadcrumb={breadcrumb} />

      <HeroSection vehicle={vehicle} />

      {/* Vehicle image + specs (hors hero — SELECTION = gradient-only) */}
      <section className="bg-white border-b" data-section="S_IDENTITY">
        <div className="container mx-auto px-4 max-w-7xl py-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Vehicle image */}
            <div className="flex-shrink-0">
              <div className="w-48 h-32 md:w-56 md:h-36 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                {!imageError && isValidImagePath(vehicle.modele_pic) ? (
                  <img
                    src={`/img/uploads/constructeurs-automobiles/marques-modeles/${vehicle.marque_alias}/${vehicle.modele_pic}`}
                    alt={`${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`}
                    width={224}
                    height={144}
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Car
                      className="w-12 h-12 text-gray-300"
                      strokeWidth={1.5}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Proof bar */}
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
                <CheckCircle className="w-4 h-4" /> 100% compatible
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700">
                <FileText className="w-4 h-4" /> Vérif VIN / CNIT
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium text-indigo-700">
                <Truck className="w-4 h-4" /> Livraison 24-48h
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-sm font-medium text-orange-700">
                <RotateCcw className="w-4 h-4" /> Retour 30 jours
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Acces rapide + Recherche */}
        {catalogFamilies.length > 0 && (
          <div data-section="S_FAST_ACCESS" className="mb-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Acces rapide
              </h2>

              {/* Search input */}
              <div className="relative mb-4">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Rechercher une gamme (ex: plaquettes, filtre a huile...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    x
                  </button>
                )}
              </div>

              {/* Quick access chips */}
              <div className="flex flex-wrap gap-2">
                {catalogFamilies.slice(0, 6).map((family) => (
                  <a
                    key={family.mf_id}
                    href="#catalogue"
                    onClick={() => setSearchQuery(family.mf_name)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                  >
                    {family.mf_name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        <SeoIntroSection r8Content={r8Content} seo={seo} />

        {/* 📦 CATALOGUE PRINCIPAL - Design inspiré de la page index */}
        {catalogFamilies.length > 0 &&
          (() => {
            const filteredFamilies = searchQuery
              ? catalogFamilies.filter(
                  (f) =>
                    f.mf_name
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                    f.gammes.some((g) =>
                      g.pg_name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                    ),
                )
              : catalogFamilies;

            return (
              <div className="mb-16" id="catalogue" data-section="S_CATALOG">
                {/* Header impactant */}
                <div className="text-center mb-12 animate-in fade-in duration-700">
                  <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">
                    Catalogue de pieces auto
                  </h2>
                  <div className="h-1 w-16 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-6"></div>
                  <p className="text-xl text-gray-600 max-w-3xl mx-auto font-medium">
                    Trouvez la piece exacte pour votre{" "}
                    <span className="font-bold text-brand">
                      {vehicle.marque_name} {vehicle.modele_name}{" "}
                      {vehicle.type_name}
                    </span>{" "}
                    • {vehicle.type_power_ps} ch • {vehicle.type_year_from}-
                    {vehicle.type_year_to || "Auj."}
                  </p>
                </div>

                {/* View toggle + count */}
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm text-gray-500">
                    {filteredFamilies.length} famille
                    {filteredFamilies.length > 1 ? "s" : ""} ·{" "}
                    {filteredFamilies.reduce(
                      (acc, f) => acc + f.gammes.length,
                      0,
                    )}{" "}
                    gammes
                  </p>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode("cards")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      Cartes
                    </button>
                    <button
                      onClick={() => setViewMode("compact")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "compact" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      Compact
                    </button>
                  </div>
                </div>

                {viewMode === "cards" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredFamilies.map((family, index) => {
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
                            {FAMILY_MICRO_DESCRIPTIONS[family.mf_name] && (
                              <p className="text-xs text-gray-500 mt-1">
                                {FAMILY_MICRO_DESCRIPTIONS[family.mf_name]}
                              </p>
                            )}
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
                ) : (
                  /* Compact view */
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {filteredFamilies.map((family) => (
                      <div key={family.mf_id} className="p-4">
                        <h3 className="font-bold text-gray-900 text-sm mb-2">
                          {family.mf_name}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {family.gammes.map((gamme) => (
                            <a
                              key={gamme.pg_id}
                              href={`/pieces/${gamme.pg_alias}-${gamme.pg_id}/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`}
                              className="text-xs px-2.5 py-1 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-md text-gray-700 transition-colors"
                            >
                              {gamme.pg_name}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

        {/* 🔥 Pièces populaires - Design moderne amélioré */}
        {popularParts.length > 0 && (
          <div className="mb-12" data-section="S_BESTSELLERS">
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
                    {isValidImagePath(part.pg_img) ? (
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

        {/* Fiche technique du vehicule */}
        <div className="mb-12" data-section="S_SAFE_TABLE">
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
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-500 w-1/3">
                      Motorisation
                    </td>
                    <td className="py-3 font-semibold text-gray-900">
                      {vehicle.type_name}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-500">
                      Puissance
                    </td>
                    <td className="py-3 font-semibold text-gray-900">
                      {vehicle.type_power_ps} ch
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-500">
                      Carburant
                    </td>
                    <td className="py-3 font-semibold text-gray-900">
                      {vehicle.type_fuel || "Non spécifié"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-500">
                      Carrosserie
                    </td>
                    <td className="py-3 font-semibold text-gray-900">
                      {vehicle.type_body || "Non spécifié"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-500">
                      Période
                    </td>
                    <td className="py-3 font-semibold text-gray-900">
                      {vehicle.type_year_from} -{" "}
                      {vehicle.type_year_to || "aujourd'hui"}
                    </td>
                  </tr>
                  {vehicle.motor_codes_formatted && (
                    <tr>
                      <td className="py-3 pr-4 font-medium text-gray-500">
                        Code moteur
                      </td>
                      <td className="py-3 font-semibold text-gray-900">
                        {vehicle.motor_codes_formatted}
                      </td>
                    </tr>
                  )}
                  {(vehicle.mine_codes_formatted ||
                    vehicle.cnit_codes_formatted) && (
                    <tr>
                      <td className="py-3 pr-4 font-medium text-gray-500">
                        Type mine / CNIT
                      </td>
                      <td className="py-3 font-semibold text-gray-900 flex items-center gap-2">
                        <span className="truncate max-w-[200px]">
                          {vehicle.mine_codes_formatted}
                          {vehicle.mine_codes_formatted &&
                            vehicle.cnit_codes_formatted &&
                            " / "}
                          {vehicle.cnit_codes_formatted}
                        </span>
                        <button
                          onClick={() => {
                            const text = [
                              vehicle.mine_codes_formatted,
                              vehicle.cnit_codes_formatted,
                            ]
                              .filter(Boolean)
                              .join(" / ");
                            navigator.clipboard.writeText(text);
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Copier"
                        >
                          <Copy size={14} className="text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* R8 technical_specs overlay (RAG motorisations) */}
            {r8Content?.blocks
              .filter((b) => b.type === "technical_specs")
              .map((block) => (
                <div
                  key={block.id}
                  className="p-6 border-t border-gray-200 bg-gray-50"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {block.title}
                  </h3>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <HtmlContent html={block.renderedText} trackLinks={true} />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* R8 enriched sections — variant_difference + maintenance_context */}
        <R8EnrichedSection r8Content={r8Content} />

        <AntiErrorsSection vehicle={vehicle} />

        <HowtoSection vehicle={vehicle} />

        {/* ❓ FAQ dynamique avec Schema.org */}
        <div className="mb-12" data-section="S_FAQ">
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

        <TrustSection />

        {/* 🔗 CTA retour hub marque R7 (maillage R8→R7) */}
        <div className="mt-8 text-center">
          <a
            href={`/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors"
          >
            Voir toutes les pièces {breadcrumb.brand}
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>

      {/* Sticky vehicle bar - top */}
      {showStickyCta && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm py-2 px-4 animate-in slide-in-from-top duration-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Car size={20} className="text-brand flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-gray-900 text-sm truncate">
                  {vehicle.marque_name} {vehicle.modele_name}{" "}
                  {vehicle.type_name}
                </div>
                <div className="text-xs text-gray-500">
                  {vehicle.type_power_ps} ch · {vehicle.type_fuel} ·{" "}
                  {vehicle.type_year_from}–{vehicle.type_year_to || "Auj."}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href="#catalogue"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand hover:brightness-110 transition-all"
              >
                <Package size={16} />
                <span className="hidden sm:inline">Catalogue</span>
              </a>
              <a
                href="/contact"
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <HeadphonesIcon size={16} />
                <span>Aide</span>
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

  // Handle 410/404
  if (
    isRouteErrorResponse(error) &&
    (error.status === 410 || error.status === 404)
  ) {
    return (
      <ErrorGeneric
        status={error.status}
        message={error.statusText || error.data?.message}
      />
    );
  }

  // Generic error for other cases
  logger.error("ERROR BOUNDARY:", error);
  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.statusText} />;
  }

  return <ErrorGeneric />;
}
