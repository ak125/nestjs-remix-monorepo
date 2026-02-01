/**
 * 🔍 SEO HUB - MONITORING
 *
 * Page de monitoring unifiée:
 * - Activité Crawl (Googlebot)
 * - Changements d'indexation
 * - Alertes consolidées
 * - URLs à risque
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Activity,
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  RefreshCw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface CrawlActivity {
  date: string;
  count: number;
  avgResponseMs: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
}

interface IndexChange {
  url: string;
  oldStatus: string;
  newStatus: string;
  changedAt: string;
}

interface UrlAtRisk {
  url: string;
  riskType: string;
  urgencyScore: number;
  lastCrawled: string | null;
  pageType: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const days = url.searchParams.get("days") || "30";
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const [crawlRes, indexRes, atRiskRes] = await Promise.all([
      fetch(
        `${backendUrl}/api/admin/seo-cockpit/monitoring/crawl?days=${days}`,
        {
          headers: { Cookie: cookieHeader },
        },
      ),
      fetch(`${backendUrl}/api/admin/seo-cockpit/monitoring/index?limit=50`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(
        `${backendUrl}/api/admin/seo-cockpit/monitoring/at-risk?limit=100`,
        {
          headers: { Cookie: cookieHeader },
        },
      ),
    ]);

    const crawlData = crawlRes.ok ? await crawlRes.json() : null;
    const indexData = indexRes.ok ? await indexRes.json() : null;
    const atRiskData = atRiskRes.ok ? await atRiskRes.json() : null;

    return json({
      crawlActivity: (crawlData?.data || []) as CrawlActivity[],
      indexChanges: (indexData?.data || []) as IndexChange[],
      urlsAtRisk: (atRiskData?.data || []) as UrlAtRisk[],
      error: null,
    });
  } catch (error) {
    console.error("[SEO Monitoring] Loader error:", error);
    return json({
      crawlActivity: [],
      indexChanges: [],
      urlsAtRisk: [],
      error: "Erreur connexion backend",
    });
  }
}

export default function SeoHubMonitoring() {
  const { crawlActivity, indexChanges, urlsAtRisk, error } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "crawl",
  );

  const days = searchParams.get("days") || "30";

  const handleDaysChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("days", value);
    setSearchParams(params);
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate crawl stats
  const totalCrawls = crawlActivity.reduce(
    (acc, d) => acc + (d?.count ?? 0),
    0,
  );
  const avgResponseMs =
    crawlActivity.length > 0
      ? Math.round(
          crawlActivity.reduce((acc, d) => acc + (d?.avgResponseMs ?? 0), 0) /
            crawlActivity.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoring SEO</h1>
          <p className="text-gray-600">Activité crawl, indexation et alertes</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={days} onValueChange={handleDaysChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="14">14 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="60">60 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Crawls ({days}j)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCrawls.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Temps moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseMs} ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Changements index
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{indexChanges.length}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              URLs à risque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {urlsAtRisk.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Crawl Activity */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() =>
            setExpandedSection(expandedSection === "crawl" ? null : "crawl")
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-500" />
                Activité Crawl Googlebot
              </CardTitle>
              <CardDescription>
                Historique des visites du robot Google
              </CardDescription>
            </div>
            {expandedSection === "crawl" ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </CardHeader>
        {expandedSection === "crawl" && (
          <CardContent>
            {crawlActivity.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                Aucune donnée de crawl disponible
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Requêtes</th>
                      <th className="px-4 py-3 text-right">Temps moy.</th>
                      <th className="px-4 py-3 text-center">2xx</th>
                      <th className="px-4 py-3 text-center">3xx</th>
                      <th className="px-4 py-3 text-center">4xx</th>
                      <th className="px-4 py-3 text-center">5xx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {crawlActivity.slice(0, 14).map((day, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {new Date(day.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {day.count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {day.avgResponseMs} ms
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700"
                          >
                            {day.status2xx}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700"
                          >
                            {day.status3xx}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {day.status4xx > 0 ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700"
                            >
                              {day.status4xx}
                            </Badge>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {day.status5xx > 0 ? (
                            <Badge variant="destructive">{day.status5xx}</Badge>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Index Changes */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() =>
            setExpandedSection(expandedSection === "index" ? null : "index")
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-purple-500" />
                Changements d'Indexation
              </CardTitle>
              <CardDescription>
                URLs dont le statut d'indexation a changé
              </CardDescription>
            </div>
            {expandedSection === "index" ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </CardHeader>
        {expandedSection === "index" && (
          <CardContent>
            {indexChanges.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                Aucun changement récent
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {indexChanges.map((change, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 truncate">
                      <a
                        href={change.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {change.url}
                      </a>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(change.changedAt).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="outline" className="text-xs">
                        {change.oldStatus}
                      </Badge>
                      <span className="text-gray-400">→</span>
                      <Badge
                        className={cn(
                          "text-xs",
                          change.newStatus === "INDEXED"
                            ? "bg-green-500"
                            : change.newStatus === "NOT_INDEXED"
                              ? "bg-red-500"
                              : "bg-gray-500",
                        )}
                      >
                        {change.newStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* URLs at Risk */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() =>
            setExpandedSection(expandedSection === "risk" ? null : "risk")
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                URLs à Risque
              </CardTitle>
              <CardDescription>
                URLs nécessitant une attention (triées par urgence)
              </CardDescription>
            </div>
            {expandedSection === "risk" ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </CardHeader>
        {expandedSection === "risk" && (
          <CardContent>
            {urlsAtRisk.length === 0 ? (
              <p className="text-center text-green-600 py-8">
                <Activity className="h-8 w-8 mx-auto mb-2 text-green-400" />
                Aucune URL à risque détectée
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">URL</th>
                      <th className="px-4 py-3 text-center">Type de risque</th>
                      <th className="px-4 py-3 text-center">Urgence</th>
                      <th className="px-4 py-3 text-center">Type page</th>
                      <th className="px-4 py-3 text-center">Dernier crawl</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {urlsAtRisk.slice(0, 50).map((url, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <a
                            href={url.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate block max-w-md"
                          >
                            {url.url}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              url.riskType === "ORPHAN"
                                ? "bg-orange-50 text-orange-700"
                                : url.riskType === "DUPLICATE"
                                  ? "bg-amber-50 text-amber-700"
                                  : url.riskType === "CONFUSION"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-50",
                            )}
                          >
                            {url.riskType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div
                            className={cn(
                              "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                              url.urgencyScore >= 80
                                ? "bg-red-100 text-red-700"
                                : url.urgencyScore >= 50
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-700",
                            )}
                          >
                            {url.urgencyScore}%
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {url.pageType || "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500 text-xs">
                          {url.lastCrawled
                            ? new Date(url.lastCrawled).toLocaleDateString(
                                "fr-FR",
                              )
                            : "Jamais"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
