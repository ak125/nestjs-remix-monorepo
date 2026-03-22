/**
 * Dashboard Admin - Page d'administration
 */

import { type LoaderFunction, type MetaFunction, json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Users,
  ShoppingCart,
  CreditCard,
  RefreshCw,
  Search,
  Package,
  Activity,
  Monitor,
  Shield,
  Zap,
  Database,
  Settings,
  Target,
  Bell,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileText,
  BarChart3,
  Truck,
  Palette,
  Code,
  Play,
  Eye,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { SeoWidget } from "../components/SeoWidget";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

export const meta: MetaFunction = () => [
  { title: "Dashboard - Administration" },
  { name: "robots", content: "noindex, nofollow" },
];

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    logger.log("📊 Chargement des statistiques du dashboard...");

    // Initialiser les stats par défaut
    let stats = {
      totalUsers: 0,
      totalOrders: 0,
      totalRevenue: 0,
      activeUsers: 0,
      pendingOrders: 0,
      completedOrders: 0,
      totalSuppliers: 0,
      totalProducts: 0,
      activeProducts: 0,
      totalCategories: 0,
      conversionRate: 0,
      avgOrderValue: 0,
      // SEO, system health, performance, security : null par defaut
      // Seules les donnees API reelles seront affichees
      seoStats: null as null | {
        totalPages: number | null;
        pagesWithSeo: number | null;
        sitemapEntries: number | null;
        completionRate: number | null;
        organicTraffic: number | null;
        keywordRankings: number | null;
      },
      systemHealth: null as null | {
        status: string;
        uptime: number | null;
        responseTime: number | null;
        memoryUsage: number | null;
        cpuUsage: number | null;
        diskUsage: number | null;
        activeConnections: number | null;
      },
      performance: null as null | {
        apiResponseTimes: Record<string, number>;
        errorRates: Record<string, number>;
        throughput: number;
        cacheHitRate: number;
      },
      security: null as null | {
        threatLevel: string;
        blockedAttacks: number;
        authenticatedSessions: number;
        failedLogins: number;
        sslStatus: string;
        backupStatus: string;
      },
    };

    let apiErrors: string[] = [];

    // Fetch les APIs en parallèle
    const headers = { Cookie: cookieHeader };
    const [unifiedRes, productsRes, healthRes] = await Promise.all([
      fetch(`${getInternalApiUrl("")}/api/dashboard/stats`, { headers }).catch(
        () => null,
      ),
      fetch(`${getInternalApiUrl("")}/api/admin/products/dashboard`, {
        headers,
      }).catch(() => null),
      fetch(`${getInternalApiUrl("")}/api/admin/health/overview`, {
        headers,
      }).catch(() => null),
    ]);

    // 1. Dashboard unifié (users, orders, revenue, suppliers, seo, avgOrderValue)
    if (unifiedRes?.ok) {
      const d = await unifiedRes.json();
      if (d.success || d.totalUsers !== undefined) {
        stats = {
          ...stats,
          totalUsers: d.totalUsers ?? stats.totalUsers,
          totalOrders: d.totalOrders ?? stats.totalOrders,
          totalRevenue: d.totalRevenue ?? stats.totalRevenue,
          activeUsers: d.activeUsers ?? stats.activeUsers,
          pendingOrders: d.pendingOrders ?? stats.pendingOrders,
          completedOrders: d.completedOrders ?? stats.completedOrders,
          totalSuppliers: d.totalSuppliers ?? stats.totalSuppliers,
          conversionRate: d.conversionRate ?? stats.conversionRate,
          avgOrderValue: d.avgOrderValue ?? stats.avgOrderValue,
          totalProducts: d.totalProducts ?? stats.totalProducts,
          seoStats: d.seoStats ?? stats.seoStats,
        };
      }
    } else {
      apiErrors.push("Dashboard unifié non disponible");
    }

    // 2. Produits (totalProducts, activeProducts, totalCategories, totalBrands)
    if (productsRes?.ok) {
      const p = await productsRes.json();
      if (p.success) {
        stats.totalProducts = p.stats.totalProducts ?? stats.totalProducts;
        stats.activeProducts = p.stats.activeProducts ?? 0;
        stats.totalCategories = p.stats.totalCategories ?? 0;
      }
    } else {
      apiErrors.push("API Produits");
    }

    // 3. System health
    if (healthRes?.ok) {
      const h = await healthRes.json();
      if (h.data?.overall || h.overall) {
        const overview = h.data ?? h;
        stats.systemHealth = {
          status: overview.overall ?? "unknown",
          uptime: overview.uptime ?? null,
          responseTime: overview.components?.database?.responseMs ?? null,
          memoryUsage: overview.components?.memory?.percentage ?? null,
          cpuUsage: null,
          diskUsage: null,
          activeConnections: null,
        };
      }
    }

    // Calculer le taux de conversion côté serveur
    if (stats.totalOrders > 0) {
      stats.conversionRate = Number(
        (((stats.completedOrders || 0) / stats.totalOrders) * 100).toFixed(1),
      );
    }

    logger.log("✅ Stats du dashboard chargées:", {
      users: stats.totalUsers,
      products: stats.totalProducts,
      systemStatus: stats.systemHealth?.status ?? "unknown",
      apiErrors: apiErrors.length > 0 ? apiErrors : "Aucune",
    });

    return json({
      stats,
      apiErrors: apiErrors.length > 0 ? apiErrors : null,
      hasErrors: apiErrors.length > 0,
    });
  } catch (error) {
    logger.error("Erreur critique dashboard:", error);
    return json({
      stats: {
        totalUsers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        activeUsers: 0,
        pendingOrders: 0,
        completedOrders: 0,
        totalSuppliers: 0,
        totalProducts: 0,
        activeProducts: 0,
        totalCategories: 0,
        conversionRate: 0,
        avgOrderValue: 0,
        seoStats: null,
        systemHealth: null,
        performance: null,
        security: null,
      },
      apiErrors: ["Erreur critique du systeme"],
      hasErrors: true,
      criticalError: "Impossible de charger les donnees du dashboard",
    });
  }
};

