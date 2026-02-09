/**
 * Page Analytics des Avis Clients
 * Tableaux de bord et statistiques avancées
 */
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  TrendingUp,
  Star,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  Calendar,
  Filter,
  Download,
} from "lucide-react";
import { Error404 } from "~/components/errors/Error404";
import { Button } from "~/components/ui/button";
import { logger } from "~/utils/logger";
import { getReviewStats } from "../services/api/review.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Analytics Avis Clients - Dashboard Support" },
    {
      name: "description",
      content: "Analyse et statistiques des avis clients",
    },
  ];
};

/** Local shape used after normalising the API response */
interface ReviewStatsData {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  totalPublished?: number;
  lastWeekTotal?: number;
  lastMonthTotal?: number;
}

interface TrendsData {
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
  lastMonth: number;
  growthRate: number;
}

interface RatingBreakdownItem {
  rating: number;
  count: number;
  percentage: number;
}

interface LoaderData {
  stats: ReviewStatsData;
  trends: TrendsData;
  ratingBreakdown: RatingBreakdownItem[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const rawStats = await getReviewStats(request).catch(() => null);

    const stats: ReviewStatsData = rawStats
      ? {
          total: rawStats.total_reviews,
          pending: rawStats.pending_reviews,
          approved: rawStats.approved_reviews,
          rejected: rawStats.rejected_reviews,
          averageRating: rawStats.average_rating,
          ratingDistribution: rawStats.rating_distribution,
        }
      : {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          averageRating: 0,
          ratingDistribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
          totalPublished: 0,
          lastWeekTotal: 0,
          lastMonthTotal: 0,
        };

    // Simulation de données de tendance
    const trends: TrendsData = {
      thisWeek: 15,
      lastWeek: 12,
      thisMonth: 45,
      lastMonth: 38,
      growthRate: 18.4,
    };

    const ratingBreakdown = [
      {
        rating: 5,
        count: stats.ratingDistribution?.["5"] || 0,
        percentage: 0,
      },
      {
        rating: 4,
        count: stats.ratingDistribution?.["4"] || 0,
        percentage: 0,
      },
      {
        rating: 3,
        count: stats.ratingDistribution?.["3"] || 0,
        percentage: 0,
      },
      {
        rating: 2,
        count: stats.ratingDistribution?.["2"] || 0,
        percentage: 0,
      },
      {
        rating: 1,
        count: stats.ratingDistribution?.["1"] || 0,
        percentage: 0,
      },
    ].map((item) => ({
      ...item,
      percentage:
        stats.total > 0
          ? Math.round((item.count / stats.total) * 100)
          : 0,
    }));

    return json<LoaderData>({
      stats,
      trends,
      ratingBreakdown,
    });
  } catch (error) {
    logger.error("Erreur lors du chargement des analytics:", error);
    return json<LoaderData>({
      stats: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        averageRating: 0,
        ratingDistribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
        totalPublished: 0,
      },
      trends: {
        thisWeek: 0,
        lastWeek: 0,
        thisMonth: 0,
        lastMonth: 0,
        growthRate: 0,
      },
      ratingBreakdown: [],
    });
  }
}

