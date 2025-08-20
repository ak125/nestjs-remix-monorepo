/**
 * 🏷️ GAMMES PRODUITS COMMERCIAL
 * 
 * Gestion des gammes de produits pour l'équipe commerciale
 * Route: /commercial/products/gammes
 */

import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ArrowLeft, Filter, Package } from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

interface Gamme {
  id: string;
  name: string;
  alias?: string;
  is_active: boolean;
  is_top: boolean;
}

interface LoaderData {
  gammes: Gamme[];
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
    const response = await fetch(`${baseUrl}/api/products/gammes`, {
      headers: { 'internal-call': 'true' }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const gammes: Gamme[] = await response.json();

    return json({ gammes } as LoaderData);

  } catch (error) {
    console.error("Erreur chargement gammes commercial:", error);
    return json({ 
      gammes: [], 
      error: "Impossible de charger les gammes" 
    } as LoaderData);
  }
}

export default function CommercialProductsGammes() {
  const { gammes, error } = useLoaderData<typeof loader>();

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
                <span className="text-gray-900">Gammes</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Gammes de produits</h1>
              <p className="text-gray-600 mt-1">
                {gammes.length} gammes de pièces automobiles disponibles
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
        {/* Statistiques rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-4">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Gammes totales</p>
                  <p className="text-2xl font-bold text-gray-900">{gammes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-4">
                  <Filter className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Gammes actives</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {gammes.filter(g => g.is_active).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-4">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Produits estimés</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(gammes.length * 45).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des gammes */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des gammes</CardTitle>
          </CardHeader>
          {error ? (
            <CardContent>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            </CardContent>
          ) : gammes.length > 0 ? (
            <CardContent>
              <div className="divide-y divide-gray-200">
                {gammes.map((gamme, index) => (
                  <div
                    key={gamme.id}
                    className="py-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-600 rounded-lg font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {gamme.name}
                          </h3>
                          {gamme.alias && (
                            <p className="text-gray-600 mt-1 text-sm">
                              Alias: {gamme.alias}
                            </p>
                          )}
                          <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                            <span>ID: {gamme.id}</span>
                            <span>~45 produits estimés</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {gamme.is_top && (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            TOP
                          </Badge>
                        )}
                        <Badge variant={gamme.is_active ? "default" : "destructive"}>
                          {gamme.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                        <Button variant="outline" size="sm">
                          Voir produits
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          ) : (
            <CardContent className="p-12 text-center">
              <Filter className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune gamme trouvée
              </h3>
              <p className="text-gray-600 mb-6">
                Il n'y a actuellement aucune gamme de produits disponible.
              </p>
              <Button>
                Ajouter une gamme
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
