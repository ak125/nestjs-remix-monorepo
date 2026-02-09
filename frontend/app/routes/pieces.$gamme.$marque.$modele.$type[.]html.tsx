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
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Await,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useRouteError,
} from "@remix-run/react";
import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
// 🚀 LCP OPTIMIZATION: fetchGammePageData supprimé (redondant avec RM V2 RPC)

// ========================================
// 📦 IMPORTS DES MODULES REFACTORISÉS
// ========================================

// Composants UI CRITIQUES (above-fold - chargés immédiatement)
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { ScrollToTop } from "../components/blog/ScrollToTop";
import { Error410 } from "../components/errors/Error410";
import { Error503 } from "../components/errors/Error503";
import { Breadcrumbs } from "../components/layout/Breadcrumbs";
import { PiecesCatalogueFamille } from "../components/pieces/PiecesCatalogueFamille";
import { PiecesComparisonView } from "../components/pieces/PiecesComparisonView";
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
import { PiecesToolbar } from "../components/pieces/PiecesToolbar";
import { PiecesVoirAussi } from "../components/pieces/PiecesVoirAussi";
// VehicleSelector supprimé - remplacé par badge véhicule avec lien "Changer"

// Hook custom
import { usePiecesFilters } from "../hooks/use-pieces-filters";
import { useSeoLinkTracking } from "../hooks/useSeoLinkTracking";

// SEO Page Role (Phase 5 - Quasi-Incopiable)

// Services API

