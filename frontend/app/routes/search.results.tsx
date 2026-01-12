/**
 * 🔍 SEARCH RESULTS PAGE - Page de résultats de recherche v3.0
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { SearchBar } from "../components/search/SearchBar";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";
import { Error404 } from "~/components/errors/Error404";
import { Badge } from "~/components/ui";
import { Button } from "~/components/ui/button";

/**
 * 🔍 SEO Meta Tags - noindex pour pages de recherche
 */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const query = data?.query || "";
  const total = data?.totalCount || 0;

  return [
    {
      title: query
        ? `Recherche: ${query} | ${total} résultats`
        : "Résultats de recherche",
    },
    { name: "description", content: `Résultats de recherche pour "${query}"` },
    { name: "robots", content: "noindex, nofollow" }, // Pages recherche non indexées
    {
      tagName: "link",
      rel: "canonical",
      href: "https://www.automecanik.com/search/results",
    },
  ];
};

interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  price?: number;
  image?: string;
  relevanceScore: number;
}

interface SearchResultsData {
  query: string;
  results: SearchResult[];
  totalCount: number;
  searchTime: number;
  version: "v7" | "v8";
  suggestions?: string[];
}

// Loader pour récupérer les résultats
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const version = (url.searchParams.get("version") as "v7" | "v8") || "v8";

  if (!query) {
    return json<SearchResultsData>({
      query: "",
      results: [],
      totalCount: 0,
      searchTime: 0,
      version,
      suggestions: [],
    });
  }

  // Simulation d'appel API (en réalité, ceci ferait appel au SearchService backend)
  const mockResults: SearchResult[] = [
    {
      id: "1",
      title: "Filtre à huile - Référence: WL7129",
      description:
        "Filtre à huile compatible véhicules essence et diesel. Haute qualité OEM.",
      category: "Filtration",
      price: 12.99,
      relevanceScore: 95,
    },
    {
      id: "2",
      title: "Plaquettes de frein avant - Référence: BP1234",
      description:
        "Plaquettes de frein céramique haute performance pour freinage optimal.",
      category: "Freinage",
      price: 45.5,
      relevanceScore: 87,
    },
    {
      id: "3",
      title: "Amortisseur arrière - Référence: SHOCK789",
      description: "Amortisseur hydraulique haute résistance, garantie 1 an.",
      category: "Suspension",
      price: 89.99,
      relevanceScore: 82,
    },
  ].filter(
    (result) =>
      result.title.toLowerCase().includes(query.toLowerCase()) ||
      result.description.toLowerCase().includes(query.toLowerCase()),
  );

  return json<SearchResultsData>({
    query,
    results: mockResults,
    totalCount: mockResults.length,
    searchTime: Math.random() * 100 + 50, // 50-150ms simulé
    version,
    suggestions:
      query.length > 2
        ? [`${query} compatible`, `${query} original`, `${query} haute qualité`]
        : [],
  });
}

export default function SearchResults() {
  const { query, results, totalCount, searchTime, version, suggestions } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b pt-4">
        <div className="max-w-7xl mx-auto px-4">
          <PublicBreadcrumb
            items={[
              { label: "Recherche", href: "/search" },
              { label: query || "Résultats" },
            ]}
          />
        </div>
      </div>

      {/* Header avec barre de recherche */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <SearchBar
            initialQuery={query}
            version={version}
            placeholder="Rechercher une pièce automobile..."
            showSuggestions={true}
            showHistory={true}
            className="max-w-2xl"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats de recherche */}
        {query && (
          <div className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Résultats pour "{query}"
                </h1>
                <p className="text-gray-600 mt-1">
                  {totalCount} résultats trouvés en {searchTime.toFixed(0)}ms
                  <span className="ml-2 text-sm text-blue-600">
                    • Version {version}
                  </span>
                </p>
              </div>

              {isLoading && (
                <div className="flex items-center text-blue-600">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                  Recherche en cours...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <div className="mb-6 p-4 bg-primary/5 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Suggestions de recherche :
            </h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <a
                  key={index}
                  href={`/search/results?q=${encodeURIComponent(suggestion)}&version=${version}`}
                  className="px-3 py-1 bg-info/90 hover:bg-info text-info-foreground text-sm rounded-full transition-colors"
                >
                  {suggestion}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar filtres (simulé) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Filtres</h3>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Catégorie</h4>
                  <div className="space-y-2">
                    {["Filtration", "Freinage", "Suspension", "Moteur"].map(
                      (category) => (
                        <label key={category} className="flex items-center">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 mr-2"
                          />
                          <span className="text-sm text-gray-600">
                            {category}
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Prix</h4>
                  <div className="space-y-2">
                    {[
                      { label: "Moins de 20€", value: "0-20" },
                      { label: "20€ - 50€", value: "20-50" },
                      { label: "50€ - 100€", value: "50-100" },
                      { label: "Plus de 100€", value: "100+" },
                    ].map((range) => (
                      <label key={range.value} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 mr-2"
                        />
                        <span className="text-sm text-gray-600">
                          {range.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Résultats */}
          <div className="lg:col-span-3">
            {results.length > 0 ? (
              <div className="space-y-4">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 cursor-pointer">
                            {result.title}
                          </h3>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {result.category}
                          </span>
                          <Badge variant="success">
                            Score: {result.relevanceScore}%
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">
                          {result.description}
                        </p>

                        {result.price && (
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-green-600">
                              {result.price.toFixed(2)}€
                            </span>
                            <Button
                              className="px-4 py-2  rounded-lg"
                              variant="blue"
                            >
                              \n Ajouter au panier\n
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : query ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <div className="text-gray-400 text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Aucun résultat trouvé
                </h3>
                <p className="text-gray-600 mb-6">
                  Essayez avec d'autres mots-clés ou vérifiez l'orthographe
                </p>
                <div className="space-y-2 text-left max-w-md mx-auto">
                  <p className="text-sm text-gray-600">Suggestions :</p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• Utilisez des mots-clés plus généraux</li>
                    <li>• Vérifiez l'orthographe</li>
                    <li>• Essayez avec le numéro de référence</li>
                    <li>• Recherchez par marque de véhicule</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <div className="text-gray-400 text-6xl mb-4">🚀</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Effectuez votre recherche
                </h3>
                <p className="text-gray-600">
                  Tapez dans la barre de recherche pour commencer
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
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
