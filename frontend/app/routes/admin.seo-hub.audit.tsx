/**
 * 📜 SEO HUB - AUDIT
 *
 * Historique unifié des actions SEO:
 * - Actions sur gammes
 * - Modifications seuils
 * - Sitemap regenerations
 * - Preview validations
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Calendar,
  Clock,
  Filter,
  History,
  RefreshCw,
  Settings,
  User,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

interface AuditEntry {
  id: string;
  adminEmail: string;
  actionType: string;
  entityType: string;
  entityIds: number[] | null;
  impactSummary: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

interface AuditStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  byAdmin: Array<{ email: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
}

export const meta: MetaFunction = () => createNoIndexMeta("Audit SEO - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  const limit = url.searchParams.get("limit") || "50";
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const [historyRes, statsRes] = await Promise.all([
      fetch(
        `${backendUrl}/api/admin/seo-cockpit/audit/history?limit=${limit}${type ? `&type=${type}` : ""}`,
        { headers: { Cookie: cookieHeader } },
      ),
      fetch(`${backendUrl}/api/admin/seo-cockpit/audit/stats`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    const historyData = historyRes.ok ? await historyRes.json() : null;
    const statsData = statsRes.ok ? await statsRes.json() : null;

    return json({
      history: (historyData?.data || []) as AuditEntry[],
      stats: statsData?.data as AuditStats | null,
      error: null,
    });
  } catch (error) {
    logger.error("[SEO Audit] Loader error:", error);
    return json({
      history: [],
      stats: null,
      error: "Erreur connexion backend",
    });
  }
}

export default function SeoHubAudit() {
  const { history, stats, error } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const typeFilter = searchParams.get("type") || "";

  const handleTypeChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set("type", value);
    } else {
      params.delete("type");
    }
    setSearchParams(params);
  };

  const getActionBadgeColor = (actionType: string) => {
    if (actionType.includes("PROMOTE"))
      return "bg-green-100 text-green-700 border-green-200";
    if (actionType.includes("DEMOTE"))
      return "bg-red-100 text-red-700 border-red-200";
    if (actionType.includes("THRESHOLD"))
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (actionType.includes("SITEMAP"))
      return "bg-blue-100 text-blue-700 border-blue-200";
    if (actionType.includes("G1"))
      return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  if (error) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-6 text-center">
          <p className="text-amber-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historique Audit</h1>
          <p className="text-gray-600">Toutes les actions SEO effectuées</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Rafraîchir
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                Cette semaine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisWeek}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Ce mois</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisMonth}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                Admins actifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byAdmin?.length || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* By Admin & By Type breakdown */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Admin */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                Par Admin
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.byAdmin?.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucune donnée</p>
              ) : (
                <div className="space-y-2">
                  {stats.byAdmin?.slice(0, 5).map((admin) => (
                    <div
                      key={admin.email}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm text-gray-700">
                        {admin.email}
                      </span>
                      <Badge variant="secondary">{admin.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-500" />
                Par Type d'Action
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.byType?.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucune donnée</p>
              ) : (
                <div className="space-y-2">
                  {stats.byType?.slice(0, 5).map((type) => (
                    <div
                      key={type.type}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <Badge
                        variant="outline"
                        className={getActionBadgeColor(type.type)}
                      >
                        {type.type.replace(/_/g, " ")}
                      </Badge>
                      <span className="font-medium">{type.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter & History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-gray-500" />
                Historique des Actions
              </CardTitle>
              <CardDescription>{history.length} entrées</CardDescription>
            </div>
            <Select
              value={typeFilter || "all"}
              onValueChange={handleTypeChange}
            >
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrer par type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="PROMOTE_INDEX">Promotions INDEX</SelectItem>
                <SelectItem value="DEMOTE_NOINDEX">
                  Rétrogradations NOINDEX
                </SelectItem>
                <SelectItem value="MARK_G1">Marquages G1</SelectItem>
                <SelectItem value="THRESHOLD">Modifications seuils</SelectItem>
                <SelectItem value="SITEMAP">Regénérations sitemap</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>Aucune action enregistrée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Admin</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(entry.createdAt).toLocaleDateString(
                              "fr-FR",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {entry.adminEmail}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={getActionBadgeColor(entry.actionType)}
                        >
                          {entry.actionType.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-md truncate">
                        {entry.impactSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
