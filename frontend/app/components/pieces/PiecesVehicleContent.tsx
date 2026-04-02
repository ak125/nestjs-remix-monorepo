/**
 * Composant principal de la page R2 Produit
 * Rendu du render tree complet avec hooks, filtres, sections SEO
 */

import { Await, Link, useLoaderData, useLocation } from "@remix-run/react";
import { ShoppingCart } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ScrollToTop } from "~/components/blog/ScrollToTop";
import {
  MobileBottomBar,
  MobileBottomBarSpacer,
} from "~/components/layout/MobileBottomBar";
import { PiecesBuyingGuide } from "~/components/pieces/PiecesBuyingGuide";
import { PiecesCatalogueFamille } from "~/components/pieces/PiecesCatalogueFamille";
import { PiecesComparisonView } from "~/components/pieces/PiecesComparisonView";
import { PiecesCompatibilityInfo } from "~/components/pieces/PiecesCompatibilityInfo";
import { PiecesCrossSelling } from "~/components/pieces/PiecesCrossSelling";
import { PiecesFilterSidebar } from "~/components/pieces/PiecesFilterSidebar";
import { PiecesGridView } from "~/components/pieces/PiecesGridView";
import { PiecesGroupedDisplay } from "~/components/pieces/PiecesGroupedDisplay";
import { PiecesHeader } from "~/components/pieces/PiecesHeader";
import { PiecesListView } from "~/components/pieces/PiecesListView";
import { PiecesOemSection } from "~/components/pieces/PiecesOemSection";
import { PiecesRecommendedSection } from "~/components/pieces/PiecesRecommendedSection";
import { PiecesRelatedArticles } from "~/components/pieces/PiecesRelatedArticles";
import { PiecesSEOSection } from "~/components/pieces/PiecesSEOSection";
import { PiecesToolbar } from "~/components/pieces/PiecesToolbar";
import { PiecesVoirAussi } from "~/components/pieces/PiecesVoirAussi";
import { FAQSection } from "~/components/seo/FAQSection";
import { FrictionReducerGroup } from "~/components/trust/FrictionReducer";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { usePiecesFilters } from "~/hooks/use-pieces-filters";
import { openCartSidebar } from "~/hooks/useCartSidebar";
import { useRootCart } from "~/hooks/useRootData";
import { useSeoLinkTracking } from "~/hooks/useSeoLinkTracking";
import { isValidPosition } from "~/utils/pieces-filters.utils";
import { buildPiecesBreadcrumbs } from "~/utils/url-builder.utils";

// LCP OPTIMIZATION V6: Seul PiecesStatistics reste lazy (pur UX, zero valeur SEO)
// Les 6 autres composants sont importes directement pour SSR (visibilite Googlebot)
const PiecesStatistics = lazy(() =>
  import("~/components/pieces/PiecesStatistics").then((m) => ({
    default: m.PiecesStatistics,
  })),
);

