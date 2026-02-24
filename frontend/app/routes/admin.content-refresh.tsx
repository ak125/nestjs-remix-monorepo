import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import {
  RefreshCw,
  Check,
  X,
  FileText,
  CheckCircle2,
  XCircle,
  SkipForward,
  Zap,
  Filter,
} from "lucide-react";
import { useState } from "react";
import { AdminDataTable, type DataColumn } from "~/components/admin/patterns";
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
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Select, SelectItem } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Content Refresh - Admin");

// UI-only thresholds for badge color coding (not the pipeline publication/advisory thresholds)
const QUALITY_THRESHOLDS = { good: 70, warning: 50 } as const;

// ── Types ──

interface DashboardData {
  counts: Record<string, number>;
  recent: RefreshItem[];
}

interface RefreshItem {
  id: number;
  pg_id: number;
  pg_alias: string;
  page_type: string;
  status: string;
  trigger_source: string;
  trigger_job_id: string;
  quality_score: number | null;
  quality_flags: string[] | null;
  error_message: string | null;
  bullmq_job_id: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

interface StatusResponse {
  data: RefreshItem[];
  total: number;
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookie };
  const url = new URL(request.url);

  // Read filter params
  const status = url.searchParams.get("status") || "";
  const pageType = url.searchParams.get("page_type") || "";
  const limit = url.searchParams.get("limit") || "50";
  const offset = url.searchParams.get("offset") || "0";

  // Build status query string
  const statusParams = new URLSearchParams();
  if (status) statusParams.set("status", status);
  if (pageType) statusParams.set("page_type", pageType);
  statusParams.set("limit", limit);
  statusParams.set("offset", offset);

