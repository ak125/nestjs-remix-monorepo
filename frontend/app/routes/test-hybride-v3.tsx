// 🚀 Page de test pour l'approche hybride V3
// Route: /test-hybride-v3

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { catalogFamiliesApi, type CatalogFamily } from "../services/api/catalog-families.api";

// Types pour les données
interface PopularPart {
  cgc_pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_img: string;
  addon_content: string;
}

interface LoaderData {
  catalog: CatalogFamily[];
  popularParts: PopularPart[];
  queryType: string;
  seoValid: boolean;
  typeId: number;
  performanceMetrics: {
    catalogCount: number;
    partsCount: number;
    isHybridSuccess: boolean;
  };
}

// Loader avec test de l'approche hybride V3
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const typeIdParam = url.searchParams.get('typeId') || '17173'; // Véhicule populaire par défaut
  const typeId = parseInt(typeIdParam, 10);

  try {
    console.log(`🚀 [TEST HYBRIDE V3] Test pour type_id: ${typeId}`);
    
    // Appel à l'API V3 hybride
    const hybridResult = await catalogFamiliesApi.getCatalogFamiliesForVehicleV3(typeId);
    
    const performanceMetrics = {
      catalogCount: hybridResult.catalog.length,
      partsCount: hybridResult.popularParts.length,
      isHybridSuccess: hybridResult.queryType === 'HYBRID_SUCCESS'
    };

    console.log(`✅ [TEST HYBRIDE V3] Résultats: ${performanceMetrics.catalogCount} familles, ${performanceMetrics.partsCount} pièces, Type: ${hybridResult.queryType}`);

    return json({
      catalog: hybridResult.catalog,
      popularParts: hybridResult.popularParts,
      queryType: hybridResult.queryType,
      seoValid: hybridResult.seoValid,
      typeId,
      performanceMetrics
    });

  } catch (error) {
    console.error('❌ [TEST HYBRIDE V3] Erreur:', error);
    
    return json({
      catalog: [],
      popularParts: [],
      queryType: 'ERROR',
      seoValid: false,
      typeId,
      performanceMetrics: {
        catalogCount: 0,
        partsCount: 0,
        isHybridSuccess: false
      }
    });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: `Test Approche Hybride V3 - Type ID ${data?.typeId || 'N/A'}` },
    { name: "description", content: "Page de test pour l'approche hybride V3 avec index composite + validation FK" },
  ];
};

// Composant principal
export default function TestHybrideV3() {
  const data = useLoaderData<LoaderData>();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* En-tête avec métriques */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🚀 Test Approche Hybride V3
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{data.typeId}</div>
              <div className="text-sm text-blue-600">Type ID testé</div>
            </div>
            
            <div className={`p-4 rounded-lg ${data.performanceMetrics.isHybridSuccess ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-2xl font-bold ${data.performanceMetrics.isHybridSuccess ? 'text-green-600' : 'text-red-600'}`}>
                {data.queryType}
              </div>
              <div className={`text-sm ${data.performanceMetrics.isHybridSuccess ? 'text-green-600' : 'text-red-600'}`}>
                Type de requête
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{data.performanceMetrics.catalogCount}</div>
              <div className="text-sm text-purple-600">Familles récupérées</div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{data.performanceMetrics.partsCount}</div>
              <div className="text-sm text-orange-600">Pièces populaires</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 text-sm">
            <span className={`px-3 py-1 rounded-full ${data.seoValid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              SEO: {data.seoValid ? 'Valide' : 'Non valide'}
            </span>
            <span className={`px-3 py-1 rounded-full ${data.performanceMetrics.isHybridSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {data.performanceMetrics.isHybridSuccess ? '⚡ Approche hybride réussie' : '❌ Approche hybride échouée'}
            </span>
          </div>
        </div>

        {/* Test avec différents véhicules */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Tester d'autres véhicules</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { typeId: 17173, name: "Véhicule populaire (17173)" },
              { typeId: 8408, name: "Véhicule test (8408)" },
              { typeId: 115277, name: "BMW Série 1 (115277)" },
              { typeId: 12345, name: "Véhicule rare (12345)" }
            ].map((vehicle) => (
              <a
                key={vehicle.typeId}
                href={`/test-hybride-v3?typeId=${vehicle.typeId}`}
                className="block p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-sm">{vehicle.name}</div>
                <div className="text-xs text-gray-500">Type ID: {vehicle.typeId}</div>
              </a>
            ))}
          </div>
        </div>

        {/* Catalogue des familles */}
        {data.catalog.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">
              📋 Catalogue filtré ({data.catalog.length} familles)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.catalog.map((family) => (
                <div key={family.mf_id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{family.mf_name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{family.mf_description}</p>
                  <div className="text-xs text-gray-500">
                    {family.gammes.length} gamme{family.gammes.length > 1 ? 's' : ''} disponible{family.gammes.length > 1 ? 's' : ''}
                  </div>
                  {family.gammes.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {family.gammes.slice(0, 3).map((gamme) => (
                        <div key={gamme.pg_id} className="text-xs bg-gray-50 px-2 py-1 rounded">
                          {gamme.pg_name}
                        </div>
                      ))}
                      {family.gammes.length > 3 && (
                        <div className="text-xs text-gray-400">
                          +{family.gammes.length - 3} autres gammes
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pièces populaires */}
        {data.popularParts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              ⭐ Pièces populaires ({data.popularParts.length} pièces)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.popularParts.map((part) => (
                <div key={part.cgc_pg_id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{part.pg_name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{part.addon_content}</p>
                  <div className="text-xs text-gray-500">
                    Alias: {part.pg_alias} • ID: {part.cgc_pg_id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message si pas de données */}
        {data.catalog.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-yellow-400 mr-3">⚠️</div>
              <div>
                <h3 className="text-lg font-medium text-yellow-800">Aucune donnée récupérée</h3>
                <p className="text-yellow-700 mt-1">
                  L'approche hybride V3 n'a pas pu récupérer de données pour le type_id {data.typeId}.
                  Cela peut être normal si ce véhicule n'a pas de pièces dans la base de données.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}