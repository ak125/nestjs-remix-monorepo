import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';

interface LoaderData {
  message: string;
  timestamp: string;
  apiTest: any;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('🔧 Test loader - fetching working-stock stats...');
    
    const response = await fetch('http://localhost:3000/api/admin/working-stock/stats');
    const data = await response.json();
    
    console.log('✅ API Response received:', data);
    
    return json({
      message: 'Test page chargée avec succès',
      timestamp: new Date().toISOString(),
      apiTest: data,
    });
  } catch (error) {
    console.error('❌ Erreur dans test loader:', error);
    return json({
      message: 'Erreur lors du chargement',
      timestamp: new Date().toISOString(),
      apiTest: { error: (error as Error).message },
    });
  }
}

export default function TestWorkingStock() {
  const { message, timestamp, apiTest } = useLoaderData<LoaderData>();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">🧪 Test Working Stock API</h1>
      
      <div className="space-y-4">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-green-600">Status</h2>
          <p>{message}</p>
          <p className="text-sm text-gray-500">{timestamp}</p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-purple-600">API Response</h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
            {JSON.stringify(apiTest, null, 2)}
          </pre>
        </div>

        {apiTest.success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800">✅ Statistiques Récupérées</h3>
            <div className="mt-2 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {apiTest.data?.availableItems?.toLocaleString('fr-FR')}
                </div>
                <div className="text-sm text-gray-600">Disponibles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {apiTest.data?.unavailableItems?.toLocaleString('fr-FR')}
                </div>
                <div className="text-sm text-gray-600">Indisponibles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {apiTest.data?.lowStockItems?.toLocaleString('fr-FR')}
                </div>
                <div className="text-sm text-gray-600">Alertes</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">🔗 Navigation</h3>
          <div className="space-y-2">
            <Link 
              to="/admin/stock/working"
              className="block text-blue-600 hover:text-blue-800 underline"
            >
              → Interface Stock Complete
            </Link>
            <Link 
              to="/admin/stock/working/reports"
              className="block text-purple-600 hover:text-purple-800 underline"
            >
              → Rapports Stock
            </Link>
            <a 
              href="/api/admin/working-stock/health"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-green-600 hover:text-green-800 underline"
            >
              → API Health Check
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
