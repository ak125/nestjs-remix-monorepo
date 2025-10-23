/**
 * 🚗 TYPES DE MODÈLE COMMERCIALE
 * 
 * Page des types/motorisations d'un modèle automobile
 * Route: /commercial/vehicles/models/$modelId/types
 */

import { Badge } from "@fafa/ui";
import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link, useParams } from "@remix-run/react";
import { ArrowLeft, Zap, Fuel, Settings, Calendar } from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

interface VehicleType {
  type_id: string;
  type_name: string;
  type_fuel: string;
  type_power_ps: string;
  type_power_kw: string;
  type_year_from: string;
  type_year_to: string | null;
  type_body: string;
  type_engine: string;
  type_liter: string;
}

interface LoaderData {
  types: VehicleType[];
  model: {
    modele_id: number;
    modele_name: string;
    brand_name: string;
  } | null;
  error?: string;
}

export async function loader({ context, params }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });
  
  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect('/unauthorized');
  }

  const { modelId } = params;
  if (!modelId) {
    throw new Response("Model ID manquant", { status: 400 });
  }

  const baseUrl = process.env.API_URL || "http://localhost:3000";

  try {
    // Récupérer les types du modèle
    const typesResponse = await fetch(`${baseUrl}/api/vehicles/models/${modelId}/types`, {
      headers: { 'internal-call': 'true' }
    });
    
    if (!typesResponse.ok) {
      throw new Error(`API Error: ${typesResponse.status}`);
    }

    const typesData = await typesResponse.json();
    const types: VehicleType[] = typesData.data?.map((type: any) => ({
      type_id: type.type_id,
      type_name: type.type_name,
      type_fuel: type.type_fuel || 'Non spécifié',
      type_power_ps: type.type_power_ps || '0',
      type_power_kw: type.type_power_kw || '0',
      type_year_from: type.type_year_from || 'N/A',
      type_year_to: type.type_year_to,
      type_body: type.type_body || 'Non spécifié',
      type_engine: type.type_engine || 'Non spécifié',
      type_liter: type.type_liter
    })) || [];

    // Récupérer le nom réel du modèle depuis le premier type retourné
    let model = {
      modele_id: parseInt(modelId),
      modele_name: `Modèle #${modelId}`,
      brand_name: 'Marque inconnue'
    };

    if (types.length > 0) {
      const firstType = typesData.data[0];
      if (firstType.type_marque_id) {
        // Récupérer les infos de la marque pour ce modèle
        const brandResponse = await fetch(`${baseUrl}/api/vehicles/brands/${firstType.type_marque_id}/models?limit=100`, {
          headers: { 'internal-call': 'true' }
        });
        
        if (brandResponse.ok) {
          const brandData = await brandResponse.json();
          const modelInfo = brandData.data?.find((m: any) => m.modele_id == parseInt(modelId));
          
          if (modelInfo) {
            model = {
              modele_id: parseInt(modelId),
              modele_name: modelInfo.modele_name,
              brand_name: modelInfo.modele_ful_name?.split(' ')[0] || 'Marque'
            };
          }
        }
      }
    }

    return json({ types, model } as LoaderData);

  } catch (error) {
    console.error("Erreur chargement types:", error);
    return json({ 
      types: [], 
      model: null,
      error: "Impossible de charger les types de véhicule" 
    } as LoaderData);
  }
}

export default function CommercialVehiclesModelTypes() {
  const { types, model, error } = useLoaderData<typeof loader>();
  const params = useParams();

  const fuelTypes = types.reduce((acc, type) => {
    acc[type.type_fuel] = (acc[type.type_fuel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                <Link to="/dashboard" className="hover:text-gray-900">Commercial</Link>
                <span>/</span>
                <Link to="/commercial/vehicles" className="hover:text-gray-900">Véhicules</Link>
                <span>/</span>
                <Link to="/commercial/products/brands" className="hover:text-gray-900">Marques</Link>
                <span>/</span>
                <span className="text-gray-900">Types</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Types - {model?.brand_name} {model?.modele_name || `Modèle #${params.modelId}`}
              </h1>
              <p className="text-gray-600 mt-1">
                {types.length} motorisation{types.length > 1 ? 's' : ''} disponible{types.length > 1 ? 's' : ''}
              </p>
            </div>
            
            <Button variant="outline" className="flex items-center space-x-2" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4" />
              <span>Retour</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total types</p>
                  <p className="text-2xl font-bold text-gray-900">{types.length}</p>
                </div>
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Carburants</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Object.keys(fuelTypes).length}
                  </p>
                </div>
                <Fuel className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Actifs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {types.filter(t => !t.type_year_to).length}
                  </p>
                </div>
                <Settings className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Puissance max</p>
                  <p className="text-lg font-bold text-gray-900">
                    {types.length > 0 ? 
                      `${Math.max(...types.map(t => parseInt(t.type_power_ps) || 0))} CV` 
                      : 'N/A'
                    }
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Répartition par carburant */}
        {Object.keys(fuelTypes).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Répartition par carburant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(fuelTypes).map(([fuel, count]) => (
                  <div key={fuel} className="text-center p-4 border rounded-lg">
                    <p className="font-semibold text-gray-900">{fuel}</p>
                    <p className="text-2xl font-bold text-blue-600">{count}</p>
                    <p className="text-sm text-gray-500">
                      {Math.round((count / types.length) * 100)}%
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Liste des types */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des types / motorisations</CardTitle>
          </CardHeader>
          {error ? (
            <CardContent>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            </CardContent>
          ) : types.length > 0 ? (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {types.map((type) => (
                  <div
                    key={type.type_id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Zap className="h-6 w-6 text-blue-600" />
                      </div>
                      <span className="text-xs text-gray-500">#{type.type_id}</span>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 text-lg mb-3">
                      {type.type_name}
                    </h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Carburant:</span>
                        <span className="font-medium">{type.type_fuel}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Puissance:</span>
                        <span className="font-medium">
                          {type.type_power_ps} CV / {type.type_power_kw} kW
                        </span>
                      </div>
                      {type.type_liter && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Cylindrée:</span>
                          <span className="font-medium">{type.type_liter}L</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Période:</span>
                        <span className="font-medium">
                          {type.type_year_from}{type.type_year_to ? ` - ${type.type_year_to}` : ' - Actuel'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        type.type_year_to 
                          ? 'bg-gray-100 text-gray-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {type.type_year_to ? 'Ancien' : 'Actuel'}
                      </span>
                      <Badge variant="info">
                        {type.type_fuel}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <div className="text-center py-8">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucun type trouvé pour ce modèle</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
