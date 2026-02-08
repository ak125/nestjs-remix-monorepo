/**
 * 🚀 SEO HUB - Dashboard Index
 *
 * Dashboard unifié affichant:
 * - Health Score global
 * - KPIs consolidés (Queue, Risks, Crawl, Content)
 * - Quick Actions
 * - Top Issues
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Package,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
  Eye,
  Bug,
  Link as LinkIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

interface DashboardKpis {
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  healthScore: number;
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  totalUrls: number;
  urlsAtRisk: number;
  riskBreakdown: {
    CONFUSION: number;
    ORPHAN: number;
    DUPLICATE: number;
    WEAK_CLUSTER: number;
    LOW_CRAWL: number;
  };
  crawlHealth: {
    last24h: number;
    last7d: number;
    avgResponseMs: number;
    googlebotAbsent14d: boolean;
  };
  contentStats: {
    r4References: number;
    r5Diagnostics: number;
    blogArticles: number;
  };
}

interface Alert {
  id: string;
  type: "RISK" | "INTERPOLATION" | "QUEUE";
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  url?: string;
  timestamp: string;
}

export const meta: MetaFunction = () => createNoIndexMeta("SEO Hub - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const [dashboardRes, alertsRes] = await Promise.all([
      fetch(`${backendUrl}/api/admin/seo-cockpit/dashboard`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(`${backendUrl}/api/admin/seo-cockpit/monitoring/alerts?limit=10`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    const dashboardData = dashboardRes.ok ? await dashboardRes.json() : null;
    const alertsData = alertsRes.ok ? await alertsRes.json() : null;

    return json({
      dashboard: dashboardData?.data as DashboardKpis | null,
      alerts: (alertsData?.data || []) as Alert[],
      error: dashboardData?.success === false ? dashboardData.error : null,
    });
  } catch (error) {
    logger.error("[SEO Hub Index] Loader error:", error);
    return json({
      dashboard: null,
      alerts: [],
      error: "Erreur connexion backend",
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    if (intent === "refresh-risks") {
      const res = await fetch(
        `${backendUrl}/api/admin/seo-cockpit/actions/refresh-risks`,
        {
          method: "POST",
          headers: { Cookie: cookieHeader },
        },
      );
      const result = await res.json();
      return json({
        success: result.success,
        message: result.data?.message || "Risks refreshed",
      });
    }

    if (intent === "trigger-monitor") {
      const res = await fetch(
        `${backendUrl}/api/admin/seo-cockpit/actions/trigger-monitor`,
        {
          method: "POST",
          headers: { Cookie: cookieHeader },
        },
      );
      const result = await res.json();
      return json({
        success: result.success,
        message: result.data?.message || "Monitor triggered",
      });
    }

    return json({ success: false, message: "Unknown action" });
  } catch (error) {
    return json({ success: false, message: "Erreur réseau" });
  }
}

export default function SeoHubDashboard() {
  const { dashboard, alerts, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle action result
  const handleAction = async (intent: string) => {
    setIsRefreshing(true);
    fetcher.submit({ intent }, { method: "POST" });
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-red-700">
              Erreur de chargement
            </h2>
            <p className="text-red-600 mt-2">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "HEALTHY":
        return "from-green-500 to-emerald-600";
      case "WARNING":
        return "from-amber-500 to-orange-600";
      case "CRITICAL":
        return "from-red-500 to-rose-600";
      default:
        return "from-gray-400 to-gray-500";
    }
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case "HEALTHY":
        return <CheckCircle2 className="h-8 w-8 text-white" />;
      case "WARNING":
        return <AlertTriangle className="h-8 w-8 text-white" />;
      case "CRITICAL":
        return <Bug className="h-8 w-8 text-white" />;
      default:
        return <Clock className="h-8 w-8 text-white" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Health Score */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Health Score Card */}
        <Card
          className={cn(
            "lg:w-72 bg-gradient-to-br text-white",
            getStatusColor(dashboard?.status),
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-white/90 text-sm font-medium">
              Santé SEO Globale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-5xl font-bold">
                  {dashboard?.healthScore || 0}%
                </div>
                <div className="text-white/80 mt-1 capitalize">
                  {dashboard?.status || "Unknown"}
                </div>
              </div>
              {getStatusIcon(dashboard?.status)}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                URLs Totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard?.totalUrls?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-600">
                URLs à Risque
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {dashboard?.urlsAtRisk?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Crawl 24h</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard?.crawlHealth?.last24h || 0}
              </div>
              <div className="text-xs text-gray-500">requêtes</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                Queue Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {dashboard?.queueStats?.waiting || 0} en attente
                </Badge>
                {(dashboard?.queueStats?.failed || 0) > 0 && (
                  <Badge variant="destructive">
                    {dashboard?.queueStats?.failed} échecs
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Risk Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Répartition des Risques
              </CardTitle>
              <CardDescription>
                Types de problèmes détectés sur vos URLs
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("refresh-risks")}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Rafraîchir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { key: "CONFUSION", label: "Confusion", icon: Bug, color: "red" },
              {
                key: "ORPHAN",
                label: "Orphelines",
                icon: LinkIcon,
                color: "orange",
              },
              {
                key: "DUPLICATE",
                label: "Doublons",
                icon: FileText,
                color: "amber",
              },
              {
                key: "WEAK_CLUSTER",
                label: "Cluster faible",
                icon: Package,
                color: "yellow",
              },
              {
                key: "LOW_CRAWL",
                label: "Crawl faible",
                icon: TrendingDown,
                color: "gray",
              },
            ].map(({ key, label, icon: Icon, color }) => (
              <div
                key={key}
                className={`p-4 rounded-lg bg-${color}-50 border border-${color}-200`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 text-${color}-600`} />
                  <span className={`text-sm font-medium text-${color}-700`}>
                    {label}
                  </span>
                </div>
                <div className={`text-2xl font-bold text-${color}-800`}>
                  {dashboard?.riskBreakdown?.[
                    key as keyof typeof dashboard.riskBreakdown
                  ] || 0}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content Stats + Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              Statistiques Contenu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded">
                    <Eye className="h-4 w-4 text-indigo-600" />
                  </div>
                  <span className="font-medium text-indigo-900">
                    R4 References
                  </span>
                </div>
                <Badge className="bg-indigo-600">
                  {dashboard?.contentStats?.r4References || 0}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded">
                    <Zap className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="font-medium text-purple-900">
                    R5 Diagnostics
                  </span>
                </div>
                <Badge className="bg-purple-600">
                  {dashboard?.contentStats?.r5Diagnostics || 0}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-100 rounded">
                    <FileText className="h-4 w-4 text-pink-600" />
                  </div>
                  <span className="font-medium text-pink-900">
                    Articles Blog
                  </span>
                </div>
                <Badge className="bg-pink-600">
                  {dashboard?.contentStats?.blogArticles || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-red-500" />
              Alertes Récentes
            </CardTitle>
            <CardDescription>10 dernières alertes détectées</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-2" />
                Aucune alerte active
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-3 rounded-lg border text-sm",
                      alert.severity === "HIGH"
                        ? "bg-red-50 border-red-200"
                        : alert.severity === "MEDIUM"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-gray-50 border-gray-200",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {alert.message}
                        </div>
                        {alert.url && (
                          <div className="text-xs text-gray-500 truncate mt-1">
                            {alert.url}
                          </div>
                        )}
                      </div>
                      <Badge
                        variant={
                          alert.severity === "HIGH"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {alert.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handleAction("trigger-monitor")}
              disabled={isRefreshing}
            >
              <Activity className="h-4 w-4 mr-2" />
              Déclencher Monitoring
            </Button>
            <Button variant="outline" asChild>
              <a href="/admin/seo-hub/gammes">
                <Package className="h-4 w-4 mr-2" />
                Gérer Gammes SEO
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/admin/seo-hub/monitoring">
                <TrendingUp className="h-4 w-4 mr-2" />
                Voir Monitoring
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
