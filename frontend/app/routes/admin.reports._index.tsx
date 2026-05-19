/**
 * Page Rapports - Analyses et statistiques détaillées
 */

import { type LoaderFunction, type MetaFunction, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
  Users,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { logger } from "~/utils/logger";

export const meta: MetaFunction = () => {
  return [
    { title: "Rapports & Analyses - Admin" },
    {
      name: "description",
      content: "Rapports détaillés et analyses de performance",
    },
    { name: "robots", content: "noindex, nofollow" },
  ];
};

interface ReportUser {
  isActive?: boolean;
  isPro?: boolean;
  emailVerified?: boolean;
}

interface ReportOrder {
  isPaid?: boolean;
  ord_is_pay?: string;
  totalTtc?: string;
  ord_total_ttc?: string;
  total?: string;
}

export const loader: LoaderFunction = async () => {
  try {
    logger.log("📊 Chargement des données pour les rapports...");

    // Récupérer les données depuis les différentes APIs
    const [usersResponse, ordersResponse, ordersStatsResponse] =
      await Promise.all([
        fetch("http://127.0.0.1:3000/api/legacy-users?limit=1000"),
        fetch("http://127.0.0.1:3000/api/legacy-orders?limit=1000"),
        fetch("http://127.0.0.1:3000/api/legacy-orders/stats").catch(
          () => null,
        ),
      ]);

    let reportData = {
      users: {
        total: 0,
        active: 0,
        professional: 0,
        verified: 0,
        growth: 0,
      },
      orders: {
        total: 0,
        completed: 0,
        pending: 0,
        revenue: 0,
        avgOrderValue: 0,
      },
      performance: {
        conversionRate: 0,
        activeUserRate: 0,
        verificationRate: 0,
      },
      trends: {
        usersThisMonth: 0,
        ordersThisMonth: 0,
        revenueThisMonth: 0,
      },
    };

    // Traiter les données users
    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      const users = usersData.data || usersData.users || [];
      reportData.users.total = users.length;
      reportData.users.active = users.filter(
        (u: ReportUser) => u.isActive,
      ).length;
      reportData.users.professional = users.filter(
        (u: ReportUser) => u.isPro,
      ).length;
      reportData.users.verified = users.filter(
        (u: ReportUser) => u.emailVerified,
      ).length;
    }

    // Traiter les statistiques commandes avancées
    if (ordersStatsResponse && ordersStatsResponse.ok) {
      const statsData = await ordersStatsResponse.json();
      // Utiliser les stats avancées si disponibles
      if (statsData.data) {
        reportData.orders.revenue = statsData.data.totalRevenue || 0;
        reportData.orders.completed = statsData.data.paidCount || 0;
        reportData.orders.total =
          statsData.data.totalCount || reportData.orders.total;
        reportData.orders.pending =
          reportData.orders.total - reportData.orders.completed;
      }
    }

    // Traiter les données orders
    if (ordersResponse.ok) {
      const ordersData = await ordersResponse.json();
      const orders = ordersData.data || ordersData.orders || [];
      reportData.orders.total = orders.length;
      reportData.orders.completed = orders.filter(
        (o: ReportOrder) => o.isPaid === true || o.ord_is_pay === "1",
      ).length;
      reportData.orders.pending = orders.filter(
        (o: ReportOrder) => o.isPaid === false || o.ord_is_pay !== "1",
      ).length;

      const paidOrders = orders.filter(
        (o: ReportOrder) => o.isPaid === true || o.ord_is_pay === "1",
      );
      reportData.orders.revenue = paidOrders.reduce(
        (sum: number, o: ReportOrder) =>
          sum + parseFloat(o.totalTtc || o.ord_total_ttc || o.total || "0"),
        0,
      );
      reportData.orders.avgOrderValue =
        reportData.orders.completed > 0
          ? reportData.orders.revenue / reportData.orders.completed
          : 0;
    }

    // Calculer les métriques de performance
    reportData.performance.conversionRate =
      reportData.orders.total > 0
        ? (reportData.orders.completed / reportData.orders.total) * 100
        : 0;
    reportData.performance.activeUserRate =
      reportData.users.total > 0
        ? (reportData.users.active / reportData.users.total) * 100
        : 0;
    reportData.performance.verificationRate =
      reportData.users.total > 0
        ? (reportData.users.verified / reportData.users.total) * 100
        : 0;

    logger.log("✅ Données des rapports chargées:", reportData);

    return json({ reportData });
  } catch (error) {
    logger.error("❌ Erreur lors du chargement des rapports:", error);
    return json({
      reportData: {
        users: { total: 0, active: 0, professional: 0, verified: 0 },
        orders: {
          total: 0,
          completed: 0,
          pending: 0,
          revenue: 0,
          avgOrderValue: 0,
        },
        performance: {
          conversionRate: 0,
          activeUserRate: 0,
          verificationRate: 0,
        },
        trends: { usersThisMonth: 0, ordersThisMonth: 0, revenueThisMonth: 0 },
      },
      error: "Erreur de connexion aux APIs pour les rapports",
    });
  }
};

