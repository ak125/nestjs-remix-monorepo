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
import { useLoaderData, useRevalidator, Link } from "@remix-run/react";
import {
  BarChart3,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  TrendingUp,
  Layers,
  ArrowRight,
  Tag,
} from "lucide-react";
import { useState } from "react";

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
import { Progress } from "~/components/ui/progress";

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

interface ValidationResult {
  valid: boolean;
  violations: Array<{
    model_name: string;
    variant_name: string;
    energy: string;
    v2_count: number;
    g1_total: number;
    percentage: number;
  }>;
  g1_count: number;
  summary: { total_v1: number; valid_v1: number; invalid_v1: number };
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const apiUrl = `${process.env.BACKEND_URL || "http://localhost:3000"}/api/admin/gammes-seo/v-level/global-stats`;

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
    console.error("Error fetching V-Level stats:", error);
    return json({
      stats: null,
      error: "Erreur de connexion au serveur",
    });
  }
}

export default function VLevelStatusPage() {
  const { stats, error } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const res = await fetch("/api/admin/gammes-seo/v-level/validate", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setValidationResult(data.data);
      }
    } catch (err) {
      console.error("Validation error:", err);
    } finally {
      setIsValidating(false);
    }
  };

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
      <AdminBreadcrumb currentPage="V-Level Status" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">V-Level Status Dashboard</h1>
          <p className="text-gray-500">
            Vue globale du systeme de classification V-Level
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/gammes-seo">
            <Button variant="outline" className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
              <Tag className="h-4 w-4 mr-2" />
              Gammes SEO
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
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
          <Button onClick={handleValidate} disabled={isValidating}>
            <CheckCircle2
              className={`h-4 w-4 mr-2 ${isValidating ? "animate-pulse" : ""}`}
            />
            {isValidating ? "Validation..." : "Valider V1 Rules"}
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
                  {Math.round((stats.gammesWithVLevel / stats.totalGammes) * 100)}
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
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    V1: {stats.distribution.v1}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
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
                <div className="text-3xl font-bold">{stats.g1Stats.coverage}%</div>
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
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Frais: {stats.freshness.fresh}
                  </Badge>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
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
                  { label: "V1 - Champions Modele", count: stats.distribution.v1, color: "bg-amber-500" },
                  { label: "V2 - Champions Gamme", count: stats.distribution.v2, color: "bg-green-500" },
                  { label: "V3 - Challengers", count: stats.distribution.v3, color: "bg-blue-500" },
                  { label: "V4 - Faibles", count: stats.distribution.v4, color: "bg-gray-400" },
                  { label: "V5 - Bloc B", count: stats.distribution.v5, color: "bg-orange-500" },
                ].map((level) => (
                  <div key={level.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{level.label}</span>
                      <span className="font-medium">
                        {level.count} (
                        {stats.distribution.total > 0
                          ? Math.round((level.count / stats.distribution.total) * 100)
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
                Age des donnees V-Level (Frais: moins de 7j, Perimes: 7-30j, Anciens: plus de 30j)
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

          {/* Validation Results */}
          {validationResult && (
            <Card
              className={
                validationResult.valid
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {validationResult.valid ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-green-800">Validation V1 OK</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="text-red-800">Violations V1 Detectees</span>
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  Regle: V1 doit etre V2 dans au moins 30% des gammes G1
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Gammes G1:</span>{" "}
                    {validationResult.g1_count} |
                    <span className="font-medium ml-2">V1 valides:</span>{" "}
                    {validationResult.summary.valid_v1}/
                    {validationResult.summary.total_v1}
                  </p>
                  {validationResult.violations.length > 0 && (
                    <div className="mt-4">
                      <p className="font-medium text-red-800 mb-2">
                        Violations (V1 avec moins de 30% G1):
                      </p>
                      <div className="bg-white rounded border border-red-200 divide-y divide-red-100">
                        {validationResult.violations.map((v, idx) => (
                          <div
                            key={idx}
                            className="p-2 flex justify-between items-center"
                          >
                            <span>
                              {v.model_name}{" "}
                              <Badge variant="outline">{v.energy}</Badge>
                            </span>
                            <span className="text-red-600 font-medium">
                              {v.percentage}% ({v.v2_count}/{v.g1_total})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
