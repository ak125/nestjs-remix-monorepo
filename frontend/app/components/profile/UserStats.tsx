/**
 * Composant de statistiques utilisateur réutilisable
 * Affiche les métriques importantes sous forme de cards
 */

import { Package, CreditCard, TrendingUp, Clock } from "lucide-react";

import { formatPrice } from "../../utils/orders";
import { Card, CardContent } from "../ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor?: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function StatCard({
  title,
  value,
  icon,
  iconColor = "text-blue-500",
  subtitle,
  trend,
}: StatCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
            {trend && (
              <div
                className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                  trend.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                <TrendingUp className="h-3 w-3" />
                {trend.isPositive ? "+" : ""}
                {trend.value}% ce mois
              </div>
            )}
          </div>
          <div className={`${iconColor}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface UserStatsProps {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalSpent: number;
  averageOrderValue?: number;
  lastOrderDate?: string;
}

export function UserStats({
  totalOrders,
  pendingOrders,
  completedOrders,
  totalSpent,
  averageOrderValue,
  lastOrderDate,
}: UserStatsProps) {
  const avgValue = averageOrderValue || (totalOrders > 0 ? totalSpent / totalOrders : 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Commandes totales"
        value={totalOrders}
        icon={<Package className="h-8 w-8" />}
        iconColor="text-blue-500"
        subtitle={lastOrderDate ? `Dernière: ${lastOrderDate}` : undefined}
      />

      <StatCard
        title="En cours"
        value={pendingOrders}
        icon={<Clock className="h-8 w-8" />}
        iconColor="text-orange-500"
        subtitle={`${completedOrders} livrées`}
      />

      <StatCard
        title="Total dépensé"
        value={formatPrice(totalSpent)}
        icon={<CreditCard className="h-8 w-8" />}
        iconColor="text-green-500"
      />

      <StatCard
        title="Panier moyen"
        value={formatPrice(avgValue)}
        icon={<TrendingUp className="h-8 w-8" />}
        iconColor="text-purple-500"
        subtitle="Par commande"
      />
    </div>
  );
}

// Variante compacte pour les dashboards
export function UserStatsCompact({
  totalOrders,
  pendingOrders,
  totalSpent,
}: Pick<UserStatsProps, "totalOrders" | "pendingOrders" | "totalSpent">) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Commandes</p>
              <p className="text-2xl font-bold">{totalOrders}</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En cours</p>
              <p className="text-2xl font-bold">{pendingOrders}</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Dépensé</p>
              <p className="text-2xl font-bold">{formatPrice(totalSpent)}</p>
            </div>
            <CreditCard className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
