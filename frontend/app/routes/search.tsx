/**
 * 🔍 SEARCH ROUTE v5.0 - Aligné sur la page pièces
 *
 * Refactorisation complète pour utiliser:
 * - usePiecesFilters (hook centralisé)
 * - PiecesGridView / PiecesListView (même affichage)
 * - PiecesFilterSidebar (mêmes filtres)
 * - Groupement par gamme avec H2
 *
 * Fonctionnalités:
 * - Logos équipementiers avec barres fiabilité
 * - Filtrage client-side performant (useMemo)
 * - Groupement par gamme (comme PHP v7/v8)
 * - Vue grille/liste/comparaison
 * - Mobile-first responsive
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
  useNavigate,
  useFetcher,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  Search as SearchIcon,
  Grid3X3,
  List,
  Scale,
  RotateCcw,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  SortAsc,
  Package,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";

// 🎯 Layout components
import {
  MobileBottomBar,
  MobileBottomBarSpacer,
} from "../components/layout/MobileBottomBar";

// 🎯 Composants partagés avec page pièces
import { PiecesFilterSidebar } from "../components/pieces/PiecesFilterSidebar";
import { PiecesGridView } from "../components/pieces/PiecesGridView";
import { PiecesListView } from "../components/pieces/PiecesListView";

// Composants search spécifiques
import { NoResults } from "../components/search/NoResults";
import { SearchBar } from "../components/search/SearchBar";
// SearchPagination supprimé - remplacé par lazy loading

// UI
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

// Hook et types
import { usePiecesFilters } from "../hooks/use-pieces-filters";
import { type PieceData } from "../types/pieces-route.types";

// Mappers
import {
  mapSearchResultsToPieces,
  groupSearchResultsByGamme,
  type SearchResultItem,
  type SearchFacet,
  type GroupedSearchResults,
} from "../utils/search-mappers";
import { Error404 } from "~/components/errors/Error404";
import { Badge } from "~/components/ui";

// ===============================
// TYPES
// ===============================

interface SearchPageData {
  results: {
    items: SearchResultItem[];
    total: number;
    page: number; // 🎯 Lazy loading: page actuelle
    limit: number;
    hasMore: boolean; // Y a-t-il plus de résultats?
    facets?: SearchFacet[];
    suggestions?: string[];
    executionTime?: number;
    cached?: boolean;
  } | null;
  pieces: PieceData[]; // Pièces mappées côté serveur
  groupedPieces: GroupedSearchResults[]; // Groupées par gamme
  query: string;
  filters: Record<string, any>;
  hasError: boolean;
  errorMessage?: string;
  performance: {
    loadTime: number;
    searchTime?: number;
    totalItems?: number;
  };
}

// ===============================
// LOADER
// ===============================

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams);

  // Extraction paramètres
  const query = searchParams.q?.trim() || "";
  // 🎯 Lazy loading: on utilise page (API backend)
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const limit = 48; // Charger 48 items à la fois

  // Retour rapide si pas de requête
  if (!query) {
    return json<SearchPageData>({
      results: null,
      pieces: [],
      groupedPieces: [],
      query: "",
      filters: {},
      hasError: false,
      performance: { loadTime: Date.now() - startTime },
    });
  }

  try {
    // Appel API search (avec prix et images)
    const apiUrl = new URL("http://127.0.0.1:3000/api/search");
    apiUrl.searchParams.set("query", query);
    apiUrl.searchParams.set("page", page.toString());
    apiUrl.searchParams.set("limit", limit.toString());

    // Filtres multi-valeurs
    url.searchParams
      .getAll("marque")
      .forEach((m) => apiUrl.searchParams.append("marque", m));
    url.searchParams
      .getAll("gamme")
      .forEach((g) => apiUrl.searchParams.append("gamme", g));

    // Filtres simples
    if (searchParams.priceMin)
      apiUrl.searchParams.set("priceMin", searchParams.priceMin);
    if (searchParams.priceMax)
      apiUrl.searchParams.set("priceMax", searchParams.priceMax);
    if (searchParams.inStock)
      apiUrl.searchParams.set("inStock", searchParams.inStock);

    const response = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }

    const apiResponse = await response.json();
    const results = apiResponse.data || apiResponse;

    // 🎯 Mapper les items vers PieceData côté serveur (performance)
    const pieces = results.items ? mapSearchResultsToPieces(results.items) : [];
    // 🎯 Passer la query pour prioriser les groupes avec match exact de référence
    const groupedPieces = results.items
      ? groupSearchResultsByGamme(results.items, query)
      : [];

    // 🎯 Lazy loading: déterminer s'il y a plus de résultats
    const total = results.total || 0;
    const currentLoaded = page * limit;
    const hasMore = currentLoaded < total;

    const loadTime = Date.now() - startTime;

    return json<SearchPageData>({
      results: {
        ...results,
        page,
        hasMore,
      },
      pieces,
      groupedPieces,
      query,
      filters: searchParams,
      hasError: false,
      performance: {
        loadTime,
        searchTime: results?.executionTime || 0,
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la recherche:", error);

    return json<SearchPageData>({
      results: null,
      pieces: [],
      groupedPieces: [],
      query,
      filters: searchParams,
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "Erreur inconnue",
      performance: { loadTime: Date.now() - startTime },
    });
  }
}

// ===============================
// META SEO
// ===============================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const query = data?.query || "";
  const total = data?.performance.totalItems || 0;

  return [
    {
      title: query
        ? `Recherche: ${query} | ${total} résultats`
        : "Recherche pièces auto",
    },
    {
      name: "description",
      content: query
        ? `${total} pièces auto pour "${query}" - Prix pas cher`
        : "Recherchez des pièces automobiles par référence ou véhicule",
    },
    { name: "robots", content: "noindex, nofollow" }, // Pages recherche non indexées (comme PHP)
  ];
};

// ===============================
// COMPOSANT PRINCIPAL
// ===============================

export default function SearchPage() {
  const {
    results,
    pieces: initialPieces,
    groupedPieces: initialGroupedPieces,
    query,
    filters: _filters,
    hasError,
    errorMessage,
    performance,
  } = useLoaderData<typeof loader>();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fetcher = useFetcher<SearchPageData>();

  // 🎯 Lazy loading: état local pour accumuler les pièces
  const [allPieces, setAllPieces] = useState<PieceData[]>(initialPieces);
  const [allGroupedPieces, setAllGroupedPieces] =
    useState<GroupedSearchResults[]>(initialGroupedPieces);
  const [currentPage, setCurrentPage] = useState(results?.page || 1);
  const [hasMore, setHasMore] = useState(results?.hasMore ?? false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Ref pour l'intersection observer (lazy load trigger)
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset quand la query change
  useEffect(() => {
    setAllPieces(initialPieces);
    setAllGroupedPieces(initialGroupedPieces);
    setCurrentPage(results?.page || 1);
    setHasMore(results?.hasMore ?? false);
  }, [
    query,
    initialPieces,
    initialGroupedPieces,
    results?.hasMore,
    results?.page,
  ]);

  // Quand le fetcher retourne de nouvelles données, les fusionner
  useEffect(() => {
    if (fetcher.data && fetcher.data.pieces.length > 0) {
      setAllPieces((prev) => {
        // Éviter les doublons
        const existingIds = new Set(prev.map((p) => p.id));
        const newPieces = fetcher.data!.pieces.filter(
          (p) => !existingIds.has(p.id),
        );
        return [...prev, ...newPieces];
      });

      // Fusionner les groupes
      setAllGroupedPieces((prev) => {
        const groupMap = new Map<string, GroupedSearchResults>();

        // Normaliser la query pour comparaison
        const normalizedQuery = query?.trim().toUpperCase() || "";

        // D'abord les groupes existants
        prev.forEach((g) => {
          groupMap.set(g.gammeName.toLowerCase().trim(), { ...g });
        });

        // Puis fusionner les nouveaux
        fetcher.data!.groupedPieces.forEach((newGroup) => {
          const key = newGroup.gammeName.toLowerCase().trim();
          const existing = groupMap.get(key);
          if (existing) {
            // Fusionner les items (éviter doublons)
            const existingIds = new Set(existing.items.map((i) => i.id));
            const newItems = newGroup.items.filter(
              (i) => !existingIds.has(i.id),
            );
            existing.items = [...existing.items, ...newItems];
            existing.count = existing.items.length;
          } else {
            groupMap.set(key, { ...newGroup });
          }
        });

        // 🎯 Tri avec priorité aux groupes contenant un match exact de référence
        return Array.from(groupMap.values()).sort((a, b) => {
          if (normalizedQuery) {
            const aHasExact = a.items.some(
              (item) => item.reference?.toUpperCase() === normalizedQuery,
            );
            const bHasExact = b.items.some(
              (item) => item.reference?.toUpperCase() === normalizedQuery,
            );
            if (aHasExact && !bHasExact) return -1;
            if (!aHasExact && bHasExact) return 1;
          }
          return b.count - a.count;
        });
      });

      setCurrentPage(fetcher.data!.results?.page || currentPage + 1);
      setHasMore(fetcher.data!.results?.hasMore ?? false);
      setIsLoadingMore(false);
    }
  }, [fetcher.data, currentPage, query]);

  // Intersection Observer pour lazy loading
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          fetcher.state === "idle"
        ) {
          setIsLoadingMore(true);
          const params = new URLSearchParams(searchParams);
          params.set("page", (currentPage + 1).toString());
          fetcher.load(`/search?${params.toString()}`);
        }
      },
      { rootMargin: "200px" }, // Déclencher 200px avant d'atteindre le bas
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, currentPage, searchParams, fetcher]);

  // 🎯 NOUVEAU: Filtrer allPieces pour ne garder que celles des gammes avec match exact
  // Prioriser les gammes ayant des matchs kind=2-3 (OEM constructeur comme PSA 1109.91)
  const piecesForFilters = useMemo(() => {
    if (!query) return allPieces;

    const normalizedQuery = query.trim().toUpperCase();
    const normalizedQueryClean = normalizedQuery
      .replace(/[\s-]/g, "")
      .replace(/\./g, "");

    // Fonction helper pour vérifier si une pièce matche la query (ref ou oemRef)
    // Normalisation: espaces/tirets/points sont ignorés (110991 = 1109 91 = 1109.91)
    const pieceMatchesQuery = (p: PieceData) => {
      const refUpper = p.reference?.toUpperCase() || "";
      const refClean = refUpper.replace(/[\s-]/g, "").replace(/\./g, "");
      const oemUpper = p.oemRef?.toUpperCase() || "";
      const oemClean = oemUpper.replace(/[\s-]/g, "").replace(/\./g, "");

      // Match sur référence équipementier
      if (refUpper === normalizedQuery || refClean === normalizedQueryClean)
        return true;

      // Match sur oemRef
      if (oemUpper === normalizedQuery || oemClean === normalizedQueryClean)
        return true;

      return false;
    };

    // 🎯 NOUVEAU: Vérifier si un item a un matchKind OEM constructeur (2 ou 3)
    const pieceHasOemConstructeurKind = (p: PieceData) => {
      return p.matchKind === 2 || p.matchKind === 3;
    };

    // Vérifier s'il existe un match exact de référence OU oemRef
    const hasExactMatch = allPieces.some(pieceMatchesQuery);

    if (!hasExactMatch) {
      // Pas de match exact → retourner toutes les pièces
      return allPieces;
    }

    // Match exact trouvé → identifier les gammes avec match et compter les matchs
    // 🎯 NOUVEAU: Prioriser les gammes ayant des matchs avec kind=2-3
    const gammeMatchData = new Map<
      string,
      { totalMatches: number; oemMatches: number }
    >();
    allGroupedPieces.forEach((group) => {
      const matchingItems = group.items.filter(pieceMatchesQuery);
      const oemMatchCount = matchingItems.filter(
        pieceHasOemConstructeurKind,
      ).length;
      if (matchingItems.length > 0) {
        gammeMatchData.set(group.gammeName.toLowerCase().trim(), {
          totalMatches: matchingItems.length,
          oemMatches: oemMatchCount,
        });
      }
    });

    // Vérifier si au moins une gamme a des matchs OEM kind=2-3
    const hasOemMatches = Array.from(gammeMatchData.values()).some(
      (d) => d.oemMatches > 0,
    );

    // Calculer le score de chaque gamme (prioriser OEM kind=2-3)
    const gammeScores = new Map<string, number>();
    gammeMatchData.forEach((data, gammeName) => {
      // Si on a des matchs OEM, le score est basé sur oemMatches * 100
      // Sinon, fallback sur totalMatches
      const score = hasOemMatches
        ? data.oemMatches > 0
          ? data.oemMatches * 100
          : 0
        : data.totalMatches;
      gammeScores.set(gammeName, score);
    });

    // Trouver le max de score
    const maxScore = Math.max(...gammeScores.values());
    const threshold = maxScore * 0.5; // Au moins 50% du max

    const topGammeNames = new Set<string>();
    gammeScores.forEach((score, gammeName) => {
      if (score >= threshold) {
        topGammeNames.add(gammeName);
      }
    });

    // Filtrer allPieces pour ne garder que celles des top gammes
    return allPieces.filter((piece) => {
      const pieceGroup = allGroupedPieces.find((g) =>
        g.items.some((i) => i.id === piece.id),
      );
      if (!pieceGroup) return false;
      return topGammeNames.has(pieceGroup.gammeName.toLowerCase().trim());
    });
  }, [allPieces, allGroupedPieces, query]);

  // 🎯 Hook centralisé de filtrage (utilise piecesForFilters filtrées)
  const {
    activeFilters,
    sortBy,
    viewMode,
    selectedPieces,
    filteredProducts,
    uniqueBrands,
    dynamicFilterCounts,
    brandAverageNotes,
    setActiveFilters,
    setSortBy,
    setViewMode,
    resetAllFilters,
    togglePieceSelection,
  } = usePiecesFilters(piecesForFilters);

  // État pour affichage mobile des filtres
  const [showFilters, setShowFilters] = useState(false);

  // Groupes filtrés (appliquer filtres locaux aux groupes accumulés)
  const filteredGroups = useMemo(() => {
    if (!allGroupedPieces.length) return [];

    return allGroupedPieces
      .map((group) => ({
        ...group,
        items: group.items.filter((piece) => {
          // Appliquer les mêmes filtres que filteredProducts
          if (
            activeFilters.brands.length &&
            !activeFilters.brands.includes(piece.brand)
          )
            return false;
          if (
            activeFilters.quality !== "all" &&
            piece.quality !== activeFilters.quality
          )
            return false;
          if (activeFilters.priceRange !== "all") {
            const price = piece.price;
            if (activeFilters.priceRange === "low" && price >= 50) return false;
            if (
              activeFilters.priceRange === "medium" &&
              (price < 50 || price >= 150)
            )
              return false;
            if (activeFilters.priceRange === "high" && price < 150)
              return false;
          }
          // Filtre stock DÉSACTIVÉ (flux tendu)
          // Stock non fiable, ne pas filtrer
          if (activeFilters.minNote) {
            const stars = piece.stars || 3;
            const note = Math.round((stars / 6) * 10);
            if (note < activeFilters.minNote) return false;
          }
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [allGroupedPieces, activeFilters]);

  // Handler sélection pièce (mode comparaison)
  const handleSelectPiece = useCallback(
    (pieceId: number) => {
      if (viewMode === "comparison") {
        togglePieceSelection(pieceId);
      }
    },
    [viewMode, togglePieceSelection],
  );

  // Calculer positions disponibles (pour le filtre) - utilise allPieces
  const availablePositions = useMemo(() => {
    const positions = allPieces
      .map((p) => p.side)
      .filter((side): side is string => Boolean(side));
    return [...new Set(positions)];
  }, [allPieces]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 relative">
      {/* Pattern d'arrière-plan */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE0YzIuMiAwIDQgMS44IDQgNHMtMS44IDQtNCA0LTQtMS44LTQtNGMwLTIuMiAxLjgtNCA0LTR6bTAgNDBjMi4yIDAgNCAxLjggNCA0cy0xLjggNC00IDQtNC0xLjgtNC00YzAtMi4yIDEuOC00IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"></div>

      <div className="relative container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <PublicBreadcrumb items={[{ label: "Recherche" }]} />

        {/* En-tête */}
        <div className="mb-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <SearchIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Recherche</h1>
                {performance.totalItems !== undefined &&
                  performance.totalItems > 0 && (
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold text-blue-600">
                        {performance.totalItems.toLocaleString()}
                      </span>{" "}
                      résultats trouvés
                    </p>
                  )}
              </div>
            </div>

            {/* Performance */}
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>{performance.loadTime}ms</span>
              {performance.searchTime && (
                <>
                  <span className="text-gray-300">•</span>
                  <span>{performance.searchTime}ms recherche</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="mb-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 p-4">
          <SearchBar
            initialQuery={query}
            version="v8"
            placeholder="Rechercher une référence, un véhicule..."
          />
        </div>

        {/* Erreur */}
        {hasError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-800">
                  Erreur de recherche
                </h3>
                <p className="text-red-700 text-sm">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Banner fallback gamme-name */}
        {results &&
          !hasError &&
          (results as any).fallbackType === "gamme-name" &&
          (results as any).matchedGammes?.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-800">
                Aucune référence exacte trouvée pour &quot;
                <strong>{query}</strong>&quot;. Voici les pièces de la gamme{" "}
                <a
                  href={`/pieces/${(results as any).matchedGammes[0].alias}-${(results as any).matchedGammes[0].id}.html`}
                  className="font-semibold underline hover:text-blue-900"
                >
                  {(results as any).matchedGammes[0].name}
                </a>
                .
              </p>
            </div>
          )}

        {/* Zone de résultats */}
        {results && !hasError && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar filtres */}
            <aside
              className={`lg:col-span-1 ${showFilters ? "block" : "hidden lg:block"}`}
            >
              <div className="sticky top-4">
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
                  availablePositions={availablePositions}
                  positionLabel="Position"
                  brandAverageNotes={brandAverageNotes}
                />
              </div>
            </aside>

            {/* Zone principale */}
            <main className="lg:col-span-3">
              {/* Barre d'outils */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 p-4 mb-6 sticky top-4 z-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  {/* Compteur + Requête */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-xl border border-blue-100">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-blue-700">
                        {filteredProducts.length}
                      </span>
                      <span className="text-gray-500 text-sm">pièces</span>
                    </div>
                    {query && (
                      <span className="text-sm text-gray-500">
                        pour "
                        <span className="font-semibold text-blue-600">
                          {query}
                        </span>
                        "
                      </span>
                    )}
                  </div>

                  {/* Contrôles */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Toggle filtres mobile */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-all"
                    >
                      <svg
                        className="w-4 h-4"
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
                      Filtres
                    </button>

                    {/* Mode d'affichage */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                          viewMode === "grid"
                            ? "bg-blue-500 text-white shadow-md"
                            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                        }`}
                        title="Vue grille"
                      >
                        <Grid3X3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setViewMode("list")}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                          viewMode === "list"
                            ? "bg-blue-500 text-white shadow-md"
                            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                        }`}
                        title="Vue liste"
                      >
                        <List className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setViewMode("comparison")}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all relative ${
                          viewMode === "comparison"
                            ? "bg-blue-500 text-white shadow-md"
                            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                        }`}
                        title="Comparer"
                      >
                        <Scale className="w-5 h-5" />
                        {selectedPieces.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {selectedPieces.length}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Tri */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                      <button
                        onClick={() => setSortBy("name")}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                          sortBy === "name"
                            ? "bg-blue-500 text-white shadow-md"
                            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                        }`}
                        title="Trier par nom (A→Z)"
                      >
                        <SortAsc className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setSortBy("price-asc")}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                          sortBy === "price-asc"
                            ? "bg-emerald-500 text-white shadow-md"
                            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                        }`}
                        title="Prix croissant"
                      >
                        <TrendingDown className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setSortBy("price-desc")}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                          sortBy === "price-desc"
                            ? "bg-rose-500 text-white shadow-md"
                            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                        }`}
                        title="Prix décroissant"
                      >
                        <TrendingUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setSortBy("brand")}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                          sortBy === "brand"
                            ? "bg-indigo-500 text-white shadow-md"
                            : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                        }`}
                        title="Trier par marque"
                      >
                        <ArrowUpDown className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Reset */}
                    {(activeFilters.brands.length > 0 ||
                      activeFilters.quality !== "all" ||
                      activeFilters.priceRange !== "all") && (
                      <button
                        onClick={resetAllFilters}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">Réinitialiser</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Suggestions */}
                {results.suggestions && results.suggestions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">
                      💡 Essayez aussi :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {results.suggestions.map(
                        (suggestion: string, index: number) => (
                          <a
                            key={`${suggestion}-${index}`}
                            href={`?q=${encodeURIComponent(suggestion)}`}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-full text-sm font-medium text-blue-700 transition-all border border-blue-200 hover:border-blue-300"
                          >
                            {suggestion}
                          </a>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 🎯 Affichage des résultats - Groupé par gamme (comme PHP v7/v8) */}
              {filteredGroups.length > 1 ? (
                // Affichage groupé avec H2
                <div className="space-y-8">
                  {filteredGroups.map((group, idx) => (
                    <div
                      key={`${group.gammeName.toLowerCase()}-${idx}`}
                      className="space-y-4"
                    >
                      {/* En-tête groupe avec H2 SEO */}
                      <div className="flex items-center gap-3 bg-gradient-to-r from-slate-800 via-slate-700 to-indigo-800 rounded-xl px-5 py-3.5 shadow-lg">
                        <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg font-bold text-white">
                            {group.gammeName}
                          </h2>
                          <p className="text-white/60 text-xs">
                            {group.items.length} pièce
                            {group.items.length > 1 ? "s" : ""} disponible
                            {group.items.length > 1 ? "s" : ""}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-white/20 text-white border-white/30"
                        >
                          {group.items.length}
                        </Badge>
                      </div>

                      {/* Grille des pièces du groupe */}
                      {viewMode === "grid" && (
                        <PiecesGridView
                          pieces={group.items}
                          onSelectPiece={handleSelectPiece}
                          selectedPieces={selectedPieces}
                        />
                      )}
                      {viewMode === "list" && (
                        <PiecesListView
                          pieces={group.items}
                          onSelectPiece={handleSelectPiece}
                          selectedPieces={selectedPieces}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Affichage simple (une seule gamme ou pas de groupement)
                <>
                  {viewMode === "grid" && (
                    <PiecesGridView
                      pieces={filteredProducts}
                      onSelectPiece={handleSelectPiece}
                      selectedPieces={selectedPieces}
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

              {/* Mode comparaison */}
              {viewMode === "comparison" && selectedPieces.length > 0 && (
                <div className="mt-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-indigo-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Scale className="w-5 h-5 text-indigo-600" />
                    Comparaison ({selectedPieces.length} pièces)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allPieces
                      .filter((p) => selectedPieces.includes(p.id))
                      .map((piece) => (
                        <div
                          key={piece.id}
                          className="bg-gray-50 rounded-xl p-4 relative"
                        >
                          <button
                            onClick={() => togglePieceSelection(piece.id)}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center text-red-600"
                          >
                            ×
                          </button>
                          <div className="font-bold text-gray-900">
                            {piece.brand}
                          </div>
                          <div className="text-sm text-gray-600">
                            {piece.reference}
                          </div>
                          <div className="text-lg font-bold text-indigo-600 mt-2">
                            {piece.priceFormatted}
                          </div>
                          {piece.stars && (
                            <div className="text-xs text-gray-500 mt-1">
                              Fiabilité: {Math.round((piece.stars / 6) * 10)}/10
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 🎯 Lazy Loading: Trigger pour charger plus */}
              <div ref={loadMoreRef} className="py-8">
                {isLoadingMore && (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-500 text-sm">
                      Chargement de plus de résultats...
                    </p>
                  </div>
                )}
                {!hasMore && allPieces.length > 0 && (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-sm">
                      ✓ {allPieces.length} pièces chargées sur {results.total}
                    </p>
                  </div>
                )}
                {hasMore && !isLoadingMore && (
                  <div className="text-center">
                    <button
                      onClick={() => {
                        setIsLoadingMore(true);
                        const params = new URLSearchParams(searchParams);
                        params.set("page", (currentPage + 1).toString());
                        fetcher.load(`/search?${params.toString()}`);
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
                    >
                      Charger plus de résultats
                    </button>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}

        {/* Aucun résultat */}
        {results && results.total === 0 && !hasError && (
          <NoResults
            query={query}
            suggestions={results.suggestions}
            searchTips={[
              "Vérifiez l'orthographe de votre recherche",
              "Essayez des termes plus généraux",
              "Utilisez des synonymes ou termes alternatifs",
              "Retirez certains filtres pour élargir votre recherche",
            ]}
            onSuggestionClick={(suggestion) => {
              const params = new URLSearchParams();
              params.set("q", suggestion);
              navigate(`?${params.toString()}`);
            }}
          />
        )}

        {/* Message d'accueil (pas de recherche) */}
        {!query && !hasError && (
          <div className="text-center py-16">
            <div className="max-w-lg mx-auto bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-gray-200/50 p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <SearchIcon className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Recherchez des pièces automobiles
              </h2>
              <p className="text-gray-600 mb-6">
                Utilisez la barre de recherche ci-dessus pour trouver des pièces
                par référence, véhicule compatible, ou description.
              </p>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <p className="text-sm text-blue-800">
                  💡 <strong>Astuce :</strong> Essayez "filtre huile renault
                  clio" ou "WL7129"
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Bar - Filtrer */}
      <MobileBottomBarSpacer />
      <MobileBottomBar>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 touch-target"
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
          <span>Filtrer</span>
          {(activeFilters.brands.length > 0 ||
            activeFilters.quality !== "all" ||
            activeFilters.priceRange !== "all") && (
            <span className="bg-white text-blue-600 text-xs px-2 py-0.5 rounded-full font-bold">
              {activeFilters.brands.length +
                (activeFilters.quality !== "all" ? 1 : 0) +
                (activeFilters.priceRange !== "all" ? 1 : 0)}
            </span>
          )}
        </button>
      </MobileBottomBar>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
