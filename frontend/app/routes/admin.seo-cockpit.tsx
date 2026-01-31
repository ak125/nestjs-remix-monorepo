/**
 * 🎯 SEO COCKPIT - Hub unifié pour l'administration SEO
 *
 * Point d'entrée unique consolidant:
 * - Dashboard KPIs unifiés
 * - Monitoring (Crawl + Index + Alerts)
 * - Contenu (R4 + R5 + Blog)
 * - Audit unifié
 *
 * Backend: /api/admin/seo-cockpit/*
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  FileText,
  History,
  LayoutDashboard,
  RefreshCw,
  Settings,
  TrendingUp,
} from "lucide-react";

import { requireUser } from "../auth/unified.server";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

export const meta: MetaFunction = () => [
  { title: "SEO Cockpit | Admin AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

interface _DashboardData {
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  healthScore: number;
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  lastCheckTimestamp: string | null;
  checksLast24h: number;
  failedChecksLast24h: number;
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
    googlebotAbsent14d: number;
  };
  contentStats: {
    r4References: { total: number; published: number; draft: number };
    r5Diagnostics: { total: number; published: number; draft: number };
    blogArticles: { total: number; published: number };
  };
}

interface _SummaryData {
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  headline: string;
  topIssues: { flag: string; count: number; severity: string }[];
  crawlTrend: "UP" | "DOWN" | "STABLE";
  recommendations: string[];
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireUser({ context });

  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    // Charger le dashboard unifié et le summary en parallèle
    const [dashboardRes, summaryRes] = await Promise.all([
      fetch(`${backendUrl}/api/admin/seo-cockpit/dashboard`, {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
      }).catch(() => null),
      fetch(`${backendUrl}/api/admin/seo-cockpit/summary`, {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
      }).catch(() => null),
    ]);

    const dashboard =
      dashboardRes && dashboardRes.ok
        ? await dashboardRes.json().catch(() => null)
        : null;

    const summary =
      summaryRes && summaryRes.ok
        ? await summaryRes.json().catch(() => null)
        : null;

    return json({
      dashboard: dashboard?.data || null,
      summary: summary?.data || null,
      error: null,
    });
  } catch (error) {
    console.error("[SEO Cockpit] Error:", error);
    return json({
      dashboard: null,
      summary: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur de connexion au backend",
    });
  }
}

// Navigation items for SEO Cockpit
const navItems = [
  {
    label: "Dashboard",
    href: "/admin/seo-cockpit",
    icon: LayoutDashboard,
    description: "Vue d'ensemble KPIs",
  },
  {
    label: "Gammes",
    href: "/admin/gammes-seo",
    icon: BarChart3,
    description: "230 gammes G-Level",
  },
  {
    label: "Monitoring",
    href: "/admin/seo-cockpit/monitoring",
    icon: Activity,
    description: "Crawl + Index + Alerts",
  },
  {
    label: "Contenu",
    href: "/admin/seo-cockpit/content",
    icon: FileText,
    description: "R4 + R5 + Blog",
  },
  {
    label: "Audit",
    href: "/admin/seo-cockpit/audit",
    icon: History,
    description: "Historique actions",
  },
];

export default function SeoCockpit() {
  const { dashboard, summary, error } = useLoaderData<typeof loader>();
  const location = useLocation();
  const isIndexPage = location.pathname === "/admin/seo-cockpit";

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return <Badge variant="success">✓ Healthy</Badge>;
      case "WARNING":
        return <Badge variant="warning">⚠ Warning</Badge>;
      case "CRITICAL":
        return <Badge variant="destructive">✗ Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Crawl trend icon
  const getCrawlTrendIcon = (trend: string) => {
    switch (trend) {
      case "UP":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "DOWN":
        return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      default:
        return <TrendingUp className="h-4 w-4 text-gray-400 rotate-90" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <AdminBreadcrumb currentPage="SEO Cockpit" />

      {/* Header with status */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🎯 SEO Cockpit
            {summary?.status && getStatusBadge(summary.status)}
          </h1>
          {summary?.headline && (
            <p className="text-muted-foreground mt-1">{summary.headline}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/seo">
              <Settings className="h-4 w-4 mr-2" />
              Ancien Dashboard
            </Link>
          </Button>
          <Button variant="default" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation tabs */}
      <div className="flex gap-2 border-b pb-4 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/admin/seo-cockpit"
              ? location.pathname === item.href
              : location.pathname.startsWith(item.href);

          return (
            <Button
              key={item.href}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              asChild
              className="whitespace-nowrap"
            >
              <Link to={item.href}>
                <Icon className="h-4 w-4 mr-2" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </div>

      {/* Main content - Dashboard when on index, Outlet otherwise */}
      {isIndexPage ? (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          {dashboard && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Health Score */}
              <Card className="border-2 border-purple-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    🎯 Health Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-purple-700">
                    {dashboard.healthScore}%
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(dashboard.status)}
                    {summary?.crawlTrend &&
                      getCrawlTrendIcon(summary.crawlTrend)}
                  </div>
                </CardContent>
              </Card>

              {/* URLs at Risk */}
              <Card className="border-2 border-orange-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    ⚠️ URLs at Risk
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-orange-700">
                    {dashboard.urlsAtRisk?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    sur {dashboard.totalUrls?.toLocaleString() || 0} total
                  </div>
                </CardContent>
              </Card>

              {/* Crawl 24h */}
              <Card className="border-2 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    🤖 Crawl 24h
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-700">
                    {dashboard.crawlHealth?.last24h?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Avg: {dashboard.crawlHealth?.avgResponseMs || 0}ms
                  </div>
                </CardContent>
              </Card>

              {/* Queue Status */}
              <Card className="border-2 border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    📊 Queue Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-green-700">
                    {dashboard.checksLast24h || 0}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {dashboard.failedChecksLast24h || 0} failed
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Risk Breakdown & Content Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Breakdown */}
            {dashboard?.riskBreakdown && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Risk Breakdown
                  </CardTitle>
                  <CardDescription>
                    Distribution des risques par type
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(dashboard.riskBreakdown).map(
                    ([flag, count]) => (
                      <div
                        key={flag}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <span className="font-mono text-sm">{flag}</span>
                        <Badge
                          variant={
                            count > 0
                              ? flag === "CONFUSION"
                                ? "destructive"
                                : "warning"
                              : "secondary"
                          }
                        >
                          {(count as number).toLocaleString()}
                        </Badge>
                      </div>
                    ),
                  )}
                </CardContent>
              </Card>
            )}

            {/* Content Stats */}
            {dashboard?.contentStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-500" />
                    Content Stats
                  </CardTitle>
                  <CardDescription>
                    État du contenu SEO (R4 + R5 + Blog)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* R4 References */}
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <div>
                      <div className="font-medium">R4 References</div>
                      <div className="text-sm text-muted-foreground">
                        Pages de définition
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {dashboard.contentStats.r4References?.published || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        +{dashboard.contentStats.r4References?.draft || 0} draft
                      </div>
                    </div>
                  </div>

                  {/* R5 Diagnostics */}
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                    <div>
                      <div className="font-medium">R5 Diagnostics</div>
                      <div className="text-sm text-muted-foreground">
                        Pages Observable Pro
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {dashboard.contentStats.r5Diagnostics?.published || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        +{dashboard.contentStats.r5Diagnostics?.draft || 0}{" "}
                        draft
                      </div>
                    </div>
                  </div>

                  {/* Blog */}
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <div>
                      <div className="font-medium">Blog Articles</div>
                      <div className="text-sm text-muted-foreground">
                        Conseils et guides
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {dashboard.contentStats.blogArticles?.published || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        total: {dashboard.contentStats.blogArticles?.total || 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top Issues & Recommendations */}
          {summary?.topIssues && summary.topIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🚨 Top Issues
                </CardTitle>
                <CardDescription>
                  Problèmes prioritaires à résoudre
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {summary.topIssues.map((issue, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            issue.severity === "CRITICAL"
                              ? "destructive"
                              : issue.severity === "HIGH"
                                ? "warning"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {issue.severity}
                        </Badge>
                        <span className="font-mono text-sm">{issue.flag}</span>
                      </div>
                      <span className="font-bold">
                        {issue.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Recommendations */}
                {summary.recommendations &&
                  summary.recommendations.length > 0 && (
                    <div className="mt-4 p-4 bg-yellow-50 rounded border border-yellow-200">
                      <div className="font-medium text-yellow-800 mb-2">
                        💡 Recommendations
                      </div>
                      <ul className="space-y-1 text-sm text-yellow-700">
                        {summary.recommendations.map((rec, index) => (
                          <li key={index}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>🚀 Actions Rapides</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link to="/admin/gammes-seo">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Gérer 230 Gammes
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/admin/seo-content">
                  <FileText className="h-4 w-4 mr-2" />
                  Valider R4/R5
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/admin/blog">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Admin Blog
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🗺️ Sitemap XML
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📈 Search Console
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
