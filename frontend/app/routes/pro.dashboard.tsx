/**
 * Dashboard Pro - Interface principal pour les professionnels
 */

import { type LoaderFunction, type MetaFunction, json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { 
  BarChart3, 
  Users, 
  ShoppingCart, 
  Package, 
  TrendingUp,
  Calendar,
  DollarSign,
  Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { requireUser } from "~/server/auth.server";
import { getRemixApiService } from "~/server/remix-api.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard Pro - Context7" },
    { name: "description", content: "Tableau de bord professionnel" },
  ];
};

export const loader: LoaderFunction = async ({ request, context }) => {
  // Vérifier que l'utilisateur est connecté
  await requireUser({ context });

  try {
    // Récupérer les statistiques via le service API
    const remixService = await getRemixApiService(context);
    const dashboardStats = await remixService.getDashboardStats();

    return json({
      stats: dashboardStats.stats || {
        totalOrders: 0,
        totalUsers: 0,
        totalRevenue: 0,
        pendingOrders: 0
      },
      success: dashboardStats.success || false
    });
  } catch (error) {
    console.error('Erreur dashboard:', error);
    return json({
      stats: {
        totalOrders: 0,
        totalUsers: 0,
        totalRevenue: 0,
        pendingOrders: 0
      },
      success: false
    });
  }
};

type LoaderData = {
  stats: {
    totalOrders: number;
    totalUsers: number;
    totalRevenue: number;
    pendingOrders: number;
  };
  success: boolean;
};

export default function ProDashboard() {
  const { stats, success } = useLoaderData<LoaderData>();

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Pro</h1>
          <p className="text-gray-600">Vue d'ensemble de votre activité professionnelle</p>
          <div className="mt-2">
            <Badge variant={success ? "default" : "destructive"}>
              {success ? "✅ Données en temps réel" : "⚠️ Données limitées"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Rapports
          </Button>
          <Button>
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Commandes</p>
                <p className="text-2xl font-bold">{stats.totalOrders.toLocaleString('fr-FR')}</p>
                <p className="text-xs text-green-600 mt-1">↗ Toutes les commandes</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Utilisateurs</p>
                <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString('fr-FR')}</p>
                <p className="text-xs text-green-600 mt-1">↗ Clients enregistrés</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', { 
                    style: 'currency', 
                    currency: 'EUR' 
                  }).format(stats.totalRevenue)}
                </p>
                <p className="text-xs text-green-600 mt-1">↗ Revenue totale</p>
              </div>
              <DollarSign className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En Attente</p>
                <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                <p className="text-xs text-yellow-600 mt-1">À traiter</p>
              </div>
              <Package className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShoppingCart className="mr-2 h-5 w-5" />
              Gestion des Commandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Gérez toutes vos commandes, suivez les statuts et traitez les paiements.
            </p>
            <div className="flex gap-2">
              <Link to="/admin/orders" className="flex-1">
                <Button className="w-full" size="sm">
                  <Eye className="mr-2 h-4 w-4" />
                  Voir les commandes
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Gestion des Utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Administrez vos clients, gérez les comptes et les permissions.
            </p>
            <div className="flex gap-2">
              <Link to="/admin/users" className="flex-1">
                <Button className="w-full" size="sm" variant="outline">
                  <Eye className="mr-2 h-4 w-4" />
                  Voir les utilisateurs
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="mr-2 h-5 w-5" />
              Analytics & Rapports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Analysez vos performances et générez des rapports détaillés.
            </p>
            <div className="flex gap-2">
              <Button className="w-full" size="sm" variant="outline" disabled>
                <BarChart3 className="mr-2 h-4 w-4" />
                Bientôt disponible
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activité récente */}
      <Card>
        <CardHeader>
          <CardTitle>Activité Récente</CardTitle>
          <p className="text-sm text-gray-600">
            Dernières actions sur votre plateforme
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium">Module Orders fonctionnel</p>
                <p className="text-sm text-gray-600">
                  {stats.totalOrders} commandes chargées depuis la base de données
                </p>
              </div>
              <span className="text-xs text-gray-500">Maintenant</span>
            </div>
            
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium">Module Users opérationnel</p>
                <p className="text-sm text-gray-600">
                  {stats.totalUsers} utilisateurs disponibles
                </p>
              </div>
              <span className="text-xs text-gray-500">Récent</span>
            </div>
            
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
              <div className="flex-1">
                <p className="font-medium">Système en fonctionnement</p>
                <p className="text-sm text-gray-600">
                  Backend NestJS + Frontend Remix opérationnels
                </p>
              </div>
              <span className="text-xs text-gray-500">Stable</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
