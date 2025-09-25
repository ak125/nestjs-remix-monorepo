// 🚀 Page de test V4 - Service hybride ultime
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { catalogFamiliesApi } from "../services/api/catalog-families.api";

export async function loader({ params }: LoaderFunctionArgs) {
  const typeId = parseInt(params.typeId || '22547'); // Audi A5 par défaut

  try {
    console.log(`🚀 [TEST V4] Test service hybride ultime pour type_id: ${typeId}`);
    
    const startTime = Date.now();
    const result = await catalogFamiliesApi.getCatalogFamiliesForVehicleV4(typeId);
    const loadTime = Date.now() - startTime;

    // Test des métriques
    let metrics = null;
    try {
      metrics = await catalogFamiliesApi.getV4Metrics();
    } catch (error) {
      console.warn('⚠️ Erreur récupération métriques V4:', error);
    }

    return json({
      typeId,
      catalog: result.catalog,
      popularParts: result.popularParts,
      performance: result.performance,
      queryType: result.queryType,
      loadTime: `${loadTime}ms`,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [TEST V4] Erreur:', error);
    return json({
      typeId,
      error: error.message,
      catalog: [],
      popularParts: [],
      performance: null,
      loadTime: '0ms',
      timestamp: new Date().toISOString()
    });
  }
}

export default function TestV4() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🚀 Test Service V4 Hybride Ultime
          </h1>
          <p className="text-gray-600">
            Validation du cache intelligent + requêtes parallèles + TTL adaptatif
          </p>
        </div>

        {/* Performance Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">Type ID</h3>
              <span className="text-lg font-bold text-blue-600">{data.typeId}</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">Load Time</h3>
              <span className="text-lg font-bold text-green-600">{data.loadTime}</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">Query Type</h3>
              <span className="text-sm font-bold text-purple-600">{data.queryType || 'ERROR'}</span>
            </div>
          </div>
        </div>

        {/* Performance Details */}
        {data.performance && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Performance V4</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{data.performance.responseTime}</div>
                <div className="text-sm text-gray-500">Response Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{data.performance.source}</div>
                <div className="text-sm text-gray-500">Source</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{(data.performance.cacheHitRatio * 100).toFixed(1)}%</div>
                <div className="text-sm text-gray-500">Cache Hit Ratio</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{data.performance.completenessScore}%</div>
                <div className="text-sm text-gray-500">Completeness</div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Panel */}
        {data.metrics && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📈 Métriques Globales V4</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{data.metrics.performance.totalRequests}</div>
                <div className="text-sm text-gray-500">Total Requests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{data.metrics.performance.cacheHitRatio}</div>
                <div className="text-sm text-gray-500">Cache Hit Ratio</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{data.metrics.performance.totalCachedVehicles}</div>
                <div className="text-sm text-gray-500">Cached Vehicles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{data.metrics.performance.avgResponseTime}ms</div>
                <div className="text-sm text-gray-500">Avg Response</div>
              </div>
            </div>

            {/* Top Vehicles */}
            {data.metrics.topVehicles?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">🔥 Top Véhicules</h3>
                <div className="space-y-2">
                  {data.metrics.topVehicles.slice(0, 5).map((vehicle: any, index: number) => (
                    <div key={vehicle.typeId} className="flex justify-between items-center bg-gray-50 rounded p-2">
                      <span className="font-medium">Type ID {vehicle.typeId}</span>
                      <div className="flex space-x-4 text-sm text-gray-600">
                        <span>{vehicle.requestCount} req</span>
                        <span>{vehicle.avgResponseTime}ms avg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Panel */}
        {data.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">❌ Erreur</h2>
            <p className="text-red-600">{data.error}</p>
          </div>
        )}

        {/* Results Panel */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📋 Catalogue ({data.catalog.length} familles)
          </h2>
          
          {data.catalog.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.catalog.slice(0, 6).map((family: any) => (
                <div key={family.mf_id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">{family.mf_name}</h3>
                  <div className="text-sm text-gray-600">
                    <div>ID: {family.mf_id}</div>
                    <div>Gammes: {family.gammes?.length || 0}</div>
                  </div>
                  {family.gammes?.slice(0, 3).map((gamme: any) => (
                    <div key={gamme.pg_id} className="text-xs text-blue-600 mt-1">
                      • {gamme.pg_name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Aucune famille trouvée</p>
          )}

          {/* Popular Parts */}
          {data.popularParts.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                ⭐ Pièces Populaires ({data.popularParts.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {data.popularParts.map((part: any) => (
                  <div key={part.pg_alias} className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="font-medium text-blue-800">{part.pg_name}</div>
                    <div className="text-xs text-blue-600">{part.pg_alias}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          Test généré le {new Date(data.timestamp).toLocaleString('fr-FR')}
        </div>
      </div>
    </div>
  );
}