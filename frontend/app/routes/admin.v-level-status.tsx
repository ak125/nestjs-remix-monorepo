/**
 * 📊 V-Level Status Dashboard
 *
 * Tableau de bord pour visualiser l'etat global des V-Levels :
 * - Distribution V1/V2/V3/V4/V5
 * - Fraicheur des donnees
 * - Couverture G1
 * - Validation rules
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  BarChart3,
  RefreshCw,
  AlertCircle,
  Clock,
  Database,
  TrendingUp,
  Layers,
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
import { Progress } from "~/components/ui/progress";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";

export const meta: MetaFunction = () => [
  { title: "V-Level Status - Admin" },
  { name: "robots", content: "noindex, nofollow" },
];

interface VLevelStats {
  totalGammes: number;
  gammesWithVLevel: number;
  distribution: {
    v1: number;
    v2: number;
    v3: number;
    v4: number;
    v5: number;
    total: number;
  };
  freshness: {
    fresh: number;
    stale: number;
    old: number;
  };
  lastUpdated: string | null;
  g1Stats: {
    total: number;
    withV2: number;
    coverage: number;
  };
}

// V1 validation deferred in v5.0

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const apiUrl = `${getInternalApiUrl("")}/api/admin/gammes-seo/v-level/global-stats`;

    const response = await fetch(apiUrl, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      },
    });

    if (!response.ok) {
      return json({
        stats: null,
        error: "Impossible de charger les statistiques V-Level",
      });
    }

    const data = await response.json();

    return json({
      stats: data.data as VLevelStats,
      error: null,
    });
  } catch (error) {
    logger.error("Error fetching V-Level stats:", error);
    return json({
      stats: null,
      error: "Erreur de connexion au serveur",
    });
  }
}

export default function VLevelStatusPage() {
  const { stats, error } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  // V1 validation deferred in v5.0

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Jamais";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 p-6">
      <PublicBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "V-Level Status" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">V-Level Status Dashboard</h1>
          <p className="text-gray-500">
            Vue globale du systeme de classification V-Level
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => revalidator.revalidate()}
            disabled={revalidator.state === "loading"}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${revalidator.state === "loading" ? "animate-spin" : ""}`}
            />
            Rafraichir
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {stats && (
        <>
          {/* KPIs Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Gammes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Gammes Totales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalGammes}</div>
                <p className="text-sm text-gray-500">
                  {stats.gammesWithVLevel} avec V-Level (
                  {Math.round(
                    (stats.gammesWithVLevel / stats.totalGammes) * 100,
                  )}
                  %)
                </p>
              </CardContent>
            </Card>

            {/* V-Level Entries */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Entrees V-Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats.distribution.total}
                </div>
                <div className="flex gap-1 mt-1">
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-800"
                  >
                    V1: {stats.distribution.v1}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    V2: {stats.distribution.v2}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* G1 Coverage */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Couverture G1
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats.g1Stats.coverage}%
                </div>
                <p className="text-sm text-gray-500">
                  {stats.g1Stats.withV2}/{stats.g1Stats.total} gammes G1 avec V2
                </p>
              </CardContent>
            </Card>

            {/* Last Updated */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Derniere MAJ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-medium">
                  {formatDate(stats.lastUpdated)}
                </div>
                <div className="flex gap-1 mt-1">
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    Frais: {stats.freshness.fresh}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-yellow-100 text-yellow-800"
                  >
                    Perimes: {stats.freshness.stale}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Distribution V-Level
              </CardTitle>
              <CardDescription>
                Repartition des motorisations par niveau V
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    label: "V1 - Champions Modele",
                    count: stats.distribution.v1,
                    color: "bg-amber-500",
                  },
                  {
                    label: "V2 - Champions Gamme",
                    count: stats.distribution.v2,
                    color: "bg-green-500",
                  },
                  {
                    label: "V3 - Champions Groupe",
                    count: stats.distribution.v3,
                    color: "bg-blue-500",
                  },
                  {
                    label: "V4 - Challengers CSV",
                    count: stats.distribution.v4,
                    color: "bg-gray-400",
                  },
                  {
                    label: "V5 - DB Siblings",
                    count: stats.distribution.v5,
                    color: "bg-orange-500",
                  },
                ].map((level) => (
                  <div key={level.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{level.label}</span>
                      <span className="font-medium">
                        {level.count} (
                        {stats.distribution.total > 0
                          ? Math.round(
                              (level.count / stats.distribution.total) * 100,
                            )
                          : 0}
                        %)
                      </span>
                    </div>
                    <Progress
                      value={
                        stats.distribution.total > 0
                          ? (level.count / stats.distribution.total) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Freshness Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Fraicheur des Donnees
              </CardTitle>
              <CardDescription>
                Age des donnees V-Level (Frais: moins de 7j, Perimes: 7-30j,
                Anciens: plus de 30j)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1 text-center p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-3xl font-bold text-green-700">
                    {stats.freshness.fresh}
                  </div>
                  <div className="text-sm text-green-600">Frais (&lt;7j)</div>
                </div>
                <div className="flex-1 text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-700">
                    {stats.freshness.stale}
                  </div>
                  <div className="text-sm text-yellow-600">Perimes (7-30j)</div>
                </div>
                <div className="flex-1 text-center p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-3xl font-bold text-red-700">
                    {stats.freshness.old}
                  </div>
                  <div className="text-sm text-red-600">Anciens (&gt;30j)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