// 🚀 RM API V2 - Complete Read Model (~400ms, single RPC)
import { fetchRmPageV2 } from "../services/api/rm-api.service";
import {
  fetchBlogArticle,
  fetchRelatedArticlesForGamme,
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
  buildVoirAussiLinks,
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

// 🚀 LCP OPTIMIZATION V6: Lazy-load composants below-fold
// Ces sections ne sont pas visibles au premier paint - différer leur chargement
const PiecesBuyingGuide = lazy(() =>
  import("../components/pieces/PiecesBuyingGuide").then((m) => ({
    default: m.PiecesBuyingGuide,
  })),
);
const PiecesCompatibilityInfo = lazy(() =>
  import("../components/pieces/PiecesCompatibilityInfo").then((m) => ({
    default: m.PiecesCompatibilityInfo,
  })),
);
const PiecesCrossSelling = lazy(() =>
  import("../components/pieces/PiecesCrossSelling").then((m) => ({
    default: m.PiecesCrossSelling,
  })),
);
const PiecesFAQSection = lazy(() =>
  import("../components/pieces/PiecesFAQSection").then((m) => ({
    default: m.PiecesFAQSection,
  })),
);
const PiecesRelatedArticles = lazy(() =>
  import("../components/pieces/PiecesRelatedArticles").then((m) => ({
    default: m.PiecesRelatedArticles,
  })),
);
const PiecesSEOSection = lazy(() =>
  import("../components/pieces/PiecesSEOSection").then((m) => ({
    default: m.PiecesSEOSection,
  })),
);
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

  // 🔄 SEO: Si validation véhicule échouée → 301 redirect vers page gamme
  // Raison: 412 est traité comme 4xx par Google → désindexation
  // 301 préserve le PageRank et guide vers une page indexable
  if (vehicleValidationFailed) {
    logger.log(
      `🔄 [301] Validation véhicule échouée, redirect vers page gamme: /pieces/${gammeData.alias}-${gammeId}.html`,
    );
    return redirect(`/pieces/${gammeData.alias}-${gammeId}.html`, 301);
  }

  // 🚀 RM API V2 - Complete Read Model (single source of truth)
  // Returns: products, grouped_pieces, vehicleInfo, gamme, seo, oemRefs, crossSelling, filters

  // 🚀 LCP V8: Lancer hierarchy immédiatement (pour catalogueMameFamille deferred)
  const hierarchyPromise = fetchJsonOrNull<HierarchyData>(
    `http://127.0.0.1:3000/api/catalog/gammes/hierarchy`,
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

  // 🚀 PARALLÉLISATION: RM V2 + seoSwitches en même temps
  const [rmV2Response, seoSwitches] = await Promise.all([
    rmV2Promise,
    seoSwitchesPromise,
  ]);

  // 🔄 SEO: Validation RM V2 - Si échec → 301 redirect vers page gamme
  if (!rmV2Response || !isRmV2DataUsable(rmV2Response, 1)) {
    logger.log(
      `🔄 [301] RM V2 invalide ou 0 produits, redirect vers page gamme: /pieces/${gammeData.alias}-${gammeId}.html`,
    );
    return redirect(`/pieces/${gammeData.alias}-${gammeId}.html`, 301);
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

  // 🔗 SEO: URLs pré-calculées pour section "Voir aussi" (pas de construction côté client)
  const voirAussiLinks = buildVoirAussiLinks(gamme, vehicle);

  // Generated Content (FAQ and buying guide with vehicle context)
  const faqItems = generateFAQ(vehicle, gamme);
  const buyingGuide = generateBuyingGuide(vehicle, gamme);

  // 🚀 LCP OPTIMIZATION V6: blogArticle et relatedArticles streamés via defer()
  const blogArticlePromise = fetchBlogArticle(gamme, vehicle).catch(() => null);
  const relatedArticlesPromise = fetchRelatedArticlesForGamme(
    gamme,
    vehicle,
  ).catch(() => []);

  // 🚀 LCP OPTIMIZATION V8: Catalogue Famille streamé via defer() (below-fold)
  const catalogueMameFamillePromise = buildCataloguePromise(
    gammeId,
    hierarchyPromise,
  );

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

      // === DONNÉES CRITIQUES SECONDAIRES (résolues après RM V2) ===
      seoSwitches, // Résolu car utilisé dans callback JS

      // === DONNÉES STREAMÉES (non-bloquantes, chargées en background) ===
      // 🚀 LCP OPTIMIZATION V7: catalogueMameFamille streamé (below-fold)
      catalogueMameFamille: catalogueMameFamillePromise,
      relatedArticles: relatedArticlesPromise,
      blogArticle: blogArticlePromise,
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
// 📔 META - SEO (Schema.org généré par composant Breadcrumbs)
// ========================================

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) {
    return [
      { title: "Pièces automobile" },
      { name: "description", content: "Catalogue de pièces détachées" },
    ];
  }

  // Construire URL canonique complète
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;

  // 📊 Schema.org @graph - Extrait dans pieces-schema.utils.ts
  const productSchema = buildPiecesProductSchema({
    vehicle: data.vehicle,
    gamme: data.gamme,
    pieces: data.pieces,
    seo: { description: data.seo.description },
    minPrice: data.minPrice,
    maxPrice: data.maxPrice,
    count: data.count,
    oemRefs: data.oemRefs,
    oemRefsSeo: data.oemRefsSeo,
    crossSellingGammes: data.crossSellingGammes,
    canonicalUrl,
  });

  return [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { property: "og:title", content: data.seo.title },
    { property: "og:description", content: data.seo.description },
    // noindex si ≤ 5 produits (thin content)
    {
      name: "robots",
      content: data.count <= 5 ? "noindex, follow" : "index, follow",
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
    ...buildHeroImagePreload(data.vehicle),

    // âœ¨ NOUVEAU: Schema.org Product (rich snippets)
    ...(productSchema
      ? [
          {
            "script:ld+json": productSchema,
          },
        ]
      : []),
  ];
};

// ========================================
// 🎨 COMPOSANT PRINCIPAL
// ========================================

export default function PiecesVehicleRoute() {
  const data = useLoaderData<typeof loader>();
  const location = useLocation(); // 🆕 Pour Schema.org breadcrumb
  const { trackClick, trackImpression } = useSeoLinkTracking();

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

  // 🔗 Fonction pour générer des ancres SEO variées depuis les switches
  const getAnchorText = useCallback(
    (index: number): string => {
      const switches = data.seoSwitches?.verbs || [];
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
    [data.seoSwitches],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 relative">
      {/* Pattern d'arrière-plan subtil */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE0YzIuMiAwIDQgMS44IDQgNHMtMS44IDQtNCA0LTQtMS44LTQtNGMwLTIuMiAxLjgtNCA0LTR6bTAgNDBjMi4yIDAgNCAxLjggNCA0cy0xLjggNC00IDQtNC0xLjgtNC00YzAtMi4yIDEuOC00IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"></div>

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
          <Breadcrumbs
            items={buildPiecesBreadcrumbs(
              data.gamme,
              data.vehicle,
              location.pathname,
            )}
            showHome={false}
            separator="left-arrow"
            enableSchema={true}
          />
        </div>
      </div>

      {/* Conteneur principal */}
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* 🚗 Badge véhicule actuel avec lien pour changer */}
        <div className="mb-6 sticky top-4 z-20 animate-in fade-in slide-in-from-top duration-500">
          <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-gray-500">
                    Véhicule sélectionné
                  </div>
                  <div className="font-semibold text-gray-900">
                    {data.vehicle.marque} {data.vehicle.modele}{" "}
                    {data.vehicle.type}
                  </div>
                </div>
              </div>
              <a
                href={`/pieces/${data.gamme.alias}-${data.gamme.id}.html`}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Changer
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar filtres et catalogue */}
          <aside className="lg:w-80 flex-shrink-0 space-y-6 animate-in fade-in slide-in-from-left duration-700">
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

            {/* Catalogue collapsible - Composant extrait */}
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

              {/* Affichage des pièces selon le mode */}
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
                    />
                  )}

                  {viewMode === "list" && (
                    <PiecesListView
                      pieces={filteredProducts}
                      onSelectPiece={handleSelectPiece}
                      selectedPieces={selectedPieces}
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

              {/* Pièces recommandées - Composant avec SEO switches */}
              <PiecesRecommendedSection
                pieces={recommendedPieces}
                visible={viewMode !== "comparison"}
                seoSwitches={data.seoSwitches}
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

                {/* 🚀 LCP OPTIMIZATION V6: Suspense boundaries pour composants lazy below-fold */}
                <Suspense
                  fallback={
                    <div className="h-24 bg-gray-100 animate-pulse rounded-lg" />
                  }
                >
                  <PiecesBuyingGuide guide={data.buyingGuide} />
                </Suspense>

                <Suspense
                  fallback={
                    <div className="h-24 bg-gray-100 animate-pulse rounded-lg" />
                  }
                >
                  <PiecesFAQSection items={data.faqItems} />
                </Suspense>

                <Suspense
                  fallback={
                    <div className="h-24 bg-gray-100 animate-pulse rounded-lg" />
                  }
                >
                  <PiecesCompatibilityInfo
                    compatibility={data.compatibilityInfo}
                    vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                    motorCodesFormatted={data.vehicle.motorCodesFormatted}
                    mineCodesFormatted={data.vehicle.mineCodesFormatted}
                  />
                </Suspense>

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

        {/* Cross-selling - Suspense pour lazy component */}
        {data.crossSellingGammes.length > 0 && (
          <div className="mt-12">
            <Suspense
              fallback={
                <div className="h-32 bg-gray-100 animate-pulse rounded-lg mx-4" />
              }
            >
              <PiecesCrossSelling
                gammes={data.crossSellingGammes}
                vehicle={data.vehicle}
              />
            </Suspense>
          </div>
        )}

        {/* 🚀 LCP OPTIMIZATION V6: Articles liés streamés via defer() + Await */}
        <Suspense
          fallback={
            <div className="h-32 bg-gray-100 animate-pulse rounded-lg mx-4" />
          }
        >
          <Await resolve={data.relatedArticles}>
            {(resolvedArticles) => {
              // Filtrer les nulls et vérifier qu'il y a des articles
              const validArticles = (resolvedArticles || []).filter(
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
  // SSR-safe: utiliser useLocation au lieu de window.location
  const location = useLocation();

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
  if (isRouteErrorResponse(error) && error.status === 503) {
    return (
      <Error503
        retryAfter={10}
        message="Notre service est temporairement surchargé."
        url={location.pathname}
      />
    );
  }

  // Gestion spécifique du 410 Gone (page sans résultats)
  if (isRouteErrorResponse(error) && error.status === 410) {
    return (
      <>
        <head>
          <meta name="robots" content="noindex, nofollow" />
          <meta name="googlebot" content="noindex, nofollow" />
        </head>
        <Error410 url={location.pathname} isOldLink={false} />
      </>
    );
  }

  // Note: 412 supprimé - toutes les erreurs récupérables font maintenant 301 redirect
  // vers la page gamme pour préserver le PageRank (SEO optimal)

  // Message d'erreur détaillé pour le développement
  const errorMessage =
    error instanceof Error
      ? error.message
      : isRouteErrorResponse(error)
        ? `${error.status}: ${error.statusText}`
        : "Une erreur inattendue s'est produite";

  const errorDetails =
    error instanceof Error && error.stack
      ? error.stack
      : JSON.stringify(error, null, 2);

  // Autres erreurs (404, 500, etc.)
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Une erreur est survenue
        </h1>
        <p className="text-gray-600 mb-4">{errorMessage}</p>

        {/* Détails de l'erreur en mode développement */}
        {process.env.NODE_ENV === "development" && (
          <details className="mb-6 bg-gray-100 rounded p-4">
            <summary className="cursor-pointer font-semibold text-sm text-gray-700 mb-2">
              Détails techniques (développement)
            </summary>
            <pre className="text-xs text-gray-600 overflow-auto max-h-64 whitespace-pre-wrap">
              {errorDetails}
            </pre>
          </details>
        )}

        <a
          href="/"
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-center font-medium transition-colors"
        >
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
