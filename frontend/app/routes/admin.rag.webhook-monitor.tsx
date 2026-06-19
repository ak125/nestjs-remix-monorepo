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

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookie };

  const [statsRes, auditRes] = await Promise.allSettled([
    fetch(
      getInternalApiUrlFromRequest("/api/rag/admin/webhook-stats?days=7", request),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest(
        "/api/rag/admin/webhook-audit?limit=30",
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

  return json({ stats, audit: auditData });
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

// ── Component ──

export default function WebhookMonitorPage() {
  const { stats, audit } = useLoaderData<typeof loader>();

  return (
    <DashboardShell
      title="Webhook Monitor"
      description="Suivi des webhooks d'ingestion RAG (chatbot)"
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
            title="Temps moyen"
            value={`${stats.avgProcessingMs}ms`}
            icon={Activity}
            variant="info"
            subtitle="traitement webhook"
          />
        </KpiGrid>
      }
    >
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
    </DashboardShell>
  );
}
