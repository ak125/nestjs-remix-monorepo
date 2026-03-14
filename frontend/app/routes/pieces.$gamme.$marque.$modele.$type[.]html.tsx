/**
 * Route : /pieces/:gamme/:marque/:modele/:type.html
 * Page Produit (R2 - PRODUIT) - Pièces avec contexte véhicule complet
 *
 * Rôle SEO : R2 - PRODUIT
 * Intention : Vérifier compatibilité / acheter
 *
 * ⚠️ URLs PRÉSERVÉES - Ne jamais modifier le format d'URL
 *
 * 🚀 RM V2: Single RPC for ALL data (~400ms, cached in Redis)
 * - products: RM-scored products (OE/EQUIV/ECO, stock status)
 * - grouped_pieces: Products grouped by gamme+side with OEM refs per group
 * - vehicleInfo: Complete vehicle info with motor/mine/cnit codes
 * - seo: Fully processed SEO (h1, title, description, content)
 * - oemRefs: Normalized OEM references
 * - crossSelling: Related gammes
 * - filters: Brands/qualities/sides with counts
 * - validation: Data quality metrics
 */

import {
  defer,
  json,
  type HeadersFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Await,
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useRouteError,
} from "@remix-run/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
// 🚀 LCP OPTIMIZATION: fetchGammePageData supprimé (redondant avec RM V2 RPC)

// ========================================
// 📦 IMPORTS DES MODULES REFACTORISÉS
// ========================================

// Composants UI CRITIQUES (above-fold - chargés immédiatement)
import {
  NoProductsAlternatives,
  type NoProductsData,
} from "~/components/pieces/NoProductsAlternatives";
import { FAQSection } from "~/components/seo/FAQSection";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { ScrollToTop } from "../components/blog/ScrollToTop";
import { ErrorGeneric } from "../components/errors/ErrorGeneric";
import {
  MobileBottomBar,
  MobileBottomBarSpacer,
} from "../components/layout/MobileBottomBar";
import { PiecesBuyingGuide } from "../components/pieces/PiecesBuyingGuide";
import { PiecesCatalogueFamille } from "../components/pieces/PiecesCatalogueFamille";
import { PiecesComparisonView } from "../components/pieces/PiecesComparisonView";
import { PiecesCompatibilityInfo } from "../components/pieces/PiecesCompatibilityInfo";
import { PiecesCrossSelling } from "../components/pieces/PiecesCrossSelling";
import {
  PiecesFilterSidebar,
  type FiltersData,
} from "../components/pieces/PiecesFilterSidebar";
import { PiecesGridView } from "../components/pieces/PiecesGridView";
import { PiecesGroupedDisplay } from "../components/pieces/PiecesGroupedDisplay";
import { PiecesHeader } from "../components/pieces/PiecesHeader";
import { PiecesListView } from "../components/pieces/PiecesListView";
import { PiecesOemSection } from "../components/pieces/PiecesOemSection";
import { PiecesRecommendedSection } from "../components/pieces/PiecesRecommendedSection";
import { PiecesRelatedArticles } from "../components/pieces/PiecesRelatedArticles";
import { PiecesSEOSection } from "../components/pieces/PiecesSEOSection";
import { PiecesToolbar } from "../components/pieces/PiecesToolbar";
import { PiecesVoirAussi } from "../components/pieces/PiecesVoirAussi";
import { FrictionReducerGroup } from "../components/trust/FrictionReducer";
// SEO-CRITICAL: Imports directs pour SSR (visibilité Googlebot)
// VehicleSelector supprimé - remplacé par badge véhicule avec lien "Changer"

// Hook custom
import { usePiecesFilters } from "../hooks/use-pieces-filters";
import { useSeoLinkTracking } from "../hooks/useSeoLinkTracking";

// SEO Page Role (Phase 5 - Quasi-Incopiable)

// Services API

// 🚀 RM API V2 - Complete Read Model (~400ms, single RPC)
import { fetchRmPageV2 } from "../services/api/rm-api.service";
import {
  fetchBlogArticleWithRelated,
  fetchSeoSwitches,
} from "../services/pieces/pieces-route.service";

// Types centralisés (VehicleData utilisé via loaderData.vehicle)

// Utilitaires
import { fetchJsonOrNull } from "../utils/fetch.utils";
import { isValidPosition } from "../utils/pieces-filters.utils";
import {
  buildCataloguePromise,
  type HierarchyData,
} from "../utils/pieces-loader.utils";
import {
  detectMalformedSegment,
  generateBuyingGuide,
  generateFAQ,
  parseUrlParam,
  resolveGammeId,
  resolveVehicleIds,
  validateVehicleIds,
} from "../utils/pieces-route.utils";
import { mapRmV2ToLoaderData, isRmV2DataUsable } from "../utils/rm-mapper";
import {
  buildHeroImagePreload,
  buildPiecesProductSchema,
} from "../utils/seo/pieces-schema.utils";
import { stripHtmlForMeta } from "../utils/seo-clean.utils";
import {
  buildPiecesBreadcrumbs,
  buildTypeSlug,
  buildVoirAussiLinks,
  normalizeAlias,
} from "../utils/url-builder.utils";

