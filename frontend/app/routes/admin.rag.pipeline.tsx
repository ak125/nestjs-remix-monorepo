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
import { getRoleDisplayLabel } from "@repo/seo-roles";
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
  Eye,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Play,
  ClipboardCheck,
  Send,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminDataTable } from "~/components/admin/patterns/AdminDataTable";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { FeatureFlagsPanel } from "~/components/admin/patterns/FeatureFlagsPanel";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import { ObserveStatsPanel } from "~/components/admin/patterns/ObserveStatsPanel";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
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
    items: Array.isArray(statusData.data) ? statusData.data : [],
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
  R3_guide_howto: "R3 Guide",
  R4_reference: "R4 Reference",
  R5_diagnostic: "R5 Diagnostic",
  R6_guide_achat: "R6 Guide Achat",
};

const PAGE_TYPE_OPTIONS = [
  { value: "R1_pieces", label: "R1 Pieces" },
  { value: "R3_conseils", label: "R3 Conseils" },
  { value: "R3_guide_howto", label: "R3 Guide How-To" },
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
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <Progress
              value={score}
              max={100}
              className={`h-1.5 max-w-[60px] flex-1 ${progressClass}`}
            />
            <Badge
              variant="outline"
              className={`font-mono text-xs ${colorClass}`}
            >
              {score}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          70+ = vert, 50-69 = jaune, &lt;50 = rouge
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

// ── R1 Constants (FR labels) ──

const SGPG_FIELD_LABELS: Record<string, string> = {
  sgpg_hero_subtitle: "Sous-titre hero",
  sgpg_micro_seo_block: "Bloc micro SEO",
  sgpg_h1: "Titre H1",
  sgpg_faq: "FAQ",
  sgpg_anti_mistakes: "Erreurs a eviter",
  sgpg_compatibilities: "Compatibilites vehicules",
  sgpg_equipementiers: "Equipementiers / marques",
  sgpg_safe_table: "Tableau comparatif",
  sgpg_arg1: "Argument commercial 1",
  sgpg_arg2: "Argument commercial 2",
  sgpg_arg3: "Argument commercial 3",
  sgpg_arg4: "Argument commercial 4",
  sgpg_gatekeeper_score: "Score qualite",
  sgpg_gatekeeper_flags: "Alertes qualite",
  sgpg_intent_lock: "Verrou d'intention",
  sgpg_is_draft: "Statut brouillon",
  sgpg_section_checks: "Controles de sections",
  sgpg_meta_title: "Meta titre",
  sgpg_meta_description: "Meta description",
  sgpg_intro: "Introduction",
};

const R1_PREVIEW_SECTIONS = [
  {
    title: "Contenu principal",
    keys: [
      "sgpg_h1",
      "sgpg_hero_subtitle",
      "sgpg_intro",
      "sgpg_micro_seo_block",
      "sgpg_meta_title",
      "sgpg_meta_description",
    ],
  },
  {
    title: "FAQ & Aide",
    keys: ["sgpg_faq", "sgpg_anti_mistakes"],
  },
  {
    title: "Compatibilite",
    keys: ["sgpg_compatibilities", "sgpg_equipementiers", "sgpg_safe_table"],
  },
  {
    title: "Arguments commerciaux",
    keys: ["sgpg_arg1", "sgpg_arg2", "sgpg_arg3", "sgpg_arg4"],
  },
  {
    title: "Qualite pipeline",
    keys: [
      "sgpg_gatekeeper_score",
      "sgpg_gatekeeper_flags",
      "sgpg_section_checks",
      "sgpg_intent_lock",
      "sgpg_is_draft",
    ],
  },
];

const KP_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  validated: { label: "Valide", color: "bg-green-100 text-green-800" },
  draft: { label: "Brouillon", color: "bg-orange-100 text-orange-800" },
  active: { label: "En cours", color: "bg-blue-100 text-blue-800" },
};

const KP_PHASE_LABELS: Record<string, string> = {
  KP0_AUDIT: "Audit initial",
  P1_INTENT: "Analyse d'intention",
  P2_SERP: "Analyse SERP",
  P3_COPY: "Generation contenu",
  P4_GATEKEEPER: "Controle qualite",
  complete: "Termine",
};

