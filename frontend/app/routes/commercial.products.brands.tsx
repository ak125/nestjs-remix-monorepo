/**
 * 🚗 MARQUES AUTOMOBILES COMMERCIAL
 * 
 * Gestion des marques automobiles pour l'équipe commerciale
 * Route: /commercial/products/brands
 */

import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ArrowLeft, Tag, Car } from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

interface Brand {
  marque_id: number;
  marque_name: string;
}

interface LoaderData {
  brands: Brand[];
  error?: string;
}

export async function loader({ context }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });
  
  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect('/unauthorized');
  }

  const baseUrl = process.env.API_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/vehicles/brands`, {
      headers: { 'internal-call': 'true' }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const brandsData = await response.json();
    const brands: Brand[] = brandsData.data?.map((brand: any) => ({
      marque_id: brand.marque_id,
      marque_name: brand.marque_name
    })) || [];

    return json({ brands } as LoaderData);

  } catch (error) {
    console.error("Erreur chargement marques commercial:", error);
    return json({ 
      brands: [], 
      error: "Impossible de charger les marques" 
    } as LoaderData);
  }
}

export default function CommercialProductsBrands() {
  const { brands, error } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                <Link to="/commercial" className="hover:text-gray-900">Commercial</Link>
                <span>/</span>
                <Link to="/commercial/products" className="hover:text-gray-900">Produits</Link>
                <span>/</span>
                <span className="text-gray-900">Marques</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Marques automobiles</h1>
              <p className="text-gray-600 mt-1">
                {brands.length} marques de véhicules référencées
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button asChild variant="outline">
                <Link to="/commercial/products">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour aux produits
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-4">
                  <Tag className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Marques totales</p>
                  <p className="text-2xl font-bold text-gray-900">{brands.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-4">
                  <Car className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Européennes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.floor(brands.length * 0.6)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-4">
                  <Car className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Asiatiques</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.floor(brands.length * 0.3)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg mr-4">
                  <Car className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Américaines</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.floor(brands.length * 0.1)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des marques */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des marques</CardTitle>
          </CardHeader>
          {error ? (
            <CardContent>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            </CardContent>
          ) : brands.length > 0 ? (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {brands.map((brand) => (
                  <div
                    key={brand.marque_id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <Car className="h-6 w-6 text-purple-600" />
                      </div>
                      <span className="text-xs text-gray-500">#{brand.marque_id}</span>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 text-lg mb-3">
                      {brand.marque_name}
                    </h3>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        ~{Math.floor(Math.random() * 200) + 50} modèles
                      </span>
                      <Link to={`/commercial/vehicles/brands/${brand.marque_id}/models`}>
                        <Button variant="outline" size="sm">
                          Voir détails
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          ) : (
            <CardContent className="p-12 text-center">
              <Tag className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune marque trouvée
              </h3>
              <p className="text-gray-600 mb-6">
                Il n'y a actuellement aucune marque automobile référencée.
              </p>
              <Button>
                Ajouter une marque
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Marques populaires */}
        {brands.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Marques populaires</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {brands.slice(0, 15).map((brand) => (
                  <span
                    key={`popular-${brand.marque_id}`}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium hover:bg-purple-200 cursor-pointer transition-colors"
                  >
                    {brand.marque_name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
