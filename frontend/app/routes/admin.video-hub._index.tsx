import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Film,
  CheckCircle,
  Clock,
  AlertTriangle,
  Archive,
  Activity,
  Cpu,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

// ── Interfaces ──

interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
}

interface ExecutionStats {
  total: number;
  byStatus: Record<string, number>;
  avgDurationMs: number | null;
  engineDistribution: Record<string, number>;
  canary: {
    totalCanary: number;
    totalFallback: number;
    successRate: number | null;
    fallbackRate: number | null;
    topErrorCodes: Record<string, number>;
  };
  renderPerformance: {
    p95RenderDurationMs: number | null;
    byEngine: Record<string, { avg: number; p95: number; count: number }>;
  };
}

interface CanaryPolicy {
  engineName: string;
  canaryAvailable: boolean;
  renderEnabled: boolean;
  dailyUsageCount: number;
  remainingQuota: number;
  quotaPerDay: number;
  eligibleVideoTypes: string[];
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookieHeader };

  const safeFetch = async <T,>(url: string): Promise<T | null> => {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data as T) ?? null;
    } catch {
      return null;
    }
  };

  const [stats, executionStats, canaryPolicy] = await Promise.all([
    safeFetch<DashboardStats>(`${backendUrl}/api/admin/video/dashboard`),
    safeFetch<ExecutionStats>(`${backendUrl}/api/admin/video/executions/stats`),
    safeFetch<CanaryPolicy>(`${backendUrl}/api/admin/video/canary/policy`),
  ]);

  return json({ stats, executionStats, canaryPolicy });
}

// ── Status config ──

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Film }
> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  pending_review: {
    label: "En review",
    color: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  script_approved: {
    label: "Script OK",
    color: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle,
  },
  storyboard: {
    label: "Storyboard",
    color: "bg-purple-100 text-purple-700",
    icon: Film,
  },
  rendering: {
    label: "Rendu",
    color: "bg-amber-100 text-amber-700",
    icon: Film,
  },
  qa: {
    label: "QA",
    color: "bg-orange-100 text-orange-700",
    icon: AlertTriangle,
  },
  qa_failed: {
    label: "QA Echoue",
    color: "bg-red-100 text-red-700",
    icon: AlertTriangle,
  },
  ready_for_publish: {
    label: "Pret",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  published: {
    label: "Publie",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  archived: {
    label: "Archive",
    color: "bg-slate-100 text-slate-600",
    icon: Archive,
  },
};

const EXEC_STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
};

// ── Helpers ──

function formatDuration(ms: number | null): string {
  if (ms == null) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Component ──

export default function VideoHubDashboard() {
  const { stats, executionStats, canaryPolicy } =
    useLoaderData<typeof loader>();

  if (!stats) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Video Dashboard</h2>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Aucune production video pour le moment.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Video Dashboard</h2>
        <Badge variant="outline" className="text-sm">
          {stats.total} production{stats.total !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = stats.byStatus[key] ?? 0;
          const Icon = config.icon;
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {config.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                {count > 0 && (
                  <Badge className={`mt-1 ${config.color}`}>
                    {((count / stats.total) * 100).toFixed(0)}%
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Execution Stats Card */}
      {executionStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Executions
              <Badge variant="outline" className="ml-auto text-xs">
                {executionStats.total} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(executionStats.byStatus).map(
                ([status, count]) => (
                  <Badge
                    key={status}
                    className={
                      EXEC_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"
                    }
                  >
                    {status}: {count}
                  </Badge>
                ),
              )}
              {executionStats.total === 0 && (
                <span className="text-sm text-gray-400">Aucune execution</span>
              )}
            </div>
            <div className="text-sm text-gray-600">
              Duree moyenne : {formatDuration(executionStats.avgDurationMs)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Canary Engine Card */}
      {canaryPolicy && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4 text-purple-500" />
              Canary Engine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Engine</div>
                <div className="font-medium">{canaryPolicy.engineName}</div>
              </div>
              <div>
                <div className="text-gray-500">Rendu reel</div>
                <Badge
                  className={
                    canaryPolicy.renderEnabled
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  }
                >
                  {canaryPolicy.renderEnabled ? "ON" : "OFF"}
                </Badge>
              </div>
              <div>
                <div className="text-gray-500">Canary</div>
                <Badge
                  className={
                    canaryPolicy.canaryAvailable
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-500"
                  }
                >
                  {canaryPolicy.canaryAvailable ? "Actif" : "Inactif"}
                </Badge>
              </div>
              <div>
                <div className="text-gray-500">Quota jour</div>
                <div className="font-medium">
                  {canaryPolicy.dailyUsageCount}/{canaryPolicy.quotaPerDay}
                  <span className="text-gray-400 ml-1">
                    ({canaryPolicy.remainingQuota} restant)
                  </span>
                </div>
              </div>
            </div>

            {executionStats && executionStats.canary.totalCanary > 0 && (
              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
                <div>
                  <div className="text-gray-500">Succes canary</div>
                  <div className="font-medium text-green-600">
                    {executionStats.canary.successRate ?? "--"}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Fallback rate</div>
                  <div className="font-medium text-amber-600">
                    {executionStats.canary.fallbackRate ?? "--"}%
                  </div>
                </div>
              </div>
            )}

            {executionStats &&
              Object.keys(executionStats.canary.topErrorCodes).length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-gray-500 mb-1">
                    Top erreurs canary
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(executionStats.canary.topErrorCodes).map(
                      ([code, count]) => (
                        <Badge
                          key={code}
                          className="bg-red-50 text-red-600 text-xs"
                        >
                          {code}: {count}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              )}

            {canaryPolicy.eligibleVideoTypes.length > 0 && (
              <div className="pt-2 border-t">
                <div className="text-xs text-gray-500 mb-1">
                  Types eligibles
                </div>
                <div className="flex flex-wrap gap-1">
                  {canaryPolicy.eligibleVideoTypes.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Render Performance Card */}
      {executionStats && executionStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Performance Rendu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">P95 global</div>
                <div className="font-medium">
                  {formatDuration(
                    executionStats.renderPerformance.p95RenderDurationMs,
                  )}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Distribution engines</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(executionStats.engineDistribution).map(
                    ([engine, count]) => (
                      <Badge key={engine} variant="outline" className="text-xs">
                        {engine}: {count}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            </div>

            {Object.keys(executionStats.renderPerformance.byEngine).length >
              0 && (
              <div className="pt-2 border-t">
                <div className="text-xs text-gray-500 mb-2">Par engine</div>
                <div className="space-y-1">
                  {Object.entries(
                    executionStats.renderPerformance.byEngine,
                  ).map(([engine, perf]) => (
                    <div
                      key={engine}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="font-medium w-24">{engine}</span>
                      <span className="text-gray-500">
                        avg: {formatDuration(perf.avg)}
                      </span>
                      <span className="text-gray-500">
                        p95: {formatDuration(perf.p95)}
                      </span>
                      <Badge variant="outline" className="text-xs ml-auto">
                        {perf.count} job{perf.count !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Gouvernance Video P6</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>7 gates de gouvernance (G1-G7) — 2 STRICT (Safety, Visual Role)</p>
          <p>5 artefacts obligatoires par production (NO-GO sans les 5)</p>
          <p>3 modes : socle (7-9min), gamme (3-6min), short (15-60s)</p>
          <p>
            Canary engine : fallback automatique, quota journalier, rollback
            &lt;1min
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
