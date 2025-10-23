/**
 * 🚗 GESTION VÉHICULES COMMERCIAL
 * 
 * Page de gestion des véhicules pour l'équipe commerciale
 * Route: /commercial/vehicles
 */

import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { BarChart3, Car, Database, Search, Settings } from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

interface VehicleStats {
  totalBrands: number;
  totalModels: number;
  totalTypes: number;
  lastUpdate: string;
}

interface LoaderData {
  user: any;
  stats: VehicleStats | null;
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
    // Appeler l'API des statistiques véhicules
    const statsResponse = await fetch(`${baseUrl}/api/vehicles/stats`);
    let stats: VehicleStats | null = null;
    let error: string | undefined = undefined;

    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      // L'API retourne directement les données avec vérification
      if (statsData && typeof statsData.totalBrands === 'number') {
        stats = {
          totalBrands: statsData.totalBrands,
          totalModels: statsData.totalModels || 0,
          totalTypes: statsData.totalTypes || 0,
          lastUpdate: statsData.lastUpdated || new Date().toISOString()
        } as VehicleStats;
      } else {
        error = 'Format de données invalide';
      }
    } else {
      error = 'Erreur lors du chargement des statistiques';
    }

    return json<LoaderData>({ 
      user,
      stats,
      error 
    });
  } catch (err) {
    console.error('Erreur loader véhicules:', err);
    return json<LoaderData>({ 
      user,
      stats: null,
      error: 'Erreur serveur'
    });
  }
}

export default function VehiclesIndex() {
  const { user, stats, error } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🚗 Gestion Véhicules</h1>
          <p className="text-gray-600 mt-1">
            Recherche et compatibilité automobile
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Connecté en tant que : <span className="font-medium">{user.email}</span> (Niveau {user.level})
        </div>
      </div>

      {/* Statistiques */}
      {error ? (
        <Alert intent="error"><strong>Erreur :</strong> {error}</Alert>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Marques Automobiles
              </CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.totalBrands || 0).toLocaleString('fr-FR')}
              </div>
              <p className="text-xs text-muted-foreground">
                Marques référencées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Modèles
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.totalModels || 0).toLocaleString('fr-FR')}
              </div>
              <p className="text-xs text-muted-foreground">
                Modèles disponibles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Versions/Types
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.totalTypes || 0).toLocaleString('fr-FR')}
              </div>
              <p className="text-xs text-muted-foreground">
                Motorisations référencées
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Chargement des statistiques...</p>
        </div>
      )}

      {/* Actions principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="search" className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-muted p-3 rounded-lg">
                  <Search className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Recherche Véhicules
                  </h3>
                  <p className="text-sm text-gray-500">
                    Recherche multicritères
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="compatibility" className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-success/10 p-3 rounded-lg">
                  <Settings className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Compatibilité
                  </h3>
                  <p className="text-sm text-gray-500">
                    Pièces par véhicule
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="brands" className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-muted p-3 rounded-lg">
                  <Car className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Marques
                  </h3>
                  <p className="text-sm text-gray-500">
                    Catalogue marques
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="parts" className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-muted p-3 rounded-lg">
                  <Database className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Recherche Pièces
                  </h3>
                  <p className="text-sm text-gray-500">
                    Par compatibilité
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Infos système */}
      {stats && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                État du système automobile
              </h3>
              <p className="text-sm text-gray-500">
                Dernière mise à jour : {new Date(stats.lastUpdate).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-600 font-medium">
                Opérationnel
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation vers Products */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Modules connexes
            </h3>
            <p className="text-gray-600">
              Accéder aux autres fonctionnalités du système
            </p>
          </div>
          <div className="flex space-x-3">
            <Link to="../products">
              <Button variant="outline" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Gestion Produits
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