  const [dashboardRes, statusRes] = await Promise.allSettled([
    fetch(
      getInternalApiUrlFromRequest(
        "/api/admin/content-refresh/dashboard",
        request,
      ),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/content-refresh/status?${statusParams.toString()}`,
        request,
      ),
      { headers },
    ),
  ]);

  const dashboard: DashboardData =
    dashboardRes.status === "fulfilled" && dashboardRes.value.ok
      ? await dashboardRes.value.json()
      : { counts: {}, recent: [] };

  const statusData: StatusResponse =
    statusRes.status === "fulfilled" && statusRes.value.ok
      ? await statusRes.value.json()
      : { data: [], total: 0 };

  return json({
    dashboard,
    items: statusData.data,
    total: statusData.total,
    filters: { status, pageType, limit: Number(limit), offset: Number(offset) },
  });
}

// ── Status mapping ──

const REFRESH_STATUS: Record<string, StatusType> = {
  pending: "PENDING",
  processing: "INFO",
  draft: "INFO",
  published: "PASS",
  failed: "FAIL",
  skipped: "NEUTRAL",
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  R1_pieces: "R1 Pieces",
  R3_conseils: "R3 Conseils",
  R3_guide_achat: "R3 Guide Achat",
  R4_reference: "R4 Reference",
  R5_diagnostic: "R5 Diagnostic",
};

// ── Helpers ──

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function QualityScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-sm text-muted-foreground">{"\u2014"}</span>;
  }

  let colorClass = "bg-red-100 text-red-800";
  if (score >= QUALITY_THRESHOLDS.good) {
    colorClass = "bg-green-100 text-green-800";
  } else if (score >= QUALITY_THRESHOLDS.warning) {
    colorClass = "bg-yellow-100 text-yellow-800";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 max-w-[60px]">
        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              score >= QUALITY_THRESHOLDS.good
                ? "bg-green-500"
                : score >= QUALITY_THRESHOLDS.warning
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>
      </div>
      <Badge variant="outline" className={`text-xs font-mono ${colorClass}`}>
        {score}
      </Badge>
    </div>
  );
}

// ── Actions component ──

function RefreshActions({
  item,
  onPublish,
  onReject,
  isLoading,
}: {
  item: RefreshItem;
  onPublish: () => void;
  onReject: () => void;
  isLoading: boolean;
}) {
  if (item.status !== "draft") return null;
  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
        onClick={onPublish}
        disabled={isLoading}
      >
        {isLoading ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        Publier
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
        onClick={onReject}
      >
        <X className="h-3 w-3" />
        Rejeter
      </Button>
    </div>
  );
}

// ── Main component ──

export default function AdminContentRefresh() {
  const { dashboard, items, total, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const refreshFetcher = useFetcher<typeof loader>();

  // Trigger form state
  const [triggerAlias, setTriggerAlias] = useState("");
  const [triggerSubmitting, setTriggerSubmitting] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{
    success?: boolean;
    error?: string;
    queued?: Array<{ pgAlias: string; pageTypes: string[] }>;
  } | null>(null);

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectItemId, setRejectItemId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Action state (publish)
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // ── Handlers ──

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset offset when changing filters
    if (key !== "offset") {
      params.delete("offset");
    }
    setSearchParams(params);
  }

  async function handleTrigger(e: React.FormEvent) {
    e.preventDefault();
    const alias = triggerAlias.trim();
    if (!alias) {
      setTriggerResult({ error: "Le pg_alias est requis" });
      return;
    }
    setTriggerSubmitting(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/admin/content-refresh/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pgAlias: alias }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTriggerResult({
          error: `Erreur ${res.status}: ${data.message || JSON.stringify(data)}`,
        });
      } else {
        setTriggerResult({ success: true, queued: data.queued });
        setTriggerAlias("");
      }
    } catch (err) {
      setTriggerResult({
        error: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setTriggerSubmitting(false);
      // Reload page data
      refreshFetcher.load(`/admin/content-refresh?${searchParams.toString()}`);
    }
  }

  async function handlePublish(id: number) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/content-refresh/${id}/publish`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`Erreur: ${data.error || data.message || "Publication echouee"}`);
      }
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
      refreshFetcher.load(`/admin/content-refresh?${searchParams.toString()}`);
    }
  }

  function openRejectDialog(id: number) {
    setRejectItemId(id);
    setRejectReason("");
    setRejectDialogOpen(true);
  }

  async function handleReject() {
    if (!rejectItemId || !rejectReason.trim()) return;
    setRejectSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/content-refresh/${rejectItemId}/reject`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`Erreur: ${data.error || data.message || "Rejet echoue"}`);
      }
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRejectSubmitting(false);
      setRejectDialogOpen(false);
      setRejectItemId(null);
      setRejectReason("");
      refreshFetcher.load(`/admin/content-refresh?${searchParams.toString()}`);
    }
  }

  // Use refreshed data if available
  const displayItems = refreshFetcher.data?.items ?? items;
  const displayTotal = refreshFetcher.data?.total ?? total;
  const displayDashboard = refreshFetcher.data?.dashboard ?? dashboard;
  const displayCounts = displayDashboard.counts;

  // Pagination
  const currentPage = Math.floor(filters.offset / filters.limit) + 1;

  // Column definitions
  const refreshColumns: DataColumn<RefreshItem>[] = [
    {
      key: "id",
      header: "ID",
      width: "w-16",
      render: (_val, row) => (
        <span className="font-mono text-xs">{String(row.id)}</span>
      ),
    },
    {
      key: "pg_alias",
      header: "Gamme",
      render: (_val, row) => (
        <span className="font-medium text-sm">{row.pg_alias}</span>
      ),
    },
    {
      key: "page_type",
      header: "Page Type",
      render: (_val, row) => (
        <Badge variant="outline" className="text-xs font-mono">
          {PAGE_TYPE_LABELS[row.page_type] || row.page_type}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (_val, row) => (
        <StatusBadge
          status={REFRESH_STATUS[row.status] || "NEUTRAL"}
          label={row.status}
          size="sm"
        />
      ),
    },
    {
      key: "quality_score",
      header: "Score",
      render: (_val, row) => <QualityScoreBadge score={row.quality_score} />,
    },
    {
      key: "quality_flags",
      header: "Flags",
      render: (_val, row) =>
        row.quality_flags && row.quality_flags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.quality_flags.slice(0, 3).map((flag) => (
              <Badge key={flag} variant="secondary" className="text-xs">
                {flag}
              </Badge>
            ))}
            {row.quality_flags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{row.quality_flags.length - 3}
              </Badge>
            )}
          </div>
        ) : row.error_message ? (
          <span
            className="text-xs text-red-600 max-w-[150px] truncate block"
            title={row.error_message}
          >
            {row.error_message.slice(0, 40)}
            {row.error_message.length > 40 ? "..." : ""}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">{"\u2014"}</span>
        ),
    },
    {
      key: "created_at",
      header: "Date",
      render: (_val, row) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: "updated_at",
      header: "Actions",
      align: "right" as const,
      render: (_val, row) => (
        <RefreshActions
          item={row}
          onPublish={() => handlePublish(row.id)}
          onReject={() => openRejectDialog(row.id)}
          isLoading={actionLoading === row.id}
        />
      ),
    },
  ];

  return (
    <DashboardShell
      title="Content Refresh"
      description="Pipeline de rafraichissement automatique du contenu SEO apres ingestion RAG"
      breadcrumb={
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <span>/</span>
          <Link to="/admin/seo" className="hover:text-foreground">
            SEO
          </Link>
          <span>/</span>
          <span className="text-foreground">Content Refresh</span>
        </div>
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            refreshFetcher.load(
              `/admin/content-refresh?${searchParams.toString()}`,
            )
          }
          className="gap-1.5"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshFetcher.state !== "idle" ? "animate-spin" : ""}`}
          />
          Rafraichir
        </Button>
      }
      kpis={
        <KpiGrid columns={4}>
          <KpiCard
            title="Draft"
            value={displayCounts.draft || 0}
            icon={FileText}
            variant="info"
          />
          <KpiCard
            title="Published"
            value={
              (displayCounts.published || 0) +
              (displayCounts.auto_published || 0)
            }
            icon={CheckCircle2}
            variant="success"
          />
          <KpiCard
            title="Skipped (no RAG)"
            value={displayCounts.skipped || 0}
            icon={SkipForward}
            variant="default"
          />
          <KpiCard
            title="Failed"
            value={displayCounts.failed || 0}
            icon={XCircle}
            variant="danger"
          />
        </KpiGrid>
      }
    >
      {/* Manual Trigger Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Declenchement manuel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleTrigger}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1">
              <label
                htmlFor="triggerAlias"
                className="text-sm font-medium text-foreground"
              >
                pg_alias de la gamme
              </label>
              <Input
                id="triggerAlias"
                name="triggerAlias"
                placeholder="disque-frein, plaquette-frein, filtre-a-huile..."
                value={triggerAlias}
                onChange={(e) => setTriggerAlias(e.target.value)}
                disabled={triggerSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Declenche le rafraichissement de contenu pour toutes les pages
                associees a cette gamme (R1, R3, R4).
              </p>
            </div>
            <Button
              type="submit"
              disabled={triggerSubmitting}
              className="gap-1.5"
            >
              {triggerSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {triggerSubmitting ? "En cours..." : "Declencher Refresh"}
            </Button>
          </form>

          {/* Trigger result banner */}
          {triggerResult?.error && (
            <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {triggerResult.error}
            </div>
          )}
          {triggerResult?.success && triggerResult.queued && (
            <div className="mt-3 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
              <p className="font-medium">Refresh declenche avec succes</p>
              <ul className="mt-1 list-disc list-inside">
                {triggerResult.queued.map((q) => (
                  <li key={q.pgAlias}>
                    <span className="font-mono">{q.pgAlias}</span>
                    {" \u2192 "}
                    {q.pageTypes.length > 0
                      ? q.pageTypes.join(", ")
                      : "aucun type de page"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1 sm:w-48">
              <label
                htmlFor="filterStatus"
                className="text-xs font-medium text-muted-foreground"
              >
                Status
              </label>
              <Select
                name="filterStatus"
                value={filters.status}
                onValueChange={(v) => updateFilter("status", v)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <SelectItem value="">Tous</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </Select>
            </div>
            <div className="space-y-1 sm:w-48">
              <label
                htmlFor="filterPageType"
                className="text-xs font-medium text-muted-foreground"
              >
                Page Type
              </label>
              <Select
                name="filterPageType"
                value={filters.pageType}
                onValueChange={(v) => updateFilter("page_type", v)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <SelectItem value="">Tous</SelectItem>
                <SelectItem value="R1_pieces">R1 Pieces</SelectItem>
                <SelectItem value="R3_conseils">R3 Conseils</SelectItem>
                <SelectItem value="R3_guide_achat">R3 Guide Achat</SelectItem>
                <SelectItem value="R4_reference">R4 Reference</SelectItem>
                <SelectItem value="R5_diagnostic">R5 Diagnostic</SelectItem>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Badge variant="secondary" className="h-9 px-3">
                {displayTotal} resultat{displayTotal !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <AdminDataTable<RefreshItem>
        data={displayItems as RefreshItem[]}
        columns={refreshColumns}
        getRowKey={(row) => String(row.id)}
        emptyMessage="Aucun element de refresh trouve"
        statusColumn={{ key: "status", mapping: REFRESH_STATUS }}
        isLoading={refreshFetcher.state !== "idle"}
        serverPagination={{
          total: displayTotal,
          page: currentPage,
          pageSize: filters.limit,
          onPageChange: (page) =>
            updateFilter(
              "offset",
              page > 1 ? String((page - 1) * filters.limit) : "",
            ),
        }}
        toolbar={<span className="text-sm font-medium">Refresh Log</span>}
      />

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le draft</DialogTitle>
            <DialogDescription>
              Indiquez la raison du rejet. Le contenu sera marque comme echoue
              et ne sera pas publie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Raison du rejet (qualite insuffisante, contenu inexact, etc.)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              disabled={rejectSubmitting}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejectSubmitting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectSubmitting || !rejectReason.trim()}
              className="gap-1.5"
            >
              {rejectSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {rejectSubmitting ? "En cours..." : "Confirmer le rejet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
