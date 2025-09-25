// 📊 Page comparative V3 vs V4
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { catalogFamiliesApi } from "../services/api/catalog-families.api";

export async function loader({ params }: LoaderFunctionArgs) {
  const typeId = parseInt(params.typeId || '22547'); // Audi A5 par défaut

  const results = {
    typeId,
    timestamp: new Date().toISOString(),
    v3: null as any,
    v4: null as any,
    comparison: null as any
  };

  // Test V3
  try {
    console.log(`🔄 [COMPARAISON] Test V3 pour type_id: ${typeId}`);
    const startV3 = Date.now();
    const v3Result = await catalogFamiliesApi.getCatalogFamiliesForVehicleV3(typeId);
    const v3Time = Date.now() - startV3;
    
    results.v3 = {
      success: true,
      catalog: v3Result.catalog,
      popularParts: v3Result.popularParts,
      queryType: v3Result.queryType,
      seoValid: v3Result.seoValid,
      loadTime: `${v3Time}ms`,
      families: v3Result.catalog.length,
      gammes: v3Result.catalog.reduce((sum, f) => sum + f.gammes.length, 0)
    };
  } catch (error) {
    results.v3 = {
      success: false,
      error: error.message,
      loadTime: '0ms'
    };
  }

  // Test V4
  try {
    console.log(`🚀 [COMPARAISON] Test V4 pour type_id: ${typeId}`);
    const startV4 = Date.now();
    const v4Result = await catalogFamiliesApi.getCatalogFamiliesForVehicleV4(typeId);
    const v4Time = Date.now() - startV4;
    
    results.v4 = {
      success: true,
      catalog: v4Result.catalog,
      popularParts: v4Result.popularParts,
      queryType: v4Result.queryType,
      seoValid: v4Result.seoValid,
      performance: v4Result.performance,
      loadTime: `${v4Time}ms`,
      families: v4Result.catalog.length,
      gammes: v4Result.catalog.reduce((sum, f) => sum + f.gammes.length, 0)
    };
  } catch (error) {
    results.v4 = {
      success: false,
      error: error.message,
      loadTime: '0ms'
    };
  }

  // Calcul de comparaison
  if (results.v3?.success && results.v4?.success) {
    const v3TimeMs = parseInt(results.v3.loadTime);
    const v4TimeMs = parseInt(results.v4.loadTime);
    
    results.comparison = {
      speedImprovement: v3TimeMs > 0 ? ((v3TimeMs - v4TimeMs) / v3TimeMs * 100).toFixed(1) : 0,
      fasterBy: v3TimeMs - v4TimeMs,
      familiesDiff: results.v4.families - results.v3.families,
      gammesDiff: results.v4.gammes - results.v3.gammes,
      cacheAdvantage: results.v4.performance?.source === 'CACHE'
    };
  }

  return json(results);
}

