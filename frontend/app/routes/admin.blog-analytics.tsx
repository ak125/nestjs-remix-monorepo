/**
 * Admin Blog Analytics — /admin/blog-analytics
 * Dashboard avec stats détaillées, top articles, distribution, intent breakdown
 */
import { type LoaderFunction, json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  BarChart3,
  TrendingUp,
  Eye,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { requireUser } from "../auth/unified.server";

interface BlogAnalyticsData {
  overview: {
    totalArticles: number;
    totalViews: number;
    totalAdvice: number;
    totalGuides: number;
    avgViewsPerArticle: number;
  };
  topArticles: Array<{
    id: string;
    title: string;
    slug: string;
    viewsCount: number;
    intent?: string;
    pg_alias?: string;
    type: string;
  }>;
  recentlyUpdated: Array<{
    id: string;
    title: string;
    slug: string;
    viewsCount: number;
    updatedAt?: string;
    type: string;
  }>;
  lowPerformers: Array<{
    id: string;
    title: string;
    slug: string;
    viewsCount: number;
    publishedAt: string;
    type: string;
  }>;
  viewsDistribution: Array<{ range: string; count: number }>;
  intentBreakdown: Array<{ intent: string; count: number }>;
}

interface LoaderData {
  analytics: BlogAnalyticsData | null;
  isError: boolean;
  errorMessage?: string;
}

export const meta: MetaFunction = () =>
  createNoIndexMeta("Blog Analytics - Admin");

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await requireUser({ context });
  const userLevel = parseInt(user.level?.toString() || "0", 10);
  if (!user.level || userLevel < 5) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      getInternalApiUrlFromRequest("/api/blog/analytics", request),
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("Cookie") || "",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn(`Blog analytics API returned ${response.status}`);
      return json<LoaderData>({
        analytics: null,
        isError: true,
        errorMessage: `API error: ${response.status}`,
      });
    }

    const result = await response.json();
    return json<LoaderData>({
      analytics: result.data || null,
      isError: false,
    });
  } catch (error) {
    logger.error("Blog analytics loader error:", error);
    return json<LoaderData>({
      analytics: null,
      isError: true,
      errorMessage: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
};

const INTENT_LABELS: Record<string, string> = {
  diagnostic: "Diagnostic",
  howto: "How-To",
  buying: "Achat",
  reference: "Référence",
  unknown: "Non classé",
};

const INTENT_COLORS: Record<string, string> = {
  diagnostic: "bg-red-100 text-red-800",
  howto: "bg-blue-100 text-blue-800",
  buying: "bg-green-100 text-green-800",
  reference: "bg-purple-100 text-purple-800",
  unknown: "bg-gray-100 text-gray-800",
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function AdminBlogAnalytics() {
  const { analytics, isError, errorMessage } = useLoaderData<LoaderData>();

  if (isError || !analytics) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Blog Analytics</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <p className="text-amber-800">
              {errorMessage || "Impossible de charger les analytics."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    overview,
    topArticles,
    recentlyUpdated,
    lowPerformers,
    viewsDistribution,
    intentBreakdown,
  } = analytics;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Blog Analytics</h1>
        <Badge variant="secondary" className="text-xs">
          Données en cache (1h)
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Articles
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalArticles}</div>
            <p className="text-xs text-muted-foreground">
              {overview.totalAdvice} conseils + {overview.totalGuides} guides
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vues</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(overview.totalViews)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Moy. Vues/Article
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(overview.avgViewsPerArticle)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conseils</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalAdvice}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Guides</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalGuides}</div>
          </CardContent>
        </Card>
      </div>

      {/* Intent Breakdown + Views Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition par Intent</CardTitle>
            <CardDescription>
              Classification automatique des articles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {intentBreakdown.map((item) => {
                const total = intentBreakdown.reduce((s, i) => s + i.count, 0);
                const pct =
                  total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.intent} className="flex items-center gap-3">
                    <Badge
                      className={`${INTENT_COLORS[item.intent] || INTENT_COLORS.unknown} min-w-[90px] justify-center`}
                    >
                      {INTENT_LABELS[item.intent] || item.intent}
                    </Badge>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 min-w-[60px] text-right">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribution des Vues</CardTitle>
            <CardDescription>Nombre d'articles par tranche</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {viewsDistribution.map((item) => {
                const maxCount = Math.max(
                  ...viewsDistribution.map((v) => v.count),
                );
                const pct =
                  maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
                return (
                  <div key={item.range} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 min-w-[70px]">
                      {item.range}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div
                        className="bg-emerald-500 h-2.5 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 min-w-[40px] text-right">
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Articles + Low Performers */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Top 10 Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topArticles.map((article, i) => (
                <div
                  key={article.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm font-bold text-gray-400 w-5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {article.title}
                    </p>
                    {article.intent && (
                      <Badge
                        className={`${INTENT_COLORS[article.intent] || ""} text-[10px] mt-0.5`}
                      >
                        {INTENT_LABELS[article.intent] || article.intent}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {formatNumber(article.viewsCount)}
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-gray-400" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Articles sous-performants
            </CardTitle>
            <CardDescription>
              Plus de 30 jours, peu de vues — candidats à l'optimisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowPerformers.map((article) => (
                <div
                  key={article.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {article.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      Publié{" "}
                      {new Date(article.publishedAt).toLocaleDateString(
                        "fr-FR",
                      )}
                    </p>
                  </div>
                  <span className="text-sm text-amber-600 font-medium">
                    {article.viewsCount} vues
                  </span>
                </div>
              ))}
              {lowPerformers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Aucun article sous-performant
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recently Updated */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Dernières mises à jour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {recentlyUpdated.map((article) => (
              <div
                key={article.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {article.title}
                  </p>
                  {article.updatedAt && (
                    <p className="text-xs text-gray-400">
                      MAJ{" "}
                      {new Date(article.updatedAt).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {formatNumber(article.viewsCount)} vues
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
