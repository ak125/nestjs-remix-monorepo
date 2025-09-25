// 🚀 Page de test pour l'approche hybride V3
// Démontre l'intégration frontend de l'API hybride optimisée

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { catalogFamiliesApi } from "../services/api/catalog-families.api";

interface LoaderData {
  typeId: number;
  result: {
    catalog: Array<{
      mf_id: number;
      mf_name: string;
      mf_description?: string;
      mf_pic?: string;
      gammes: Array<{
        pg_id: number;
        pg_alias: string;
        pg_name: string;
      }>;
    }>;
    popularParts: Array<{
      cgc_pg_id: number;
      pg_alias: string;
      pg_name: string;
      pg_name_meta: string;
      pg_img: string;
      addon_content: string;
    }>;
    queryType: string;
    seoValid: boolean;
  };
  performance: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  error?: string;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const typeId = parseInt(params.typeId || '17173', 10);
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [TEST HYBRIDE] Récupération catalogue pour type_id: ${typeId}`);
    
    const result = await catalogFamiliesApi.getCatalogFamiliesForVehicleV3(typeId);
    const endTime = Date.now();
    
    return json<LoaderData>({
      typeId,
      result,
      performance: {
        startTime,
        endTime,
        duration: endTime - startTime
      }
    });
  } catch (error) {
    const endTime = Date.now();
    console.error('❌ [TEST HYBRIDE] Erreur:', error);
    
    return json<LoaderData>({
      typeId,
      result: {
        catalog: [],
        popularParts: [],
        queryType: 'ERROR',
        seoValid: false
      },
      performance: {
        startTime,
        endTime,
        duration: endTime - startTime
      },
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
}

export default function TestHybridCatalog() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header avec métriques */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🚀 Test Approche Hybride V3
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{data.typeId}</div>
              <div className="text-sm text-blue-800">Type ID</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{data.result.catalog.length}</div>
              <div className="text-sm text-green-800">Familles</div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{data.result.popularParts.length}</div>
              <div className="text-sm text-purple-800">Pièces Populaires</div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{data.performance.duration}ms</div>
              <div className="text-sm text-orange-800">Temps</div>
            </div>
          </div>
          
          {/* Statut hybride */}
          <div className="mt-4 flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              data.result.queryType === 'HYBRID_SUCCESS' 
                ? 'bg-green-100 text-green-800'
                : data.result.queryType === '2-STEPS_SUCCESS'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {data.result.queryType}
            </div>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              data.result.seoValid 
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              SEO: {data.result.seoValid ? 'VALIDE' : 'NON VALIDE'}
            </div>
          </div>
          
          {data.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Erreur:</p>
              <p className="text-red-600">{data.error}</p>
            </div>
          )}
        </div>

        {/* Catalogue des familles */}
        {data.result.catalog.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              📁 Familles Filtrées ({data.result.catalog.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.result.catalog.map((family) => (
                <div key={family.mf_id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-blue-600 font-bold text-lg">{family.mf_id}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{family.mf_name}</h3>
                      <p className="text-sm text-gray-600">{family.mf_description}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Gammes ({family.gammes.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {family.gammes.slice(0, 3).map((gamme) => (
                        <span
                          key={gamme.pg_id}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          {gamme.pg_name}
                        </span>
                      ))}
                      {family.gammes.length > 3 && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs">
                          +{family.gammes.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pièces populaires */}
        {data.result.popularParts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              ⭐ Pièces Populaires ({data.result.popularParts.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.result.popularParts.map((part) => (
                <div key={part.cgc_pg_id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-orange-600 font-bold">🔧</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{part.pg_name}</h3>
                      <p className="text-sm text-blue-600">{part.pg_alias}</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600">{part.addon_content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pas de données */}
        {data.result.catalog.length === 0 && !data.error && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Aucune famille trouvée
              </h2>
              <p className="text-gray-600">
                L'approche hybride n'a pas trouvé de familles pour ce véhicule.
              </p>
            </div>
          </div>
        )}

        {/* Liens de test rapide */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🧪 Tests Rapides</h3>
          <div className="flex flex-wrap gap-2">
            <a 
              href="/test-hybrid-catalog/17173" 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Type 17173 (Test Principal)
            </a>
            <a 
              href="/test-hybrid-catalog/8408" 
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Type 8408 (Alternatif)
            </a>
            <a 
              href="/test-hybrid-catalog/1234" 
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Type 1234 (Test Vide)
            </a>
          </div>
        </div>
        
      </div>
    </div>
  );
}