// ── R1 Helpers ──

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const R1_STEP_STATUS_LABELS: Record<string, { label: string; color: string }> =
  {
    pending: { label: "En attente", color: "bg-slate-100 text-slate-700" },
    processing: { label: "En cours", color: "bg-blue-100 text-blue-800" },
    draft: { label: "Brouillon", color: "bg-orange-100 text-orange-800" },
    published: { label: "Publie", color: "bg-green-100 text-green-800" },
    auto_published: {
      label: "Auto-publie",
      color: "bg-green-100 text-green-800",
    },
    failed: { label: "Erreur", color: "bg-red-100 text-red-800" },
    skipped: { label: "Ignore", color: "bg-slate-100 text-slate-600" },
  };

function R1Stepper({ activeStep }: { activeStep: number }) {
  const steps = [
    { num: 1, label: "Lancer", icon: Play },
    { num: 2, label: "Verifier", icon: ClipboardCheck },
    { num: 3, label: "Publier", icon: Send },
  ];
  return (
    <div className="flex items-center justify-center gap-0 py-3">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isActive = step.num === activeStep;
        const isComplete = step.num < activeStep;
        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isComplete
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground"
                }`}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive
                    ? "text-primary"
                    : isComplete
                      ? "text-green-700"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`mx-3 mt-[-18px] h-0.5 w-12 ${
                  isComplete ? "bg-green-400" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
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

  // ── R1 Management state ──

  // Bulk publish
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPublishSubmitting, setBulkPublishSubmitting] = useState(false);

  async function handleBulkPublish() {
    if (selectedIds.size === 0) return;
    setBulkPublishSubmitting(true);
    try {
      const res = await fetch("/api/admin/content-refresh/bulk-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const data = await res.json();
      const result = data?.data ?? data;
      if (res.ok) {
        const pub = result?.published ?? 0;
        const fail = result?.failed ?? 0;
        const failures = result?.failures as
          | Array<{ id: number; reason: string }>
          | undefined;
        if (fail > 0 && failures?.length) {
          toast.warning(
            `${pub} publie(s), ${fail} echec(s): ${failures.map((f) => `#${f.id}`).join(", ")}`,
            { duration: 8000 },
          );
        } else {
          toast.success(`${pub} brouillon(s) publie(s)`);
        }
        setSelectedIds(new Set());
      } else {
        toast.error(data?.message || "Echec bulk publish");
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBulkPublishSubmitting(false);
      revalidator.revalidate();
    }
  }

  // R1 Preview
  const [r1PreviewOpen, setR1PreviewOpen] = useState(false);
  const [r1PreviewAlias, setR1PreviewAlias] = useState<string | null>(null);
  const [r1PreviewData, setR1PreviewData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [r1PreviewLoading, setR1PreviewLoading] = useState(false);

  async function openR1Preview(pgAlias: string) {
    setR1PreviewAlias(pgAlias);
    setR1PreviewOpen(true);
    setR1PreviewLoading(true);
    try {
      const res = await fetch(
        `/api/admin/content-refresh/r1-preview/${pgAlias}`,
      );
      const json = res.ok ? await res.json() : null;
      setR1PreviewData(json?.data ?? json);
    } catch {
      setR1PreviewData(null);
    } finally {
      setR1PreviewLoading(false);
    }
  }

  // Batch canary — desactive (LLM externe supprime)

  // R1 Keyword Plans (client-side fetch + sort/filter)
  type KpItem = {
    rkp_pg_alias: string;
    rkp_status: string | null;
    rkp_pipeline_phase: string | null;
    rkp_quality_score: number | null;
    rkp_coverage_score: number | null;
    rkp_built_at: string | null;
  };
  const [kpData, setKpData] = useState<KpItem[]>([]);
  const [kpLoading, setKpLoading] = useState(false);
  const [kpLoaded, setKpLoaded] = useState(false);
  const [kpSearch, setKpSearch] = useState("");
  const [kpStatusFilter, setKpStatusFilter] = useState("all");
  const [kpSortCol, setKpSortCol] = useState<keyof KpItem>("rkp_pg_alias");
  const [kpSortAsc, setKpSortAsc] = useState(true);

  // R1 guided workflow state
  const [r1Mode, setR1Mode] = useState<"trigger" | "review">("review");
  const [kpOpen, setKpOpen] = useState(false);

  const r1Items = useMemo(
    () => items.filter((i) => i.page_type === "R1_pieces"),
    [items],
  );
  const r1DraftItems = useMemo(
    () => r1Items.filter((i) => i.status === "draft"),
    [r1Items],
  );

  async function loadKeywordPlans() {
    if (kpLoaded) return;
    setKpLoading(true);
    try {
      const res = await fetch(
        "/api/admin/content-refresh/r1-keyword-plans?limit=200",
      );
      if (res.ok) {
        const json = await res.json();
        setKpData(json?.data ?? json ?? []);
      }
    } finally {
      setKpLoading(false);
      setKpLoaded(true);
    }
  }

  function toggleKpSort(col: keyof KpItem) {
    if (kpSortCol === col) {
      setKpSortAsc(!kpSortAsc);
    } else {
      setKpSortCol(col);
      setKpSortAsc(true);
    }
  }

  const filteredKpData = useMemo(() => {
    let data = kpData;
    if (kpSearch) {
      const q = kpSearch.toLowerCase();
      data = data.filter((kp) => kp.rkp_pg_alias.toLowerCase().includes(q));
    }
    if (kpStatusFilter !== "all") {
      data = data.filter((kp) => kp.rkp_status === kpStatusFilter);
    }
    const sorted = [...data].sort((a, b) => {
      const av = a[kpSortCol];
      const bv = b[kpSortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return kpSortAsc ? sorted : sorted.reverse();
  }, [kpData, kpSearch, kpStatusFilter, kpSortCol, kpSortAsc]);

  // ── Column definitions ──
  const draftIds = items.filter((i) => i.status === "draft").map((i) => i.id);
  const allDraftsSelected =
    draftIds.length > 0 && draftIds.every((id) => selectedIds.has(id));

  const pipelineColumns: DataColumn<RefreshItem>[] = [
    {
      key: "id",
      header: (
        <Checkbox
          checked={allDraftsSelected}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedIds(new Set(draftIds));
            } else {
              setSelectedIds(new Set());
            }
          }}
          aria-label="Tout selectionner"
        />
      ) as unknown as string,
      width: "40px",
      render: (val, row) => {
        const item = row as RefreshItem;
        if (item.status !== "draft") return null;
        return (
          <Checkbox
            checked={selectedIds.has(item.id)}
            onCheckedChange={(checked) => {
              const next = new Set(selectedIds);
              if (checked) {
                next.add(item.id);
              } else {
                next.delete(item.id);
              }
              setSelectedIds(next);
            }}
          />
        );
      },
    },
    {
      key: "pg_alias",
      header: "Gamme",
      render: (val, row) => {
        const item = row as RefreshItem;
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{String(val)}</span>
            {item.page_type === "R1_pieces" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  openR1Preview(String(val));
                }}
              >
                <FileSearch className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      },
    },
    {
      key: "page_type",
      header: "Type",
      render: (val) => (
        <Badge variant="outline" className="font-mono text-xs">
          {PAGE_TYPE_LABELS[val as string] ?? getRoleDisplayLabel(String(val))}
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
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="r1">
            <Database className="mr-1.5 h-3.5 w-3.5" />
            R1
          </TabsTrigger>
          <TabsTrigger value="flags">
            <Wrench className="mr-1.5 h-3.5 w-3.5" />
            Flags
          </TabsTrigger>
          <TabsTrigger value="observe">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Observe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
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
                  Consultez les resultats : controles qualite et sources
                  utilisees
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
                Lance un enrichissement force a partir du corpus RAG existant,
                sans extraction PDF. Utile pour regenerer le contenu apres mise
                a jour du corpus.
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
                    <span className="text-sm font-medium">
                      Cleanup doublons
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scan SHA-256 pour detecter et supprimer les doublons exacts.
                  </p>
                  <div className="flex items-center gap-2">
                    <Select
                      value={cleanupMode}
                      onValueChange={(v) =>
                        setCleanupMode(v as "dry" | "commit")
                      }
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
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
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
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700"
                    >
                      {backfillResult.updated} empreintes calculees
                    </Badge>
                  )}
                  {backfillResult?.error && (
                    <p className="text-xs text-red-600">
                      {backfillResult.error}
                    </p>
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
                    Recalcule les scores qualite de toutes les gammes et agrege
                    vers gamme-level.
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
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700"
                      >
                        {(qualityResult as { pagesScored?: number })
                          .pagesScored ?? 0}{" "}
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
                    <SelectItem value="R3_guide_howto">
                      R3 Guide How-To
                    </SelectItem>
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
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4" />
                  Historique
                </div>
                {selectedIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkPublish}
                    disabled={bulkPublishSubmitting}
                    className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Publier {selectedIds.size} brouillon
                    {selectedIds.size > 1 ? "s" : ""}
                  </Button>
                )}
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="r1" className="space-y-4">
          {/* Stepper visuel */}
          <Card>
            <CardContent className="pt-4 pb-2">
              <R1Stepper
                activeStep={
                  r1Mode === "trigger" ? 1 : r1DraftItems.length > 0 ? 2 : 3
                }
              />
            </CardContent>
          </Card>

          {/* Mode switcher */}
          <div className="flex items-center gap-2">
            <Button
              variant={r1Mode === "trigger" ? "default" : "outline"}
              size="sm"
              onClick={() => setR1Mode("trigger")}
              className="gap-1.5"
            >
              <Info className="h-3.5 w-3.5" />
              Comment generer
            </Button>
            <Button
              variant={r1Mode === "review" ? "default" : "outline"}
              size="sm"
              onClick={() => setR1Mode("review")}
              className="gap-1.5"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Gammes en attente
              {r1DraftItems.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                  {r1DraftItems.length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Mode Trigger */}
          {r1Mode === "trigger" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Generer du contenu R1
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="info" icon={<Info className="h-4 w-4" />}>
                  <AlertDescription className="space-y-2">
                    <p>
                      La generation de contenu R1 passe par les{" "}
                      <strong>skills Claude Code</strong> et le{" "}
                      <strong>RAG</strong>. Le pipeline LLM automatique est
                      desactive.
                    </p>
                    <div className="space-y-1 text-xs">
                      <p className="font-medium">Skills disponibles :</p>
                      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                        <li>
                          <code className="rounded bg-blue-100 px-1 py-0.5 font-mono">
                            /seo-content-architect
                          </code>{" "}
                          — generation contenu SEO complet
                        </li>
                        <li>
                          <code className="rounded bg-blue-100 px-1 py-0.5 font-mono">
                            r1-content-batch
                          </code>{" "}
                          — agent batch R1 transactionnel
                        </li>
                        <li>
                          <code className="rounded bg-blue-100 px-1 py-0.5 font-mono">
                            keyword-planner
                          </code>{" "}
                          — keyword plans R1
                        </li>
                        <li>
                          <code className="rounded bg-blue-100 px-1 py-0.5 font-mono">
                            /rag-ops ingest
                          </code>{" "}
                          — ingestion corpus RAG
                        </li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Mode Review */}
          {r1Mode === "review" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Gammes R1 ({r1Items.length})
                  </CardTitle>
                  {r1DraftItems.length > 0 && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        const draftIds = r1DraftItems.map((i) => i.id);
                        setSelectedIds(new Set(draftIds));
                        handleBulkPublish();
                      }}
                      disabled={bulkPublishSubmitting}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Publier {r1DraftItems.length} brouillon
                      {r1DraftItems.length > 1 ? "s" : ""}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {r1Items.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <Database className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Aucune gamme R1 en cours.{" "}
                      <button
                        type="button"
                        className="text-primary underline underline-offset-2"
                        onClick={() => setR1Mode("trigger")}
                      >
                        Lancer le pipeline
                      </button>
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Gamme</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r1Items.map((item) => {
                        const statusInfo = R1_STEP_STATUS_LABELS[
                          item.status
                        ] ?? {
                          label: item.status,
                          color: "bg-slate-100 text-slate-700",
                        };
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-sm">
                              {humanizeSlug(item.pg_alias)}
                              <span className="block text-xs text-muted-foreground font-mono">
                                {item.pg_alias}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${statusInfo.color}`}
                              >
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <QualityScoreBadge score={item.quality_score} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(item.updated_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => openR1Preview(item.pg_alias)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {item.status === "draft" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-green-700 hover:text-green-800"
                                    onClick={() => openPublishDialog(item.id)}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {item.status === "failed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-orange-700 hover:text-orange-800"
                                    onClick={() => handleRetry(item)}
                                    disabled={retryingId === item.id}
                                  >
                                    <RotateCcw
                                      className={`h-3.5 w-3.5 ${retryingId === item.id ? "animate-spin" : ""}`}
                                    />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Keyword Plans — Collapsible */}
          <Collapsible
            open={kpOpen}
            onOpenChange={(open) => {
              setKpOpen(open);
              if (open) loadKeywordPlans();
            }}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    {kpOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4 rotate-180" />
                    )}
                    Keyword Plans R1
                    {kpLoaded && (
                      <Badge variant="secondary" className="text-xs ml-auto">
                        {filteredKpData.length}/{kpData.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {kpLoaded && kpData.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Filtrer par gamme..."
                          value={kpSearch}
                          onChange={(e) => setKpSearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                      <select
                        value={kpStatusFilter}
                        onChange={(e) => setKpStatusFilter(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="all">Tous</option>
                        <option value="validated">Valide</option>
                        <option value="draft">Brouillon</option>
                        <option value="active">En cours</option>
                      </select>
                    </div>
                  )}
                  {kpLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Chargement...
                      </span>
                    </div>
                  ) : kpData.length === 0 && kpLoaded ? (
                    <p className="text-sm text-muted-foreground py-4">
                      Aucun keyword plan R1
                    </p>
                  ) : kpData.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            className="cursor-pointer hover:text-foreground select-none"
                            onClick={() => toggleKpSort("rkp_pg_alias")}
                          >
                            <span className="inline-flex items-center gap-1">
                              Gamme
                              {kpSortCol === "rkp_pg_alias" ? (
                                kpSortAsc ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                              )}
                            </span>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:text-foreground select-none"
                            onClick={() => toggleKpSort("rkp_status")}
                          >
                            <span className="inline-flex items-center gap-1">
                              Statut
                              {kpSortCol === "rkp_status" ? (
                                kpSortAsc ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                              )}
                            </span>
                          </TableHead>
                          <TableHead>Phase</TableHead>
                          <TableHead
                            className="text-right cursor-pointer hover:text-foreground select-none"
                            onClick={() => toggleKpSort("rkp_quality_score")}
                          >
                            <span className="inline-flex items-center gap-1 justify-end">
                              Qualite
                              {kpSortCol === "rkp_quality_score" ? (
                                kpSortAsc ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                              )}
                            </span>
                          </TableHead>
                          <TableHead className="text-right">
                            Couverture
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:text-foreground select-none"
                            onClick={() => toggleKpSort("rkp_built_at")}
                          >
                            <span className="inline-flex items-center gap-1">
                              Date
                              {kpSortCol === "rkp_built_at" ? (
                                kpSortAsc ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                              )}
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredKpData.map((kp) => {
                          const kpStatus = KP_STATUS_LABELS[
                            kp.rkp_status ?? ""
                          ] ?? {
                            label: kp.rkp_status ?? "\u2014",
                            color: "bg-slate-100 text-slate-600",
                          };
                          return (
                            <TableRow key={kp.rkp_pg_alias}>
                              <TableCell className="font-medium text-sm">
                                {humanizeSlug(kp.rkp_pg_alias)}
                                <span className="block text-xs text-muted-foreground font-mono">
                                  {kp.rkp_pg_alias}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${kpStatus.color}`}
                                >
                                  {kpStatus.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {KP_PHASE_LABELS[kp.rkp_pipeline_phase ?? ""] ??
                                  kp.rkp_pipeline_phase ??
                                  "\u2014"}
                              </TableCell>
                              <TableCell className="text-right">
                                <QualityScoreBadge
                                  score={kp.rkp_quality_score}
                                />
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {kp.rkp_coverage_score != null
                                  ? `${Math.round(kp.rkp_coverage_score * 100)}%`
                                  : "\u2014"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {kp.rkp_built_at
                                  ? formatDate(kp.rkp_built_at)
                                  : "\u2014"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {filteredKpData.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="py-4 text-center text-sm text-muted-foreground"
                            >
                              Aucun resultat
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  ) : null}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        <TabsContent value="flags">
          <FeatureFlagsPanel />
        </TabsContent>

        <TabsContent value="observe">
          <ObserveStatsPanel days={7} />
        </TabsContent>
      </Tabs>

      {/* R1 Preview Dialog — sections organisees FR */}
      <Dialog open={r1PreviewOpen} onOpenChange={setR1PreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Apercu R1 — {r1PreviewAlias ? humanizeSlug(r1PreviewAlias) : ""}
            </DialogTitle>
            <DialogDescription>
              Contenu genere par le pipeline R1 pour cette gamme
            </DialogDescription>
          </DialogHeader>
          {r1PreviewLoading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Chargement...
              </span>
            </div>
          ) : r1PreviewData ? (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-5 pr-4">
                {R1_PREVIEW_SECTIONS.map((section) => {
                  const sectionEntries = section.keys
                    .map((key) => [key, r1PreviewData[key]] as const)
                    .filter(([, v]) => v !== null && v !== undefined);
                  if (sectionEntries.length === 0) return null;
                  return (
                    <div key={section.title}>
                      <h3 className="text-sm font-semibold mb-2 text-foreground">
                        {section.title}
                      </h3>
                      <div className="space-y-2">
                        {sectionEntries.map(([key, value]) => {
                          const label =
                            SGPG_FIELD_LABELS[key] ?? key.replace(/^sgpg_/, "");
                          return (
                            <div key={key} className="rounded-lg border p-3">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="text-xs font-medium">
                                  {label}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {key}
                                </span>
                                {key === "sgpg_gatekeeper_score" && (
                                  <QualityScoreBadge score={value as number} />
                                )}
                                {key === "sgpg_is_draft" && (
                                  <Badge
                                    variant={value ? "outline" : "default"}
                                    className="text-xs"
                                  >
                                    {value ? "Brouillon" : "Publie"}
                                  </Badge>
                                )}
                              </div>
                              {/* FAQ: render Q/R pairs */}
                              {key === "sgpg_faq" && Array.isArray(value) ? (
                                <div className="space-y-2">
                                  {(
                                    value as Array<{
                                      q?: string;
                                      a?: string;
                                      question?: string;
                                      answer?: string;
                                    }>
                                  ).map((faq, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-muted/30 rounded p-2"
                                    >
                                      <p className="text-xs font-semibold">
                                        Q: {faq.q ?? faq.question ?? ""}
                                      </p>
                                      <p className="text-xs mt-0.5">
                                        {faq.a ?? faq.answer ?? ""}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : key === "sgpg_anti_mistakes" &&
                                Array.isArray(value) ? (
                                <ul className="list-disc list-inside space-y-0.5">
                                  {(value as string[]).map((m, idx) => (
                                    <li key={idx} className="text-sm">
                                      {m}
                                    </li>
                                  ))}
                                </ul>
                              ) : key === "sgpg_gatekeeper_flags" &&
                                Array.isArray(value) ? (
                                <div className="flex flex-wrap gap-1">
                                  {(value as string[]).map((flag, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="text-xs bg-orange-50 text-orange-700"
                                    >
                                      {flag}
                                    </Badge>
                                  ))}
                                  {(value as string[]).length === 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      Aucune alerte
                                    </span>
                                  )}
                                </div>
                              ) : typeof value === "string" ? (
                                <p className="text-sm">{value}</p>
                              ) : typeof value === "number" ? (
                                <p className="text-sm font-mono">{value}</p>
                              ) : typeof value === "boolean" ? (
                                <p className="text-sm">
                                  {value ? "Oui" : "Non"}
                                </p>
                              ) : (
                                <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 rounded p-2">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* Autres champs non mappes */}
                {(() => {
                  const mappedKeys = new Set(
                    R1_PREVIEW_SECTIONS.flatMap((s) => s.keys),
                  );
                  const otherEntries = Object.entries(r1PreviewData).filter(
                    ([key, v]) =>
                      !mappedKeys.has(key) && v !== null && v !== undefined,
                  );
                  if (otherEntries.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 text-foreground">
                        Autres champs
                      </h3>
                      <div className="space-y-2">
                        {otherEntries.map(([key, value]) => (
                          <div key={key} className="rounded-lg border p-3">
                            <span className="text-xs font-medium">{key}</span>
                            {typeof value === "string" ? (
                              <p className="text-sm mt-1">{value}</p>
                            ) : (
                              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 rounded p-2 mt-1">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Aucune donnee disponible
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setR1PreviewOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
