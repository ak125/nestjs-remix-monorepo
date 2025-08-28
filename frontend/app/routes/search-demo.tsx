/**
 * 🔍 SEARCH DEMO PAGE - Test du système de recherche optimisé
 * 
 * Page de démonstration pour tester le SearchService v3.0 avec le frontend
 */

import type { MetaFunction } from "@remix-run/node";
import { useState } from "react";
import { SearchBar } from "../components/search/SearchBar";

export const meta: MetaFunction = () => {
  return [
    { title: "Démo Recherche - SearchService v3.0" },
    { name: "description", content: "Démonstration du système de recherche optimisé avec IA et cache intelligent" },
  ];
};

export default function SearchDemo() {
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearchResults = (results: any) => {
    setSearchResults(results);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔍 Démo SearchService v3.0
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Système de recherche avancé avec IA, cache intelligent et suggestions personnalisées.
            Recherchez des véhicules par MINE, VIN, marque, modèle ou toute autre information.
          </p>
        </div>

        {/* Barre de recherche principale */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <SearchBar
              placeholder="Rechercher des véhicules (ex: BMW X5, MINE VF3XXXX, VIN WBAVD13526KX12345)..."
              onSearch={handleSearchResults}
              className="w-full"
            />
          </div>
        </div>

        {/* Zone de résultats */}
        <div className="max-w-6xl mx-auto">
          {isLoading && (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Recherche en cours avec l'IA...</p>
            </div>
          )}

          {searchResults && !isLoading && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-blue-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold">Résultats de recherche</h2>
                <p className="text-blue-100">
                  {searchResults?.totalHits || 0} résultats trouvés en {searchResults?.processingTimeMs || 0}ms
                </p>
              </div>
              <div className="p-6">
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                  {JSON.stringify(searchResults, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {!searchResults && !isLoading && (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">🚗</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Prêt pour la recherche
              </h3>
              <p className="text-gray-600">
                Utilisez la barre de recherche ci-dessus pour découvrir nos fonctionnalités avancées :
              </p>
              <div className="grid md:grid-cols-3 gap-4 mt-6 text-left">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">🎯 Recherche Intelligente</h4>
                  <p className="text-sm text-blue-700">
                    IA qui comprend vos intentions et corrige automatiquement les fautes de frappe
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">⚡ Cache Adaptatif</h4>
                  <p className="text-sm text-green-700">
                    Résultats ultra-rapides grâce au cache intelligent avec TTL adaptatif
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">🎨 Suggestions Personnalisées</h4>
                  <p className="text-sm text-purple-700">
                    Suggestions contextuelle basées sur vos recherches et préférences
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer avec informations techniques */}
        <div className="max-w-4xl mx-auto mt-12 text-center text-sm text-gray-500">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="font-semibold mb-2">Informations Techniques</p>
            <div className="grid md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="font-medium">Backend:</span> NestJS + Meilisearch
              </div>
              <div>
                <span className="font-medium">Cache:</span> Redis intelligent
              </div>
              <div>
                <span className="font-medium">IA:</span> Scoring personnalisé
              </div>
              <div>
                <span className="font-medium">Version:</span> SearchService v3.0
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