export default function CompareV3V4() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 Comparaison V3 vs V4 Ultime
          </h1>
          <p className="text-gray-600">
            Performance et fonctionnalités - Type ID: {data.typeId}
          </p>
        </div>

        {/* Comparison Overview */}
        {data.comparison && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🏆 Résultats</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${data.comparison.speedImprovement > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  {data.comparison.speedImprovement > 0 ? '+' : ''}{data.comparison.speedImprovement}%
                </div>
                <div className="text-sm text-gray-500">Amélioration vitesse</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${data.comparison.fasterBy > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  {data.comparison.fasterBy > 0 ? '-' : '+'}{Math.abs(data.comparison.fasterBy)}ms
                </div>
                <div className="text-sm text-gray-500">Différence temps</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${data.comparison.cacheAdvantage ? 'text-green-600' : 'text-blue-600'}`}>
                  {data.comparison.cacheAdvantage ? 'CACHE' : 'DB'}
                </div>
                <div className="text-sm text-gray-500">Source V4</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${data.comparison.gammesDiff >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  {data.comparison.gammesDiff >= 0 ? '+' : ''}{data.comparison.gammesDiff}
                </div>
                <div className="text-sm text-gray-500">Gammes différence</div>
              </div>
            </div>
          </div>
        )}

        {/* Side by Side Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* V3 Panel */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="bg-blue-500 text-white px-6 py-3 rounded-t-lg">
              <h2 className="text-lg font-bold">🔄 Service V3 - Hybride</h2>
            </div>
            <div className="p-6">
              {data.v3?.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{data.v3.loadTime}</div>
                      <div className="text-sm text-gray-500">Load Time</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{data.v3.families}</div>
                      <div className="text-sm text-gray-500">Familles</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{data.v3.gammes}</div>
                      <div className="text-sm text-gray-500">Gammes</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{data.v3.popularParts.length}</div>
                      <div className="text-sm text-gray-500">Pièces Pop</div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="text-sm">
                      <div><strong>Query Type:</strong> <span className="text-blue-600">{data.v3.queryType}</span></div>
                      <div><strong>SEO Valid:</strong> <span className={data.v3.seoValid ? 'text-green-600' : 'text-orange-600'}>{data.v3.seoValid ? 'Oui' : 'Non'}</span></div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Familles (5 premières)</h4>
                    <div className="space-y-1">
                      {data.v3.catalog.slice(0, 5).map((family: any) => (
                        <div key={family.mf_id} className="text-sm">
                          <strong>{family.mf_name}</strong> ({family.gammes.length} gammes)
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-red-500 text-xl mb-2">❌ Erreur V3</div>
                  <div className="text-sm text-gray-500">{data.v3?.error}</div>
                </div>
              )}
            </div>
          </div>

          {/* V4 Panel */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-t-lg">
              <h2 className="text-lg font-bold">🚀 Service V4 - Ultime</h2>
            </div>
            <div className="p-6">
              {data.v4?.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{data.v4.loadTime}</div>
                      <div className="text-sm text-gray-500">Load Time</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{data.v4.families}</div>
                      <div className="text-sm text-gray-500">Familles</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{data.v4.gammes}</div>
                      <div className="text-sm text-gray-500">Gammes</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{data.v4.popularParts.length}</div>
                      <div className="text-sm text-gray-500">Pièces Pop</div>
                    </div>
                  </div>

                  {/* V4 Specific Performance */}
                  {data.v4.performance && (
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <strong>Source:</strong> <span className={`${data.v4.performance.source === 'CACHE' ? 'text-green-600' : 'text-blue-600'}`}>{data.v4.performance.source}</span>
                        </div>
                        <div>
                          <strong>Response:</strong> <span className="text-purple-600">{data.v4.performance.responseTime}</span>
                        </div>
                        <div>
                          <strong>Cache Hit:</strong> <span className="text-orange-600">{(data.v4.performance.cacheHitRatio * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          <strong>Completeness:</strong> <span className="text-green-600">{data.v4.performance.completenessScore}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t pt-4">
                    <div className="text-sm">
                      <div><strong>Query Type:</strong> <span className="text-purple-600">{data.v4.queryType}</span></div>
                      <div><strong>SEO Valid:</strong> <span className={data.v4.seoValid ? 'text-green-600' : 'text-orange-600'}>{data.v4.seoValid ? 'Oui' : 'Non'}</span></div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Familles (5 premières)</h4>
                    <div className="space-y-1">
                      {data.v4.catalog.slice(0, 5).map((family: any) => (
                        <div key={family.mf_id} className="text-sm">
                          <strong>{family.mf_name}</strong> ({family.gammes.length} gammes)
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-red-500 text-xl mb-2">❌ Erreur V4</div>
                  <div className="text-sm text-gray-500">{data.v4?.error}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Test Links */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🔗 Tests Rapides</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a href="/compare-v3-v4/22547" className="text-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border">
              <div className="font-medium">Audi A5</div>
              <div className="text-sm text-gray-500">Type 22547</div>
            </a>
            <a href="/compare-v3-v4/17173" className="text-center p-3 bg-green-50 hover:bg-green-100 rounded-lg border">
              <div className="font-medium">Audi A5</div>
              <div className="text-sm text-gray-500">Type 17173</div>
            </a>
            <a href="/compare-v3-v4/472" className="text-center p-3 bg-orange-50 hover:bg-orange-100 rounded-lg border">
              <div className="font-medium">Citroën C4</div>
              <div className="text-sm text-gray-500">Type 472</div>
            </a>
            <a href="/compare-v3-v4/15432" className="text-center p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border">
              <div className="font-medium">BMW</div>
              <div className="text-sm text-gray-500">Type 15432</div>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          Comparaison générée le {new Date(data.timestamp).toLocaleString('fr-FR')}
        </div>
      </div>
    </div>
  );
}