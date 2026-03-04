import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useRevalidator,
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
  RotateCcw,
  ShieldCheck,
  FileSearch,
  Activity,
  Info,
  MoreHorizontal,
  FlaskConical,
  Database,
  Fingerprint,
  BarChart3,
  Trash2,
  Wrench,
  Globe,
  Clock,
  Layers,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminDataTable } from "~/components/admin/patterns/AdminDataTable";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import { type DataColumn } from "~/components/admin/patterns/ResponsiveDataTable";
import {
  StatusBadge,
  type StatusType,
} from "~/components/admin/patterns/StatusBadge";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Select, SelectItem } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Pipeline RAG - Admin");

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
  evidence_pack?: unknown | null;
  evidence_pack_hash?: string | null;
  hard_gate_results?: string | null;
}

interface StatusResponse {
  data: RefreshItem[];
  total: number;
}

interface GateResult {
  gate: string;
  verdict: "PASS" | "WARN" | "FAIL";
  measured: number;
  details?: string[];
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookie };
  const url = new URL(request.url);

  const status = url.searchParams.get("status") || "";
  const pageType = url.searchParams.get("page_type") || "";
  const pgAlias = url.searchParams.get("pg_alias") || "";
  const limit = url.searchParams.get("limit") || "50";
  const offset = url.searchParams.get("offset") || "0";

  const statusParams = new URLSearchParams();
  if (status) statusParams.set("status", status);
  if (pageType) statusParams.set("page_type", pageType);
  if (pgAlias) statusParams.set("pg_alias", pgAlias);
  statusParams.set("limit", limit);
  statusParams.set("offset", offset);

  const [dashboardRes, statusRes, coverageRes, r1CoverageRes] =
    await Promise.allSettled([
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
      fetch(
        getInternalApiUrlFromRequest(
          "/api/admin/content-refresh/rag-coverage-summary",
          request,
        ),
        { headers },
      ),
      fetch(
        getInternalApiUrlFromRequest(
          "/api/admin/content-refresh/r1-coverage",
          request,
        ),
        { headers },
      ),
    ]);

  const dashboardRaw =
    dashboardRes.status === "fulfilled" && dashboardRes.value.ok
      ? await dashboardRes.value.json()
      : null;
  const dashboard: DashboardData = dashboardRaw?.data ??
    dashboardRaw ?? { counts: {}, recent: [] };

  const statusData: StatusResponse =
    statusRes.status === "fulfilled" && statusRes.value.ok
      ? await statusRes.value.json()
      : { data: [], total: 0 };

  const ragCoverage: {
    gammesCovered?: number;
    totalGammes?: number;
    ragCoveragePercent?: number;
    webContentSources?: number;
    recentIngestionJobs?: number;
  } =
    coverageRes.status === "fulfilled" && coverageRes.value.ok
      ? await coverageRes.value.json()
      : {};

  const r1Coverage: {
    sections?: Array<{
      section: string;
      pipeline: number;
      fallback: number;
      total: number;
    }>;
  } =
    r1CoverageRes.status === "fulfilled" && r1CoverageRes.value.ok
      ? await r1CoverageRes.value.json()
      : {};

  return json({
    dashboard,
    items: statusData.data,
    total: statusData.total,
    ragCoverage,
    r1Coverage,
    filters: {
      status,
      pageType,
      pgAlias,
      limit: Number(limit),
      offset: Number(offset),
    },
  });
}

// ── Mappings ──

const REFRESH_STATUS: Record<string, StatusType> = {
  pending: "PENDING",
  processing: "INFO",
  draft: "INFO",
  published: "PASS",
  auto_published: "PASS",
  failed: "FAIL",
  skipped: "NEUTRAL",
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  R1_pieces: "R1 Pieces",
  R3_conseils: "R3 Conseils",
  R3_guide_achat: "R3 Guide",
  R4_reference: "R4 Reference",
  R5_diagnostic: "R5 Diagnostic",
};

const PAGE_TYPE_OPTIONS = [
  { value: "R1_pieces", label: "R1 Pieces" },
  { value: "R3_conseils", label: "R3 Conseils" },
  { value: "R3_guide_achat", label: "R3 Guide Achat" },
  { value: "R4_reference", label: "R4 Reference" },
  { value: "R6_guide_achat", label: "R6 Guide Achat" },
] as const;

