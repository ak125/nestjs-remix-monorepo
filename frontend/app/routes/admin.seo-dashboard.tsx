/**
 * 📊 SEO Dashboard Admin
 *
 * Tableau de bord pour visualiser les KPIs SEO :
 * - Performance des liens internes (maillage)
 * - CTR par type de lien
 * - Top performers
 * - Évolution journalière
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import { useEffect, useState } from "react";

export const meta: MetaFunction = () => [
  { title: "SEO Dashboard - Admin" },
  { name: "robots", content: "noindex, nofollow" },
];

// Types pour les métriques
interface LinkMetrics {
  linkType: string;
  impressions: number;
  clicks: number;
  ctr: number;
  uniqueUsers: number;
  avgPosition: number;
}

interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface TopPerformer {
  url: string;
  linkType: string;
  clicks: number;
  ctr: number;
}

interface PerformanceReport {
  period: { start: string; end: string };
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number;
  byLinkType: LinkMetrics[];
  topPerformers: TopPerformer[];
  dailyTrend: DailyMetric[];
}

// Loader pour charger les données SEO
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate") || getDefaultStartDate();
  const endDate =
    url.searchParams.get("endDate") || new Date().toISOString().split("T")[0];

  try {
    // Appel à l'API backend
    const apiUrl = `${process.env.BACKEND_URL || "http://localhost:3000"}/api/seo/metrics/report?startDate=${startDate}&endDate=${endDate}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      // Retourner des données mock si l'API n'est pas disponible
      return json({
        report: getMockReport(startDate, endDate),
        error: null,
        filters: { startDate, endDate },
      });
    }

    const report: PerformanceReport = await response.json();

    return json({
      report,
      error: null,
      filters: { startDate, endDate },
    });
  } catch (error) {
    console.error("Error fetching SEO metrics:", error);
    return json({
      report: getMockReport(startDate, endDate),
      error:
        "Impossible de charger les métriques. Affichage des données de démonstration.",
      filters: { startDate, endDate },
    });
  }
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split("T")[0];
}

function getMockReport(startDate: string, endDate: string): PerformanceReport {
  return {
    period: { start: startDate, end: endDate },
    totalImpressions: 125480,
    totalClicks: 8456,
    overallCtr: 6.74,
    byLinkType: [
      {
        linkType: "LinkGammeCar",
        impressions: 45000,
        clicks: 3200,
        ctr: 7.11,
        uniqueUsers: 12500,
        avgPosition: 2.3,
      },
      {
        linkType: "CrossSelling",
        impressions: 32000,
        clicks: 2100,
        ctr: 6.56,
        uniqueUsers: 9800,
        avgPosition: 4.1,
      },
      {
        linkType: "VoirAussi",
        impressions: 18000,
        clicks: 1400,
        ctr: 7.78,
        uniqueUsers: 7200,
        avgPosition: 1.8,
      },
      {
        linkType: "Footer",
        impressions: 15480,
        clicks: 856,
        ctr: 5.53,
        uniqueUsers: 6500,
        avgPosition: 8.2,
      },
      {
        linkType: "RelatedArticles",
        impressions: 12000,
        clicks: 720,
        ctr: 6.0,
        uniqueUsers: 4800,
        avgPosition: 3.5,
      },
      {
        linkType: "CompSwitch",
        impressions: 3000,
        clicks: 180,
        ctr: 6.0,
        uniqueUsers: 1200,
        avgPosition: 5.0,
      },
    ],
    topPerformers: [
      {
        url: "/pieces/freins/bmw/serie-3/berline.html",
        linkType: "LinkGammeCar",
        clicks: 456,
        ctr: 8.2,
      },
      {
        url: "/pieces/filtres/volkswagen/golf/vii.html",
        linkType: "VoirAussi",
        clicks: 398,
        ctr: 9.1,
      },
      {
        url: "/pieces/embrayage/renault/clio/iv.html",
        linkType: "CrossSelling",
        clicks: 342,
        ctr: 7.5,
      },
      {
        url: "/pieces/suspension/peugeot/308/ii.html",
        linkType: "LinkGammeCar",
        clicks: 289,
        ctr: 6.8,
      },
      {
        url: "/pieces/demarreur/audi/a3/8p.html",
        linkType: "RelatedArticles",
        clicks: 267,
        ctr: 7.2,
      },
    ],
    dailyTrend: generateDailyTrend(startDate, endDate),
  };
}

function generateDailyTrend(startDate: string, endDate: string): DailyMetric[] {
  const trend: DailyMetric[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const baseImpressions = 4000 + Math.random() * 2000;
    const baseClicks = baseImpressions * (0.05 + Math.random() * 0.04);
    trend.push({
      date: d.toISOString().split("T")[0],
      impressions: Math.round(baseImpressions),
      clicks: Math.round(baseClicks),
      ctr: parseFloat(((baseClicks / baseImpressions) * 100).toFixed(2)),
    });
  }

  return trend;
}

export default function SeoDashboard() {
  const { report, error, filters: _filters } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [selectedPeriod, setSelectedPeriod] = useState<
    "7d" | "30d" | "90d" | "custom"
  >("30d");

  // Auto-refresh toutes les 5 minutes
  useEffect(() => {
    const interval = setInterval(
      () => {
        revalidator.revalidate();
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [revalidator]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">📊 SEO Dashboard</h1>
          <p className="text-gray-600 mt-2">Performance du maillage interne</p>
          {error && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Filtres de période */}
        <div className="mb-6 flex gap-2">
          {(["7d", "30d", "90d"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPeriod === period
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {period === "7d"
                ? "7 jours"
                : period === "30d"
                  ? "30 jours"
                  : "90 jours"}
            </button>
          ))}
        </div>

        {/* KPIs principaux */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <KpiCard
            title="Impressions"
            value={formatNumber(report.totalImpressions)}
            icon="👁️"
            trend={+12.5}
          />
          <KpiCard
            title="Clics"
            value={formatNumber(report.totalClicks)}
            icon="🖱️"
            trend={+8.3}
          />
          <KpiCard
            title="CTR Global"
            value={`${report.overallCtr.toFixed(2)}%`}
            icon="📈"
            trend={+0.4}
          />
          <KpiCard
            title="Types de liens"
            value={report.byLinkType.length.toString()}
            icon="🔗"
          />
        </div>

        {/* Graphiques et tableaux */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance par type de lien */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Performance par type de lien
            </h2>
            <div className="space-y-4">
              {report.byLinkType.map((metric) => (
                <LinkTypeRow key={metric.linkType} metric={metric} />
              ))}
            </div>
          </div>

          {/* Top performers */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              🏆 Top Performers
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-500 text-sm">
                    <th className="pb-3">URL</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3 text-right">Clics</th>
                    <th className="pb-3 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {report.topPerformers.map((performer, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="py-3">
                        <span
                          className="text-blue-600 truncate block max-w-[200px]"
                          title={performer.url}
                        >
                          {performer.url}
                        </span>
                      </td>
                      <td className="py-3">
                        <LinkTypeBadge type={performer.linkType} />
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatNumber(performer.clicks)}
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-green-600 font-medium">
                          {performer.ctr.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Évolution journalière (graphique simplifié) */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📅 Évolution sur la période
          </h2>
          <div className="h-64">
            <SimpleBarChart data={report.dailyTrend} />
          </div>
        </div>

        {/* Recommandations SEO */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            💡 Recommandations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RecommendationCard
              title="Augmenter les liens VoirAussi"
              description="CTR de 7.78% - Le meilleur performer. Augmentez le nombre de liens dans cette section."
              priority="high"
            />
            <RecommendationCard
              title="Optimiser les liens Footer"
              description="CTR de 5.53% - En dessous de la moyenne. Revoir le placement et l'ancrage des liens."
              priority="medium"
            />
            <RecommendationCard
              title="Diversifier CrossSelling"
              description="32k impressions mais peut être optimisé. Tester de nouvelles positions."
              priority="low"
            />
            <RecommendationCard
              title="Monitorer RelatedArticles"
              description="Bonne progression. Continuer à enrichir le contenu blog lié."
              priority="info"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Composants auxiliaires
function KpiCard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string;
  icon: string;
  trend?: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {trend !== undefined && (
          <span
            className={`text-sm font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-gray-500 text-sm mt-1">{title}</p>
    </div>
  );
}

function LinkTypeRow({ metric }: { metric: LinkMetrics }) {
  const maxImpressions = 50000; // Pour la barre de progression
  const progress = (metric.impressions / maxImpressions) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkTypeBadge type={metric.linkType} />
          <span className="text-sm text-gray-500">
            {formatNumber(metric.impressions)} imp.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {formatNumber(metric.clicks)} clics
          </span>
          <span
            className={`text-sm font-medium ${metric.ctr >= 7 ? "text-green-600" : metric.ctr >= 5 ? "text-yellow-600" : "text-red-600"}`}
          >
            {metric.ctr.toFixed(1)}% CTR
          </span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

function LinkTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    LinkGammeCar: "bg-blue-100 text-blue-800",
    CrossSelling: "bg-purple-100 text-purple-800",
    VoirAussi: "bg-green-100 text-green-800",
    Footer: "bg-gray-100 text-gray-800",
    RelatedArticles: "bg-orange-100 text-orange-800",
    CompSwitch: "bg-pink-100 text-pink-800",
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${colors[type] || "bg-gray-100 text-gray-800"}`}
    >
      {type}
    </span>
  );
}

function RecommendationCard({
  title,
  description,
  priority,
}: {
  title: string;
  description: string;
  priority: "high" | "medium" | "low" | "info";
}) {
  const colors = {
    high: "border-l-red-500",
    medium: "border-l-yellow-500",
    low: "border-l-green-500",
    info: "border-l-blue-500",
  };

  const icons = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
    info: "ℹ️",
  };

  return (
    <div className={`bg-white rounded-lg p-4 border-l-4 ${colors[priority]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span>{icons[priority]}</span>
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

function SimpleBarChart({ data }: { data: DailyMetric[] }) {
  // Afficher les 14 derniers jours pour lisibilité
  const displayData = data.slice(-14);
  const maxClicks = Math.max(...displayData.map((d) => d.clicks));

  return (
    <div className="flex items-end justify-between h-full gap-1">
      {displayData.map((day, idx) => {
        const height = (day.clicks / maxClicks) * 100;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer group relative"
              style={{ height: `${height}%`, minHeight: "4px" }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                {day.date}: {day.clicks} clics ({day.ctr}%)
              </div>
            </div>
            <span className="text-xs text-gray-400 mt-1 rotate-45 origin-left">
              {new Date(day.date).getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}