export default function AdminReports() {
  const { reportData, error } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <PublicBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Rapports & Analyses" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Rapports & Analyses
          </h1>
          <p className="text-muted-foreground">
            Analyses détaillées des performances de votre plateforme
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exporter PDF
          </Button>
          <Button className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Rapport Mensuel
          </Button>
        </div>
      </div>

      {/* Alerte en cas d'erreur */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métriques de performance clés */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taux de Conversion
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData.performance.conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {reportData.orders.completed}/{reportData.orders.total} commandes
              payées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Utilisateurs Actifs
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData.performance.activeUserRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {reportData.users.active}/{reportData.users.total} utilisateurs
              actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Emails Vérifiés
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData.performance.verificationRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {reportData.users.verified}/{reportData.users.total} emails
              vérifiés
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Statistiques détaillées */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Analyse des Utilisateurs
            </CardTitle>
            <CardDescription>
              Répartition et engagement des utilisateurs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Total Utilisateurs</span>
                <Badge variant="default">{reportData.users.total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Utilisateurs Actifs</span>
                <Badge variant="default" className="bg-success/20 text-success">
                  {reportData.users.active}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Professionnels</span>
                <Badge variant="default" className="bg-info/20 text-info">
                  {reportData.users.professional}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Emails Vérifiés</span>
                <Badge
                  variant="default"
                  className="bg-muted text-foreground"
                >
                  {reportData.users.verified}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Analyse des Commandes
            </CardTitle>
            <CardDescription>
              Performance des ventes et transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Total Commandes</span>
                <Badge variant="default">{reportData.orders.total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Commandes Payées</span>
                <Badge variant="default" className="bg-success/20 text-success">
                  {reportData.orders.completed}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>En Attente</span>
                <Badge variant="default" className="bg-warning/20 text-warning">
                  {reportData.orders.pending}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Chiffre d'Affaires</span>
                <Badge
                  variant="default"
                  className="bg-muted text-foreground"
                >
                  {reportData.orders.revenue.toFixed(2)}€
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Panier Moyen</span>
                <Badge variant="secondary">
                  {reportData.orders.avgOrderValue.toFixed(2)}€
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommandations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recommandations
          </CardTitle>
          <CardDescription>
            Suggestions d'amélioration basées sur les données
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-green-600">Points Forts</h4>
              <ul className="text-sm space-y-1">
                {reportData.performance.conversionRate > 50 && (
                  <li>
                    ✅ Excellent taux de conversion (
                    {reportData.performance.conversionRate.toFixed(1)}%)
                  </li>
                )}
                {reportData.performance.activeUserRate > 80 && (
                  <li>
                    ✅ Très bon engagement utilisateur (
                    {reportData.performance.activeUserRate.toFixed(1)}%)
                  </li>
                )}
                {reportData.performance.verificationRate > 70 && (
                  <li>
                    ✅ Bon taux de vérification email (
                    {reportData.performance.verificationRate.toFixed(1)}%)
                  </li>
                )}
                {reportData.users.professional > 0 && (
                  <li>
                    ✅ Base de clients professionnels solide (
                    {reportData.users.professional} pros)
                  </li>
                )}
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-orange-600">
                Axes d'Amélioration
              </h4>
              <ul className="text-sm space-y-1">
                {reportData.performance.conversionRate < 30 && (
                  <li>
                    🔸 Améliorer le taux de conversion (
                    {reportData.performance.conversionRate.toFixed(1)}%)
                  </li>
                )}
                {reportData.performance.verificationRate < 50 && (
                  <li>
                    🔸 Encourager la vérification des emails (
                    {reportData.performance.verificationRate.toFixed(1)}%)
                  </li>
                )}
                {reportData.orders.pending > reportData.orders.completed && (
                  <li>
                    🔸 Réduire les commandes en attente (
                    {reportData.orders.pending} en cours)
                  </li>
                )}
                {reportData.orders.avgOrderValue < 100 && (
                  <li>
                    🔸 Augmenter le panier moyen (
                    {reportData.orders.avgOrderValue.toFixed(2)}€)
                  </li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
