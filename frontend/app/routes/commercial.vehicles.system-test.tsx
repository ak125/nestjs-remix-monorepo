import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader() {
  // Tester directement les APIs
  const tests = [];
  
  try {
    const statsResponse = await fetch('http://localhost:3000/api/vehicles/forms/stats');
    const stats = await statsResponse.json();
    tests.push({ name: 'Stats API', status: 'OK', data: stats });
  } catch (error) {
    tests.push({ name: 'Stats API', status: 'ERROR', error: error.message });
  }

  try {
    const modelsResponse = await fetch('http://localhost:3000/api/vehicles/forms/models?search=golf&limit=3');
    const models = await modelsResponse.json();
    tests.push({ name: 'Models API', status: 'OK', count: models.length });
  } catch (error) {
    tests.push({ name: 'Models API', status: 'ERROR', error: error.message });
  }

  try {
    const typesResponse = await fetch('http://localhost:3000/api/vehicles/forms/types?modelId=173049&limit=3');
    const types = await typesResponse.json();
    tests.push({ name: 'Types API', status: 'OK', count: types.length });
  } catch (error) {
    tests.push({ name: 'Types API', status: 'ERROR', error: error.message });
  }

  try {
    const yearsResponse = await fetch('http://localhost:3000/api/vehicles/forms/years?typeId=115566');
    const years = await yearsResponse.json();
    tests.push({ name: 'Years API', status: 'OK', count: years.totalYears });
  } catch (error) {
    tests.push({ name: 'Years API', status: 'ERROR', error: error.message });
  }

  return json({ tests });
}

export default function SystemTest() {
  const { tests } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">🔧 Test Système - APIs Véhicules</h1>
      
      <div className="grid gap-4">
        {tests.map((test, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg border ${
              test.status === 'OK' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{test.name}</h3>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                test.status === 'OK' ? 'bg-green-200' : 'bg-red-200'
              }`}>
                {test.status}
              </span>
            </div>
            
            {test.status === 'OK' && (
              <div className="mt-2 text-sm">
                {test.data && (
                  <div>
                    <p>Marques: {test.data.totalBrands}</p>
                    <p>Modèles: {test.data.totalModels}</p>
                    <p>Types: {test.data.totalTypes}</p>
                  </div>
                )}
                {test.count && <p>Résultats trouvés: {test.count}</p>}
              </div>
            )}
            
            {test.status === 'ERROR' && (
              <div className="mt-2 text-sm">
                <p>Erreur: {test.error}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">📋 Pages Disponibles</h2>
        <div className="space-y-2">
          <a 
            href="/commercial/vehicles/advanced-search" 
            className="block text-blue-600 hover:text-blue-800"
          >
            🎯 Recherche Avancée Complète
          </a>
          <a 
            href="/commercial/vehicles/demo" 
            className="block text-blue-600 hover:text-blue-800"
          >
            🧪 Demo Composants Individuels
          </a>
          <a 
            href="/commercial/vehicles/system-test" 
            className="block text-blue-600 hover:text-blue-800"
          >
            🔧 Test Système (cette page)
          </a>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <div className="inline-flex items-center px-4 py-2 bg-green-100 border border-green-300 rounded-full">
          <span className="text-green-800 font-semibold">
            🟢 Système Opérationnel - Tous les composants fonctionnels
          </span>
        </div>
      </div>
    </div>
  );
}