/**
 * Handle export pour propager le rôle SEO au root Layout
 * Permet l'ajout automatique de data-attributes sur <body>
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R2_PRODUCT, {
    clusterId: "pieces",
    canonicalEntity: "pieces-vehicule",
  }),
};

// 🚀 LCP OPTIMIZATION V6: Seul PiecesStatistics reste lazy (pur UX, zéro valeur SEO)
// Les 6 autres composants sont importés directement pour SSR (visibilité Googlebot)
const PiecesStatistics = lazy(() =>
  import("../components/pieces/PiecesStatistics").then((m) => ({
    default: m.PiecesStatistics,
  })),
);

// ========================================
// 🔄 LOADER - Récupération des données
// ========================================

export async function loader({ params, request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  // Debug URL complète
  const url = new URL(request.url);
  logger.log("📍 [LOADER] URL complète:", url.pathname);

  // 1. Parse des paramètres URL
  const {
    gamme: rawGamme,
    marque: rawMarque,
    modele: rawModele,
    type: rawType,
  } = params;

  if (!rawGamme || !rawMarque || !rawModele || !rawType) {
    throw new Response(`Paramètres manquants`, { status: 400 });
  }

  // 1b. Guard: détection URLs mal formées AVANT appels API
  // Économise les API calls pour ~60k URLs historiques (anciens sitemaps, liens externes)
  const malformedReason = detectMalformedSegment(
    rawGamme,
    rawMarque,
    rawModele,
    rawType,
  );
  if (malformedReason) {
    logger.log(`🚫 [404] URL mal formée (${malformedReason}): ${url.pathname}`);
    throw new Response(
      JSON.stringify({ reason: malformedReason, url: url.pathname }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "public, max-age=86400",
        },
      },
    );
  }

  // 2. Parse les IDs depuis les URLs
  const gammeData = parseUrlParam(rawGamme);
  const _marqueData = parseUrlParam(rawMarque);
  const _modeleData = parseUrlParam(rawModele);
  const _typeData = parseUrlParam(rawType);

  // 3. Résolution des IDs via API (🚀 PARALLÉLISÉ pour performance)
  const [vehicleIds, gammeId] = await Promise.all([
    resolveVehicleIds(rawMarque, rawModele, rawType),
    resolveGammeId(rawGamme),
  ]);

  // Validation des IDs véhicule - Si invalides, 301 redirect vers page gamme
  // 🛡️ gammeId n'est PAS validé ici - délégué au RM V2 RPC pour permettre gammeId=0 → 404 SEO
  let vehicleValidationFailed = false;
  try {
    validateVehicleIds({
      marqueId: vehicleIds.marqueId,
      modeleId: vehicleIds.modeleId,
      typeId: vehicleIds.typeId,
      // gammeId: gammeId, // Retiré - validation par RM V2 RPC
      source: "loader-validation",
    });
  } catch (validationError) {
    // 🛡️ IDs invalides → 301 redirect vers page gamme (SEO optimal)
    logger.warn(
      `⚠️ [LOADER] Validation IDs échouée, redirect 301 vers gamme:`,
      validationError,
    );
    vehicleValidationFailed = true;
  }

  // 🔄 SEO: Si validation véhicule échouée → 404 avec page utile
  // Raison: 301 vers page gamme crée des "pages avec redirection" dans GSC (43.9k URLs)
  // 404 dit à Google "cette page n'existe pas" → désindexation propre
  if (vehicleValidationFailed) {
    logger.log(
      `🚫 [404] Validation véhicule échouée: /pieces/${gammeData.alias}-${gammeId}.html`,
    );
    throw new Response(
      JSON.stringify({
        reason: "invalid_vehicle",
        gammeAlias: gammeData.alias,
        gammeId,
        gammeUrl: `/pieces/${gammeData.alias}-${gammeId}.html`,
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control":
            "public, max-age=60, s-maxage=3600, stale-while-revalidate=3600",
        },
      },
    );
  }

  // 🚀 RM API V2 - Complete Read Model (single source of truth)
  // Returns: products, grouped_pieces, vehicleInfo, gamme, seo, oemRefs, crossSelling, filters

  // 🚀 LCP V8: Lancer hierarchy immédiatement (pour catalogueMameFamille deferred)
  const hierarchyPromise = fetchJsonOrNull<HierarchyData>(
    `http://127.0.0.1:3000/api/catalog/homepage-families`,
    3000,
  );

  // SEO switches pour anchor text variés
  const seoSwitchesPromise = fetchSeoSwitches(gammeId, 3000);

  // 🚀 RM V2: Single RPC for ALL data (~400ms, cached in Redis)
  const INITIAL_PRODUCTS_LIMIT = 200;
  const rmV2Promise = fetchRmPageV2(
    gammeId,
    vehicleIds.typeId,
    INITIAL_PRODUCTS_LIMIT,
  ).catch((err) => {
    logger.error(
      `❌ [RM V2] Failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  });

  // 🚀 LCP V9: seoSwitches deferred (below-fold only, has fallback anchors)
  const rmV2Response = await rmV2Promise;

  // 🔄 SEO: 0 produits → page utile avec alternatives (200 + noindex)
  // Mieux que 404 : pas d'erreur GSC, liens internes suivis, UX guidée
  if (!rmV2Response || !isRmV2DataUsable(rmV2Response, 1)) {
    logger.log(
      `🔄 [NO_PRODUCTS] 0 produits, page alternatives pour: /pieces/${gammeData.alias}-${gammeId}.html`,
    );

    // Fetch alternatives en parallèle (autres gammes pour ce véhicule + autres véhicules pour cette gamme)
    const alternativesData = await fetchJsonOrNull<{
      success: boolean;
      alternativeGammes: Array<{
        pg_id: number;
        pg_name: string;
        pg_alias: string;
        pg_pic: string | null;
      }>;
      alternativeVehicles: Array<{
        type_id: string;
        type_name: string;
        type_alias: string | null;
        modele_name: string;
        modele_alias: string;
        modele_id: number;
        marque_name: string;
        marque_alias: string;
        marque_id: number;
      }>;
    }>(
      `http://127.0.0.1:3000/api/rm/alternatives?gamme_id=${gammeId}&type_id=${vehicleIds.typeId}&limit=12`,
      3000,
    );

    // Construire le label véhicule lisible depuis les params URL
    const vehicleLabel = [rawMarque, rawModele, rawType]
      .filter(Boolean)
      .map((s) => s!.replace(/-\d+$/, "").replace(/-/g, " "))
      .join(" ");

    return json(
      {
        noProducts: true as const,
        gammeId,
        gammeAlias: gammeData.alias,
        gammeName:
          rmV2Response?.gamme?.pg_name || gammeData.alias.replace(/-/g, " "),
        vehicleLabel,
        alternativeGammes: alternativesData?.alternativeGammes || [],
        alternativeVehicles: alternativesData?.alternativeVehicles || [],
      } satisfies NoProductsData,
      {
        headers: {
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "public, max-age=300, s-maxage=3600",
        },
      },
    );
  }

  logger.log(
    `🚀 [RM V2] ${rmV2Response.count} products in ${rmV2Response.duration_ms}ms (cache: ${rmV2Response.cacheHit})`,
  );

  // 🎯 Map RM V2 response to LoaderData format
  const loaderData = mapRmV2ToLoaderData(rmV2Response, {
    loadTime: Date.now() - startTime,
  });

  // Extract mapped data
  const { vehicle, gamme, pieces: piecesData } = loaderData;

  // 🔄 SEO: Canonical URL calculée depuis les données RM V2 (pas location.pathname)
  // Corrige les ~1.4k pages "Page en double" dans Google Search Console
  const correctGammeSlug = `${gamme.alias}-${gamme.id}`;
  const correctBrandSlug = `${vehicle.marqueAlias || normalizeAlias(vehicle.marque)}-${vehicle.marqueId}`;
  const correctModelSlug = `${vehicle.modeleAlias || normalizeAlias(vehicle.modele)}-${vehicle.modeleId}`;
  const correctTypeSlug = buildTypeSlug({
    type_alias: vehicle.typeAlias,
    type_name: vehicle.type,
    type_id: vehicle.typeId,
  });
  const canonicalPath = `/pieces/${correctGammeSlug}/${correctBrandSlug}/${correctModelSlug}/${correctTypeSlug}.html`;

  // 301 redirect si l'URL courante ne correspond pas à l'URL canonique
  // Normalisation URI pour éviter les faux positifs (encoding, trailing slash)
  const currentPath = decodeURIComponent(url.pathname);
  const targetPath = decodeURIComponent(canonicalPath);

  if (currentPath !== targetPath) {
    // Anti-boucle : si déjà redirigé (param r=1), servir la page telle quelle
    if (url.searchParams.get("r") === "1") {
      logger.warn(
        `⚠️ [301-LOOP] Anti-boucle activé, page servie sans redirect: ${currentPath}`,
      );
    } else {
      logger.log(`🔄 [301] Canonical mismatch: ${currentPath} → ${targetPath}`);
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = canonicalPath;
      redirectUrl.searchParams.set("r", "1");
      return redirect(redirectUrl.toString(), 301);
    }
  }

  // 🔗 SEO: URLs pré-calculées pour section "Voir aussi" (pas de construction côté client)
  const voirAussiLinks = buildVoirAussiLinks(gamme, vehicle);

  // Generated Content (FAQ and buying guide with vehicle context)
  // FAQ gating : ne garder que les Q/R avec réponse substantielle (>= 20 chars)
  const faqItems = generateFAQ(vehicle, gamme).filter(
    (item) => item.answer && item.answer.length >= 20,
  );
  const buyingGuide = generateBuyingGuide(vehicle, gamme);

  // LCP: blogData deferred (below-fold, non-bloquant pour TTFB)
  // Googlebot exécute JS et verra les liens une fois le defer résolu
  const blogDataPromise = fetchBlogArticleWithRelated(gamme, vehicle).catch(
    () => ({ article: null, relatedArticles: [] }),
  );

  // 🚀 LCP OPTIMIZATION V8: Catalogue Famille streamé via defer() (below-fold)
  // T5: Top 8 liens SSR pour crawl interne, reste deferred
  const catalogueMameFamillePromise = buildCataloguePromise(
    gammeId,
    hierarchyPromise,
  );
  // Await hierarchy (already fetched in parallel with RM V2, should be resolved)
  const catalogueMameFamille = await catalogueMameFamillePromise.catch(
    () => null,
  );
  const catalogueTop8 = catalogueMameFamille?.items?.slice(0, 8) ?? [];

  const loadTime = Date.now() - startTime;

  // 🎯 Filters from RM V2 (already includes counts)
  const filtersData: FiltersData | null = rmV2Response.filters
    ? {
        filters: [],
        summary: {
          total_filters: 3, // brands, qualities, sides
          total_options:
            (rmV2Response.filters.brands?.length || 0) +
            (rmV2Response.filters.qualities?.length || 0) +
            (rmV2Response.filters.sides?.length || 0),
        },
        ...rmV2Response.filters,
      }
    : null;

  // 🚀 LCP OPTIMIZATION V6: defer() pour streamer données non-critiques
  // Données critiques (vehicle, pieces, seo) : retournées immédiatement
  // Données non-critiques (relatedArticles, blogArticle) : streamées après le first paint
  return defer(
    {
      // === DONNÉES CRITIQUES (bloquantes, nécessaires pour LCP) ===
      canonicalPath,
      vehicle,
      gamme,
      pieces: piecesData,
      // Map grouped_pieces with null → undefined conversion for filtre_side
      grouped_pieces: (rmV2Response.grouped_pieces || []).map((g) => ({
        ...g,
        filtre_side: g.filtre_side ?? undefined, // Convert null to undefined
      })),
      count: rmV2Response.count || piecesData.length,
      minPrice: loaderData.minPrice,
      maxPrice: loaderData.maxPrice,
      filtersData,
      seoContent: loaderData.seoContent,
      faqItems,
      buyingGuide,
      compatibilityInfo: loaderData.compatibilityInfo,
      crossSellingGammes: loaderData.crossSellingGammes,
      oemRefs: loaderData.oemRefs,
      oemRefsSeo: loaderData.oemRefsSeo,
      voirAussiLinks, // 🔗 SEO: URLs pré-calculées pour section "Voir aussi"
      catalogueTop8, // 🕷️ SEO: Top 8 liens catalogue SSR pour crawl interne
      seo: {
        title:
          rmV2Response.seo?.title ||
          `${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} | Pièces Auto`,
        h1: rmV2Response.seo?.h1 || loaderData.seoContent.h1,
        description: stripHtmlForMeta(
          rmV2Response.seo?.description ||
            loaderData.seoContent.longDescription,
        ),
      },
      performance: {
        loadTime,
        source: "rm-v2",
        cacheHit: rmV2Response.cacheHit || false,
        rmDuration: rmV2Response.duration_ms,
      },
      dataQuality: rmV2Response.validation?.dataQuality?.quality ?? 0,

      // === DONNÉES STREAMÉES (non-bloquantes, chargées en background) ===
      // LCP: blogData deferred (below-fold, Googlebot exécute JS)
      blogData: blogDataPromise,
      // 🚀 LCP V9: seoSwitches deferred (below-fold, fallback anchors in getAnchorText)
      seoSwitches: seoSwitchesPromise,
      // Catalogue complet (déjà résolu pour SSR top 8, passé en direct)
      catalogueMameFamille: catalogueMameFamille
        ? Promise.resolve(catalogueMameFamille)
        : Promise.resolve(null),
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=86400, stale-while-revalidate=3600",
      },
    },
  );
}

// ========================================
// 📦 CACHE — 1min browser + 24h CDN stale
// ========================================

export const headers: HeadersFunction = () => ({
  "Cache-Control":
    "public, max-age=60, s-maxage=86400, stale-while-revalidate=3600",
});

// ========================================
// 📔 META - SEO (Schema.org généré par composant Breadcrumbs)
// ========================================

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) {
    return [
      { title: "Pièces automobile" },
      { name: "description", content: "Catalogue de pièces détachées" },
    ];
  }

  // Page alternatives (0 produits) — noindex
  if ("noProducts" in data && data.noProducts) {
    return [
      { title: `${data.gammeName} - Non disponible | AutoMecanik` },
      {
        name: "description",
        content: `${data.gammeName} pour ${data.vehicleLabel}. Découvrez nos alternatives disponibles.`,
      },
      { name: "robots", content: "noindex, follow" },
    ];
  }

  // Type narrowing: après les early returns, data est forcément le type complet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;

  // Construire URL canonique depuis les données RM V2 (pas location.pathname)
  // Evite les doublons canonical quand le slug URL != alias réel
  const canonicalUrl = d.canonicalPath
    ? `https://www.automecanik.com${d.canonicalPath}`
    : `https://www.automecanik.com${location.pathname}`;

  // 📊 Schema.org @graph - Extrait dans pieces-schema.utils.ts
  const productSchema = buildPiecesProductSchema({
    vehicle: d.vehicle,
    gamme: d.gamme,
    pieces: d.pieces,
    seo: { description: d.seo.description },
    minPrice: d.minPrice,
    maxPrice: d.maxPrice,
    count: d.count,
    oemRefs: d.oemRefs,
    oemRefsSeo: d.oemRefsSeo,
    crossSellingGammes: d.crossSellingGammes,
    canonicalUrl,
  });

  return [
    { title: d.seo.title },
    { name: "description", content: d.seo.description },
    { property: "og:title", content: d.seo.title },
    { property: "og:description", content: d.seo.description },
    { property: "og:url", content: canonicalUrl },
    // Robots: index si 2+ produits, OU si 1 produit avec qualité données suffisante
    // Pages 2+ produits ont ~300 mots SSR (FAQ, guide, compatibilité)
    {
      name: "robots",
      content:
        d.count >= 2 || (d.count === 1 && (d.dataQuality ?? 0) >= 50)
          ? "index, follow"
          : "noindex, follow",
    },

    // âœ¨ NOUVEAU: Canonical URL
    { tagName: "link", rel: "canonical", href: canonicalUrl },

    // ✅ FIX 2026-01-21: Preconnect vers automecanik.com (imgproxy)
    {
      tagName: "link",
      rel: "preconnect",
      href: "https://www.automecanik.com",
    },

    // 🚀 LCP Optimization V5: Preload hero vehicle image - Fonction extraite
    ...buildHeroImagePreload(d.vehicle, d.gamme),

    // âœ¨ NOUVEAU: Schema.org Product (rich snippets)
    ...(productSchema
      ? [
          {
            "script:ld+json": productSchema,
          },
        ]
      : []),

    // Schema.org FAQPage dans <head> pour rich snippets (SSR garanti)
    ...(d.faqItems && d.faqItems.length >= 2
      ? [
          {
            "script:ld+json": {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: d.faqItems
                .filter((item: { schema?: boolean }) => item.schema !== false)
                .map((item: { question: string; answer: string }) => ({
                  "@type": "Question",
                  name: item.question,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: item.answer,
                  },
                })),
            },
          },
        ]
      : []),
  ];
};

// ========================================
// 🎨 COMPOSANT PRINCIPAL
// ========================================

export default function PiecesVehicleRoute() {
  const rawData = useLoaderData<typeof loader>();

  // 🔄 Page alternatives quand 0 produits (200 + noindex)
  if ("noProducts" in rawData && rawData.noProducts) {
    return <NoProductsAlternatives data={rawData as NoProductsData} />;
  }

  return <PiecesVehicleContent />;
}

/** Composant interne avec tous les hooks — évite la violation rules-of-hooks */
function PiecesVehicleContent() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = useLoaderData<typeof loader>() as any;

  const location = useLocation(); // 🆕 Pour Schema.org breadcrumb
  const { trackClick, trackImpression } = useSeoLinkTracking();
  const [showFilters, setShowFilters] = useState(false);

  // Hook custom pour la logique de filtrage (gère son propre état)
  const {
    activeFilters,
    sortBy,
    viewMode,
    selectedPieces,
    filteredProducts,
    uniqueBrands,
    recommendedPieces,
    dynamicFilterCounts, // âœ¨ NOUVEAU: Comptages dynamiques
    brandAverageNotes, // âœ¨ Notes moyennes par marque
    setActiveFilters,
    setSortBy,
    setViewMode,
    resetAllFilters,
    togglePieceSelection,
    isFilterPending,
  } = usePiecesFilters(data.pieces);

  // 📊 Track les impressions de la section "Voir aussi" au montage
  useEffect(() => {
    trackImpression("VoirAussi", 4); // 4 liens dans la section
    if (data.crossSellingGammes?.length > 0) {
      trackImpression("CrossSelling", data.crossSellingGammes.length);
    }
  }, [trackImpression, data.crossSellingGammes?.length]);

  // 📊 Handlers pour tracker les clics "Voir aussi"
  const handleVoirAussiClick = useCallback(
    (url: string, anchorText: string) => {
      trackClick("VoirAussi", url, { anchorText, position: "voiraussi" });
    },
    [trackClick],
  );

  // Actions de sélection pour mode comparaison
  // âš¡ Optimisé avec useCallback pour éviter re-création Ã  chaque render
  const handleSelectPiece = useCallback(
    (pieceId: number) => {
      if (viewMode === "comparison") {
        togglePieceSelection(pieceId);
      }
    },
    [viewMode, togglePieceSelection],
  );

  const handleRemoveFromComparison = useCallback(
    (pieceId: number) => {
      togglePieceSelection(pieceId);
    },
    [togglePieceSelection],
  );

  // âœ¨ Calcul des positions disponibles pour le filtre sidebar
  const availablePositions = useMemo((): string[] => {
    const groupedPieces = data.grouped_pieces || [];
    const positions: string[] = groupedPieces
      .map((g: any) => g.filtre_side as string)
      .filter((side): side is string => Boolean(side));
    return [...new Set(positions)];
  }, [data.grouped_pieces]);

  // âœ¨ Label du filtre position adapté selon la gamme
  const positionLabel = useMemo(() => {
    const gammeAlias = data.gamme?.alias?.toLowerCase() || "";
    // Rétroviseurs, essuie-glaces, clignotants ←' Côté (Gauche/Droite)
    if (
      ["retroviseur", "essuie-glace", "clignotant", "feu", "phare"].some((k) =>
        gammeAlias.includes(k),
      )
    ) {
      return "Côté";
    }
    // Plaquettes, disques, amortisseurs ←' Position (Avant/Arrière)
    return "Position";
  }, [data.gamme]);

  // ✅ Validation: reset position si invalide (ex: données API changent)
  useEffect(() => {
    if (!isValidPosition(activeFilters.position, availablePositions)) {
      setActiveFilters((prev) => ({ ...prev, position: "all" }));
    }
  }, [availablePositions, activeFilters.position, setActiveFilters]);

  // 🚀 LCP V9: seoSwitches is deferred — resolve promise when available
  const [resolvedSeoSwitches, setResolvedSeoSwitches] = useState<
    | { verbs: Array<{ id: number; content: string }>; verbCount: number }
    | null
    | undefined
  >(null);
  useEffect(() => {
    const val = data.seoSwitches;
    if (val && typeof (val as any).then === "function") {
      (val as any)
        .then((r: any) => setResolvedSeoSwitches(r ?? null))
        .catch(() => null);
    } else {
      setResolvedSeoSwitches(val as any);
    }
  }, [data.seoSwitches]);

  // 🔗 Fonction pour générer des ancres SEO variées depuis les switches
  const getAnchorText = useCallback(
    (index: number): string => {
      const switches = resolvedSeoSwitches?.verbs || [];
      if (switches.length > 0) {
        const switchItem = switches[index % switches.length];
        const verb = switchItem?.content || "";
        if (verb) {
          // Capitaliser la première lettre
          return verb.charAt(0).toUpperCase() + verb.slice(1);
        }
      }
      // Ancres par défaut avec rotation
      const defaultAnchors = ["Voir", "Découvrir", "Explorer", "Détails"];
      return defaultAnchors[index % defaultAnchors.length];
    },
    [resolvedSeoSwitches],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 relative overflow-x-clip">
      {/* Pattern d'arrière-plan subtil */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE0YzIuMiAwIDQgMS44IDQgNHMtMS44IDQtNCA0LTQtMS44LTQtNGMwLTIuMiAxLjgtNCA0LTR6bTAgNDBjMi4yIDAgNCAxLjggNCA0cy0xLjggNC00IDQtNC0xLjgtNC00YzAtMi4yIDEuOC00IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40 pointer-events-none"></div>

      {/* Header moderne */}
      <div className="relative z-10">
        <PiecesHeader
          vehicle={data.vehicle}
          gamme={data.gamme}
          count={data.count}
          performance={data.performance}
        />
      </div>

      {/* 🍞 Fil d'ariane SEO optimisé - Réutilisation composant Breadcrumbs */}
      <div
        className="bg-white border-b border-gray-200 relative z-[100]"
        style={{ pointerEvents: "auto", position: "relative" }}
      >
        <div
          className="max-w-7xl mx-auto px-4 py-3"
          style={{ pointerEvents: "auto" }}
        >
          <PublicBreadcrumb
            items={buildPiecesBreadcrumbs(
              data.gamme,
              data.vehicle,
              location.pathname,
            )}
            showHome={false}
            withJsonLd
          />
        </div>
      </div>

      {/* Conteneur principal */}
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* 🚗 Badge véhicule actuel avec lien pour changer */}
        {/* Vehicle badge - full-width mobile, compact desktop */}
        <div className="mb-6 sticky top-0 md:top-4 z-20 animate-in fade-in slide-in-from-top duration-500 -mx-4 md:mx-0">
          <div className="bg-slate-900 md:bg-white/95 md:border md:border-gray-200 md:rounded-xl md:shadow-sm px-4 py-3 md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500/20 md:bg-blue-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-blue-400 md:text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-gray-400 md:text-gray-500 hidden md:block">
                    Véhicule sélectionné
                  </div>
                  <div className="text-sm md:text-base font-semibold text-white md:text-gray-900">
                    {data.vehicle.marque} {data.vehicle.modele}{" "}
                    {data.vehicle.type}
                  </div>
                </div>
              </div>
              <Link
                to={`/pieces/${data.gamme.alias}-${data.gamme.id}.html`}
                className="px-3 py-1.5 text-sm font-medium text-blue-400 md:text-blue-600 hover:text-blue-300 md:hover:text-blue-800 md:hover:bg-blue-50 rounded-lg transition-colors"
                prefetch="intent"
              >
                Changer
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar filtres et catalogue — hidden on mobile, toggle via MobileBottomBar */}
          <aside
            className={`lg:w-80 flex-shrink-0 space-y-6 animate-in fade-in slide-in-from-left duration-700 ${showFilters ? "block" : "hidden lg:block"}`}
          >
            {/* Filtres */}
            <div className="sticky top-24">
              <PiecesFilterSidebar
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                uniqueBrands={uniqueBrands}
                piecesCount={filteredProducts.length}
                resetAllFilters={resetAllFilters}
                getBrandCount={(brand) =>
                  dynamicFilterCounts.brandCounts.get(brand) || 0
                }
                getQualityCount={(quality) =>
                  dynamicFilterCounts.qualityCounts.get(quality) || 0
                }
                getPriceRangeCount={(range) =>
                  dynamicFilterCounts.priceCounts[
                    range as "low" | "medium" | "high"
                  ] || 0
                }
                filtersData={data.filtersData}
                availablePositions={availablePositions}
                positionLabel={positionLabel}
                brandAverageNotes={brandAverageNotes}
              />
            </div>

            {/* Catalogue — Top 8 liens SSR pour crawl interne */}
            {data.catalogueTop8 && data.catalogueTop8.length > 0 && (
              <nav
                aria-label="Gammes similaires"
                className="bg-white rounded-lg border border-gray-200 p-3"
              >
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Gammes similaires
                </h3>
                <ul className="space-y-1">
                  {data.catalogueTop8.map(
                    (item: { name: string; link: string }) => (
                      <li key={item.link}>
                        <a
                          href={item.link}
                          className="text-sm text-blue-700 hover:text-blue-900 hover:underline block py-0.5"
                        >
                          {item.name}
                        </a>
                      </li>
                    ),
                  )}
                </ul>
              </nav>
            )}

            {/* Catalogue collapsible complet - deferred (below-fold) */}
            <PiecesCatalogueFamille
              catalogueMameFamillePromise={data.catalogueMameFamille}
              getAnchorText={getAnchorText}
            />
          </aside>

          {/* Contenu principal */}
          <main className="flex-1 min-w-0">
            <div className="space-y-6">
              {/* Barre d'outils vue - Composant extrait */}
              <PiecesToolbar
                viewMode={viewMode}
                setViewMode={setViewMode}
                sortBy={sortBy}
                setSortBy={setSortBy}
                filteredCount={filteredProducts.length}
                minPrice={data.minPrice}
                selectedPiecesCount={selectedPieces.length}
              />

              {/* CTA VIN compact — rassurance compatibilité */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">
                    Pas sûr de la compatibilité ?
                  </span>{" "}
                  Vérifiez avec votre numéro de châssis (VIN)
                </p>
                <a
                  href="#compatibilite"
                  className="flex-shrink-0 text-sm font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md transition-colors"
                >
                  Vérifier
                </a>
              </div>

              {/* Trust bar - reassurance mobile */}
              <FrictionReducerGroup
                assurances={["return", "secure-payment", "support"]}
                variant="compact"
                layout="grid"
                className="py-3 border-y border-gray-100"
              />

              {/* Affichage des pièces selon le mode */}
              <div
                className={
                  isFilterPending
                    ? "opacity-60 transition-opacity duration-150"
                    : "transition-opacity duration-150"
                }
              >
                {data.grouped_pieces && data.grouped_pieces.length > 0 ? (
                  // Affichage groupé - Composant extrait
                  <PiecesGroupedDisplay
                    groupedPieces={data.grouped_pieces}
                    activeFilters={activeFilters}
                    viewMode={viewMode}
                    vehicleModele={data.vehicle.modele}
                    vehicleMarque={data.vehicle.marque}
                    selectedPieces={selectedPieces}
                    onSelectPiece={handleSelectPiece}
                    typeId={data.vehicle.typeId}
                  />
                ) : (
                  // âœ¨ FALLBACK: Affichage simple si pas de groupes
                  <>
                    {viewMode === "grid" && (
                      <PiecesGridView
                        pieces={filteredProducts}
                        onSelectPiece={handleSelectPiece}
                        selectedPieces={selectedPieces}
                        vehicleMarque={data.vehicle.marque}
                        typeId={data.vehicle.typeId}
                      />
                    )}

                    {viewMode === "list" && (
                      <PiecesListView
                        pieces={filteredProducts}
                        onSelectPiece={handleSelectPiece}
                        selectedPieces={selectedPieces}
                        typeId={data.vehicle.typeId}
                      />
                    )}
                  </>
                )}

                {viewMode === "comparison" && (
                  <PiecesComparisonView
                    pieces={filteredProducts}
                    selectedPieces={selectedPieces}
                    onRemovePiece={handleRemoveFromComparison}
                  />
                )}
              </div>

              {/* Pièces recommandées - Composant avec SEO switches */}
              <PiecesRecommendedSection
                pieces={recommendedPieces}
                visible={viewMode !== "comparison"}
                seoSwitches={resolvedSeoSwitches ?? undefined}
                gamme={data.gamme}
                vehicle={data.vehicle}
              />

              {/* Sections SEO */}
              <div className="space-y-6 mt-12">
                <PiecesSEOSection
                  content={data.seoContent}
                  vehicleName={`${data.vehicle.marque} ${data.vehicle.modele} ${data.vehicle.type}`}
                  gammeName={data.gamme.name}
                />

                {/* 🎯 Section Références OEM Constructeur - Composant extrait */}
                <PiecesOemSection
                  groupedPieces={data.grouped_pieces}
                  vehicle={data.vehicle}
                  gamme={data.gamme}
                />

                {/* SSR: Composants SEO rendus côté serveur (visibilité Googlebot) */}
                <PiecesBuyingGuide guide={data.buyingGuide} />
                <FAQSection faq={data.faqItems} withJsonLd={false} />
                <div id="compatibilite">
                  <PiecesCompatibilityInfo
                    compatibility={data.compatibilityInfo}
                    vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                    motorCodesFormatted={data.vehicle.motorCodesFormatted}
                    mineCodesFormatted={data.vehicle.mineCodesFormatted}
                  />
                </div>

                {/* PiecesStatistics reste lazy (pur UX, zéro valeur SEO) */}
                <Suspense
                  fallback={
                    <div className="h-24 bg-gray-100 animate-pulse rounded-lg" />
                  }
                >
                  <PiecesStatistics
                    pieces={data.pieces}
                    vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                    gammeName={data.gamme.name}
                  />
                </Suspense>
              </div>
            </div>
          </main>
        </div>

        {/* Cross-selling - SSR pour maillage interne (5-12 liens) */}
        {data.crossSellingGammes.length > 0 && (
          <div className="mt-12">
            <PiecesCrossSelling
              gammes={data.crossSellingGammes}
              vehicle={data.vehicle}
            />
          </div>
        )}

        {/* Articles liés - deferred pour ne pas bloquer LCP */}
        <Suspense fallback={null}>
          <Await resolve={data.blogData} errorElement={null}>
            {(blogData) => {
              const validArticles = (blogData?.relatedArticles || []).filter(
                (a): a is NonNullable<typeof a> => a !== null,
              );
              return validArticles.length > 0 ? (
                <div className="container mx-auto px-4">
                  <PiecesRelatedArticles
                    articles={validArticles}
                    gammeName={data.gamme.name}
                    vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                  />
                </div>
              ) : null;
            }}
          </Await>
        </Suspense>

        {/* Section "Voir aussi" - Maillage interne SEO (composant extrait) */}
        <PiecesVoirAussi
          links={data.voirAussiLinks}
          gamme={data.gamme}
          vehicle={data.vehicle}
          onLinkClick={handleVoirAussiClick}
        />
      </div>

      {/* Bouton retour en haut */}
      <ScrollToTop />

      {/* Mobile bottom bar : bouton Filtrer */}
      <MobileBottomBarSpacer />
      <MobileBottomBar>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          {showFilters ? "Masquer filtres" : "Filtrer"}
          {(activeFilters.brands.length > 0 ||
            activeFilters.quality !== "all" ||
            activeFilters.priceRange !== "all") && (
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              {activeFilters.brands.length +
                (activeFilters.quality !== "all" ? 1 : 0) +
                (activeFilters.priceRange !== "all" ? 1 : 0)}
            </span>
          )}
        </button>
      </MobileBottomBar>

      {/* Performance debug (dev only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg backdrop-blur-sm">
          <div>âš¡ Load: {data.performance.loadTime}ms</div>
          <div>📦 Pièces: {data.count}</div>
          <div>📍 Filtrées: {filteredProducts.length}</div>
        </div>
      )}
    </div>
  );
}

// ========================================
// 🚨 ERROR BOUNDARY - Gestion 410 Gone & 503 Service Unavailable
// ========================================

export function ErrorBoundary() {
  const error = useRouteError();
  // SSR-safe: Log détaillé de l'erreur uniquement côté client
  useEffect(() => {
    logger.error("🚨 [ERROR BOUNDARY] Erreur capturée:", error);
    logger.error("🚨 [ERROR BOUNDARY] Type:", typeof error);
    logger.error(
      "🚨 [ERROR BOUNDARY] Stack:",
      error instanceof Error ? error.stack : "N/A",
    );
  }, [error]);

  // 🛡️ Gestion spécifique du 503 Service Unavailable (erreur réseau temporaire)
  if (isRouteErrorResponse(error)) {
    return (
      <ErrorGeneric
        status={error.status}
        message={error.statusText || error.data?.message}
      />
    );
  }

  return <ErrorGeneric />;
}
