/**
 * 📊 TABLEAU DE BORD COMMERCIAL
 *
 * Dashboard principal pour l'interface commerciale
 * Route: /commercial
 */

import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Package,
  AlertCircle,
  ShoppingCart,
  Truck,
  DollarSign,
} from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";
import { getInternalApiUrl } from "~/utils/internal-api.server";

// Types pour les données du dashboard
interface DashboardData {
  orders: {
    todayCount: number;
    preparingCount: number;
    monthRevenue: number;
    data: Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      status: string;
      totalAmount: number;
      createdAt: string;
    }>;
  };
  stock: {
    lowStockCount: number;
    lowStockItems: Array<{
      id: string;
      name: string;
      currentStock: number;
      minStock: number;
    }>;
  };
  suppliers: {
    data: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  };
}

export async function loader({ context }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });

  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect("/unauthorized");
  }

  try {
    // Récupérer les données depuis l'API Dashboard unifiée
    const API_BASE = getInternalApiUrl("");
    console.log("🔗 API_BASE:", API_BASE);

    const [dashboardResponse, suppliersResponse, recentOrdersResponse] =
      await Promise.all([
        fetch(`${API_BASE}/api/dashboard/stats`, {
          headers: { "internal-call": "true" },
        }),
        fetch(`${API_BASE}/api/suppliers`, {
          headers: { "internal-call": "true" },
        }),
        fetch(`${API_BASE}/api/dashboard/orders/recent`, {
          headers: { "internal-call": "true" },
        }),
      ]);

    console.log("📊 Response status:", {
      dashboard: dashboardResponse.status,
      suppliers: suppliersResponse.status,
      orders: recentOrdersResponse.status,
    });

    let dashboardData: DashboardData = {
      orders: {
        todayCount: 0,
        preparingCount: 0,
        monthRevenue: 0,
        data: [],
      },
      stock: {
        lowStockCount: 0,
        lowStockItems: [],
      },
      suppliers: {
        data: [],
      },
    };

    // Traiter les données du dashboard
    if (dashboardResponse.ok) {
      const stats = await dashboardResponse.json();

      // Récupérer les commandes récentes
      let recentOrders = [];
      if (recentOrdersResponse.ok) {
        const recentData = await recentOrdersResponse.json();
        recentOrders = recentData.orders || [];
      }

      dashboardData.orders = {
        todayCount: Math.floor(stats.totalOrders * 0.02), // Estimation 2% par jour
        preparingCount: stats.pendingOrders || 0,
        monthRevenue: stats.totalRevenue || 0,
        data: recentOrders.slice(0, 5), // 5 commandes récentes
      };
    }

    // Traiter les données des fournisseurs
    if (suppliersResponse.ok) {
      const suppliersData = await suppliersResponse.json();
      dashboardData.suppliers = {
        data: (suppliersData.suppliers || [])
          .slice(0, 5)
          .map((supplier: any) => ({
            id: supplier.id,
            name: supplier.name,
            status:
              supplier.statistics?.totalArticles > 0 ? "active" : "inactive",
          })),
      };
    }

    return json({
      dashboardData,
      user: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        level: user.level,
      },
    });
  } catch (error) {
    console.error("❌ Erreur dashboard commercial:", error);

    // Données de fallback
    return json({
      dashboardData: {
        orders: { todayCount: 0, preparingCount: 0, monthRevenue: 0, data: [] },
        stock: { lowStockCount: 0, lowStockItems: [] },
        suppliers: { data: [] },
      },
      user: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        level: user.level,
      },
    });
  }
}

// Fonction helper pour les variants de badge
function getStatusVariant(
  status: string | null | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "default";

  switch (status) {
    case "confirme":
      return "default";
    case "en_preparation":
      return "secondary";
    case "expedie":
      return "outline";
    case "annule":
      return "destructive";
    default:
      return "default";
  }
}

