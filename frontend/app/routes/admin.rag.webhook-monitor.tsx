import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Zap, RefreshCw, CheckCircle2, Activity, Clock } from "lucide-react";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import {
  StatusBadge,
  type StatusType,
} from "~/components/admin/patterns/StatusBadge";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Webhook Monitor - Admin");

// ── Types ──

interface WebhookAuditItem {
  id: number;
  job_id: string;
  source: string;
  status: string;
  files_created: string[];
  gammes_detected: string[];
  diagnostics_detected: string[];
  event_emitted: boolean;
  error_message: string | null;
  processing_ms: number | null;
  received_at: string;
}

interface WebhookStats {
  total: number;
  today: number;
  bySource: { pdf: number; web: number };
  successRate: number;
  gammesRefreshed: number;
  avgProcessingMs: number;
}

interface RefreshItem {
  id: number;
  pg_alias: string;
  page_type: string;
  status: string;
  trigger_source: string;
  quality_score: number | null;
  created_at: string;
}

interface DashboardData {
  counts: Record<string, number>;
  recent: RefreshItem[];
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookie };

  const [statsRes, auditRes, dashboardRes] = await Promise.allSettled([
    fetch(
      getInternalApiUrlFromRequest(
        "/api/admin/content-refresh/webhook-stats?days=7",
        request,
      ),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest(
        "/api/admin/content-refresh/webhook-audit?limit=30",
        request,
      ),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest(
        "/api/admin/content-refresh/dashboard",
        request,
      ),
      { headers },
    ),
  ]);

  const stats: WebhookStats =
    statsRes.status === "fulfilled" && statsRes.value.ok
      ? await statsRes.value.json()
      : {
          total: 0,
          today: 0,
          bySource: { pdf: 0, web: 0 },
          successRate: 0,
          gammesRefreshed: 0,
          avgProcessingMs: 0,
        };

  const auditData: { data: WebhookAuditItem[]; total: number } =
    auditRes.status === "fulfilled" && auditRes.value.ok
      ? await auditRes.value.json()
      : { data: [], total: 0 };

  const dashboardRaw =
    dashboardRes.status === "fulfilled" && dashboardRes.value.ok
      ? await dashboardRes.value.json()
      : null;
  const dashboard: DashboardData = dashboardRaw?.data ??
    dashboardRaw ?? { counts: {}, recent: [] };

  return json({ stats, audit: auditData, dashboard });
}

// ── Helpers ──

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function webhookStatusToType(status: string, emitted: boolean): StatusType {
  if (status === "failed") return "FAIL";
  if (emitted) return "PASS";
  return "WARN";
}

function pipelineStatusToType(status: string): StatusType {
  switch (status) {
    case "auto_published":
    case "published":
      return "PASS";
    case "failed":
      return "FAIL";
    case "draft":
    case "pending":
    case "processing":
      return "PENDING";
    case "skipped":
      return "NEUTRAL";
    default:
      return "INFO";
  }
}

function qualityBadgeVariant(
  score: number | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (score === null) return "outline";
  if (score >= 70) return "default";
  if (score >= 50) return "secondary";
  return "destructive";
}

// ── Component ──

export default function WebhookMonitorPage() {
  const { stats, audit, dashboard } = useLoaderData<typeof loader>();

  const pipelineTotal = Object.values(dashboard.counts).reduce(
    (a, b) => a + b,
    0,
  );
  const avgQuality =
    dashboard.recent.length > 0
      ? Math.round(
          dashboard.recent
            .filter((r) => r.quality_score !== null)
            .reduce((sum, r) => sum + (r.quality_score || 0), 0) /
            Math.max(
              dashboard.recent.filter((r) => r.quality_score !== null).length,
              1,
            ),
        )
      : 0;

  return (
    <DashboardShell
      title="Webhook & Pipeline Monitor"
      description="Suivi des webhooks RAG et de l'execution du pipeline content-refresh"
      breadcrumb={
        <span className="text-muted-foreground">
          Admin &gt; RAG &gt; Webhook Monitor
        </span>
      }
      kpis={
        <KpiGrid>
          <KpiCard
            title="Webhooks aujourd'hui"
            value={stats.today}
            icon={Zap}
            variant="info"
            subtitle={`${stats.total} sur 7j`}
          />
          <KpiCard
            title="Gammes refreshed"
            value={stats.gammesRefreshed}
            icon={RefreshCw}
            variant="success"
            subtitle={`${stats.bySource.web} web / ${stats.bySource.pdf} pdf`}
          />
          <KpiCard
            title="Success rate"
            value={`${stats.successRate}%`}
            icon={CheckCircle2}
            variant={
              stats.successRate >= 90
                ? "success"
                : stats.successRate >= 70
                  ? "warning"
                  : "danger"
            }
          />
          <KpiCard
            title="Qualite moyenne"
            value={avgQuality}
            icon={Activity}
            variant={
              avgQuality >= 70
                ? "success"
                : avgQuality >= 50
                  ? "warning"
                  : "danger"
            }
            subtitle={`${pipelineTotal} jobs total`}
          />
        </KpiGrid>
      }
    >
      <Tabs defaultValue="webhooks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="webhooks" className="gap-1.5">
            <Zap className="h-4 w-4" />
            Webhooks recents
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Activity className="h-4 w-4" />
            Pipeline runs
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Webhooks recents ── */}
        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Historique webhooks ({audit.total})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {audit.data.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucun webhook enregistre
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Job ID</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Gammes</TableHead>
                        <TableHead>Temps</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.data.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(item.received_at)}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[140px] truncate">
                            {item.job_id}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.source}</Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={webhookStatusToType(
                                item.status,
                                item.event_emitted,
                              )}
                              label={
                                item.event_emitted
                                  ? "Emis"
                                  : item.status === "failed"
                                    ? "Echec"
                                    : "Skip"
                              }
                              size="sm"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.gammes_detected.length > 0 ? (
                                item.gammes_detected.map((g) => (
                                  <Badge
                                    key={g}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {g}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  -
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {item.processing_ms != null ? (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {item.processing_ms}ms
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Pipeline runs ── */}
        <TabsContent value="pipeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Derniers jobs pipeline ({dashboard.recent.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucun job recent
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Gamme</TableHead>
                        <TableHead>Page type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.recent.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(item.created_at)}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {item.pg_alias}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.page_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={pipelineStatusToType(item.status)}
                              label={item.status}
                              size="sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={qualityBadgeVariant(item.quality_score)}
                              className="text-xs"
                            >
                              {item.quality_score ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.trigger_source || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