const GATE_LABELS: Record<string, string> = {
  attribution: "Attribution des sources",
  no_guess: "Pas de supposition",
  scope_leakage: "Hors sujet",
  contradiction: "Contradiction",
  seo_integrity: "Integrite SEO",
  missing_og_image: "Image OG manquante",
  missing_hero_policy_match: "Hero policy non respectee",
  missing_alt_text: "Alt text manquant",
};

const GATE_VERDICT_STATUS: Record<string, StatusType> = {
  PASS: "PASS",
  WARN: "WARN",
  FAIL: "FAIL",
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

  const colorClass =
    score >= 70
      ? "bg-green-100 text-green-800"
      : score >= 50
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  const progressClass =
    score >= 70
      ? "[&>div]:bg-green-500"
      : score >= 50
        ? "[&>div]:bg-yellow-500"
        : "[&>div]:bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <Progress
        value={score}
        max={100}
        className={`h-1.5 max-w-[60px] flex-1 ${progressClass}`}
      />
      <Badge variant="outline" className={`font-mono text-xs ${colorClass}`}>
        {score}
      </Badge>
    </div>
  );
}

function parseGateResults(raw: string | null | undefined): GateResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function GatesSummary({ raw }: { raw: string | null | undefined }) {
  const gates = parseGateResults(raw);
  if (gates.length === 0) {
    return <span className="text-xs text-muted-foreground">{"\u2014"}</span>;
  }

  const failCount = gates.filter((g) => g.verdict === "FAIL").length;
  const warnCount = gates.filter((g) => g.verdict === "WARN").length;
  const passCount = gates.filter((g) => g.verdict === "PASS").length;

  return (
    <div className="flex items-center gap-1">
      {passCount > 0 && (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 text-xs px-1.5"
        >
          {passCount}
        </Badge>
      )}
      {warnCount > 0 && (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 text-xs px-1.5"
        >
          {warnCount}
        </Badge>
      )}
      {failCount > 0 && (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 text-xs px-1.5"
        >
          {failCount}
        </Badge>
      )}
    </div>
  );
}

// ── Pipeline Actions ──

