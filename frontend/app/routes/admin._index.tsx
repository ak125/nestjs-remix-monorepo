/**
 * Dashboard Admin - Page d'accueil d'administration
 */

import  { type LoaderFunction, type MetaFunction , json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { 
  Users, 
  ShoppingCart, 
  CreditCard, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  RefreshCw 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard - Administration" },
    { name: "description", content: "Tableau de bord d'administration avec statistiques en temps réel" },
  ];
};

export const loader: LoaderFunction = async () => {
  try {
    console.log('📊 Chargement des statistiques du dashboard...');
    
    // Récupérer les stats depuis les différentes APIs
    const [usersResponse, ordersResponse] = await Promise.all([
      fetch('http://localhost:3000/api/users?limit=1000'),
      fetch('http://localhost:3000/api/orders?limit=1000')
    ]);

    let stats = {
      totalUsers: 0,
      totalOrders: 0,
      totalRevenue: 0,
      activeUsers: 0,
      pendingOrders: 0,
      completedOrders: 0
    };

    // Traiter les données users
    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      stats.totalUsers = usersData.totalUsers || 0;
      stats.activeUsers = usersData.users?.filter((u: any) => u.isActive)?.length || 0;
    }

    // Traiter les données orders
    if (ordersResponse.ok) {
      const ordersData = await ordersResponse.json();
      const orders = ordersData.orders || [];
      stats.totalOrders = orders.length;
      stats.completedOrders = orders.filter((o: any) => o.ord_is_pay === "1").length;
      stats.pendingOrders = orders.filter((o: any) => o.ord_is_pay !== "1").length;
      stats.totalRevenue = orders
        .filter((o: any) => o.ord_is_pay === "1")
        .reduce((sum: number, o: any) => sum + parseFloat(o.ord_total_ttc || 0), 0);
    }

    console.log('✅ Stats du dashboard chargées:', stats);

    return json({ stats });
  } catch (error) {
    console.error('❌ Erreur lors du chargement du dashboard:', error);
    return json({ 
      stats: {
        totalUsers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        activeUsers: 0,
        pendingOrders: 0,
        completedOrders: 0
      },
      error: 'Erreur de connexion aux APIs'
    });
  }
};

export default function AdminDashboard() {
  const { stats, error } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          📊 Dashboard Administration
        </h1>
        <p className="text-muted-foreground">
          Vue d'ensemble de votre plateforme e-commerce
        </p>
      </div>

      {/* Alerte en cas d'erreur */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsers} actifs
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedOrders} payées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRevenue.toFixed(2)}€</div>
            <p className="text-xs text-muted-foreground">
              Commandes payées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
            <RefreshCw className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOrders}</div>
            <p className="text-xs text-muted-foreground">
              Commandes à traiter
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques de performance */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activité Récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">API Users opérationnelle</p>
                  <p className="text-xs text-muted-foreground">{stats.totalUsers} utilisateurs chargés</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">API Orders fonctionnelle</p>
                  <p className="text-xs text-muted-foreground">{stats.totalOrders} commandes trouvées</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Taux de conversion</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalOrders > 0 ? ((stats.completedOrders / stats.totalOrders) * 100).toFixed(1) : 0}% des commandes sont payées
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accès Rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a href="/admin/users" className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Gestion des Utilisateurs</p>
                    <p className="text-xs text-muted-foreground">{stats.totalUsers} utilisateurs</p>
                  </div>
                </div>
              </a>
              
              <a href="/admin/orders" className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Gestion des Commandes</p>
                    <p className="text-xs text-muted-foreground">{stats.totalOrders} commandes</p>
                  </div>
                </div>
              </a>
              
              <a href="/admin/payments" className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Gestion des Paiements</p>
                    <p className="text-xs text-muted-foreground">{stats.totalRevenue.toFixed(2)}€ de CA</p>
                  </div>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
