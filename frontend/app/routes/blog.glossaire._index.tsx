/**
 * Route index optimisée pour le glossaire automobile
 * Liste complète des termes avec recherche, filtres et pagination avancés
 * @route /blog/glossaire
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, useNavigate } from "@remix-run/react";
import { useState, useEffect } from "react";

import { glossaryApi, type GlossaryResponse } from "../services/api/glossary.api";

// Icons simplifiés
const BookOpenIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25A8.966 8.966 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const MagnifyingGlassIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const TagIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
  </svg>
);

const EyeIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const StarIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const ChevronLeftIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const FunnelIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
  </svg>
);

// Types pour les données de la page
interface LoaderData {
  glossaryData: GlossaryResponse;
  searchQuery: string;
  currentPage: number;
  selectedCategory: string;
  selectedDifficulty: string;
  selectedLetter: string;
  alphabet: string[];
  meta: {
    title: string;
    description: string;
    canonicalUrl: string;
  };
}

// Loader pour récupérer les données
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const category = url.searchParams.get("category") || "";
  const difficulty = url.searchParams.get("difficulty") || "";
  const letter = url.searchParams.get("letter") || "";
  const sortBy = (url.searchParams.get("sortBy") as "word" | "views" | "date") || "word";

  console.log(`[LOADER] Glossaire - search: ${searchQuery}, page: ${page}, category: ${category}`);

  try {
    // Récupération des données avec filtres
    const glossaryData = await glossaryApi.getGlossaryTerms({
      search: searchQuery,
      page,
      limit: 12,
      category: category || undefined,
      difficulty: difficulty || undefined,
      letter: letter || undefined,
      sortBy,
      sortOrder: "asc"
    });

    // Alphabet pour les filtres alphabétiques
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    // Métadonnées SEO dynamiques
    const meta = {
      title: searchQuery 
        ? `Recherche "${searchQuery}" - Glossaire Automobile`
        : "Glossaire Automobile - Définitions Techniques",
      description: searchQuery
        ? `Résultats de recherche pour "${searchQuery}" dans le glossaire automobile.`
        : "Découvrez les définitions des termes techniques automobiles. ABS, ESP, Turbo, FAP et bien plus.",
      canonicalUrl: `${url.origin}/blog/glossaire`
    };

    return json<LoaderData>({
      glossaryData,
      searchQuery,
      currentPage: page,
      selectedCategory: category,
      selectedDifficulty: difficulty,
      selectedLetter: letter,
      alphabet,
      meta
    });

  } catch (error) {
    console.error("[LOADER ERROR] Glossaire:", error);
    
    // Fallback en cas d'erreur
    return json<LoaderData>({
      glossaryData: {
        success: false,
        data: {
          terms: [],
          total: 0,
          page: 1,
          totalPages: 0,
          limit: 12,
          filters: {}
        },
        error: "Erreur de chargement"
      },
      searchQuery,
      currentPage: page,
      selectedCategory: category,
      selectedDifficulty: difficulty,
      selectedLetter: letter,
      alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
      meta: {
        title: "Erreur - Glossaire Automobile",
        description: "Une erreur est survenue lors du chargement du glossaire.",
        canonicalUrl: `${url.origin}/blog/glossaire`
      }
    });
  }
}

// Métadonnées pour le SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Glossaire Automobile - Définitions Techniques" },
      { name: "description", content: "Découvrez les définitions des termes techniques automobiles." }
    ];
  }

  const { meta: metaData } = data;

  return [
    { title: metaData.title },
    { name: "description", content: metaData.description },
    { name: "keywords", content: "glossaire, automobile, définitions, technique, ABS, ESP, turbo" },
    { property: "og:title", content: metaData.title },
    { property: "og:description", content: metaData.description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: metaData.canonicalUrl },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: metaData.title },
    { name: "twitter:description", content: metaData.description },
    { tagName: "link", rel: "canonical", href: metaData.canonicalUrl }
  ];
};

// Composant principal
export default function GlossaryIndexPage() {
  const { 
    glossaryData, 
    searchQuery: initialSearch, 
    selectedCategory,
    selectedDifficulty,
    selectedLetter,
    alphabet 
  } = useLoaderData<LoaderData>();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // États locaux
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSort, setSelectedSort] = useState(searchParams.get("sortBy") || "word");

  // Mise à jour de la recherche quand les paramètres changent
  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  // Construction des paramètres URL
  const buildSearchParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Reset de la page lors du changement de filtres
    if (Object.keys(updates).some(key => key !== "page")) {
      params.delete("page");
    }

    return params.toString();
  };

  // Gestion de la recherche
  const handleSearch = (query: string) => {
    const paramsString = buildSearchParams({ search: query });
    navigate(`/blog/glossaire${paramsString ? `?${paramsString}` : ""}`);
  };

  // Gestion des filtres
  const handleFilterChange = (filterType: string, value: string) => {
    const paramsString = buildSearchParams({ [filterType]: value });
    navigate(`/blog/glossaire${paramsString ? `?${paramsString}` : ""}`);
  };

  // Gestion du tri
  const handleSortChange = (sortBy: string) => {
    setSelectedSort(sortBy);
    const paramsString = buildSearchParams({ sortBy });
    navigate(`/blog/glossaire${paramsString ? `?${paramsString}` : ""}`);
  };

  // Gestion de la pagination
  const handlePageChange = (page: number) => {
    const paramsString = buildSearchParams({ page: page.toString() });
    navigate(`/blog/glossaire${paramsString ? `?${paramsString}` : ""}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Difficulté badge
  const getDifficultyBadge = (difficulty?: string) => {
    const colors = {
      basic: "bg-green-100 text-green-800 border-green-200",
      intermediate: "bg-yellow-100 text-yellow-800 border-yellow-200", 
      advanced: "bg-red-100 text-red-800 border-red-200"
    };

    const labels = {
      basic: "Débutant",
      intermediate: "Intermédiaire",
      advanced: "Avancé"
    };

    if (!difficulty) return null;

    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${colors[difficulty as keyof typeof colors]}`}>
        <StarIcon className="w-3 h-3 mr-1" />
        {labels[difficulty as keyof typeof labels]}
      </span>
    );
  };

  // Pagination component
  const renderPagination = () => {
    if (!glossaryData.success || glossaryData.data.totalPages <= 1) return null;

    const { page, totalPages } = glossaryData.data;
    const pages: JSX.Element[] = [];
    
    // Previous
    if (page > 1) {
      pages.push(
        <button
          key="prev"
          onClick={() => handlePageChange(page - 1)}
          className="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-offset-0"
        >
          <span className="sr-only">Précédent</span>
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      );
    }

    // Pages
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
            i === page
              ? "z-10 bg-blue-600 text-white focus:z-10"
              : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-offset-0"
          }`}
        >
          {i}
        </button>
      );
    }

    // Next
    if (page < totalPages) {
      pages.push(
        <button
          key="next"
          onClick={() => handlePageChange(page + 1)}
          className="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-offset-0"
        >
          <span className="sr-only">Suivant</span>
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      );
    }

    return (
      <nav className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
        <div className="hidden sm:block">
          <p className="text-sm text-gray-700">
            Affichage de <span className="font-medium">{((page - 1) * glossaryData.data.limit) + 1}</span> à{" "}
            <span className="font-medium">
              {Math.min(page * glossaryData.data.limit, glossaryData.data.total)}
            </span>{" "}
            sur <span className="font-medium">{glossaryData.data.total}</span> résultats
          </p>
        </div>
        <div className="flex flex-1 justify-center sm:justify-end">
          <div className="isolate inline-flex -space-x-px rounded-md shadow-sm">
            {pages}
          </div>
        </div>
      </nav>
    );
  };

  // Affichage d'erreur
  if (!glossaryData.success) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <BookOpenIcon className="w-16 h-16 text-gray-300 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Erreur de chargement</h1>
            <p className="text-lg text-gray-600 mb-8">
              Une erreur est survenue lors du chargement du glossaire.
            </p>
            <Link
              to="/blog"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retour au blog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: { terms, total, stats, categories } } = glossaryData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Fil d'Ariane */}
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
            <Link to="/blog" className="hover:text-gray-700">Blog</Link>
            <ChevronRightIcon className="w-4 h-4" />
            <span className="text-gray-900 font-medium">Glossaire</span>
          </nav>

          {/* Titre et description */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Glossaire Automobile
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Découvrez les définitions des termes techniques automobiles les plus importants.
              De l'ABS au turbocompresseur, maîtrisez le vocabulaire automobile.
            </p>
          </div>

          {/* Statistiques */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-blue-700">Termes</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.totalViews.toLocaleString()}</div>
                <div className="text-sm text-green-700">Vues</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{categories?.length || 0}</div>
                <div className="text-sm text-purple-700">Catégories</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.avgViews}</div>
                <div className="text-sm text-yellow-700">Vues moy.</div>
              </div>
            </div>
          )}

          {/* Barre de recherche */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un terme technique..."
                className="w-full pl-10 pr-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch(searchQuery);
                  }
                }}
              />
              <button
                onClick={() => handleSearch(searchQuery)}
                className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Rechercher
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar avec filtres */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Filtres</h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
                >
                  <FunnelIcon className="w-5 h-5" />
                </button>
              </div>

              <div className={`space-y-6 ${showFilters ? 'block' : 'hidden lg:block'}`}>
                {/* Alphabet */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Par lettre</h3>
                  <div className="grid grid-cols-6 gap-1">
                    <button
                      onClick={() => handleFilterChange("letter", "")}
                      className={`p-2 text-xs font-medium rounded text-center transition-colors ${
                        !selectedLetter 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Tous
                    </button>
                    {alphabet.map((letter) => (
                      <button
                        key={letter}
                        onClick={() => handleFilterChange("letter", letter)}
                        className={`p-2 text-xs font-medium rounded text-center transition-colors ${
                          selectedLetter === letter 
                            ? "bg-blue-600 text-white" 
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catégories */}
                {categories && categories.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Catégories</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => handleFilterChange("category", "")}
                        className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                          !selectedCategory 
                            ? "bg-blue-100 text-blue-700 font-medium" 
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        Toutes les catégories
                      </button>
                      {categories.map((category) => (
                        <button
                          key={category}
                          onClick={() => handleFilterChange("category", category)}
                          className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                            selectedCategory === category 
                              ? "bg-blue-100 text-blue-700 font-medium" 
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Difficulté */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Difficulté</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleFilterChange("difficulty", "")}
                      className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                        !selectedDifficulty 
                          ? "bg-blue-100 text-blue-700 font-medium" 
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      Tous les niveaux
                    </button>
                    <button
                      onClick={() => handleFilterChange("difficulty", "basic")}
                      className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                        selectedDifficulty === "basic" 
                          ? "bg-green-100 text-green-700 font-medium" 
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className="flex items-center">
                        <StarIcon className="w-3 h-3 mr-2" />
                        Débutant
                      </span>
                    </button>
                    <button
                      onClick={() => handleFilterChange("difficulty", "intermediate")}
                      className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                        selectedDifficulty === "intermediate" 
                          ? "bg-yellow-100 text-yellow-700 font-medium" 
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className="flex items-center">
                        <StarIcon className="w-3 h-3 mr-2" />
                        Intermédiaire
                      </span>
                    </button>
                    <button
                      onClick={() => handleFilterChange("difficulty", "advanced")}
                      className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                        selectedDifficulty === "advanced" 
                          ? "bg-red-100 text-red-700 font-medium" 
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className="flex items-center">
                        <StarIcon className="w-3 h-3 mr-2" />
                        Avancé
                      </span>
                    </button>
                  </div>
                </div>

                {/* Tri */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Trier par</h3>
                  <select
                    value={selectedSort}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="word">Ordre alphabétique</option>
                    <option value="views">Plus consultés</option>
                    <option value="date">Plus récents</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="flex-1">
            {/* En-tête des résultats */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {searchQuery ? `Résultats pour "${searchQuery}"` : "Tous les termes"}
                </h2>
                <p className="text-gray-600 mt-1">
                  {total} terme{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Liste des termes */}
            {terms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {terms.map((term) => (
                  <Link
                    key={term.id}
                    to={`/blog/word/${term.word.toLowerCase()}`}
                    className="block bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-700">
                        {term.word}
                      </h3>
                      <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                    </div>

                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {term.definition}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {term.category && (
                          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            <TagIcon className="w-3 h-3 mr-1" />
                            {term.category}
                          </span>
                        )}
                        {getDifficultyBadge(term.difficulty)}
                      </div>

                      <div className="flex items-center text-sm text-gray-500">
                        <EyeIcon className="w-4 h-4 mr-1" />
                        {term.viewsCount.toLocaleString()}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpenIcon className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun terme trouvé</h3>
                <p className="text-gray-600 mb-6">
                  Essayez de modifier vos critères de recherche ou vos filtres.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    navigate("/blog/glossaire");
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Voir tous les termes
                </button>
              </div>
            )}

            {/* Pagination */}
            {renderPagination()}
          </div>
        </div>
      </div>
    </div>
  );
}
