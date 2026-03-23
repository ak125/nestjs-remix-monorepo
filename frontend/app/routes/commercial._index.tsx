/**
 * TABLEAU DE BORD COMMERCIAL
 * Dashboard principal pour l'interface commerciale
 * Route: /commercial
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ShoppingCart, Truck, CheckCircle, TrendingUp } from "lucide-react";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
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

export const meta: MetaFunction = () =>
  createNoIndexMeta("Tableau de Bord - Commercial");

interface DashboardData {
  orders: {
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    monthRevenue: number;
    recentOrders: Array<{
      id: string;
      orderNumber?: string;
      customerName?: string;
      customerId?: string;
      status: string;
      total: number;
      date: string;
      isPaid: boolean;
    }>;
  };
}

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });

  if (!user.level || user.level < 3) {
    throw redirect("/unauthorized");
  }

  try {
    const API_BASE = getInternalApiUrl("");

    const [dashboardResponse, recentOrdersResponse] = await Promise.all([
      fetch(`${API_BASE}/api/dashboard/stats`, {
        headers: { "internal-call": "true" },
      }),
      fetch(`${API_BASE}/api/dashboard/orders/recent`, {
        headers: { "internal-call": "true" },
      }),
    ]);

    let dashboardData: DashboardData = {
      orders: {
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        monthRevenue: 0,
        recentOrders: [],
      },
    };

    if (dashboardResponse.ok) {
      const stats = await dashboardResponse.json();

      let recentOrders: any[] = [];
      if (recentOrdersResponse.ok) {
        const recentData = await recentOrdersResponse.json();
        recentOrders = recentData.orders || [];
      }

      dashboardData.orders = {
        totalOrders: stats.totalOrders || 0,
        pendingOrders: stats.pendingOrders || 0,
        completedOrders: stats.completedOrders || 0,
        monthRevenue: stats.totalRevenue || 0,
        recentOrders: recentOrders.slice(0, 8).map((o: any) => ({
          id: o.id || o.ord_id,
          orderNumber: o.orderNumber || o.ord_id,
          customerName: o.customerName || "Client",
          customerId: o.customerId || o.ord_cst_id,
          status: o.status || "en_cours",
          total: o.total || parseFloat(o.ord_total_ttc || "0"),
          date: o.date || o.ord_date,
          isPaid: o.isPaid || o.ord_is_pay === "1",
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
    logger.error("Erreur dashboard commercial:", error);

    return json({
      dashboardData: {
        orders: {
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          monthRevenue: 0,
          recentOrders: [],
        },
      },
      user: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        level: user.level,
      },
    });
  }
}

function getStatusVariant(
  status: string | null | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "default";
  switch (status) {
    case "confirme":
    case "payee":
      return "default";
    case "en_preparation":
    case "en_cours":
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
  const { dashboardData, user } = useLoaderData<typeof loader>();
  const { orders } = dashboardData;

  const stats = [
    {
      title: "Total commandes",
      value: orders.totalOrders.toLocaleString("fr-FR"),
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-primary/15",
      link: "/commercial/orders",
    },
    {
      title: "En attente",
      value: orders.pendingOrders.toString(),
      icon: Truck,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      link: "/commercial/orders?orderStatus=1",
    },
    {
      title: "Terminées",
      value: orders.completedOrders.toString(),
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-success/15",
      link: "/commercial/orders?orderStatus=5",
    },
    {
      title: "Chiffre d'affaires",
      value:
        orders.monthRevenue > 1000
          ? `${(orders.monthRevenue / 1000).toFixed(1)}k\u20AC`
          : `${orders.monthRevenue.toFixed(0)}\u20AC`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      link: "/commercial/reports",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <PublicBreadcrumb items={[{ label: "Commercial" }]} />

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Tableau de bord
            </h1>
            <p className="text-gray-600 mt-1">
              Bienvenue {user.name} — Gérez vos commandes et expéditions
            </p>
          </div>
          <div className="flex space-x-3">
            <Link to="/commercial/orders">
              <Button className="bg-primary hover:bg-primary/90">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Commandes
              </Button>
            </Link>
            <Link to="/commercial/shipping">
              <Button variant="outline">
                <Truck className="mr-2 h-4 w-4" />
                Expéditions
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

        {/* Commandes récentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShoppingCart className="mr-2 h-5 w-5 text-blue-600" />
              Commandes récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.recentOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune commande récente
              </p>
            ) : (
              <div className="space-y-2">
                {orders.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/commercial/orders/${order.id}`}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border"
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">
                          #{order.orderNumber || order.id}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.customerName || `Client #${order.customerId}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status?.replace(/_/g, " ") || "En attente"}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {order.isPaid ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            Payée
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                            Impayée
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900 text-sm">
                          {(order.total || 0).toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                          })}
                          {"\u20AC"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.date
                            ? new Date(order.date).toLocaleDateString("fr-FR")
                            : ""}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Link to="/commercial/orders">
                <Button variant="outline" className="w-full">
                  Voir toutes les commandes
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