export default function ReviewAnalyticsPage() {
  const { stats, trends, ratingBreakdown } = useLoaderData<typeof loader>();

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? "text-yellow-400 fill-current" : "text-gray-300"
        }`}
      />
    ));
  };

  const getGrowthIcon = (current: number, previous: number) => {
    if (current > previous) {
      return <ArrowUp className="w-4 h-4 text-green-500" />;
    } else if (current < previous) {
      return <ArrowDown className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  const getGrowthColor = (current: number, previous: number) => {
    if (current > previous) return "text-green-600";
    if (current < previous) return "text-red-600";
    return "text-gray-600";
  };

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Analytics des Avis Clients
            </h1>
            <p className="text-gray-600 mt-1">
              Analyse détaillée des évaluations et commentaires clients
            </p>
          </div>
          <div className="flex gap-3">
            <button className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200">
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </button>
            <Button
              className="inline-flex items-center px-4 py-2   rounded-md"
              variant="blue"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Total des Avis
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.total || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {getGrowthIcon(trends.thisMonth, trends.lastMonth)}
            <span
              className={`text-sm ml-1 ${getGrowthColor(trends.thisMonth, trends.lastMonth)}`}
            >
              {calculateGrowth(trends.thisMonth, trends.lastMonth)}% ce mois
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Note Moyenne</p>
              <div className="flex items-center mt-1">
                <p className="text-2xl font-bold text-gray-900 mr-2">
                  {stats.averageRating?.toFixed(1) || "0.0"}
                </p>
                {renderStars(Math.round(stats.averageRating || 0))}
              </div>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              <p className="text-sm text-gray-600">
                {stats.totalPublished || stats.approved || 0}{" "}
                avis publiés
              </p>
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">En Attente</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.pending || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-orange-600">
              Nécessite modération
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Taux d'Approbation
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.total > 0
                  ? Math.round(
                      (stats.approved / stats.total) * 100,
                    )
                  : 0}
                %
              </p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-green-600">
              {stats.approved || 0} approuvés
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Répartition des notes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Répartition des Notes
            </h2>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>

          <div className="space-y-4">
            {ratingBreakdown.map((item) => (
              <div key={item.rating} className="flex items-center">
                <div className="flex items-center w-16">
                  <span className="text-sm font-medium text-gray-900 mr-2">
                    {item.rating}
                  </span>
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                </div>

                <div className="flex-1 mx-4">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-warning/60 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center w-20 text-right">
                  <span className="text-sm text-gray-600 mr-2">
                    {item.count}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({item.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>

          {stats.total === 0 && (
            <div className="text-center py-8">
              <PieChart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">Aucune donnée disponible</p>
              <p className="text-sm text-gray-400">
                Les statistiques apparaîtront une fois que vous aurez des avis
              </p>
            </div>
          )}
        </div>

        {/* Tendances temporelles */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Tendances</h2>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Cette semaine
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {trends.thisWeek}
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((trends.thisWeek / Math.max(trends.thisWeek, trends.lastWeek, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Semaine dernière
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {trends.lastWeek}
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gray-400 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((trends.lastWeek / Math.max(trends.thisWeek, trends.lastWeek, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Ce mois
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {trends.thisMonth}
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-success h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((trends.thisMonth / Math.max(trends.thisMonth, trends.lastMonth, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Mois dernier
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {trends.lastMonth}
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gray-400 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((trends.lastMonth / Math.max(trends.thisMonth, trends.lastMonth, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary/5 rounded-lg">
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">
                Croissance
              </span>
            </div>
            <p className="text-lg font-bold text-blue-900 mt-1">
              +{calculateGrowth(trends.thisMonth, trends.lastMonth)}%
            </p>
            <p className="text-sm text-blue-700">vs mois précédent</p>
          </div>
        </div>
      </div>

      {/* Insights et recommandations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Insights et Recommandations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-primary/5 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">
              Performance Globale
            </h3>
            <p className="text-sm text-blue-800">
              {stats.averageRating >= 4
                ? "Excellente satisfaction client avec une note moyenne élevée."
                : stats.averageRating >= 3
                  ? "Satisfaction correcte, mais des améliorations sont possibles."
                  : "Attention requise - la satisfaction client peut être améliorée."}
            </p>
          </div>

          <div className="p-4 bg-warning/5 rounded-lg">
            <h3 className="font-medium text-yellow-900 mb-2">Modération</h3>
            <p className="text-sm text-yellow-800">
              {stats.pending > 5
                ? `${stats.pending} avis en attente de modération nécessitent votre attention.`
                : stats.pending > 0
                  ? `${stats.pending} avis en attente - traitement rapide recommandé.`
                  : "Tous les avis sont modérés. Excellent suivi!"}
            </p>
          </div>

          <div className="p-4 bg-success/5 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">Tendance</h3>
            <p className="text-sm text-green-800">
              {trends.thisMonth > trends.lastMonth
                ? "Croissance positive des avis clients ce mois-ci."
                : trends.thisMonth === trends.lastMonth
                  ? "Volume d'avis stable par rapport au mois dernier."
                  : "Baisse du volume d'avis - considérez des initiatives d'engagement."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
