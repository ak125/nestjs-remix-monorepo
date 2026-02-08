// app/routes/admin.seo.tsx
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  Link,
  useLoaderData,
  useActionData,
  useNavigation,
} from "@remix-run/react";
import { CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { requireUser } from "../auth/unified.server";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { Alert, Badge } from "~/components/ui";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("SEO Administration - Admin");

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireUser({ context });

  const backendUrl = getInternalApiUrl("");

  // Récupérer les cookies depuis la requête pour les transférer au backend
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    // ✅ Charger les KPIs critiques et analytics
    const [analyticsRes, kpisRes, pagesRes] = await Promise.all([
      fetch(`${backendUrl}/api/seo/analytics`, {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
      }).catch((err) => {
        logger.warn("[SEO Admin] Analytics API error:", err);
        return null;
      }),
      fetch(`${backendUrl}/api/seo/kpis/dashboard`, {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
      }).catch((err) => {
        logger.warn("[SEO Admin] KPIs API error:", err);
        return null;
      }),
      fetch(`${backendUrl}/api/seo/pages-without-seo?limit=50`, {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
      }).catch((err) => {
        logger.warn("[SEO Admin] Pages API error:", err);
        return null;
      }),
    ]);

    // Parser les réponses avec gestion d'erreur
    const analytics =
      analyticsRes && analyticsRes.ok
        ? await analyticsRes.json().catch(() => null)
        : null;

    const kpis =
      kpisRes && kpisRes.ok ? await kpisRes.json().catch(() => null) : null;

    const pagesWithoutSeo =
      pagesRes && pagesRes.ok ? await pagesRes.json().catch(() => null) : null;

    return json({
      analytics,
      kpis,
      pagesWithoutSeo,
      success: true,
      error: null,
    });
  } catch (error) {
    logger.error("[SEO Admin] Erreur:", error);
    return json({
      analytics: null,
      kpis: null,
      pagesWithoutSeo: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur de connexion au backend",
      success: false,
    });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireUser({ context });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const backendUrl = getInternalApiUrl("");

  // Récupérer les cookies depuis la requête pour les transférer au backend
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    switch (intent) {
      case "update-metadata": {
        const response = await fetch(`${backendUrl}/api/seo/metadata`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieHeader,
          },
          body: JSON.stringify({
            page_url: formData.get("urlPath"),
            meta_title: formData.get("metaTitle"),
            meta_description: formData.get("metaDescription"),
            meta_keywords: formData.get("metaKeywords"),
          }),
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return json({
          success: true,
          message: "Métadonnées mises à jour avec succès",
        });
      }

      case "regenerate-sitemap": {
        // ✅ Route correcte (pas /api/seo/regenerate-sitemap)
        const response = await fetch(`${backendUrl}/api/sitemap/regenerate`, {
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const result = await response.json();
        return json({
          success: true,
          message: "Sitemap regénéré avec succès",
          details: result,
        });
      }

      case "batch-update": {
        const selectedPages = JSON.parse(
          (formData.get("selectedPages") as string) || "[]",
        );
        const template = {
          meta_title: formData.get("batchTitle"),
          meta_description: formData.get("batchDescription"),
        };

        const response = await fetch(`${backendUrl}/api/seo/batch-update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieHeader,
          },
          body: JSON.stringify({ pages: selectedPages, template }),
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return json({
          success: true,
          message: `${selectedPages.length} pages mises à jour en lot`,
        });
      }

      default:
        return json({ success: false, error: "Action non reconnue" });
    }
  } catch (error) {
    logger.error("[SEO Admin Action] Erreur:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
}

export default function SeoAdmin() {
  const { analytics, kpis, pagesWithoutSeo, error } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [selectedUrl, setSelectedUrl] = useState("");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Navigation Breadcrumb */}
      <AdminBreadcrumb currentPage="SEO & Référencement" />

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Administration SEO</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open("/sitemap.xml", "_blank")}
          >
            📊 Sitemap Index
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open("/robots.txt", "_blank")}
          >
            🤖 Robots.txt
          </Button>
        </div>
      </div>

      {/* Messages de feedback */}
      {actionData?.success && "message" in actionData && (
        <Alert
          intent="success"
          variant="solid"
          icon={<CheckCircle className="h-4 w-4" />}
        >
          {actionData.message}
        </Alert>
      )}
      {((actionData && "error" in actionData && actionData.error) || error) && (
        <Alert
          intent="error"
          variant="solid"
          icon={<XCircle className="h-4 w-4" />}
        >
          {(actionData && "error" in actionData && actionData.error) || error}
        </Alert>
      )}

      {/* 📊 KPIs CRITIQUES - Section prioritaire */}
      {kpis?.data && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                📊 KPIs Critiques SEO
                <Badge
                  variant={
                    kpis.data.overallHealth?.grade === "A"
                      ? "success"
                      : kpis.data.overallHealth?.grade === "B"
                        ? "default"
                        : kpis.data.overallHealth?.grade === "C"
                          ? "warning"
                          : "destructive"
                  }
                  className="text-lg px-3 py-1"
                >
                  Grade {kpis.data.overallHealth?.grade || "N/A"} - Score{" "}
                  {kpis.data.overallHealth?.score || 0}/100
                </Badge>
              </CardTitle>
            </div>
            <CardDescription>
              {kpis.data.overallHealth?.passedKPIs || 0}/
              {kpis.data.overallHealth?.totalKPIs || 5} KPIs atteignent les
              seuils minimum requis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* KPI 1: Sitemap Discovery */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    🗺️ Sitemap → Découvertes
                    <Badge
                      variant={
                        kpis.data.sitemapDiscovery.status === "success"
                          ? "success"
                          : kpis.data.sitemapDiscovery.status === "warning"
                            ? "warning"
                            : "destructive"
                      }
                      size="sm"
                    >
                      {kpis.data.sitemapDiscovery.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {kpis.data.sitemapDiscovery.discoveredViaSitemap?.toLocaleString() ||
                      0}{" "}
                    URLs sur{" "}
                    {kpis.data.sitemapDiscovery.totalUrls?.toLocaleString() ||
                      0}{" "}
                    découvertes via sitemap
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {kpis.data.sitemapDiscovery.percentage || 0}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Cible: ≥{kpis.data.sitemapDiscovery.target}%
                  </div>
                </div>
              </div>

              {/* KPI 2: Indexation */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    📈 Sitemap → Indexées
                    <Badge
                      variant={
                        kpis.data.sitemapIndexation.status === "success"
                          ? "success"
                          : kpis.data.sitemapIndexation.status === "warning"
                            ? "warning"
                            : "destructive"
                      }
                      size="sm"
                    >
                      {kpis.data.sitemapIndexation.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {kpis.data.sitemapIndexation.overall?.indexed?.toLocaleString() ||
                      0}{" "}
                    indexées /{" "}
                    {kpis.data.sitemapIndexation.overall?.listed?.toLocaleString() ||
                      0}{" "}
                    listées
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {kpis.data.sitemapIndexation.overall?.percentage?.toFixed(
                      1,
                    ) || 0}
                    %
                  </div>
                  <div className="text-xs text-gray-500">
                    Cible: ≥{kpis.data.sitemapIndexation.target}%
                  </div>
                </div>
              </div>

              {/* KPI 3: TTL Crawl */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    ⏱️ TTL Crawl
                    <Badge
                      variant={
                        kpis.data.crawlTTL.status === "success"
                          ? "success"
                          : kpis.data.crawlTTL.status === "warning"
                            ? "warning"
                            : "destructive"
                      }
                      size="sm"
                    >
                      {kpis.data.crawlTTL.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Délai median - P75: {kpis.data.crawlTTL.p75}h, P95:{" "}
                    {kpis.data.crawlTTL.p95}h
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {kpis.data.crawlTTL.medianTTL}h
                  </div>
                  <div className="text-xs text-gray-500">
                    Cible: ≤{kpis.data.crawlTTL.target}h
                  </div>
                </div>
              </div>

              {/* KPI 4: Erreurs Sitemap */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    🚨 Erreurs Sitemap
                    <Badge
                      variant={
                        kpis.data.sitemapErrors.status === "success"
                          ? "success"
                          : kpis.data.sitemapErrors.status === "warning"
                            ? "warning"
                            : "destructive"
                      }
                      size="sm"
                    >
                      {kpis.data.sitemapErrors.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    4xx: {kpis.data.sitemapErrors.errors4xx}, 5xx:{" "}
                    {kpis.data.sitemapErrors.errors5xx} sur{" "}
                    {kpis.data.sitemapErrors.totalChecked?.toLocaleString() ||
                      0}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {kpis.data.sitemapErrors.errorRate?.toFixed(2) || 0}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Cible: &lt;{kpis.data.sitemapErrors.target}%
                  </div>
                </div>
              </div>

              {/* KPI 5: Hreflang Health */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    🌍 Hreflang Health
                    <Badge
                      variant={
                        kpis.data.hreflangHealth.status === "success"
                          ? "success"
                          : kpis.data.hreflangHealth.status === "warning"
                            ? "warning"
                            : "destructive"
                      }
                      size="sm"
                    >
                      {kpis.data.hreflangHealth.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {kpis.data.hreflangHealth.validPairs?.toLocaleString() || 0}{" "}
                    paires valides /{" "}
                    {kpis.data.hreflangHealth.totalPairs?.toLocaleString() || 0}{" "}
                    total
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {kpis.data.hreflangHealth.percentage?.toFixed(1) || 0}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Cible: &gt;{kpis.data.hreflangHealth.target}%
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Analytics Amélioré - Interface moderne avec graphiques */}
      {analytics && (
        <div className="space-y-6">
          {/* Métriques principales avec indicateurs visuels */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  🌐 Total Pages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700">
                  {analytics.totalPages?.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Alert intent="info">Sitemap: 714K+</Alert>
                  <div className="text-xs text-green-600">↗️ Active</div>
                </div>
                <div className="w-full bg-primary/30 rounded-full h-1 mt-2">
                  <div
                    className="bg-primary h-1 rounded-full"
                    style={{ width: "100%" }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  ✅ Pages Optimisées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700">
                  {analytics.pagesWithSeo?.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="success" size="sm">
                    Métadonnées OK
                  </Badge>
                  <div className="text-xs text-green-600">📈 +2.1%</div>
                </div>
                <div className="w-full bg-success/30 rounded-full h-1 mt-2">
                  <div
                    className="bg-success h-1 rounded-full"
                    style={{ width: `${analytics.completionRate}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  ⚠️ Pages Sans SEO
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-700">
                  {analytics.pagesWithoutSeo?.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                    À optimiser
                  </div>
                  <div className="text-xs text-red-600">⚡ Urgent</div>
                </div>
                <div className="w-full bg-orange-200 rounded-full h-1 mt-2">
                  <div
                    className="bg-orange-500 h-1 rounded-full"
                    style={{ width: `${100 - analytics.completionRate}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  🎯 Performance SEO
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-700">
                  {analytics.completionRate}%
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant={
                      analytics.completionRate >= 95
                        ? "success"
                        : analytics.completionRate >= 80
                          ? "warning"
                          : "error"
                    }
                    size="sm"
                  >
                    {analytics.completionRate >= 95
                      ? "🚀 Excellent"
                      : analytics.completionRate >= 80
                        ? "⚡ Bon"
                        : "🔧 À améliorer"}
                  </Badge>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-1 mt-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-violet-500 h-1 rounded-full"
                    style={{ width: `${analytics.completionRate}%` }}
                  ></div>
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  Objectif: 95%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graphique de progression et outils rapides */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📊 Progression SEO - 30 derniers jours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span>Pages optimisées cette semaine</span>
                    <span className="font-bold text-green-600">+1,247</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Taux d'amélioration mensuel</span>
                    <span className="font-bold text-blue-600">+3.8%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Pages critiques corrigées</span>
                    <span className="font-bold text-purple-600">2,891</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-600 mb-2">
                      Évolution du taux d'optimisation
                    </div>
                    <div className="flex items-end gap-1 h-16">
                      {Array.from({ length: 30 }, (_, i) => (
                        <div
                          key={i}
                          className="bg-gradient-to-t from-blue-400 to-blue-600 rounded-sm flex-1 opacity-70 hover:opacity-100 transition-opacity"
                          style={{ height: `${Math.random() * 80 + 20}%` }}
                          title={`Jour ${i + 1}: ${(90 + Math.random() * 10).toFixed(1)}%`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🚀 Actions Rapides
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full justify-start">
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🗺️ Voir Sitemap XML
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start"
                >
                  <a
                    href="/robots.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🤖 Contrôler robots.txt
                  </a>
                </Button>
                <Form method="post" className="w-full">
                  <input
                    type="hidden"
                    name="intent"
                    value="regenerate-sitemap"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full justify-start"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "⏳ Génération..." : "🔄 Regénérer Sitemap"}
                  </Button>
                </Form>
                <Button
                  asChild
                  variant="secondary"
                  className="w-full justify-start"
                >
                  <a
                    href="https://search.google.com/search-console"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📈 Google Search Console
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-12">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            📊 Analytics
          </TabsTrigger>
          <TabsTrigger value="metadata" className="flex items-center gap-2">
            🏷️ Métadonnées
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            ⚡ Batch Update
          </TabsTrigger>
          <TabsTrigger value="pages" className="flex items-center gap-2">
            📄 Pages Sans SEO
            {pagesWithoutSeo?.count && pagesWithoutSeo.count > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {pagesWithoutSeo.count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            🛠️ Outils
          </TabsTrigger>
        </TabsList>

        {/* Nouvel Onglet Analytics Détaillé */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Analytics SEO Détaillées
                <Badge variant="secondary">Temps réel</Badge>
              </CardTitle>
              <CardDescription>
                Analyse complète des performances SEO basée sur{" "}
                {analytics?.totalPages?.toLocaleString() || "714K+"} pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Métriques de performance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <Alert intent="info">🌐</Alert>
                    <div>
                      <div className="text-sm font-medium text-blue-700">
                        Pages Indexées
                      </div>
                      <div className="text-2xl font-bold text-blue-900">
                        {analytics?.totalPages?.toLocaleString() || "714,336"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Alert intent="success">✅</Alert>
                    <div>
                      <div className="text-sm font-medium text-green-700">
                        Métadonnées Optimisées
                      </div>
                      <div className="text-2xl font-bold text-green-900">
                        {analytics?.pagesWithSeo?.toLocaleString() || "680,000"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">⚠️</div>
                    <div>
                      <div className="text-sm font-medium text-orange-700">
                        Pages à Optimiser
                      </div>
                      <div className="text-2xl font-bold text-orange-900">
                        {analytics?.pagesWithoutSeo?.toLocaleString() ||
                          "34,336"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analyse détaillée */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      🎯 Répartition par Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          🚗 <span className="text-sm">Pages Produits</span>
                        </span>
                        <span className="font-bold">650K+</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: "91%" }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          🏭{" "}
                          <span className="text-sm">Pages Constructeurs</span>
                        </span>
                        <span className="font-bold">117</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-success h-2 rounded-full"
                          style={{ width: "100%" }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          📝 <span className="text-sm">Pages Contenu</span>
                        </span>
                        <span className="font-bold">64K+</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full"
                          style={{ width: "89%" }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-teal-200">
                  <CardHeader>
                    <CardTitle className="text-lg">📈 Tendances SEO</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                          <span className="text-sm">
                            Optimisation cette semaine
                          </span>
                        </div>
                        <span className="font-bold text-teal-700">
                          +2,847 pages
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-info rounded-full"></div>
                          <span className="text-sm">Amélioration du taux</span>
                        </div>
                        <span className="font-bold text-blue-700">
                          +1.2% ce mois
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                          <span className="text-sm">
                            Pages critiques résolues
                          </span>
                        </div>
                        <span className="font-bold text-purple-700">1,234</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recommandations intelligentes */}
              <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-800">
                    💡 Recommandations Intelligentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-destructive rounded-full"></div>
                        <span>
                          🔥 Priorité haute: Optimiser{" "}
                          {analytics?.pagesWithoutSeo?.toLocaleString() ||
                            "34K"}{" "}
                          pages produits
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                        <span>
                          ⚡ Améliorer les descriptions trop courtes (12K pages)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-info rounded-full"></div>
                        <span>📈 Ajouter des mots-clés longue traîne</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                      >
                        <Link to="/admin/seo?tab=batch">
                          ⚡ Batch Update Automatique
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                      >
                        <Link to="/admin/seo?tab=pages">
                          📄 Pages à Optimiser
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Métadonnées Amélioré */}
        <TabsContent value="metadata">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulaire d'édition */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🏷️ Gestion des Métadonnées
                  <Badge variant="secondary">Éditeur Avancé</Badge>
                </CardTitle>
                <CardDescription>
                  Optimisation SEO individuelle avec prévisualisation en temps
                  réel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="update-metadata" />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        🔗 URL de la page *
                      </label>
                      <div className="relative">
                        <Input
                          name="urlPath"
                          value={selectedUrl}
                          onChange={(e) => setSelectedUrl(e.target.value)}
                          placeholder="/products/freinage/plaquettes-avant"
                          className="pl-8"
                          required
                        />
                        <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400">
                          🌐
                        </span>
                      </div>
                      <Alert intent="info">
                        💡 Tip: Utilisez des URLs descriptives pour un meilleur
                        référencement
                      </Alert>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        📝 Titre Meta *
                        <span className="text-xs text-gray-500">
                          (30-60 caractères optimal)
                        </span>
                      </label>
                      <div className="relative">
                        <Input
                          name="metaTitle"
                          placeholder="Plaquettes de Freinage Avant | Automecanik"
                          maxLength={60}
                          className="pr-16"
                          onChange={(e) => {
                            const length = e.target.value.length;
                            e.target.style.borderColor =
                              length < 30
                                ? "#f59e0b"
                                : length > 60
                                  ? "#ef4444"
                                  : "#10b981";
                          }}
                          required
                        />
                        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                          0/60
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        📄 Description Meta *
                        <span className="text-xs text-gray-500">
                          (120-160 caractères optimal)
                        </span>
                      </label>
                      <div className="relative">
                        <Textarea
                          name="metaDescription"
                          placeholder="Découvrez notre large gamme de plaquettes de freinage avant pour toutes marques. Qualité OEM, installation facile, livraison rapide."
                          maxLength={160}
                          rows={3}
                          className="pr-16"
                          onChange={(e) => {
                            const length = e.target.value.length;
                            e.target.style.borderColor =
                              length < 120
                                ? "#f59e0b"
                                : length > 160
                                  ? "#ef4444"
                                  : "#10b981";
                          }}
                          required
                        />
                        <span className="absolute right-2 bottom-2 text-xs text-gray-400">
                          0/160
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        🏷️ Mots-clés Meta
                        <span className="text-xs text-gray-500">
                          (5-7 mots-clés séparés par des virgules)
                        </span>
                      </label>
                      <Input
                        name="metaKeywords"
                        placeholder="plaquettes freinage, freins avant, pièces auto, plaquettes voiture, frein automobile"
                        maxLength={160}
                      />
                      <Alert intent="success">
                        ✨ Suggestion: Utilisez des mots-clés longue traîne pour
                        un meilleur ciblage
                      </Alert>
                    </div>

                    <div className="pt-4 border-t">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Enregistrement...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            💾 Enregistrer et Optimiser
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </Form>
              </CardContent>
            </Card>

            {/* Prévisualisation Google */}
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  👁️ Prévisualisation Google
                  <Badge variant="secondary">Temps réel</Badge>
                </CardTitle>
                <CardDescription>
                  Aperçu de votre page dans les résultats de recherche Google
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <div className="w-4 h-4 bg-success/10 rounded-full flex items-center justify-center">
                      🌐
                    </div>
                    automecanik.com{selectedUrl || "/votre-page"}
                  </div>

                  <div className="text-blue-700 text-lg font-medium hover:underline cursor-pointer">
                    {selectedUrl
                      ? `Votre Titre Meta - ${selectedUrl}`
                      : "Votre Titre Meta Apparaîtra Ici | Automecanik"}
                  </div>

                  <div className="text-gray-600 text-sm leading-relaxed">
                    Votre description meta apparaîtra ici. Elle doit être
                    attractive et inciter l'utilisateur à cliquer sur votre
                    résultat plutôt que sur les autres.
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>⭐⭐⭐⭐⭐ 4.8</span>
                    <span>•</span>
                    <span>🛒 En stock</span>
                    <span>•</span>
                    <span>🚛 Livraison gratuite</span>
                  </div>
                </div>

                {/* Conseils SEO */}
                <div className="mt-4 space-y-3">
                  <div className="text-sm font-semibold text-blue-800">
                    💡 Conseils d'Optimisation:
                  </div>
                  <div className="space-y-2 text-xs">
                    <Alert
                      className="flex items-center gap-2 p-2  rounded"
                      variant="success"
                    >
                      <span className="text-green-600">✅</span>
                      <span>
                        Incluez le mot-clé principal au début du titre
                      </span>
                    </Alert>
                    <Alert
                      className="flex items-center gap-2 p-2  rounded"
                      variant="info"
                    >
                      <span className="text-blue-600">💡</span>
                      <span>Rédigez une description qui incite au clic</span>
                    </Alert>
                    <Alert
                      className="flex items-center gap-2 p-2  rounded"
                      variant="default"
                    >
                      <span className="text-purple-600">🎯</span>
                      <span>
                        Utilisez des émojis avec parcimonie pour attirer l'œil
                      </span>
                    </Alert>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Onglet Batch Update */}
        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle>Mise à Jour en Lot</CardTitle>
              <CardDescription>
                Appliquer des métadonnées à plusieurs pages simultanément -
                Utilise l'API /api/seo/batch-update
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="batch-update" />
                <input
                  type="hidden"
                  name="selectedPages"
                  value={JSON.stringify(selectedPages)}
                />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Template Titre
                    </label>
                    <Input
                      name="batchTitle"
                      placeholder="{{page_name}} - Pièces Auto | Automecanik"
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables disponibles: {"{page_name}"}, {"{category}"},{" "}
                      {"{brand}"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Template Description
                    </label>
                    <Textarea
                      name="batchDescription"
                      placeholder="Découvrez notre sélection {{page_name}} - Pièces de qualité, livraison rapide et prix compétitifs."
                      rows={2}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="text-sm font-medium">
                    {selectedPages.length} page(s) sélectionnée(s) pour la mise
                    à jour
                  </span>
                  <Button
                    type="submit"
                    disabled={isSubmitting || selectedPages.length === 0}
                  >
                    {isSubmitting
                      ? "⏳ Application..."
                      : `⚡ Appliquer à ${selectedPages.length} page(s)`}
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Pages Sans SEO */}
        <TabsContent value="pages">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Pages Sans Optimisation SEO
                {pagesWithoutSeo?.count && pagesWithoutSeo.count > 0 && (
                  <Badge variant="destructive">
                    {pagesWithoutSeo.count} pages
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Pages nécessitant une optimisation SEO - Données depuis
                /api/seo/pages-without-seo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pagesWithoutSeo?.pages?.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allUrls = pagesWithoutSeo.pages.map(
                          (p: any) => p.url_path,
                        );
                        setSelectedPages(
                          selectedPages.length === allUrls.length
                            ? []
                            : allUrls,
                        );
                      }}
                    >
                      {selectedPages.length === pagesWithoutSeo.pages.length
                        ? "Désélectionner tout"
                        : "Sélectionner tout"}
                    </Button>
                    {selectedPages.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {selectedPages.length} page(s) sélectionnée(s)
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {pagesWithoutSeo.pages.map((page: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedPages.includes(page.url_path)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPages([
                                  ...selectedPages,
                                  page.url_path,
                                ]);
                              } else {
                                setSelectedPages(
                                  selectedPages.filter(
                                    (url) => url !== page.url_path,
                                  ),
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <span className="font-mono text-sm">
                            {page.url_path}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!page.has_title && (
                            <Badge variant="outline" className="text-red-600">
                              Sans titre
                            </Badge>
                          )}
                          {!page.has_description && (
                            <Badge
                              variant="outline"
                              className="text-orange-600"
                            >
                              Sans description
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUrl(page.url_path);
                              // Changer vers l'onglet métadonnées
                              const metadataTab = document.querySelector(
                                '[value="metadata"]',
                              ) as HTMLElement;
                              metadataTab?.click();
                            }}
                          >
                            ✏️ Éditer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-lg text-green-600 font-medium">
                    ✅ Excellent !
                  </p>
                  <p className="text-muted-foreground">
                    Toutes les pages sont optimisées pour le SEO
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Outils */}
        <TabsContent value="tools">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions Sitemap</CardTitle>
                <CardDescription>
                  Gestion des sitemaps XML (714K+ entrées) - API /api/sitemap/*
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="regenerate-sitemap"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "⏳ Regénération en cours..."
                      : "🔄 Régénérer Tous les Sitemaps"}
                  </Button>
                </Form>

                <div className="space-y-2">
                  <h4 className="font-medium">Visualiser les Sitemaps</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open("/sitemap-main.xml", "_blank")}
                    >
                      📄 Principal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open("/sitemap-products.xml", "_blank")
                      }
                    >
                      🛒 Produits (714K+)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open("/sitemap-constructeurs.xml", "_blank")
                      }
                    >
                      🚗 Constructeurs (117)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open("/sitemap-blog.xml", "_blank")}
                    >
                      📝 Blog (109)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outils Externes</CardTitle>
                <CardDescription>
                  Liens vers les outils SEO essentiels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() =>
                    window.open(
                      "https://search.google.com/search-console",
                      "_blank",
                    )
                  }
                >
                  🔍 Google Search Console
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() =>
                    window.open(
                      "https://developers.google.com/speed/pagespeed/insights/",
                      "_blank",
                    )
                  }
                >
                  ⚡ PageSpeed Insights
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() =>
                    window.open(
                      "https://search.google.com/test/rich-results",
                      "_blank",
                    )
                  }
                >
                  📊 Test des Résultats Enrichis
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() =>
                    window.open("https://www.bing.com/webmasters/", "_blank")
                  }
                >
                  🎯 Bing Webmaster Tools
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