export default function CommercialDashboard() {
  const { dashboardData } = useLoaderData<typeof loader>();
  const { orders, stock, suppliers } = dashboardData;

  const stats = [
    {
      title: "Commandes du jour",
      value: orders.todayCount.toString(),
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-primary/15",
      link: "/commercial/orders",
    },
    {
      title: "En préparation",
      value: orders.preparingCount.toString(),
      icon: Package,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      link: "/commercial/orders?status=preparing",
    },
    {
      title: "Expéditions",
      value: orders.preparingCount.toString(),
      icon: Truck,
      color: "text-green-600",
      bgColor: "bg-success/15",
      link: "/commercial/shipping",
    },
    {
      title: "Chiffre du mois",
      value: `${(orders.monthRevenue / 1000).toFixed(1)}k€`,
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      link: "/commercial/reports",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Breadcrumb */}
        <PublicBreadcrumb items={[{ label: "Commercial" }]} />

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Tableau de bord Commercial
            </h1>
            <p className="text-gray-600 mt-1">
              Gérez vos commandes, stock et fournisseurs
            </p>
          </div>
          <div className="flex space-x-3">
            <Link to="/commercial/shipping">
              <Button className="bg-success hover:bg-success/90">
                <Truck className="mr-2 h-4 w-4" />
                Expéditions
              </Button>
            </Link>
            <Link to="/commercial/orders/new">
              <Button className="bg-primary hover:bg-primary/90">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Nouvelle commande
              </Button>
            </Link>
            <Link to="/admin/suppliers">
              <Button variant="outline">
                <Truck className="mr-2 h-4 w-4" />
                Fournisseurs
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Link key={stat.title} to={stat.link} className="group">
              <Card className="hover:shadow-lg transition-all duration-200 group-hover:scale-105">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Commandes récentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingCart className="mr-2 h-5 w-5 text-blue-600" />
                Commandes récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orders.data?.map((order: any) => (
                  <Link
                    key={order.id}
                    to={`/commercial/orders/${order.id}`}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          Commande #{order.id}
                        </div>
                        <div className="text-sm text-gray-500">
                          Client #{order.customerId || "N/A"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status?.replace("_", " ") || "En attente"}
                      </Badge>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {(order.total || 0).toLocaleString("fr-FR")}€
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.date
                            ? new Date(order.date).toLocaleDateString("fr-FR")
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-4">
                <Link to="/orders">
                  <Button variant="outline" className="w-full">
                    Voir toutes les commandes
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Alertes de stock */}
          <Card className="border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle className="flex items-center text-orange-700">
                <AlertCircle className="mr-2 h-5 w-5" />
                Alertes de stock ({stock.lowStockCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {stock.lowStockItems?.map((item: any) => (
                  <Link
                    key={item.id}
                    to={`/commercial/stock/${item.id}`}
                    className="flex items-center justify-between p-3 hover:bg-orange-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-destructive/60"></div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          Stock actuel: {item.currentStock} (min:{" "}
                          {item.minStock})
                        </div>
                      </div>
                    </div>
                    <div className="text-red-600 font-medium text-sm">
                      Stock bas
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-4">
                <Link to="/commercial/stock?lowStock=true">
                  <Button
                    variant="outline"
                    className="w-full text-orange-700 border-orange-300"
                  >
                    Gérer les alertes de stock
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section fournisseurs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Truck className="mr-2 h-5 w-5 text-green-600" />
              Fournisseurs actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suppliers.data?.slice(0, 6).map((supplier: any) => (
                <Link
                  key={supplier.id}
                  to={`/admin/suppliers/${supplier.id}`}
                  className="flex items-center p-3 hover:bg-gray-50 rounded-lg border transition-colors"
                >
                  <div className="mr-3">
                    <Truck className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {supplier.name}
                    </div>
                    <div className="text-sm text-green-600">Actif</div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-4">
              <Link to="/admin/suppliers">
                <Button variant="outline" className="w-full">
                  Voir tous les fournisseurs
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Section produits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5 text-purple-600" />
              Catalogue produits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/commercial/products/catalog"
                className="flex items-center p-4 hover:bg-gray-50 rounded-lg border transition-colors group"
              >
                <div className="mr-4">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 group-hover:text-blue-600">
                    Parcourir le catalogue
                  </div>
                  <div className="text-sm text-gray-500">
                    Milliers de pièces auto
                  </div>
                </div>
              </Link>

              <Link
                to="/commercial/products"
                className="flex items-center p-4 hover:bg-gray-50 rounded-lg border transition-colors group"
              >
                <div className="mr-4">
                  <AlertCircle className="h-8 w-8 text-orange-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 group-hover:text-orange-600">
                    Gérer les produits
                  </div>
                  <div className="text-sm text-gray-500">
                    Dashboard produits
                  </div>
                </div>
              </Link>
            </div>

            <div className="mt-4">
              <Link to="/commercial/products">
                <Button variant="outline" className="w-full">
                  Accéder à la gestion produits
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
