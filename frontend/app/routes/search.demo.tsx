/**
 * 🔍 SEARCH DEMO PAGE - Page de démo du système de recherche v3.0
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { SearchBar } from '../components/search/SearchBar';

// Interface pour les données de démo
interface SearchDemoData {
  version: 'v7' | 'v8';
  placeholder: string;
  initialQuery: string;
}

// Loader pour initialiser la page
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const version = (url.searchParams.get('version') as 'v7' | 'v8') || 'v8';
  const initialQuery = url.searchParams.get('q') || '';

  return json<SearchDemoData>({
    version,
    placeholder: 'Rechercher une pièce automobile, référence, véhicule...',
    initialQuery,
  });
}

// Action pour traiter les recherches
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const query = formData.get('query') as string;
  const version = formData.get('version') as 'v7' | 'v8';

  // Redirection vers la page de résultats
  const searchParams = new URLSearchParams();
  searchParams.set('q', query);
  if (version) searchParams.set('version', version);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/search/results?${searchParams.toString()}`,
    },
  });
}

export default function SearchDemo() {
  const { version, placeholder, initialQuery } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔍 Système de Recherche v3.0
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Recherche intelligente avec auto-complétion et suggestions contextuelles
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Version {version} • Backend v3.0 Optimisé
          </div>
        </div>

        {/* Zone de recherche principale */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <SearchBar
            initialQuery={initialQuery}
            version={version}
            placeholder={placeholder}
            autoFocus={true}
            showSuggestions={true}
            showHistory={true}
            className="w-full"
          />
        </div>

        {/* Fonctionnalités */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-blue-600 text-2xl mb-3">⚡</div>
            <h3 className="font-semibold text-gray-900 mb-2">Recherche Instantanée</h3>
            <p className="text-gray-600 text-sm">
              Résultats en temps réel avec debounce intelligent
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-green-600 text-2xl mb-3">🧠</div>
            <h3 className="font-semibold text-gray-900 mb-2">IA Intégrée</h3>
            <p className="text-gray-600 text-sm">
              Suggestions contextuelles et scoring personnalisé
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-purple-600 text-2xl mb-3">🚀</div>
            <h3 className="font-semibold text-gray-900 mb-2">Performance</h3>
            <p className="text-gray-600 text-sm">
              Cache intelligent Redis + optimisation 30-50%
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-orange-600 text-2xl mb-3">🔍</div>
            <h3 className="font-semibold text-gray-900 mb-2">Multi-Version</h3>
            <p className="text-gray-600 text-sm">
              Support V7/V8 avec migration transparente
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-red-600 text-2xl mb-3">📊</div>
            <h3 className="font-semibold text-gray-900 mb-2">Analytics</h3>
            <p className="text-gray-600 text-sm">
              Suivi complet des interactions et performances
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-indigo-600 text-2xl mb-3">🎯</div>
            <h3 className="font-semibold text-gray-900 mb-2">Ciblage</h3>
            <p className="text-gray-600 text-sm">
              Recherche véhicule MINE/VIN et pièces détachées
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-3">💡 Comment tester :</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Tapez dans la barre de recherche pour voir l'auto-complétion</li>
            <li>• Utilisez les flèches ↑↓ pour naviguer dans les suggestions</li>
            <li>• Appuyez sur Entrée ou cliquez pour effectuer la recherche</li>
            <li>• L'historique se sauvegarde automatiquement</li>
            <li>• Les suggestions s'adaptent à votre contexte</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
