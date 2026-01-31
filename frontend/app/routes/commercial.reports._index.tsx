/**
 * 📊 RAPPORTS COMMERCIAUX
 *
 * Interface de rapports et analytics pour l'équipe commerciale
 * Utilise les APIs existantes dashboard et legacy-orders
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  DollarSign,
  Package,
  Users,
} from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Button } from "~/components/ui/button";

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Vérifier l'accès commercial (niveau 3+)
  const user = await requireUser({ context });
  if (!user || (user.level && user.level < 3)) {
    throw new Response("Accès commercial requis", { status: 403 });
  }

  try {
    // Récupérer les données via les APIs existantes
    const [dashboardResponse, ordersResponse] = await Promise.all([
      fetch("http://127.0.0.1:3000/api/dashboard/stats", {
        headers: { Cookie: request.headers.get("Cookie") || "" },
      }),
      fetch("http://127.0.0.1:3000/api/dashboard/orders/recent", {
        headers: { Cookie: request.headers.get("Cookie") || "" },
      }),
    ]);

    const dashboardData = await dashboardResponse.json();
    const recentOrders = await ordersResponse.json();

    // Calculer les métriques
    const conversionRate =
      dashboardData.totalOrders > 0
        ? (
            (dashboardData.completedOrders / dashboardData.totalOrders) *
            100
          ).toFixed(1)
        : "0.0";

    const averageOrderValue =
      dashboardData.completedOrders > 0
        ? (dashboardData.totalRevenue / dashboardData.completedOrders).toFixed(
            2,
          )
        : "0.00";

    return json({
      statistics: {
        totalOrders: dashboardData.totalOrders || 0,
        completedOrders: dashboardData.completedOrders || 0,
        pendingOrders: dashboardData.pendingOrders || 0,
        totalRevenue: dashboardData.totalRevenue || 0,
        totalUsers: dashboardData.totalUsers || 0,
        totalSuppliers: dashboardData.totalSuppliers || 0,
        conversionRate,
        averageOrderValue,
      },
      recentOrders: recentOrders.orders || [],
    });
  } catch (error) {
    console.error("Erreur chargement rapports:", error);
    return json({
      statistics: {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        totalUsers: 0,
        totalSuppliers: 0,
        conversionRate: "0.0",
        averageOrderValue: "0.00",
      },
      recentOrders: [],
    });
  }
}

export default function CommercialReports() {
  const data = useLoaderData<typeof loader>() as any;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <BarChart3 className="mr-3 h-8 w-8 text-blue-600" />
            Rapports Commerciaux
          </h1>
          <p className="text-gray-600 mt-1">
            Analytics et insights de performance
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard">
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              ← Retour Dashboard
            </button>
          </Link>
          <Button
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm"
            variant="blue"
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter Rapport
          </Button>
        </div>
      </div>

      {/* Métriques Clés */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(data.statistics.totalRevenue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.statistics.completedOrders} commandes payées
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Taux de Conversion</p>
              <p className="text-2xl font-bold text-blue-600">
                {data.statistics.conversionRate}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.statistics.completedOrders}/{data.statistics.totalOrders}{" "}
                commandes
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Panier Moyen</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(parseFloat(data.statistics.averageOrderValue))}
              </p>
              <p className="text-xs text-gray-500 mt-1">Par commande payée</p>
            </div>
            <Package className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Clients Actifs</p>
              <p className="text-2xl font-bold text-orange-600">
                {data.statistics.totalUsers.toLocaleString("fr-FR")}
              </p>
              <p className="text-xs text-gray-500 mt-1">Base client totale</p>
            </div>
            <Users className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="mr-2 h-5 w-5 text-blue-600" />
            Performance des Ventes
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Commandes Totales</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: "100%" }}
                  ></div>
                </div>
                <span className="text-sm font-semibold">
                  {data.statistics.totalOrders}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Commandes Payées</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div
                    className="bg-success h-2 rounded-full"
                    style={{ width: `${data.statistics.conversionRate}%` }}
                  ></div>
                </div>
                <span className="text-sm font-semibold">
                  {data.statistics.completedOrders}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">En Attente</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div
                    className="bg-orange-600 h-2 rounded-full"
                    style={{
                      width: `${100 - parseFloat(data.statistics.conversionRate)}%`,
                    }}
                  ></div>
                </div>
                <span className="text-sm font-semibold">
                  {data.statistics.pendingOrders}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Package className="mr-2 h-5 w-5 text-purple-600" />
            Résumé Rapide
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Fournisseurs</span>
              <span className="font-semibold">
                {data.statistics.totalSuppliers}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Clients</span>
              <span className="font-semibold">
                {data.statistics.totalUsers.toLocaleString("fr-FR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">CA Moyen/Client</span>
              <span className="font-semibold">
                {formatCurrency(
                  data.statistics.totalRevenue /
                    (data.statistics.totalUsers || 1),
                )}
              </span>
            </div>
            <div className="pt-3 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.statistics.totalRevenue)}
                </div>
                <div className="text-xs text-gray-500">
                  Chiffre d'affaires total
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Commandes Récentes */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold flex items-center">
            <Calendar className="mr-2 h-5 w-5 text-green-600" />
            Activité Récente
          </h3>
        </div>
        <div className="p-6">
          {data.recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">Aucune commande récente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recentOrders.slice(0, 10).map((order: any) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-3 ${
                        order.status === "completed" || order.isPaid
                          ? "bg-success"
                          : "bg-orange-600"
                      }`}
                    ></div>
                    <div>
                      <div className="font-medium">
                        Commande #{order.orderNumber}
                      </div>
                      <div className="text-sm text-gray-600">
                        {order.customerName} • {formatDate(order.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatCurrency(order.totalAmount)}
                    </div>
                    <div
                      className={`text-xs px-2 py-1 rounded-full ${
                        order.status === "completed" || order.isPaid
                          ? "success"
                          : "orange"
                      }`}
                    >
                      {order.status === "completed" || order.isPaid
                        ? "Payée"
                        : "En attente"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions Rapides */}
      <div className="mt-8">
        <div className="bg-primary/5 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            Actions Rapides
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/orders"
              className="flex items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <Package className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <div className="font-medium">Gérer les Commandes</div>
                <div className="text-sm text-gray-600">
                  {data.statistics.pendingOrders} en attente
                </div>
              </div>
            </Link>
            <Link
              to="/commercial/stock"
              className="flex items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <TrendingDown className="h-8 w-8 text-orange-600 mr-3" />
              <div>
                <div className="font-medium">Contrôler le Stock</div>
                <div className="text-sm text-gray-600">
                  Vérifier les niveaux
                </div>
              </div>
            </Link>
            <div className="flex items-center p-4 bg-white rounded-lg shadow-sm">
              <Users className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <div className="font-medium">Support Client</div>
                <div className="text-sm text-gray-600">
                  Assistance disponible
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