function PipelineActions({
  item,
  onViewGates,
  onViewEvidence,
  onPublish,
  onReject,
  onRetry,
  retrying,
}: {
  item: RefreshItem;
  onViewGates: () => void;
  onViewEvidence: () => void;
  onPublish: () => void;
  onReject: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const gates = parseGateResults(item.hard_gate_results);
  const hasEvidence =
    item.evidence_pack !== null && item.evidence_pack !== undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {gates.length > 0 && (
          <DropdownMenuItem onClick={onViewGates}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Voir controles
          </DropdownMenuItem>
        )}
        {hasEvidence && (
          <DropdownMenuItem onClick={onViewEvidence}>
            <FileSearch className="h-4 w-4 mr-2" />
            Voir sources
          </DropdownMenuItem>
        )}
        {item.status === "draft" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-green-700" onClick={onPublish}>
              <Check className="h-4 w-4 mr-2" />
              Publier
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-700" onClick={onReject}>
              <X className="h-4 w-4 mr-2" />
              Rejeter
            </DropdownMenuItem>
          </>
        )}
        {item.status === "failed" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onRetry}
              disabled={retrying}
              className="text-orange-700"
            >
              <RotateCcw
                className={`h-4 w-4 mr-2 ${retrying ? "animate-spin" : ""}`}
              />
              {retrying ? "Relance..." : "Relancer"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main component ──

export default function AdminRagPipeline() {
  const { dashboard, items, total, ragCoverage, r1Coverage, filters } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();

  // Trigger form state
  const [triggerAlias, setTriggerAlias] = useState("");
  const [triggerForce, setTriggerForce] = useState(false);
  const [triggerPageTypes, setTriggerPageTypes] = useState<string[]>([]);
  const [triggerSubmitting, setTriggerSubmitting] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{
    success?: boolean;
    error?: string;
    queued?: Array<{ pgAlias: string; pageTypes: string[] }>;
  } | null>(null);

  // Force-enrich state
  const [enrichAlias, setEnrichAlias] = useState("");
  const [enrichSections, setEnrichSections] = useState("");
  const [enrichSubmitting, setEnrichSubmitting] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{
    success?: boolean;
    error?: string;
    queuedPageTypes?: string[];
  } | null>(null);

  // Operations state
  const [cleanupMode, setCleanupMode] = useState<"dry" | "commit">("dry");
  const [cleanupSubmitting, setCleanupSubmitting] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [syncPattern, setSyncPattern] = useState("gammes/*.md");
  const [syncSubmitting, setSyncSubmitting] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [backfillSubmitting, setBackfillSubmitting] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{
    updated?: number;
    error?: string;
  } | null>(null);
  const [qualitySubmitting, setQualitySubmitting] = useState(false);
  const [qualityResult, setQualityResult] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Retry state
  const [retryingId, setRetryingId] = useState<number | null>(null);

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectItemId, setRejectItemId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<RefreshItem | null>(null);
  const [detailTab, setDetailTab] = useState<string>("gates");

  // Snapshot state
  const [snapshotData, setSnapshotData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // Publish confirmation dialog
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishItemId, setPublishItemId] = useState<number | null>(null);

  const displayCounts = dashboard.counts;

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;

  // ── Handlers ──

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "offset") params.delete("offset");
    setSearchParams(params);
  }

  async function handleTrigger(e: React.FormEvent) {
    e.preventDefault();
    const raw = triggerAlias.trim();
    if (!raw) {
      setTriggerResult({ error: "Le nom de la gamme est requis" });
      return;
    }
    const aliases = raw
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    setTriggerSubmitting(true);
    setTriggerResult(null);
    try {
      const body: Record<string, unknown> = {
        ...(aliases.length === 1
          ? { pgAlias: aliases[0] }
          : { pgAliases: aliases }),
        ...(triggerForce ? { force: true } : {}),
        ...(triggerPageTypes.length > 0 ? { pageTypes: triggerPageTypes } : {}),
      };
      const res = await fetch("/api/admin/content-refresh/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setTriggerResult({
          error: `Erreur ${res.status}: ${data.message || JSON.stringify(data)}`,
        });
      } else {
        setTriggerResult({ success: true, queued: data.queued });
        setTriggerAlias("");
        setTriggerPageTypes([]);
      }
    } catch (err) {
      setTriggerResult({
        error: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setTriggerSubmitting(false);
      revalidator.revalidate();
    }
  }

  async function handleForceEnrich(e: React.FormEvent) {
    e.preventDefault();
    const alias = enrichAlias.trim();
    if (!alias) {
      setEnrichResult({ error: "Le nom de la gamme est requis" });
      return;
    }
    const sectionsFilter = enrichSections.trim()
      ? enrichSections
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    setEnrichSubmitting(true);
    setEnrichResult(null);
    try {
      const res = await fetch("/api/admin/rag/pdf-merge/force-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pgAlias: alias,
          ...(sectionsFilter ? { sectionsFilter } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEnrichResult({
          error: `Erreur ${res.status}: ${data.message || JSON.stringify(data)}`,
        });
      } else {
        toast.success(`Force-enrich lance pour "${alias}"`);
        setEnrichResult({
          success: true,
          queuedPageTypes: data.queuedPageTypes,
        });
        setEnrichAlias("");
        setEnrichSections("");
      }
    } catch (err) {
      setEnrichResult({
        error: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setEnrichSubmitting(false);
      revalidator.revalidate();
    }
  }

  async function handleCleanupBatch() {
    setCleanupSubmitting(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/rag/admin/cleanup/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: cleanupMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Erreur cleanup: ${data.message || res.status}`);
      } else {
        toast.success(
          `Cleanup ${cleanupMode === "dry" ? "(dry-run)" : "(commit)"} termine`,
        );
        setCleanupResult(data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setCleanupSubmitting(false);
    }
  }

  async function handleSyncFiles() {
    if (!syncPattern.trim()) return;
    setSyncSubmitting(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/rag/admin/cleanup/sync-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: syncPattern.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Erreur sync: ${data.message || res.status}`);
      } else {
        toast.success(`Sync termine : ${data.synced ?? 0} fichiers`);
        setSyncResult(data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncSubmitting(false);
    }
  }

  async function handleBackfillFingerprints() {
    setBackfillSubmitting(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/rag/admin/cleanup/backfill-fingerprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 50 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Erreur backfill: ${data.message || res.status}`);
        setBackfillResult({ error: data.message || String(res.status) });
      } else {
        toast.success(`${data.updated ?? 0} empreintes calculees`);
        setBackfillResult({ updated: data.updated });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBackfillSubmitting(false);
    }
  }

  async function handleComputeQualityScores() {
    setQualitySubmitting(true);
    setQualityResult(null);
    try {
      const res = await fetch(
        "/api/admin/content-refresh/compute-quality-scores",
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Erreur scores: ${data.message || res.status}`);
      } else {
        toast.success(
          `Scores calcules : ${data.pagesScored ?? 0} pages, ${data.gammesAggregated ?? 0} gammes`,
        );
        setQualityResult(data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setQualitySubmitting(false);
    }
  }

  function openPublishDialog(id: number) {
    setPublishItemId(id);
    setPublishDialogOpen(true);
  }

  async function confirmPublish() {
    if (!publishItemId) return;
    setPublishDialogOpen(false);
    const itemId = publishItemId;
    setPublishItemId(null);
    try {
      const res = await fetch(`/api/admin/content-refresh/${itemId}/publish`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || data.message || "Publication echouee");
      } else {
        toast.success("Brouillon publie avec succes");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      revalidator.revalidate();
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
        toast.error(data.error || data.message || "Rejet echoue");
      } else {
        toast.success("Brouillon rejete");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRejectSubmitting(false);
      setRejectDialogOpen(false);
      setRejectItemId(null);
      setRejectReason("");
      revalidator.revalidate();
    }
  }

  function openDetailDialog(item: RefreshItem, tab: string) {
    setDetailItem(item);
    setDetailTab(tab);
    setSnapshotData(null);
    setDetailDialogOpen(true);
  }

  async function handleRetry(item: RefreshItem) {
    setRetryingId(item.id);
    try {
      const res = await fetch("/api/admin/content-refresh/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pgAlias: item.pg_alias,
          force: true,
          pageTypes: [item.page_type],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Erreur relance: ${data.message || res.status}`);
      } else {
        toast.success(
          `Relance lancee pour ${item.pg_alias} (${item.page_type})`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRetryingId(null);
      revalidator.revalidate();
    }
  }

  // ── Column definitions ──
  const pipelineColumns: DataColumn<RefreshItem>[] = [
    {
      key: "id",
      header: "ID",
      width: "64px",
      render: (val) => <span className="font-mono text-xs">{String(val)}</span>,
    },
    {
      key: "pg_alias",
      header: "Gamme",
      render: (val) => (
        <span className="text-sm font-medium">{String(val)}</span>
      ),
    },
    {
      key: "page_type",
      header: "Type",
      render: (val) => (
        <Badge variant="outline" className="font-mono text-xs">
          {PAGE_TYPE_LABELS[val as string] || String(val)}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Statut",
    },
    {
      key: "quality_score",
      header: "Qualite",
      render: (val) => <QualityScoreBadge score={val as number | null} />,
    },
    {
      key: "hard_gate_results",
      header: "Controles",
      render: (val, row) => {
        const gates = parseGateResults(val as string | null);
        if (gates.length === 0) {
          return (
            <span className="text-xs text-muted-foreground">{"\u2014"}</span>
          );
        }
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1"
              onClick={() => openDetailDialog(row as RefreshItem, "gates")}
            >
              <GatesSummary raw={val as string | null} />
            </Button>
          </div>
        );
      },
    },
    {
      key: "evidence_pack_hash",
      header: "Sources",
      render: (val, row) => {
        const hasEvidence =
          (row as RefreshItem).evidence_pack !== null &&
          (row as RefreshItem).evidence_pack !== undefined;
        if (!hasEvidence) {
          return (
            <span className="text-xs text-muted-foreground">{"\u2014"}</span>
          );
        }
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
              onClick={() => openDetailDialog(row as RefreshItem, "evidence")}
            >
              <FileSearch className="h-3 w-3" />
              {val ? String(val).slice(0, 8) : "voir"}
            </Button>
          </div>
        );
      },
    },
    {
      key: "created_at",
      header: "Date",
      render: (val) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(val as string | null)}
        </span>
      ),
    },
    {
      key: "updated_at",
      header: "Actions",
      align: "right" as const,
      render: (_val, row) => (
        <PipelineActions
          item={row as RefreshItem}
          onViewGates={() => openDetailDialog(row as RefreshItem, "gates")}
          onViewEvidence={() =>
            openDetailDialog(row as RefreshItem, "evidence")
          }
          onPublish={() => openPublishDialog((row as RefreshItem).id)}
          onReject={() => openRejectDialog((row as RefreshItem).id)}
          onRetry={() => handleRetry(row as RefreshItem)}
          retrying={retryingId === (row as RefreshItem).id}
        />
      ),
    },
  ];

  return (
    <DashboardShell
      title="Enrichissement contenu"
      description="Generation automatique de contenu SEO a partir du corpus RAG"
      breadcrumb={
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <span>/</span>
          <Link to="/admin/rag" className="hover:text-foreground">
            RAG
          </Link>
          <span>/</span>
          <span className="text-foreground">Pipeline</span>
        </div>
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => revalidator.revalidate()}
          className="gap-1.5"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${revalidator.state !== "idle" ? "animate-spin" : ""}`}
          />
          Rafraichir
        </Button>
      }
      kpis={
        <div className="space-y-3">
          <KpiGrid columns={4}>
            <KpiCard
              title="Brouillons"
              value={displayCounts.draft || 0}
              icon={FileText}
              variant="info"
            />
            <KpiCard
              title="Publies"
              value={
                (displayCounts.published || 0) +
                (displayCounts.auto_published || 0)
              }
              icon={CheckCircle2}
              variant="success"
            />
            <KpiCard
              title="Ignores"
              value={displayCounts.skipped || 0}
              icon={SkipForward}
              variant="default"
            />
            <KpiCard
              title="Echoues"
              value={displayCounts.failed || 0}
              icon={XCircle}
              variant="danger"
            />
          </KpiGrid>
          <KpiGrid columns={4}>
            <KpiCard
              title="Gammes couvertes"
              value={`${ragCoverage.gammesCovered ?? 0} / ${ragCoverage.totalGammes ?? 0}`}
              icon={Layers}
              variant="default"
            />
            <KpiCard
              title="Coverage RAG"
              value={`${ragCoverage.ragCoveragePercent ?? 0}%`}
              icon={BarChart3}
              variant={
                (ragCoverage.ragCoveragePercent ?? 0) >= 70
                  ? "success"
                  : (ragCoverage.ragCoveragePercent ?? 0) >= 40
                    ? "warning"
                    : "danger"
              }
            />
            <KpiCard
              title="Sources web"
              value={ragCoverage.webContentSources ?? 0}
              icon={Globe}
              variant="info"
            />
            <KpiCard
              title="Jobs recents 24h"
              value={ragCoverage.recentIngestionJobs ?? 0}
              icon={Clock}
              variant="default"
            />
          </KpiGrid>
          {r1Coverage.sections && r1Coverage.sections.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4" />
                R1 Pipeline Coverage
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Section</th>
                      <th className="pb-2 pr-4 text-right">Pipeline</th>
                      <th className="pb-2 pr-4 text-right">Fallback</th>
                      <th className="pb-2 pr-4 text-right">Total</th>
                      <th className="pb-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r1Coverage.sections.map((s) => {
                      const pct =
                        s.total > 0
                          ? Math.round((s.pipeline / s.total) * 100)
                          : 0;
                      return (
                        <tr key={s.section} className="border-b last:border-0">
                          <td className="py-1.5 pr-4 font-mono text-xs">
                            {s.section}
                          </td>
                          <td className="py-1.5 pr-4 text-right font-medium">
                            {s.pipeline}
                          </td>
                          <td className="py-1.5 pr-4 text-right text-muted-foreground">
                            {s.fallback}
                          </td>
                          <td className="py-1.5 pr-4 text-right">{s.total}</td>
                          <td className="py-1.5 text-right">
                            <span
                              className={
                                pct >= 70
                                  ? "text-green-600"
                                  : pct >= 30
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              }
                            >
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      }
    >
      {/* Guide */}
      <Alert
        variant="info"
        icon={<Info className="h-4 w-4" />}
        title="Enrichissement automatique du contenu"
      >
        <AlertDescription>
          <ol className="list-decimal list-inside space-y-1 mt-1">
            <li>
              Entrez le nom d&apos;une gamme (ex:{" "}
              <code className="rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">
                disque-de-frein
              </code>
              ) pour lancer l&apos;enrichissement
            </li>
            <li>
              Consultez les resultats : controles qualite et sources utilisees
            </li>
            <li>Publiez les brouillons valides sur le site</li>
          </ol>
        </AlertDescription>
      </Alert>

      {/* Lancer un enrichissement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4" />
            Lancer un enrichissement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTrigger} className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="triggerAlias">
                  Gamme(s) — separer par virgule pour batch
                </Label>
                <Input
                  id="triggerAlias"
                  name="triggerAlias"
                  placeholder="disque-de-frein, plaquette-frein, filtre-a-huile"
                  value={triggerAlias}
                  onChange={(e) => setTriggerAlias(e.target.value)}
                  disabled={triggerSubmitting}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={triggerForce}
                  onChange={(e) => setTriggerForce(e.target.checked)}
                  disabled={triggerSubmitting}
                  className="rounded border-gray-300"
                />
                Forcer
              </label>
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
                {triggerSubmitting ? "En cours..." : "Lancer"}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Types de page (vide = tous les types actifs)
              </Label>
              <div className="flex flex-wrap gap-3">
                {PAGE_TYPE_OPTIONS.map(({ value, label }) => (
                  <Checkbox
                    key={value}
                    id={`pt-${value}`}
                    checked={triggerPageTypes.includes(value)}
                    onCheckedChange={(checked) => {
                      setTriggerPageTypes((prev) =>
                        checked
                          ? [...prev, value]
                          : prev.filter((t) => t !== value),
                      );
                    }}
                    disabled={triggerSubmitting}
                    label={label}
                  />
                ))}
              </div>
            </div>
          </form>

          {triggerResult?.error && (
            <Alert variant="error" className="mt-3" size="sm">
              {triggerResult.error}
            </Alert>
          )}
          {triggerResult?.success && triggerResult.queued && (
            <Alert variant="success" className="mt-3" size="sm">
              <AlertTitle>Enrichissement lance</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-inside list-disc">
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
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Force-enrich sans PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="h-4 w-4 text-orange-500" />
            Force-enrich sans PDF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Lance un enrichissement force a partir du corpus RAG existant, sans
            extraction PDF. Utile pour regenerer le contenu apres mise a jour du
            corpus.
          </p>
          <form
            onSubmit={handleForceEnrich}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="enrichAlias">Gamme</Label>
              <Input
                id="enrichAlias"
                placeholder="disque-de-frein"
                value={enrichAlias}
                onChange={(e) => setEnrichAlias(e.target.value)}
                disabled={enrichSubmitting}
              />
            </div>
            <div className="sm:w-56 space-y-1.5">
              <Label htmlFor="enrichSections">
                Sections (optionnel, virgule)
              </Label>
              <Input
                id="enrichSections"
                placeholder="introduction, symptomes"
                value={enrichSections}
                onChange={(e) => setEnrichSections(e.target.value)}
                disabled={enrichSubmitting}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={enrichSubmitting}
              className="gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              {enrichSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              {enrichSubmitting ? "En cours..." : "Force-enrich"}
            </Button>
          </form>

          {enrichResult?.error && (
            <Alert variant="error" className="mt-3" size="sm">
              {enrichResult.error}
            </Alert>
          )}
          {enrichResult?.success && (
            <Alert variant="success" className="mt-3" size="sm">
              <AlertTitle>Enrichissement lance</AlertTitle>
              <AlertDescription>
                Types mis en queue :{" "}
                {enrichResult.queuedPageTypes?.join(", ") || "aucun"}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Operations de maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4" />
            Operations de maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Cleanup doublons */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Cleanup doublons</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Scan SHA-256 pour detecter et supprimer les doublons exacts.
              </p>
              <div className="flex items-center gap-2">
                <Select
                  value={cleanupMode}
                  onValueChange={(v) => setCleanupMode(v as "dry" | "commit")}
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                  disabled={cleanupSubmitting}
                  name="cleanupMode"
                >
                  <SelectItem value="dry">Dry-run (simulation)</SelectItem>
                  <SelectItem value="commit">
                    Commit (suppression reelle)
                  </SelectItem>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCleanupBatch}
                  disabled={cleanupSubmitting}
                  className={`gap-1.5 ${cleanupMode === "commit" ? "border-red-200 text-red-700 hover:bg-red-50" : ""}`}
                >
                  {cleanupSubmitting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {cleanupSubmitting ? "..." : "Lancer"}
                </Button>
              </div>
              {cleanupResult && (
                <pre className="rounded bg-muted/50 p-2 text-xs font-mono max-h-24 overflow-auto">
                  {JSON.stringify(cleanupResult, null, 2)}
                </pre>
              )}
            </div>

            {/* Sync fichiers → DB */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Sync fichiers &rarr; DB
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Synchronise les fichiers .md du disque vers __rag_knowledge.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={syncPattern}
                  onChange={(e) => setSyncPattern(e.target.value)}
                  placeholder="gammes/*.md"
                  disabled={syncSubmitting}
                  className="h-8 flex-1 text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncFiles}
                  disabled={syncSubmitting}
                  className="gap-1.5"
                >
                  {syncSubmitting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Database className="h-3.5 w-3.5" />
                  )}
                  {syncSubmitting ? "..." : "Sync"}
                </Button>
              </div>
              {syncResult && (
                <div className="flex gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700"
                  >
                    {(syncResult as { synced?: number }).synced ?? 0} sync
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    {(syncResult as { skipped?: number }).skipped ?? 0} skip
                  </Badge>
                </div>
              )}
            </div>

            {/* Backfill empreintes SHA-256 */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Backfill empreintes SHA-256
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Calcule les empreintes manquantes pour les documents actifs
                (batch 50).
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackfillFingerprints}
                disabled={backfillSubmitting}
                className="gap-1.5"
              >
                {backfillSubmitting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Fingerprint className="h-3.5 w-3.5" />
                )}
                {backfillSubmitting ? "En cours..." : "Backfill"}
              </Button>
              {backfillResult && !backfillResult.error && (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {backfillResult.updated} empreintes calculees
                </Badge>
              )}
              {backfillResult?.error && (
                <p className="text-xs text-red-600">{backfillResult.error}</p>
              )}
            </div>

            {/* Calculer scores qualite */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Calculer scores qualite
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Recalcule les scores qualite de toutes les gammes et agrege vers
                gamme-level.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleComputeQualityScores}
                disabled={qualitySubmitting}
                className="gap-1.5"
              >
                {qualitySubmitting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BarChart3 className="h-3.5 w-3.5" />
                )}
                {qualitySubmitting ? "En cours..." : "Calculer"}
              </Button>
              {qualityResult && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    {(qualityResult as { pagesScored?: number }).pagesScored ??
                      0}{" "}
                    pages
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-purple-50 text-purple-700"
                  >
                    {(qualityResult as { gammesAggregated?: number })
                      .gammesAggregated ?? 0}{" "}
                    gammes
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 sm:w-48">
              <Label htmlFor="filterStatus">Statut</Label>
              <Select
                name="filterStatus"
                value={filters.status}
                onValueChange={(v) => updateFilter("status", v)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <SelectItem value="">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="processing">En cours</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="published">Publie</SelectItem>
                <SelectItem value="auto_published">Auto-publie</SelectItem>
                <SelectItem value="failed">Echoue</SelectItem>
                <SelectItem value="skipped">Ignore</SelectItem>
              </Select>
            </div>
            <div className="space-y-1.5 sm:w-48">
              <Label htmlFor="filterPageType">Type de page</Label>
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
            <div className="space-y-1.5 sm:w-52">
              <Label htmlFor="filterAlias">Gamme</Label>
              <Input
                id="filterAlias"
                placeholder="balais-d-essuie-glace..."
                defaultValue={filters.pgAlias}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    updateFilter("pg_alias", e.currentTarget.value);
                }}
              />
            </div>
            <Badge variant="secondary" className="h-9 px-3">
              {total} resultat{total !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Historique */}
      <AdminDataTable<RefreshItem>
        data={items as RefreshItem[]}
        columns={pipelineColumns}
        getRowKey={(r) => String(r.id)}
        emptyMessage="Aucun enrichissement trouve"
        statusColumn={{ key: "status", mapping: REFRESH_STATUS }}
        isLoading={revalidator.state !== "idle"}
        serverPagination={{
          total,
          page: currentPage,
          pageSize: filters.limit,
          onPageChange: (page) =>
            updateFilter(
              "offset",
              page > 1 ? String((page - 1) * filters.limit) : "",
            ),
        }}
        toolbar={
          <div className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" />
            Historique
          </div>
        }
      />

      {/* AlertDialog de publication */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publier ce brouillon ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le contenu enrichi sera publie sur le site. Cette action est
              irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={confirmPublish}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Publier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de rejet */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le brouillon</DialogTitle>
            <DialogDescription>
              Indiquez la raison du rejet. Le contenu ne sera pas publie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="rejectReason">Raison du rejet</Label>
            <Textarea
              id="rejectReason"
              placeholder="Qualite insuffisante, contenu inexact, hors sujet..."
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

      {/* Dialog detail : Controles qualite / Sources RAG */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailItem?.pg_alias} —{" "}
              {detailTab === "gates"
                ? "Controles qualite"
                : detailTab === "snapshot"
                  ? "Snapshot"
                  : "Sources RAG"}
            </DialogTitle>
            <DialogDescription>
              {detailTab === "gates"
                ? "Resultats des 5 controles automatiques pour cet enrichissement"
                : detailTab === "snapshot"
                  ? "Scores avant/apres et dimensions de qualite"
                  : "Documents du corpus RAG utilises pour generer le contenu"}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={detailTab}
            onValueChange={(tab) => {
              setDetailTab(tab);
              if (tab === "snapshot" && detailItem && !snapshotData) {
                setSnapshotLoading(true);
                fetch(`/api/admin/content-refresh/snapshot/${detailItem.id}`)
                  .then((r) => (r.ok ? r.json() : null))
                  .then((d) => setSnapshotData(d))
                  .catch(() => setSnapshotData(null))
                  .finally(() => setSnapshotLoading(false));
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="gates" className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Controles qualite
              </TabsTrigger>
              <TabsTrigger value="evidence" className="gap-1.5">
                <FileSearch className="h-3.5 w-3.5" />
                Sources RAG
              </TabsTrigger>
              <TabsTrigger value="snapshot" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Snapshot
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gates">
              {detailItem &&
              parseGateResults(detailItem.hard_gate_results).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Aucun controle disponible
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Controle</TableHead>
                      <TableHead>Resultat</TableHead>
                      <TableHead>Mesure</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItem &&
                      parseGateResults(detailItem.hard_gate_results).map(
                        (gate) => (
                          <TableRow key={gate.gate}>
                            <TableCell className="text-sm font-medium">
                              {GATE_LABELS[gate.gate] || gate.gate}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                status={
                                  GATE_VERDICT_STATUS[gate.verdict] || "NEUTRAL"
                                }
                                label={gate.verdict}
                                size="sm"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {typeof gate.measured === "number"
                                ? gate.measured.toFixed(2)
                                : "\u2014"}
                            </TableCell>
                            <TableCell className="max-w-[300px] text-xs text-muted-foreground">
                              {gate.details && gate.details.length > 0 ? (
                                <HoverCard>
                                  <HoverCardTrigger className="cursor-help underline decoration-dotted">
                                    {gate.details.slice(0, 2).join("; ")}
                                    {gate.details.length > 2 &&
                                      ` (+${gate.details.length - 2})`}
                                  </HoverCardTrigger>
                                  <HoverCardContent className="w-80">
                                    <ul className="space-y-1 text-xs">
                                      {gate.details.map((d, i) => (
                                        <li key={i}>{d}</li>
                                      ))}
                                    </ul>
                                  </HoverCardContent>
                                </HoverCard>
                              ) : (
                                "\u2014"
                              )}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="evidence">
              {detailItem?.evidence_pack ? (
                <ScrollArea className="h-[400px] rounded-lg border bg-muted/30">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                    {JSON.stringify(detailItem.evidence_pack, null, 2)}
                  </pre>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  Aucune source disponible
                </p>
              )}
            </TabsContent>

            <TabsContent value="snapshot">
              {snapshotLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Chargement...
                  </span>
                </div>
              ) : snapshotData ? (
                <div className="space-y-4">
                  {/* Scores before/after */}
                  {(snapshotData.scoresBefore != null ||
                    snapshotData.scoresAfter != null) && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Avant
                        </p>
                        {snapshotData.scoresBefore ? (
                          <pre className="text-xs font-mono">
                            {JSON.stringify(snapshotData.scoresBefore, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-xs text-muted-foreground">N/A</p>
                        )}
                      </div>
                      <div className="rounded-lg border p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Apres
                        </p>
                        {snapshotData.scoresAfter ? (
                          <pre className="text-xs font-mono">
                            {JSON.stringify(snapshotData.scoresAfter, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-xs text-muted-foreground">N/A</p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Dimensions */}
                  {snapshotData.dimensions != null && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Dimensions
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        {Object.entries(
                          snapshotData.dimensions as Record<string, unknown>,
                        ).map(([key, val]) => (
                          <div key={key} className="rounded bg-muted/50 p-2">
                            <span className="block font-medium capitalize">
                              {key.replace(/_/g, " ")}
                            </span>
                            <span className="font-mono">
                              {typeof val === "number"
                                ? val.toFixed(2)
                                : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Locked fields */}
                  {Array.isArray(snapshotData.lockedFields) &&
                    snapshotData.lockedFields.length > 0 && (
                      <div className="rounded-lg border p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Champs bloques
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(snapshotData.lockedFields as string[]).map((f) => (
                            <Badge
                              key={f}
                              variant="outline"
                              className="bg-amber-50 text-amber-700 text-xs"
                            >
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  {/* Raw data fallback */}
                  {!snapshotData.scoresBefore &&
                    !snapshotData.scoresAfter &&
                    !snapshotData.dimensions && (
                      <ScrollArea className="h-[400px] rounded-lg border bg-muted/30">
                        <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                          {JSON.stringify(snapshotData, null, 2)}
                        </pre>
                      </ScrollArea>
                    )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  Aucun snapshot disponible
                </p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