export default function AdminDashboard() {
  const { stats, apiErrors, hasErrors, criticalError } =
    useLoaderData<typeof loader>();
  const [realTimeStats, _setRealTimeStats] = useState(stats);
  // SSR-safe: Initialize with null, set in useEffect to avoid hydration mismatch
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Initialize lastUpdate on client only
  useEffect(() => {
    setLastUpdate(new Date());
  }, []);

  // Fonction helper pour formater les nombres en securite
  const formatNumber = (
    value: number | undefined | null,
    locale = "fr-FR",
    options?: Intl.NumberFormatOptions,
  ) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "\u2014";
    }
    return value.toLocaleString(locale, options);
  };

  return (
    <div className="space-y-8">
      {/* Navigation Breadcrumb */}
      <PublicBreadcrumb
        items={[{ label: "Admin", href: "/admin" }, { label: "Dashboard" }]}
      />

      {/* Header principal avec indicateur de santé */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            🎯 Tableau de Bord Administration
            {realTimeStats.systemHealth?.status && (
              <Badge
                variant={
                  realTimeStats.systemHealth.status === "healthy"
                    ? "success"
                    : realTimeStats.systemHealth.status === "degraded"
                      ? "warning"
                      : "error"
                }
                size="sm"
                icon={<Activity className="h-4 w-4" />}
              >
                {realTimeStats.systemHealth.status.toUpperCase()}
              </Badge>
            )}
          </h1>
          <p className="text-gray-600 mt-2">
            Interface d'administration complète • Données en temps réel •
            Analytics avancées
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Dernière mise à jour</p>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            {lastUpdate?.toLocaleTimeString("fr-FR") || "Chargement..."}
          </p>
        </div>
      </div>

      {/* Alerte en cas d'erreur critique */}
      {criticalError && (
        <Alert
          intent="error"
          variant="solid"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Erreur critique"
        >
          {criticalError}. Les donnees affichees ne sont pas fiables.
        </Alert>
      )}

      {/* Kill-switch : banniere erreurs API (Phase 0.5) */}
      {hasErrors && apiErrors && !criticalError && (
        <Alert
          intent="warning"
          variant="solid"
          icon={<AlertTriangle className="h-4 w-4" />}
          title={`${apiErrors.length} source${apiErrors.length > 1 ? "s" : ""} de donnees indisponible${apiErrors.length > 1 ? "s" : ""}`}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium">
              APIs en erreur : {apiErrors.join(" | ")}
            </p>
            <p className="text-xs text-yellow-800">
              Les sections concernees affichent « — » au lieu de donnees
              reelles. Les metriques visibles peuvent etre incompletes.
            </p>
          </div>
        </Alert>
      )}

      {/* Métriques principales */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Utilisateurs */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border border-blue-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">
                Utilisateurs
              </p>
              <p className="text-3xl font-bold text-blue-900 mt-1">
                {formatNumber(realTimeStats.totalUsers)}
              </p>
              <p className="text-sm text-blue-600 mt-2">
                {realTimeStats.activeUsers || 0} actifs maintenant
              </p>
            </div>
            <div className="bg-primary/30 p-3 rounded-full">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Produits */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-lg p-6 border border-orange-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide">
                Produits
              </p>
              <p className="text-3xl font-bold text-orange-900 mt-1">
                {formatNumber(realTimeStats.totalProducts)}
              </p>
              <p className="text-sm text-orange-600 mt-2">
                {realTimeStats.totalCategories || 0} catégories
              </p>
            </div>
            <div className="bg-orange-200 p-3 rounded-full">
              <Package className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Commandes */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 border border-green-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
                Commandes
              </p>
              <p className="text-3xl font-bold text-green-900 mt-1">
                {formatNumber(realTimeStats.totalOrders)}
              </p>
              <p className="text-sm text-green-600 mt-2">
                {realTimeStats.completedOrders || 0} complétées (
                {realTimeStats.conversionRate || 0}%)
              </p>
            </div>
            <div className="bg-success/30 p-3 rounded-full">
              <ShoppingCart className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Revenus */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-lg p-6 border border-purple-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
                Revenus
              </p>
              <p className="text-3xl font-bold text-purple-900 mt-1">
                {formatNumber(realTimeStats.totalRevenue, "fr-FR", {
                  style: "currency",
                  currency: "EUR",
                })}
              </p>
              <p className="text-sm text-purple-600 mt-2">
                {(realTimeStats.avgOrderValue || 0).toFixed(0)}€ panier moyen
              </p>
            </div>
            <div className="bg-purple-200 p-3 rounded-full">
              <CreditCard className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Métriques secondaires avec Fournisseurs */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Fournisseurs */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl shadow-lg p-6 border border-indigo-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">
                Fournisseurs
              </p>
              <p className="text-3xl font-bold text-indigo-900 mt-1">
                {formatNumber(realTimeStats.totalSuppliers)}
              </p>
              <p className="text-sm text-indigo-600 mt-2">Partenaires actifs</p>
            </div>
            <div className="bg-indigo-200 p-3 rounded-full">
              <Truck className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Commandes en attente */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-lg p-6 border border-yellow-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">
                En Attente
              </p>
              <p className="text-3xl font-bold text-yellow-900 mt-1">
                {formatNumber(realTimeStats.pendingOrders)}
              </p>
              <p className="text-sm text-yellow-600 mt-2">
                Commandes à traiter
              </p>
            </div>
            <div className="bg-warning/30 p-3 rounded-full">
              <RefreshCw className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Taux de conversion */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-lg p-6 border border-emerald-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
                Conversion
              </p>
              <p className="text-3xl font-bold text-emerald-900 mt-1">
                {(realTimeStats.conversionRate || 0).toFixed(1)}%
              </p>
              <p className="text-sm text-emerald-600 mt-2">
                Performance commerciale
              </p>
            </div>
            <div className="bg-emerald-200 p-3 rounded-full">
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Nouveaux utilisateurs — donnee non disponible (pas d'API) */}
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl shadow-lg p-6 border border-cyan-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-700 uppercase tracking-wide">
                Nouveaux
              </p>
              <p className="text-3xl font-bold text-cyan-900 mt-1">
                {"\u2014"}
              </p>
              <p className="text-sm text-cyan-600 mt-2">Cette semaine</p>
            </div>
            <div className="bg-cyan-200 p-3 rounded-full">
              <Users className="h-8 w-8 text-cyan-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: "overview", label: "Vue d'ensemble", icon: Monitor },
              { id: "commerce", label: "Commerce", icon: ShoppingCart },
              { id: "design", label: "Design System", icon: Palette },
              { id: "seo", label: "SEO Enterprise", icon: Search },
              { id: "system", label: "Système", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Vue d'ensemble */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Alertes systeme */}
              {realTimeStats.pendingOrders > 100 && (
                <div className="bg-warning/5 border border-yellow-200 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-yellow-800">
                        Alertes Systeme
                      </h3>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm text-yellow-700">
                          {formatNumber(realTimeStats.pendingOrders)} commandes
                          en attente de traitement
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sante systeme */}
              {realTimeStats.systemHealth && (
                <div
                  className={`border rounded-xl p-6 ${
                    realTimeStats.systemHealth.status === "healthy"
                      ? "bg-green-50 border-green-200"
                      : realTimeStats.systemHealth.status === "degraded"
                        ? "bg-yellow-50 border-yellow-200"
                        : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Activity
                      className={`h-5 w-5 ${
                        realTimeStats.systemHealth.status === "healthy"
                          ? "text-green-600"
                          : realTimeStats.systemHealth.status === "degraded"
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    />
                    <div>
                      <h3 className="font-medium">
                        Systeme :{" "}
                        {realTimeStats.systemHealth.status.toUpperCase()}
                      </h3>
                      {realTimeStats.systemHealth.uptime != null && (
                        <p className="text-sm text-gray-600">
                          Uptime :{" "}
                          {Math.round(realTimeStats.systemHealth.uptime / 3600)}
                          h
                          {realTimeStats.systemHealth.memoryUsage != null && (
                            <>
                              {" "}
                              | RAM :{" "}
                              {realTimeStats.systemHealth.memoryUsage.toFixed(
                                0,
                              )}
                              %
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Métriques Business Avancées */}
              <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-muted p-2 rounded-lg">
                      <Database className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900">
                        Catalogue
                      </h3>
                      <p className="text-sm text-blue-600">
                        Gestion des produits
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Produits actifs</span>
                      <span className="font-bold text-blue-900">
                        {formatNumber(realTimeStats.totalProducts)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Catégories</span>
                      <span className="font-bold text-blue-900">
                        {formatNumber(realTimeStats.totalCategories)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Nouveaux produits</span>
                      <span className="font-bold text-blue-900">
                        {"\u2014"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-success/10 p-2 rounded-lg">
                      <ShoppingCart className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-green-900">
                        Ventes
                      </h3>
                      <p className="text-sm text-green-600">
                        Performance commerciale
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-green-700">Commandes totales</span>
                      <span className="font-bold text-green-900">
                        {formatNumber(realTimeStats.totalOrders)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Taux conversion</span>
                      <span className="font-bold text-green-900">
                        {(realTimeStats.conversionRate || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Panier moyen</span>
                      <span className="font-bold text-green-900">
                        {(realTimeStats.avgOrderValue || 0).toFixed(0)}€
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <Truck className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-indigo-900">
                        Logistique
                      </h3>
                      <p className="text-sm text-indigo-600">
                        Chaîne d'approvisionnement
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-indigo-700">
                        Fournisseurs actifs
                      </span>
                      <span className="font-bold text-indigo-900">
                        {formatNumber(realTimeStats.totalSuppliers)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-indigo-700">
                        Commandes en attente
                      </span>
                      <span className="font-bold text-indigo-900">
                        {formatNumber(realTimeStats.pendingOrders)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-indigo-700">Delai moyen</span>
                      <span className="font-bold text-indigo-900">
                        {"\u2014"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Commerce */}
          {activeTab === "commerce" && (
            <div className="space-y-6">
              {/* Statistiques Commerce */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white rounded-lg shadow-md p-6 border border-indigo-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="h-5 w-5 text-indigo-600" />
                    <span className="font-medium">Fournisseurs</span>
                  </div>
                  <div className="text-2xl font-bold text-indigo-900">
                    {formatNumber(realTimeStats.totalSuppliers)}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Partenaires actifs
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border border-orange-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">Catégories</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-900">
                    {formatNumber(realTimeStats.totalCategories)}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Gammes produits
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border border-yellow-200">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCw className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium">En Attente</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-900">
                    {formatNumber(realTimeStats.pendingOrders)}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Commandes à traiter
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium">Conversion</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-900">
                    {(realTimeStats.conversionRate || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Taux de conversion
                  </div>
                </div>
              </div>

              {/* Top Performances */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Top Categories
                  </h3>
                  <p className="text-sm text-gray-500 italic">
                    Donnees non configurees
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-indigo-600" />
                    Top Fournisseurs
                  </h3>
                  <p className="text-sm text-gray-500 italic">
                    Donnees non configurees
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Design System */}
          {activeTab === "design" && (
            <div className="space-y-6">
              {/* Header Design System */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Palette className="h-8 w-8 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-purple-900">
                      Design System Manager
                    </h2>
                    <p className="text-purple-600">
                      Gestion centralisée des tokens, styles et composants
                    </p>
                  </div>
                  <Badge variant="success" size="sm" className="ml-auto">
                    @fafa/design-tokens v1.0.0
                  </Badge>
                </div>
              </div>

              {/* Statistiques Design System */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white rounded-lg shadow-md p-6 border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Palette className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Couleurs</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-900">120+</div>
                  <div className="text-sm text-gray-600 mt-2">
                    Tokens de couleur
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Spacing</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">30+</div>
                  <div className="text-sm text-gray-600 mt-2">
                    Tokens d'espacement
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Typography</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">15+</div>
                  <div className="text-sm text-gray-600 mt-2">
                    Tokens de typo
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border border-orange-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Code className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">Build Status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <span className="text-lg font-bold text-green-900">
                      Ready
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions rapides Design System */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Play className="h-5 w-5 text-blue-600" />
                    Commandes de Build
                  </h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        const command =
                          "cd packages/design-tokens && npm run build";
                        navigator.clipboard.writeText(command);
                        toast.success("Commande copiée !", {
                          description: command,
                          duration: 3000,
                        });
                      }}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-primary p-2 rounded-lg">
                          <Play className="h-5 w-5 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">
                            Build Tokens
                          </p>
                          <p className="text-xs text-gray-600">
                            Copier la commande
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">npm run build</Badge>
                    </button>

                    <button
                      onClick={() => {
                        window.open("http://localhost:3001", "_blank");
                      }}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border border-green-200 rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-success p-2 rounded-lg">
                          <Eye className="h-5 w-5 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">
                            Preview Frontend
                          </p>
                          <p className="text-xs text-gray-600">
                            Voir l'application en direct
                          </p>
                        </div>
                      </div>
                      <Badge variant="success" size="sm">
                        Port 3001
                      </Badge>
                    </button>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          "cd packages/design-tokens && npm run build",
                        );
                        toast.success("Commande copiée !", {
                          duration: 2000,
                        });
                      }}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border border-purple-200 rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-600 p-2 rounded-lg">
                          <Code className="h-5 w-5 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">
                            Copier Commande
                          </p>
                          <p className="text-xs text-gray-600">
                            Terminal command
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">Copier</Badge>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    Documentation
                  </h3>
                  <div className="space-y-3">
                    <a
                      href="https://github.com/ak125/nestjs-remix-monorepo/blob/main/DESIGN-SYSTEM-USAGE-GUIDE.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-gray-900">
                          Guide d'utilisation
                        </span>
                      </div>
                      <Badge variant="outline">GitHub</Badge>
                    </a>

                    <a
                      href="https://github.com/ak125/nestjs-remix-monorepo/blob/main/DESIGN-SYSTEM-QUICK-REF.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-gray-900">
                          Quick Reference
                        </span>
                      </div>
                      <Badge variant="success">Aide-mémoire</Badge>
                    </a>

                    <a
                      href="https://github.com/ak125/nestjs-remix-monorepo/blob/main/packages/design-tokens/README.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-purple-600" />
                        <span className="font-medium text-gray-900">
                          Package README
                        </span>
                      </div>
                      <Badge variant="outline">Technique</Badge>
                    </a>

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium mb-1">
                        💡 Astuce
                      </p>
                      <p className="text-xs text-blue-700">
                        Utilisez les tokens sémantiques (p-md, bg-primary-500)
                        plutôt que des valeurs hardcodées
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aperçu des Tokens */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-600" />
                  Palette de Couleurs
                </h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {/* Primary */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 mb-3">
                      Primary (CTA)
                    </h4>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-primary-500 shadow-md"></div>
                      <div>
                        <p className="text-sm font-medium">#e8590c</p>
                        <p className="text-xs text-gray-600">primary-500</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Boutons d'action, CTA
                    </p>
                  </div>

                  {/* Secondary */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 mb-3">
                      Secondary (Navigation)
                    </h4>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-secondary-500 shadow-md"></div>
                      <div>
                        <p className="text-sm font-medium">#0d1b3e</p>
                        <p className="text-xs text-gray-600">secondary-500</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Liens, navigation</p>
                  </div>

                  {/* Success */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 mb-3">Success</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-success shadow-md"></div>
                      <div>
                        <p className="text-sm font-medium">#27AE60</p>
                        <p className="text-xs text-gray-600">success</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Validations, succès</p>
                  </div>

                  {/* Warning */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 mb-3">Warning</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-warning shadow-md"></div>
                      <div>
                        <p className="text-sm font-medium">#F39C12</p>
                        <p className="text-xs text-gray-600">warning</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Alertes, attention</p>
                  </div>

                  {/* Error */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 mb-3">Error</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-error shadow-md"></div>
                      <div>
                        <p className="text-sm font-medium">#C0392B</p>
                        <p className="text-xs text-gray-600">error</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Erreurs, incompatibilité
                    </p>
                  </div>

                  {/* Info */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 mb-3">Info</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-info shadow-md"></div>
                      <div>
                        <p className="text-sm font-medium">#3498DB</p>
                        <p className="text-xs text-gray-600">info</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Informations</p>
                  </div>
                </div>
              </div>

              {/* Spacing Grid */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Échelle d'Espacement (8px Grid)
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      name: "XS",
                      value: "4px",
                      class: "p-xs",
                      usage: "Micro-espaces (badges)",
                    },
                    {
                      name: "SM",
                      value: "8px",
                      class: "p-sm",
                      usage: "Serré (label → input)",
                    },
                    {
                      name: "MD",
                      value: "16px",
                      class: "p-md",
                      usage: "Standard (padding cartes)",
                    },
                    {
                      name: "LG",
                      value: "24px",
                      class: "p-lg",
                      usage: "Sections/blocs",
                    },
                    {
                      name: "XL",
                      value: "32px",
                      class: "p-xl",
                      usage: "Grilles/marges",
                    },
                    {
                      name: "2XL",
                      value: "40px",
                      class: "p-2xl",
                      usage: "Large grilles",
                    },
                    {
                      name: "3XL",
                      value: "48px",
                      class: "p-3xl",
                      usage: "Hero sections",
                    },
                  ].map((spacing, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                    >
                      <div
                        className="bg-primary-500 rounded"
                        style={{ width: spacing.value, height: "32px" }}
                      ></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900 w-12">
                            {spacing.name}
                          </span>
                          <code className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">
                            {spacing.class}
                          </code>
                          <span className="text-sm text-gray-600">
                            {spacing.value}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {spacing.usage}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography Preview */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  Typographie
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-2">
                      Headings - Montserrat (font-heading)
                    </p>
                    <h1 className="font-heading font-bold text-3xl">
                      Titre Principal H1
                    </h1>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-2">
                      Body - Inter (font-sans)
                    </p>
                    <p className="font-sans text-base">
                      Texte de description avec une lisibilité optimale pour le
                      contenu principal de l'application.
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-2">
                      Data - Roboto Mono (font-mono)
                    </p>
                    <code className="font-mono text-sm">
                      Réf OEM: 7701208265 | Stock: 42 unités | 149,99 €
                    </code>
                  </div>
                </div>
              </div>

              {/* Exemples de Composants */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Code className="h-5 w-5 text-orange-600" />
                  Exemples de Composants
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Bouton Primary */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Bouton CTA</h4>
                    <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                      Ajouter au panier
                    </button>
                    <code className="block text-xs bg-gray-100 p-2 rounded">
                      className="bg-primary-500 hover:bg-primary-600"
                    </code>
                  </div>

                  {/* Badge Success */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">
                      Badge Compatible
                    </h4>
                    <span className="inline-flex bg-success text-white px-4 py-2 rounded-full text-sm">
                      ✓ Compatible
                    </span>
                    <code className="block text-xs bg-gray-100 p-2 rounded">
                      className="bg-success text-white"
                    </code>
                  </div>

                  {/* Alert Warning */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Alerte Délai</h4>
                    <div className="bg-warning/10 border border-warning text-warning-foreground p-4 rounded-md">
                      ⚠️ Livraison sous 5-7 jours
                    </div>
                    <code className="block text-xs bg-gray-100 p-2 rounded">
                      className="bg-warning/10 border border-warning"
                    </code>
                  </div>

                  {/* Card */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Card Produit</h4>
                    <div className="bg-white border border-neutral-200 rounded-lg shadow-md p-4">
                      <h5 className="font-heading font-bold mb-2">
                        Plaquettes de frein
                      </h5>
                      <p className="font-mono text-sm text-gray-600 mb-2">
                        Réf: 7701208265
                      </p>
                      <p className="font-mono text-xl font-bold">45,99 €</p>
                    </div>
                    <code className="block text-xs bg-gray-100 p-2 rounded">
                      className="bg-white border rounded-lg p-4"
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEO Enterprise */}
          {activeTab === "seo" && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white rounded-lg shadow-md p-6 border border-green-200">
                  <h3 className="text-lg font-medium mb-4 text-green-800">
                    Pages SEO
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total pages</span>
                      <span className="font-bold text-green-700">
                        {formatNumber(realTimeStats.seoStats?.totalPages)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pages optimisées</span>
                      <span className="font-bold text-green-700">
                        {formatNumber(realTimeStats.seoStats?.pagesWithSeo)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Taux d'optimisation</span>
                      <span className="font-bold text-green-700">
                        {realTimeStats.seoStats?.completionRate || 0}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border border-blue-200">
                  <h3 className="text-lg font-medium mb-4 text-blue-800">
                    Trafic Organique
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Visiteurs organiques
                      </span>
                      <span className="font-bold text-blue-700">
                        {formatNumber(realTimeStats.seoStats?.organicTraffic)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mots-clés classés</span>
                      <span className="font-bold text-blue-700">
                        {formatNumber(realTimeStats.seoStats?.keywordRankings)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sitemap entries</span>
                      <span className="font-bold text-blue-700">
                        {formatNumber(realTimeStats.seoStats?.sitemapEntries)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border border-purple-200">
                  <h3 className="text-lg font-medium mb-4 text-purple-800">
                    Performance SEO
                  </h3>
                  <div className="space-y-3">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full flex items-center justify-center text-xs text-white font-medium"
                        style={{
                          width: `${realTimeStats.seoStats?.completionRate || 0}%`,
                        }}
                      >
                        {realTimeStats.seoStats?.completionRate || 0}%
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Optimisation SEO Enterprise très avancée
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance */}
          {activeTab === "performance" && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Monitor className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">CPU</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {realTimeStats.systemHealth?.cpuUsage || 0}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${realTimeStats.systemHealth?.cpuUsage || 0}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Mémoire</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {realTimeStats.systemHealth?.memoryUsage || 0}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-success h-2 rounded-full"
                      style={{
                        width: `${realTimeStats.systemHealth?.memoryUsage || 0}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Disque</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-900">
                    {realTimeStats.systemHealth?.diskUsage || 0}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{
                        width: `${realTimeStats.systemHealth?.diskUsage || 0}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">Connexions</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-900">
                    {realTimeStats.systemHealth?.activeConnections || 0}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Connexions actives
                  </div>
                </div>
              </div>

              {/* Temps de réponse API */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium mb-4">
                  Temps de Réponse API (ms)
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(
                    realTimeStats.performance?.apiResponseTimes || {},
                  ).map(([api, time]) => (
                    <div
                      key={api}
                      className="text-center p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="text-2xl font-bold text-gray-900">
                        {(time as number) || 0}
                      </div>
                      <div className="text-sm text-gray-600 capitalize">
                        {api}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sécurité */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-medium">Status Sécurité</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Niveau de menace</span>
                      <Badge variant="success" size="sm">
                        {(
                          realTimeStats.security?.threatLevel || "unknown"
                        ).toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Attaques bloquées</span>
                      <span className="font-bold text-red-600">
                        {realTimeStats.security?.blockedAttacks || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sessions actives</span>
                      <span className="font-bold text-green-600">
                        {realTimeStats.security?.authenticatedSessions || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-medium">Authentification</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Connexions échouées</span>
                      <span className="font-bold text-red-600">
                        {realTimeStats.security?.failedLogins || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">SSL</span>
                      <Badge variant="success" size="sm">
                        {(
                          realTimeStats.security?.sslStatus || "unknown"
                        ).toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                  <div className="flex items-center gap-2 mb-4">
                    <Database className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-medium">Sauvegardes</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Status</span>
                      <Badge variant="success" size="sm">
                        {(
                          realTimeStats.security?.backupStatus || "unknown"
                        ).toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      Dernière sauvegarde: Aujourd'hui
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Système */}
          {activeTab === "system" && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4">Maintenance</h3>
                  <p className="text-sm text-gray-500 italic">
                    Donnees non configurees
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-medium mb-4">
                    Statistiques Système
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uptime</span>
                      <span className="font-bold text-green-600">
                        {realTimeStats.systemHealth?.uptime || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Temps de réponse</span>
                      <span className="font-bold">
                        {realTimeStats.systemHealth?.responseTime || 0}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cache hit rate</span>
                      <span className="font-bold text-blue-600">
                        {realTimeStats.performance?.cacheHitRate || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Accès rapides */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          Accès Rapides
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/admin/products"
            className="block p-4 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:bg-info/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-blue-500 group-hover:text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Produits</p>
                <p className="text-sm text-gray-500">
                  {formatNumber(realTimeStats.totalProducts)} articles
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/users"
            className="block p-4 rounded-lg border-2 border-green-200 hover:border-green-400 hover:bg-success/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-green-500 group-hover:text-green-600" />
              <div>
                <p className="font-medium text-gray-900">Utilisateurs</p>
                <p className="text-sm text-gray-500">
                  {formatNumber(realTimeStats.totalUsers)} total
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/orders"
            className="block p-4 rounded-lg border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-6 w-6 text-purple-500 group-hover:text-purple-600" />
              <div>
                <p className="font-medium text-gray-900">Commandes</p>
                <p className="text-sm text-gray-500">
                  {realTimeStats.totalOrders || 0} total
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/suppliers"
            className="block p-4 rounded-lg border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Truck className="h-6 w-6 text-indigo-500 group-hover:text-indigo-600" />
              <div>
                <p className="font-medium text-gray-900">Fournisseurs</p>
                <p className="text-sm text-gray-500">
                  {formatNumber(realTimeStats.totalSuppliers)} partenaires
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Ligne 2 : Fonctionnalités avancées */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/admin/ai-content"
            className="block p-4 rounded-lg border-2 border-gradient-to-r from-purple-200 to-pink-200 hover:border-purple-400 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
                <Sparkles className="h-6 w-6 text-white group-hover:animate-pulse" />
              </div>
              <div>
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  Générateur IA
                  <Badge variant="success" size="sm">
                    NOUVEAU
                  </Badge>
                </p>
                <p className="text-sm text-gray-500">
                  Contenu intelligent gratuit
                </p>
              </div>
            </div>
          </Link>

          <button
            onClick={() => setActiveTab("design")}
            className="block p-4 rounded-lg border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <Palette className="h-6 w-6 text-purple-500 group-hover:text-purple-600" />
              <div>
                <p className="font-medium text-gray-900">Design System</p>
                <p className="text-sm text-gray-500">Tokens & Templates</p>
              </div>
            </div>
          </button>

          <Link
            to="/admin/seo"
            className="block p-4 rounded-lg border-2 border-green-200 hover:border-green-400 hover:bg-success/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Search className="h-6 w-6 text-green-500 group-hover:text-green-600" />
              <div>
                <p className="font-medium text-gray-900">SEO Enterprise</p>
                <p className="text-sm text-gray-500">
                  {realTimeStats.seoStats?.completionRate || 0}% optimisé
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/analytics"
            className="block p-4 rounded-lg border-2 border-yellow-200 hover:border-yellow-400 hover:bg-warning/5 transition-all group"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-yellow-500 group-hover:text-yellow-600" />
              <div>
                <p className="font-medium text-gray-900">Analytics</p>
                <p className="text-sm text-gray-500">Rapports détaillés</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/system"
            className="block p-4 rounded-lg border-2 border-red-200 hover:border-red-400 hover:bg-destructive/5 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Monitor className="h-6 w-6 text-red-500 group-hover:text-red-600" />
              <div>
                <p className="font-medium text-gray-900">Système</p>
                <p className="text-sm text-gray-500">
                  {realTimeStats.systemHealth?.status || "unknown"}
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/security"
            className="block p-4 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-gray-500 group-hover:text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Sécurité</p>
                <p className="text-sm text-gray-500">
                  {realTimeStats.security?.blockedAttacks || 0} attaques
                  bloquées
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Accès rapides avancés de l'ancienne version */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mt-6">
          <Link
            to="/admin/analytics-test-simple"
            className="block p-3 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:bg-info/20 transition-all bg-gradient-to-r from-blue-50 to-purple-50"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900">
                  🚀 Test Analytics Avancées
                </p>
                <p className="text-xs text-gray-600">
                  A/B testing, IA assistant, métriques
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/optimization-summary"
            className="block p-3 rounded-lg border-2 border-green-200 hover:border-green-400 hover:bg-success/20 transition-all bg-gradient-to-r from-green-50 to-blue-50"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-gray-900">
                  🎉 Résumé Optimisations
                </p>
                <p className="text-xs text-gray-600">
                  Vue d'ensemble complète des fonctionnalités
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/checkout-ab-test"
            className="block p-3 rounded-lg border-2 border-red-200 hover:border-red-400 hover:bg-destructive/5 transition-all bg-gradient-to-r from-red-50 to-orange-50"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-gray-900">
                  🚀 Test A/B Checkout
                </p>
                <p className="text-xs text-gray-600">
                  Convertir les {realTimeStats.pendingOrders || 0} commandes
                  pendantes
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Section SEO Enterprise Détaillée - Inspirée de l'ancienne version */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-green-600" />
          <h2 className="text-xl font-semibold">Module SEO Enterprise</h2>
          <Badge variant="success" size="sm">
            ACTIF
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-green-200 hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pages Indexées
              </CardTitle>
              <FileText className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {formatNumber(realTimeStats.seoStats?.sitemapEntries)}
              </div>
              <p className="text-xs text-green-600">
                Sitemap généré automatiquement
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pages Optimisées
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {formatNumber(realTimeStats.seoStats?.pagesWithSeo)}
              </div>
              <p className="text-xs text-blue-600">Métadonnées automatiques</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Taux d'Optimisation
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">
                {(realTimeStats.seoStats?.completionRate || 0).toFixed(1)}%
              </div>
              <p className="text-xs text-purple-600">Performance SEO globale</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Trafic Organique
              </CardTitle>
              <Activity className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                {formatNumber(realTimeStats.seoStats?.organicTraffic)}
              </div>
              <p className="text-xs text-orange-600">
                Visiteurs organiques/mois
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activité Récente et Statistiques - Inspirée de l'ancienne version */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Activité Récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">
                    API Services opérationnels
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatNumber(realTimeStats.totalUsers)} utilisateurs •{" "}
                    {formatNumber(realTimeStats.totalProducts)} produits
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Commandes consolidées</p>
                  <p className="text-xs text-gray-500">
                    {formatNumber(realTimeStats.totalOrders)} commandes •{" "}
                    {realTimeStats.completedOrders || 0} payées
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Taux de conversion</p>
                  <p className="text-xs text-gray-500">
                    {realTimeStats.totalOrders > 0
                      ? (
                          ((realTimeStats.completedOrders || 0) /
                            realTimeStats.totalOrders) *
                          100
                        ).toFixed(1)
                      : 0}
                    % des commandes sont finalisées
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Search className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">SEO Enterprise actif</p>
                  <p className="text-xs text-gray-500">
                    {formatNumber(realTimeStats.seoStats?.keywordRankings)}{" "}
                    mots-clés classés
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-purple-600" />
              Performance Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            {realTimeStats.systemHealth ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Uptime</span>
                  <span className="font-bold text-green-600">
                    {realTimeStats.systemHealth.uptime ?? "\u2014"}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Temps de réponse</span>
                  <span className="font-bold">
                    {realTimeStats.systemHealth.responseTime ?? "\u2014"}ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Connexions actives</span>
                  <span className="font-bold text-blue-600">
                    {realTimeStats.systemHealth.activeConnections ?? "\u2014"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Cache efficace</span>
                  <span className="font-bold text-purple-600">
                    {realTimeStats.performance?.cacheHitRate ?? "\u2014"}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                Donnees non configurees
              </p>
            )}
          </CardContent>
        </Card>

        {/* Widget SEO Enterprise intégré - de l'ancienne version */}
        <SeoWidget stats={realTimeStats.seoStats} className="lg:col-span-1" />
      </div>
    </div>
  );
}
