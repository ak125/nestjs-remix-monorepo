/**
 * 🎯 PAGE DEMO V5 ULTIMATE - Test d'intégration
 * 
 * Page de démonstration des services V5 Ultimate intégrés
 */

import { useState } from 'react';
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useFetcher, Form } from '@remix-run/react';
import { searchPieceByReference, getV5UltimateHealth } from '~/services/api/v5-ultimate.api';

interface LoaderData {
  health: any;
  timestamp: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const health = await getV5UltimateHealth();
    
    return json<LoaderData>({
      health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erreur loader V5 Ultimate:', error);
    return json<LoaderData>({
      health: { status: 'error', services: {}, summary: { total_services: 0, all_healthy: false } },
      timestamp: new Date().toISOString(),
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const reference = formData.get('reference') as string;
  const action = formData.get('_action') as string;

  if (action === 'search' && reference) {
    try {
      const results = await searchPieceByReference(reference);
      return json({ success: true, results });
    } catch (error) {
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue' 
      });
    }
  }

  return json({ success: false, error: 'Action non supportée' });
}

export default function V5UltimateDemo() {
  const { health, timestamp } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const [reference, setReference] = useState('');

  const isLoading = fetcher.state === 'submitting';
  const searchResults = fetcher.data?.results;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎯 V5 Ultimate - Démonstration
          </h1>
          <p className="text-gray-600">
            Test d'intégration des services V5 Ultimate avec distinction supplier/brand
          </p>
        </div>

        {/* Statut des services */}
        <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              État des Services V5 Ultimate
            </h2>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                health.status === 'healthy' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {health.status || 'Unknown'}
              </span>
              <span className="text-sm text-gray-500">
                {health.summary?.total_services || 0} services
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {health.services && Object.entries(health.services).map(([key, service]: [string, any]) => (
              <div key={key} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 capitalize">
                    {key.replace('_v5', ' V5')}
                  </h3>
                  <span className={`px-2 py-1 rounded text-xs ${
                    service.status === 'healthy' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {service.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {service.service || 'Service indisponible'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Réponse: {service.performance?.response_time}ms
                </p>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
            <strong>Dernière vérification:</strong> {new Date(timestamp).toLocaleString('fr-FR')}
          </div>
        </div>

        {/* Formulaire de recherche */}
        <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🔍 Recherche de Pièces V5 Ultimate
          </h2>
          
          <Form method="post" className="space-y-4">
            <input type="hidden" name="_action" value="search" />
            
            <div>
              <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
                Référence de pièce
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  id="reference"
                  name="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="ex: KTBWP8841, 0001106017"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading || !reference.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    '🔍 Rechercher'
                  )}
                </button>
              </div>
            </div>

            {/* Boutons de test rapide */}
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setReference('KTBWP8841')}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                disabled={isLoading}
              >
                Test KTBWP8841 (DAYCO)
              </button>
              <button
                type="button"
                onClick={() => setReference('0001106017')}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                disabled={isLoading}
              >
                Test 0001106017 (BOSCH)
              </button>
            </div>
          </Form>
        </div>

        {/* Résultats de recherche */}
        {searchResults && (
          <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Résultats ({searchResults.found_count})
              </h2>
              <span className="text-sm text-gray-500">
                Temps de réponse: {searchResults._metadata?.response_time?.toFixed(1)}ms
              </span>
            </div>

            {searchResults.found_count === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800">
                  Aucune pièce trouvée pour la référence "{searchResults.search_query}"
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults.results.map((piece: any, index: number) => (
                  <div
                    key={`${piece.piece_id}-${index}`}
                    className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {piece.reference}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            piece.stock_status === 'En stock'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {piece.stock_status}
                          </span>
                        </div>
                        
                        <p className="text-gray-700 mb-3">{piece.designation}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-600">Fournisseur:</span>
                            <div className="text-gray-900">{piece.supplier}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Marque:</span>
                            <div className="text-gray-900 font-medium">{piece.brand}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Pièce ID:</span>
                            <div className="text-gray-900">{piece.piece_id}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Type:</span>
                            <div className="text-gray-900">V5 Ultimate</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        <div className="text-xl font-bold text-gray-900">
                          {parseFloat(piece.raw_price_ttc).toFixed(2)}€
                        </div>
                        <div className="text-sm text-gray-600">
                          HT: {parseFloat(piece.raw_price_ht).toFixed(2)}€
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Métadonnées */}
            <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
              <strong>Méthodologie:</strong> {searchResults._metadata?.methodology}
            </div>
          </div>
        )}

        {/* Erreur */}
        {fetcher.data?.success === false && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">
              <strong>Erreur:</strong> {fetcher.data.error}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">
            🎯 Intégration V5 Ultimate Réussie
          </h3>
          <p className="text-blue-800 text-sm mb-3">
            Cette page démontre l'intégration complète des services V5 Ultimate avec :
          </p>
          <ul className="text-blue-700 text-sm space-y-1 list-disc ml-4">
            <li>Distinction correcte Supplier (fournisseur) vs Brand (marque)</li>
            <li>Service PricingServiceV5UltimateFinal intégré dans le catalog</li>
            <li>Recherche par référence avec performances optimisées</li>
            <li>Monitoring en temps réel des services</li>
            <li>Méthodologie "vérifier existant avant et utiliser le meilleur et améliorer" appliquée</li>
          </ul>
        </div>
      </div>
    </div>
  );
}