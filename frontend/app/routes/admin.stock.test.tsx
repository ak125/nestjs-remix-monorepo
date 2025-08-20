import { useState } from 'react';

interface ApiTestResult {
  endpoint: string;
  status: 'loading' | 'success' | 'error';
  data?: any;
  error?: string;
  duration?: number;
}

export default function StockApiTest() {
  const [results, setResults] = useState<ApiTestResult[]>([]);
  const [isTestingAll, setIsTestingAll] = useState(false);

  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin.replace(':3000', ':3000')
    : 'http://localhost:3000';

  const apiEndpoints = [
    { name: 'Stats', url: '/api/admin/working-stock/stats', method: 'GET' },
    { name: 'Dashboard', url: '/api/admin/working-stock/dashboard?page=1&limit=5', method: 'GET' },
    { name: 'Recherche', url: '/api/admin/working-stock/search?page=1&limit=5', method: 'GET' },
    { name: 'Top Articles', url: '/api/admin/working-stock/top-items?type=price&limit=5', method: 'GET' },
    { name: 'Analytics', url: '/api/admin/working-stock/analytics', method: 'GET' },
    { name: 'Export JSON', url: '/api/admin/working-stock/export?format=json&limit=5', method: 'GET' },
  ];

  const testEndpoint = async (endpoint: { name: string; url: string; method: string }) => {
    const startTime = Date.now();
    
    try {
      setResults(prev => 
        prev.map(r => 
          r.endpoint === endpoint.name 
            ? { ...r, status: 'loading' as const }
            : r
        )
      );

      const response = await fetch(`${baseUrl}${endpoint.url}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        setResults(prev => 
          prev.map(r => 
            r.endpoint === endpoint.name 
              ? { 
                  ...r, 
                  status: 'success' as const, 
                  data: data,
                  duration 
                }
              : r
          )
        );
      } else {
        const errorData = await response.text();
        setResults(prev => 
          prev.map(r => 
            r.endpoint === endpoint.name 
              ? { 
                  ...r, 
                  status: 'error' as const, 
                  error: `HTTP ${response.status}: ${errorData}`,
                  duration 
                }
              : r
          )
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      setResults(prev => 
        prev.map(r => 
          r.endpoint === endpoint.name 
            ? { 
                ...r, 
                status: 'error' as const, 
                error: error instanceof Error ? error.message : 'Erreur inconnue',
                duration 
              }
            : r
        )
      );
    }
  };

  const testAllEndpoints = async () => {
    setIsTestingAll(true);
    
    // Initialiser les résultats
    const initialResults: ApiTestResult[] = apiEndpoints.map(endpoint => ({
      endpoint: endpoint.name,
      status: 'loading' as const,
    }));
    setResults(initialResults);

    // Tester tous les endpoints en parallèle
    await Promise.all(
      apiEndpoints.map(endpoint => testEndpoint(endpoint))
    );
    
    setIsTestingAll(false);
  };

  const getStatusIcon = (status: ApiTestResult['status']) => {
    switch (status) {
      case 'loading':
        return '🔄';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⭕';
    }
  };

  const getStatusColor = (status: ApiTestResult['status']) => {
    switch (status) {
      case 'loading':
        return 'text-blue-600 bg-blue-50';
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Test API Stock Enrichi
          </h1>
          <p className="text-gray-600">
            Testez les endpoints du service stock enrichi
          </p>
        </div>
        <button
          onClick={testAllEndpoints}
          disabled={isTestingAll}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isTestingAll ? '🔄 Test en cours...' : '🧪 Tester Tout'}
        </button>
      </div>

      {/* Configuration */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">
          Configuration
        </h2>
        <div className="space-y-2 text-sm">
          <p><strong>URL Backend:</strong> {baseUrl}</p>
          <p><strong>Endpoints testés:</strong> {apiEndpoints.length}</p>
          <p><strong>Service:</strong> Stock Management Enrichi</p>
        </div>
      </div>

      {/* Résultats des tests */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Résultats des Tests ({results.length})
          </h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {apiEndpoints.map((endpoint, index) => {
            const result = results.find(r => r.endpoint === endpoint.name);
            
            return (
              <div key={endpoint.name} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">
                        {getStatusIcon(result?.status || 'loading')}
                      </span>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {endpoint.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {endpoint.method} {endpoint.url}
                        </p>
                      </div>
                    </div>

                    {/* Statut */}
                    <div className="mt-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(result?.status || 'loading')}`}>
                        {result?.status === 'loading' && 'Test en cours...'}
                        {result?.status === 'success' && `Succès ${result.duration ? `(${result.duration}ms)` : ''}`}
                        {result?.status === 'error' && 'Erreur'}
                        {!result && 'En attente'}
                      </span>
                    </div>

                    {/* Erreur */}
                    {result?.error && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-700">
                          <strong>Erreur:</strong> {result.error}
                        </p>
                      </div>
                    )}

                    {/* Données de succès */}
                    {result?.status === 'success' && result.data && (
                      <div className="mt-3">
                        <details className="group">
                          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                            📋 Voir les données ({Object.keys(result.data).length} propriétés)
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 border rounded text-xs">
                            <pre className="whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="ml-4">
                    <button
                      onClick={() => testEndpoint(endpoint)}
                      disabled={result?.status === 'loading'}
                      className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 text-sm font-medium"
                    >
                      {result?.status === 'loading' ? '⏳' : '🔄 Retester'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {results.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🧪</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun test lancé
            </h3>
            <p className="text-gray-500 mb-4">
              Cliquez sur "Tester Tout" pour commencer les tests
            </p>
          </div>
        )}
      </div>

      {/* Statistiques */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-green-600">Succès</p>
                <p className="text-2xl font-bold text-green-800">
                  {results.filter(r => r.status === 'success').length}
                </p>
              </div>
              <div className="text-green-600 text-2xl">✅</div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600">Erreurs</p>
                <p className="text-2xl font-bold text-red-800">
                  {results.filter(r => r.status === 'error').length}
                </p>
              </div>
              <div className="text-red-600 text-2xl">❌</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-600">Temps moyen</p>
                <p className="text-2xl font-bold text-blue-800">
                  {Math.round(
                    results
                      .filter(r => r.duration)
                      .reduce((acc, r) => acc + (r.duration || 0), 0) /
                    results.filter(r => r.duration).length || 0
                  )}ms
                </p>
              </div>
              <div className="text-blue-600 text-2xl">⏱️</div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
          📝 Instructions
        </h3>
        <div className="text-sm text-yellow-700 space-y-2">
          <p>1. Assurez-vous que le serveur backend est démarré sur le port 3000</p>
          <p>2. Vérifiez que le module AdminModule inclut StockEnhancedController</p>
          <p>3. Les tests vérifient la connectivité et la disponibilité des endpoints</p>
          <p>4. En cas d'erreur CORS, vérifiez la configuration CORS du backend</p>
        </div>
      </div>
    </div>
  );
}
