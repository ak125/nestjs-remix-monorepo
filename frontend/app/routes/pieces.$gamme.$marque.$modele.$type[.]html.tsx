// 🔧 Route pièces avec véhicule - Version REFACTORISÉE
// Format: /pieces/{gamme}/{marque}/{modele}/{type}.html
// ⚠️ URLs PRÉSERVÉES - Ne jamais modifier le format d'URL

import {
  defer,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Await,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
// 🚀 LCP OPTIMIZATION: fetchGammePageData supprimé (RPC V2 redondant avec batch-loader RPC V3)

// ========================================
// 📦 IMPORTS DES MODULES REFACTORISÉS
// ========================================

// Composants UI CRITIQUES (above-fold - chargés immédiatement)
import { ScrollToTop } from "../components/blog/ScrollToTop";
import { Error410 } from "../components/errors/Error410";
import { Error503 } from "../components/errors/Error503";
import { Breadcrumbs } from "../components/layout/Breadcrumbs";
import { PiecesCatalogueFamille } from "../components/pieces/PiecesCatalogueFamille";
import { PiecesComparisonView } from "../components/pieces/PiecesComparisonView";
import { PiecesFilterSidebar } from "../components/pieces/PiecesFilterSidebar";
import { PiecesGridView } from "../components/pieces/PiecesGridView";
import { PiecesGroupedDisplay } from "../components/pieces/PiecesGroupedDisplay";
import { PiecesHeader } from "../components/pieces/PiecesHeader";
import { PiecesListView } from "../components/pieces/PiecesListView";
import { PiecesOemSection } from "../components/pieces/PiecesOemSection";
import { PiecesRecommendedSection } from "../components/pieces/PiecesRecommendedSection";
import { PiecesToolbar } from "../components/pieces/PiecesToolbar";
import { PiecesVoirAussi } from "../components/pieces/PiecesVoirAussi";
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";

// Hook custom
import { usePiecesFilters } from "../hooks/use-pieces-filters";
import { useSeoLinkTracking } from "../hooks/useSeoLinkTracking";

// Services API
import {
  fetchBatchLoader,
  fetchBlogArticle,
  fetchCrossSellingGammes as _fetchCrossSellingGammes,
  fetchRelatedArticlesForGamme,
  fetchSeoSwitches,
} from "../services/pieces/pieces-route.service";

// Types centralisés
import {
  type GammeData,
  type LoaderData as _LoaderData,
  type PieceData as _PieceData,
  type VehicleData,
} from "../types/pieces-route.types";

// Utilitaires
import { fetchJsonOrNull } from "../utils/fetch.utils";
import { buildCataloguePromise, buildCompatibilityInfo, buildGammeData, buildVehicleData, type HierarchyData } from "../utils/pieces-loader.utils";
import {
  calculatePriceStats,
  generateBuyingGuide,
  generateFAQ,
  generateRelatedArticles as _generateRelatedArticles, // Fallback uniquement
  generateSEOContent,
  mapBatchPiecesToData,
  mergeSeoContent,
  parseUrlParam,
  resolveGammeId,
  resolveVehicleIds,
  validateVehicleIds,
} from "../utils/pieces-route.utils";
import { buildHeroImagePreload, buildPiecesProductSchema } from "../utils/seo/pieces-schema.utils";
import { buildPiecesBreadcrumbs, buildVoirAussiLinks } from "../utils/url-builder.utils";

// 🚀 LCP OPTIMIZATION V6: Lazy-load composants below-fold
// Ces sections ne sont pas visibles au premier paint - différer leur chargement
const PiecesBuyingGuide = lazy(() => import("../components/pieces/PiecesBuyingGuide").then(m => ({ default: m.PiecesBuyingGuide })));
const PiecesCompatibilityInfo = lazy(() => import("../components/pieces/PiecesCompatibilityInfo").then(m => ({ default: m.PiecesCompatibilityInfo })));
const PiecesCrossSelling = lazy(() => import("../components/pieces/PiecesCrossSelling").then(m => ({ default: m.PiecesCrossSelling })));
const PiecesFAQSection = lazy(() => import("../components/pieces/PiecesFAQSection").then(m => ({ default: m.PiecesFAQSection })));
const PiecesRelatedArticles = lazy(() => import("../components/pieces/PiecesRelatedArticles").then(m => ({ default: m.PiecesRelatedArticles })));
const PiecesSEOSection = lazy(() => import("../components/pieces/PiecesSEOSection").then(m => ({ default: m.PiecesSEOSection })));
const PiecesStatistics = lazy(() => import("../components/pieces/PiecesStatistics").then(m => ({ default: m.PiecesStatistics })));

// ========================================
// 🔄 LOADER - Récupération des données
// ========================================

export async function loader({ params, request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  // Debug URL complète
  const url = new URL(request.url);
  console.log("📍 [LOADER] URL complète:", url.pathname);

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
  const marqueData = parseUrlParam(rawMarque);
  const modeleData = parseUrlParam(rawModele);
  const typeData = parseUrlParam(rawType);

  // 3. Résolution des IDs via API (🚀 PARALLÉLISÉ pour performance)
  const [vehicleIds, gammeId] = await Promise.all([
    resolveVehicleIds(rawMarque, rawModele, rawType),
    resolveGammeId(rawGamme),
  ]);

  // Validation des IDs véhicule - Si invalides, on laisse batch-loader retourner 404
  // 🛡️ gammeId n'est PAS validé ici - délégué au batch-loader pour permettre gammeId=0 → 404 SEO
  try {
    validateVehicleIds({
      marqueId: vehicleIds.marqueId,
      modeleId: vehicleIds.modeleId,
      typeId: vehicleIds.typeId,
      // gammeId: gammeId, // Retiré - validation par batch-loader (ligne 117-119 backend)
      source: "loader-validation",
    });
  } catch (validationError) {
    // 🛡️ IDs invalides → 404 SEO au lieu de 500
    console.warn(`⚠️ [LOADER] Validation IDs échouée, retour 404:`, validationError);
    throw new Response("Véhicule non trouvé", {
      status: 404,
      statusText: "Not Found",
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // 🚀 LCP OPTIMIZATION V7: Seul batch-loader bloque le LCP
  // hierarchy et switches sont streamés via defer() car below-fold

  // 1. Lancer les fetches non-critiques IMMÉDIATEMENT (sans await)
  const hierarchyPromise = fetchJsonOrNull<HierarchyData>(`http://localhost:3000/api/catalog/gammes/hierarchy`, 3000);
  const seoSwitchesPromise = fetchSeoSwitches(gammeId, 3000);

  // 2. Seul le batch-loader bloque le LCP (données critiques) - Service extrait
  const batchResponse = await fetchBatchLoader(vehicleIds.typeId, gammeId);

  // 3. Attendre seoSwitches APRÈS batch-loader (ne bloque pas le LCP, mais résolu avant render)
  const seoSwitches = await seoSwitchesPromise;

  console.log(`🚀 [LOADER] batch-loader terminé, hierarchy/switches en streaming`);

  // 5. Construction des objets Vehicle & Gamme (via utilitaires centralisés)
  const vehicle: VehicleData = buildVehicleData({
    vehicleInfo: batchResponse.vehicleInfo,
    vehicleIds,
    urlParams: {
      marqueAlias: marqueData.alias,
      modeleAlias: modeleData.alias,
      typeAlias: typeData.alias,
    },
  });

  const gamme: GammeData = buildGammeData(gammeId, gammeData.alias);

  // 🔗 SEO: URLs pré-calculées pour section "Voir aussi" (pas de construction côté client)
  const voirAussiLinks = buildVoirAussiLinks(gamme, vehicle);

  // 🚀 V4: blogArticle et relatedArticles seront récupérés en parallèle plus bas

  // 6. Traitement de la réponse Batch

  // Validation
  if (batchResponse.validation && !batchResponse.validation.valid) {
    const statusCode = batchResponse.validation.http_status || 410;
    const reason =
      batchResponse.validation.recommendation ||
      "Cette combinaison n'est pas disponible.";
    throw new Response(reason, {
      status: statusCode,
      statusText: statusCode === 410 ? "Gone" : "Not Found",
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // Mapping Pièces - Utilise utilitaire centralisé
  const piecesData = mapBatchPiecesToData(batchResponse.pieces);

  if (piecesData.length === 0) {
    throw new Response(
      `Cette combinaison ${gamme.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type} n'est pas disponible.`,
      {
        status: 410,
        statusText: "Gone",
        headers: {
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  }

  // Stats prix - Utilise utilitaire centralisé
  const { minPrice, maxPrice } = calculatePriceStats(piecesData);

  // SEO Content - Utilise utilitaire centralisé
  const seoContent = mergeSeoContent(generateSEOContent(vehicle, gamme), batchResponse.seo);

  // Cross Selling
  const crossSellingGammes = batchResponse.crossSelling || [];

  // Generated Content
  const faqItems = generateFAQ(vehicle, gamme);

  // 🚀 LCP OPTIMIZATION V6: blogArticle et relatedArticles streamés via defer()
  // Ces données ne bloquent plus le first paint - chargées en background
  const blogArticlePromise = fetchBlogArticle(gamme, vehicle).catch(() => null);
  const relatedArticlesPromise = fetchRelatedArticlesForGamme(gamme, vehicle).catch(() => []);

  const buyingGuide = generateBuyingGuide(vehicle, gamme);
  const compatibilityInfo = buildCompatibilityInfo(vehicle);

  // 🚀 LCP OPTIMIZATION V7: Catalogue Famille streamé via defer() (below-fold)
  // Utilise utilitaire centralisé pour construire le catalogue
  const catalogueMameFamillePromise = buildCataloguePromise(gammeId, hierarchyPromise);

  const loadTime = Date.now() - startTime;

  // 🚀 OPTIMISÉ V3: filters inclus dans batch-loader, plus d'appel séparé
  const filtersData =
    batchResponse.filters?.data || batchResponse.filters || null;

  // 🚀 LCP OPTIMIZATION V6: defer() pour streamer données non-critiques
  // Données critiques (vehicle, pieces, seo) : retournées immédiatement
  // Données non-critiques (relatedArticles, blogArticle) : streamées après le first paint
  return defer(
    {
      // === DONNÉES CRITIQUES (bloquantes, nécessaires pour LCP) ===
      vehicle,
      gamme,
      pieces: piecesData,
      grouped_pieces: batchResponse.grouped_pieces || batchResponse.blocs || [],
      count: piecesData.length,
      minPrice,
      maxPrice,
      filtersData,
      seoContent,
      faqItems,
      buyingGuide,
      compatibilityInfo,
      crossSellingGammes,
      oemRefs: batchResponse.oemRefs || undefined,
      oemRefsSeo: batchResponse.oemRefsSeo || undefined,
      voirAussiLinks, // 🔗 SEO: URLs pré-calculées pour section "Voir aussi"
      seo: {
        title: `${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} | Pièces Auto`,
        h1: seoContent.h1,
        description: seoContent.longDescription.substring(0, 160),
      },
      performance: {
        loadTime,
        source: "batch-loader",
        cacheHit: false,
      },

      // === DONNÉES CRITIQUES SECONDAIRES (résolues après batch-loader) ===
      seoSwitches, // Résolu car utilisé dans callback JS

      // === DONNÉES STREAMÉES (non-bloquantes, chargées en background) ===
      // 🚀 LCP OPTIMIZATION V7: catalogueMameFamille streamé (below-fold)
      catalogueMameFamille: catalogueMameFamillePromise,
      relatedArticles: relatedArticlesPromise,
      blogArticle: blogArticlePromise,
    },
    {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=86400, stale-while-revalidate=3600" },
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
    { name: "robots", content: "index, follow" },

    // âœ¨ NOUVEAU: Canonical URL
    { tagName: "link", rel: "canonical", href: canonicalUrl },

    // âœ¨ NOUVEAU: Resource Hints pour Supabase (préconnexion)
    {
      tagName: "link",
      rel: "preconnect",
      href: "https://cxpojprgwgubzjyqzmoq.supabase.co",
    },
    {
      tagName: "link",
      rel: "dns-prefetch",
      href: "https://cxpojprgwgubzjyqzmoq.supabase.co",
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

  // 🔗 Fonction pour générer des ancres SEO variées depuis les switches
  const getAnchorText = useCallback((index: number): string => {
    const switches = data.seoSwitches?.verbs || [];
    if (switches.length > 0) {
      const switchItem = switches[index % switches.length];
      const verb = switchItem?.content || '';
      if (verb) {
        // Capitaliser la première lettre
        return verb.charAt(0).toUpperCase() + verb.slice(1);
      }
    }
    // Ancres par défaut avec rotation
    const defaultAnchors = ['Voir', 'Découvrir', 'Explorer', 'Détails'];
    return defaultAnchors[index % defaultAnchors.length];
  }, [data.seoSwitches]);

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
            items={buildPiecesBreadcrumbs(data.gamme, data.vehicle)}
            showHome={false}
            separator="left-arrow"
            enableSchema={true}
          />
        </div>
      </div>

      {/* Conteneur principal */}
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* 🚗 Sélecteur de véhicule - Mode compact sticky */}
        <div className="mb-6 sticky top-4 z-20 animate-in fade-in slide-in-from-top duration-500">
          <VehicleSelectorV2
            mode="compact"
            context="pieces"
            variant="card"
            redirectOnSelect={false}
            onVehicleSelect={(vehicle) => {
              console.log("🔄 Véhicule sélectionné:", vehicle);
              // Construire URL avec format alias-id
              const brandSlug = `${vehicle.brand.marque_alias || vehicle.brand.marque_name.toLowerCase()}-${vehicle.brand.marque_id}`;
              const modelSlug = `${vehicle.model.modele_alias || vehicle.model.modele_name.toLowerCase()}-${vehicle.model.modele_id}`;
              const typeSlug = `${vehicle.type.type_alias || vehicle.type.type_name.toLowerCase()}-${vehicle.type.type_id}`;
              const url = `/pieces/${data.gamme.alias}/${brandSlug}/${modelSlug}/${typeSlug}.html`;
              window.location.href = url;
            }}
            currentVehicle={{
              brand: { id: data.vehicle.marqueId, name: data.vehicle.marque },
              model: { id: data.vehicle.modeleId, name: data.vehicle.modele },
              type: { id: data.vehicle.typeId, name: data.vehicle.type },
            }}
          />
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
                <Suspense fallback={<div className="h-24 bg-gray-100 animate-pulse rounded-lg" />}>
                  <PiecesBuyingGuide guide={data.buyingGuide} />
                </Suspense>

                <Suspense fallback={<div className="h-24 bg-gray-100 animate-pulse rounded-lg" />}>
                  <PiecesFAQSection items={data.faqItems} />
                </Suspense>

                <Suspense fallback={<div className="h-24 bg-gray-100 animate-pulse rounded-lg" />}>
                  <PiecesCompatibilityInfo
                    compatibility={data.compatibilityInfo}
                    vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                    motorCodesFormatted={data.vehicle.motorCodesFormatted}
                    mineCodesFormatted={data.vehicle.mineCodesFormatted}
                  />
                </Suspense>

                <Suspense fallback={<div className="h-24 bg-gray-100 animate-pulse rounded-lg" />}>
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
            <Suspense fallback={<div className="h-32 bg-gray-100 animate-pulse rounded-lg mx-4" />}>
              <PiecesCrossSelling
                gammes={data.crossSellingGammes}
                vehicle={data.vehicle}
              />
            </Suspense>
          </div>
        )}

        {/* 🚀 LCP OPTIMIZATION V6: Articles liés streamés via defer() + Await */}
        <Suspense fallback={<div className="h-32 bg-gray-100 animate-pulse rounded-lg mx-4" />}>
          <Await resolve={data.relatedArticles}>
            {(resolvedArticles) => {
              // Filtrer les nulls et vérifier qu'il y a des articles
              const validArticles = (resolvedArticles || []).filter((a): a is NonNullable<typeof a> => a !== null);
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

  // Log détaillé de l'erreur pour debug
  console.error("🚨 [ERROR BOUNDARY] Erreur capturée:", error);
  console.error("🚨 [ERROR BOUNDARY] Type:", typeof error);
  console.error(
    "🚨 [ERROR BOUNDARY] Stack:",
    error instanceof Error ? error.stack : "N/A",
  );

  // 🛡️ Gestion spécifique du 503 Service Unavailable (erreur réseau temporaire)
  if (isRouteErrorResponse(error) && error.status === 503) {
    return (
      <Error503
        retryAfter={10}
        message="Notre service est temporairement surchargé."
        url={typeof window !== "undefined" ? window.location.pathname : undefined}
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
        <Error410
          url={
            typeof window !== "undefined" ? window.location.pathname : undefined
          }
          isOldLink={false}
        />
      </>
    );
  }

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