export function PiecesVehicleContent() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = useLoaderData<any>() as any;

  const location = useLocation();
  const { trackClick, trackImpression } = useSeoLinkTracking();
  const [showFilters, setShowFilters] = useState(false);
  const cartData = useRootCart();
  const cartCount = cartData?.summary?.total_items || 0;

  // Hook custom pour la logique de filtrage (gere son propre etat)
  const {
    activeFilters,
    sortBy,
    viewMode,
    selectedPieces,
    filteredProducts,
    uniqueBrands,
    recommendedPieces,
    dynamicFilterCounts,
    brandAverageNotes,
    setActiveFilters,
    setSortBy,
    setViewMode,
    resetAllFilters,
    togglePieceSelection,
    isFilterPending,
  } = usePiecesFilters(data.pieces);

  // Track les impressions de la section "Voir aussi" au montage
  useEffect(() => {
    trackImpression("VoirAussi", 4); // 4 liens dans la section
    if (data.crossSellingGammes?.length > 0) {
      trackImpression("CrossSelling", data.crossSellingGammes.length);
    }
  }, [trackImpression, data.crossSellingGammes?.length]);

  // Handlers pour tracker les clics "Voir aussi"
  const handleVoirAussiClick = useCallback(
    (url: string, anchorText: string) => {
      trackClick("VoirAussi", url, { anchorText, position: "voiraussi" });
    },
    [trackClick],
  );

  // Actions de selection pour mode comparaison
  // Optimise avec useCallback pour eviter re-creation a chaque render
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

  // Calcul des positions disponibles pour le filtre sidebar
  const availablePositions = useMemo((): string[] => {
    const groupedPieces = data.grouped_pieces || [];
    const positions: string[] = groupedPieces
      .map((g: any) => g.filtre_side as string)
      .filter((side): side is string => Boolean(side));
    return [...new Set(positions)];
  }, [data.grouped_pieces]);

  // Label du filtre position adapte selon la gamme
  const positionLabel = useMemo(() => {
    const gammeAlias = data.gamme?.alias?.toLowerCase() || "";
    // Retroviseurs, essuie-glaces, clignotants -> Cote (Gauche/Droite)
    if (
      ["retroviseur", "essuie-glace", "clignotant", "feu", "phare"].some((k) =>
        gammeAlias.includes(k),
      )
    ) {
      return "Côté";
    }
    // Plaquettes, disques, amortisseurs -> Position (Avant/Arriere)
    return "Position";
  }, [data.gamme]);

  // Validation: reset position si invalide (ex: donnees API changent)
  useEffect(() => {
    if (!isValidPosition(activeFilters.position, availablePositions)) {
      setActiveFilters((prev) => ({ ...prev, position: "all" }));
    }
  }, [availablePositions, activeFilters.position, setActiveFilters]);

  // LCP V9: seoSwitches is deferred — resolve promise when available
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

  // Fonction pour generer des ancres SEO variees depuis les switches
  const getAnchorText = useCallback(
    (index: number): string => {
      const switches = resolvedSeoSwitches?.verbs || [];
      if (switches.length > 0) {
        const switchItem = switches[index % switches.length];
        const verb = switchItem?.content || "";
        if (verb) {
          // Capitaliser la premiere lettre
          return verb.charAt(0).toUpperCase() + verb.slice(1);
        }
      }
      // Ancres par defaut avec rotation
      const defaultAnchors = ["Voir", "Découvrir", "Explorer", "Détails"];
      return defaultAnchors[index % defaultAnchors.length];
    },
    [resolvedSeoSwitches],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 relative overflow-x-clip">
      {/* Pattern d'arriere-plan subtil */}
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

      {/* Fil d'ariane SEO optimise - Reutilisation composant Breadcrumbs */}
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
        {/* Badge vehicule actuel avec lien pour changer */}
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

              {/* CTA VIN compact — rassurance compatibilite */}
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

              {/* Affichage des pieces selon le mode */}
              <div
                className={
                  isFilterPending
                    ? "opacity-60 transition-opacity duration-150"
                    : "transition-opacity duration-150"
                }
              >
                {data.grouped_pieces && data.grouped_pieces.length > 0 ? (
                  // Affichage groupe - Composant extrait
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
                  // FALLBACK: Affichage simple si pas de groupes
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

              {/* Pieces recommandees - Composant avec SEO switches */}
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

                {/* Section References OEM Constructeur - Composant extrait */}
                <PiecesOemSection
                  groupedPieces={data.grouped_pieces}
                  vehicle={data.vehicle}
                  gamme={data.gamme}
                />

                {/* SSR: Composants SEO rendus cote serveur (visibilite Googlebot) */}
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

                {/* PiecesStatistics reste lazy (pur UX, zero valeur SEO) */}
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

        {/* Articles lies - deferred pour ne pas bloquer LCP */}
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

      {/* Mobile bottom bar : Panier + Filtrer */}
      <MobileBottomBarSpacer />
      <MobileBottomBar>
        {/* Bouton Panier — accès direct sans scroller jusqu'au navbar */}
        <button
          type="button"
          onClick={openCartSidebar}
          className="relative py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2 transition-colors"
        >
          <ShoppingCart className="w-5 h-5" />
          Panier
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 bg-white text-orange-500 text-xs font-bold rounded-full flex items-center justify-center px-1">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
        {/* Bouton Filtrer */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
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
          <div>Load: {data.performance.loadTime}ms</div>
          <div>Pieces: {data.count}</div>
          <div>Filtrees: {filteredProducts.length}</div>
        </div>
      )}
    </div>
  );
}
