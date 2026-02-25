import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  FileSearch,
  FileText,
  FilePen,
  Layers,
  Clock,
  RefreshCw,
  Search,
  ShieldCheck,
  SkipForward,
  Target,
  Upload,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { Select, SelectItem } from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getFamilyTheme } from "~/utils/family-theme";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Cockpit Gammes - Admin");

// ── Types ──

interface DashboardData {
  counts: Record<string, number>;
}

interface ActivityEvent {
  id: number;
  pg_alias: string;
  page_type: string;
  status: string;
  trigger_source: string;
  quality_score: number | null;
  created_at: string;
  completed_at: string | null;
  published_at: string | null;
}

interface PageScore {
  page_type: string;
  quality_score: number;
  confidence_score: number;
  subscores: Record<string, number>;
  penalties: Array<{ rule: string; points: number }>;
  status: string;
  priority: string;
  reasons: string[];
  next_actions: string[];
  features: Record<string, unknown>;
}

interface GammeScore {
  pg_id: number;
  pg_alias: string;
  gamme_score: number;
  confidence_score: number;
  business_value: number;
  composite_score: number;
  family_name: string | null;
  product_count: number;
  priority: string;
  status: string;
  pages_expected: number;
  pages_scored: number;
  missing_page_types: string[];
  page_scores_summary: Record<string, { score: number; status: string }>;
  top_reasons: string[];
  top_actions: string[];
  page_scores: PageScore[];
}

interface FamilySummary {
  name: string;
  count: number;
  avgComposite: number;
}

interface QualityData {
  gammes: GammeScore[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    avgScore: number;
    avgComposite: number;
    avgConfidence: number;
    blockedPages: number;
    totalActions: number;
    families: FamilySummary[];
  };
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookie };

  const [dashboardRes, qualityRes, timelineRes] = await Promise.allSettled([
    fetch(
      getInternalApiUrlFromRequest(
        "/api/admin/content-refresh/dashboard",
        request,
      ),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest(
        "/api/admin/content-refresh/quality-dashboard",
        request,
      ),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest(
        "/api/admin/content-refresh/activity-timeline?limit=50",
        request,
      ),
      { headers },
    ),
  ]);

  const dashRaw =
    dashboardRes.status === "fulfilled" && dashboardRes.value.ok
      ? await dashboardRes.value.json()
      : null;
  const dashboard: DashboardData = dashRaw?.data ?? dashRaw ?? { counts: {} };

  const qualRaw =
    qualityRes.status === "fulfilled" && qualityRes.value.ok
      ? await qualityRes.value.json()
      : null;
  const quality: QualityData = qualRaw?.data ??
    qualRaw ?? {
      gammes: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        avgScore: 0,
        avgComposite: 0,
        avgConfidence: 0,
        blockedPages: 0,
        totalActions: 0,
        families: [],
      },
    };

  const tlRaw =
    timelineRes.status === "fulfilled" && timelineRes.value.ok
      ? await timelineRes.value.json()
      : null;
  const timeline: ActivityEvent[] = tlRaw?.data ?? tlRaw ?? [];

  return json({ dashboard, quality, timeline, serverNow: Date.now() });
}

// ── Mappings ──

const STATUS_MAP: Record<string, StatusType> = {
  pending: "PENDING",
  processing: "INFO",
  draft: "INFO",
  published: "PASS",
  auto_published: "PASS",
  failed: "FAIL",
  skipped: "NEUTRAL",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  draft: "A relire",
  published: "En ligne",
  auto_published: "En ligne",
  failed: "Erreur",
  skipped: "Sans source",
};

const PRIORITY_MAP: Record<string, StatusType> = {
  CRITICAL: "FAIL",
  HIGH: "WARN",
  MEDIUM: "INFO",
  LOW: "PASS",
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Urgent",
  HIGH: "Important",
  MEDIUM: "Normal",
  LOW: "OK",
};

const QUALITY_STATUS_MAP: Record<string, StatusType> = {
  HEALTHY: "PASS",
  REVIEW: "INFO",
  DEGRADED: "WARN",
  BLOCKED: "FAIL",
  INSUFFICIENT_DATA: "NEUTRAL",
  PENDING: "PENDING",
};

const QUALITY_STATUS_LABELS: Record<string, string> = {
  HEALTHY: "Sain",
  REVIEW: "A verifier",
  DEGRADED: "Degrade",
  BLOCKED: "Bloque",
  INSUFFICIENT_DATA: "Donnees insuffisantes",
  PENDING: "Non calcule",
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  R1_pieces: "Transactionnel",
  R3_guide: "Guide d'achat",
  R3_conseils: "Conseils DIY",
  R4_reference: "Reference",
  R5_diagnostic: "Diagnostic",
};

const PAGE_TYPE_SHORT: Record<string, string> = {
  R1_pieces: "R1",
  R3_guide: "R3g",
  R3_conseils: "R3c",
  R4_reference: "R4",
  R5_diagnostic: "R5",
};

const DIMENSION_LABELS: Record<string, string> = {
  content_depth: "Contenu",
  seo_technical: "SEO",
  trust_evidence: "Fiabilite",
  freshness: "Fraicheur",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manuelle",
  rag_web_ingest: "Source web",
  rag_pdf_ingest: "Source PDF",
};

// ── Helpers ──

function formatRelativeTime(dateStr: string, now: number): string {
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "a l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD < 7) return `il y a ${diffD}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-700";
  if (score >= 60) return "text-yellow-700";
  if (score >= 40) return "text-orange-600";
  return "text-red-700";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-50 border-green-200";
  if (score >= 60) return "bg-yellow-50 border-yellow-200";
  if (score >= 40) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function progressClass(score: number): string {
  if (score >= 80) return "[&>div]:bg-green-500";
  if (score >= 60) return "[&>div]:bg-yellow-500";
  if (score >= 40) return "[&>div]:bg-orange-500";
  return "[&>div]:bg-red-500";
}

function confidenceLabel(conf: number): {
  text: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (conf >= 70) return { text: "Fiable", variant: "default" };
  if (conf >= 40) return { text: "Partiel", variant: "secondary" };
  return { text: "Faible", variant: "outline" };
}

// ── Score Bar (reusable for gamme + page scores) ──

function ScoreBar({
  score,
  max = 100,
  label,
}: {
  score: number;
  max?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((score / max) * 100)));
  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-[10px] text-muted-foreground w-[56px] truncate">
          {label}
        </span>
      )}
      <Progress
        value={pct}
        max={100}
        className={`h-1.5 max-w-[48px] flex-1 ${progressClass(pct)}`}
      />
      <span className="font-mono text-[10px] text-muted-foreground">
        {score}/{max}
      </span>
    </div>
  );
}

// ── Feature Display Config per page type ──

interface FeatureDisplay {
  key: string;
  label: string;
  threshold?: number;
  unit?: string;
  type: "number" | "boolean" | "count";
}

const FEATURE_DISPLAYS: Record<string, FeatureDisplay[]> = {
  R3_guide: [
    {
      key: "how_to_choose_length",
      label: "Comment choisir",
      threshold: 200,
      unit: "chars",
      type: "number",
    },
    { key: "faq_count", label: "FAQ", threshold: 3, type: "count" },
    { key: "symptoms_count", label: "Symptomes", threshold: 3, type: "count" },
    {
      key: "anti_mistakes_count",
      label: "Erreurs a eviter",
      threshold: 3,
      type: "count",
    },
    { key: "arg_count", label: "Arguments", threshold: 3, type: "count" },
    { key: "source_verified", label: "Source verifiee", type: "boolean" },
    {
      key: "rag_content_length",
      label: "RAG",
      threshold: 1500,
      unit: "chars",
      type: "number",
    },
  ],
  R4_reference: [
    {
      key: "definition_length",
      label: "Definition",
      threshold: 200,
      unit: "chars",
      type: "number",
    },
    {
      key: "content_html_length",
      label: "Contenu HTML",
      threshold: 500,
      unit: "chars",
      type: "number",
    },
    {
      key: "confusions_count",
      label: "Confusions",
      threshold: 1,
      type: "count",
    },
    {
      key: "regles_metier_count",
      label: "Regles metier",
      threshold: 1,
      type: "count",
    },
    { key: "has_schema_json", label: "Schema.org", type: "boolean" },
    {
      key: "rag_content_length",
      label: "RAG",
      threshold: 1500,
      unit: "chars",
      type: "number",
    },
  ],
  R3_conseils: [
    { key: "total_sections", label: "Sections", threshold: 8, type: "count" },
    {
      key: "rich_sections",
      label: "Sections riches",
      threshold: 3,
      type: "count",
    },
    {
      key: "total_content_length",
      label: "Contenu total",
      threshold: 2500,
      unit: "chars",
      type: "number",
    },
    {
      key: "rag_content_length",
      label: "RAG",
      threshold: 1500,
      unit: "chars",
      type: "number",
    },
  ],
  R1_pieces: [
    { key: "has_pg_img", label: "Image produit", type: "boolean" },
    { key: "has_pg_pic", label: "Image hero", type: "boolean" },
    { key: "has_pg_wall", label: "Wallpaper", type: "boolean" },
    { key: "has_blog_advice", label: "Conseil blog", type: "boolean" },
    {
      key: "seo_content_length",
      label: "Contenu SEO",
      threshold: 800,
      unit: "chars",
      type: "number",
    },
    {
      key: "rag_content_length",
      label: "RAG",
      threshold: 1500,
      unit: "chars",
      type: "number",
    },
  ],
};

function FeatureChip({ fd, value }: { fd: FeatureDisplay; value: unknown }) {
  if (fd.type === "boolean") {
    const ok = Boolean(value);
    return (
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded ${ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}
      >
        {fd.label}: {ok ? "oui" : "non"}
      </span>
    );
  }

  const num = typeof value === "number" ? value : 0;
  const threshold = fd.threshold || 1;
  const ok = num >= threshold;
  const pct = Math.min(100, Math.round((num / threshold) * 100));

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded ${ok ? "bg-green-100 text-green-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}
    >
      {fd.label}:{" "}
      {fd.type === "count"
        ? `${num}/${threshold}`
        : `${num.toLocaleString("fr-FR")}/${threshold.toLocaleString("fr-FR")}`}
    </span>
  );
}

// ── Page Score Card (expanded row) ──

function PageScoreCard({ ps }: { ps: PageScore }) {
  const [showDetails, setShowDetails] = useState(false);
  const label = PAGE_TYPE_LABELS[ps.page_type] || ps.page_type;
  const statusLabel = QUALITY_STATUS_LABELS[ps.status] || ps.status;
  const statusType = QUALITY_STATUS_MAP[ps.status] || "NEUTRAL";

  // Dimension weights per page type (from scoring-profiles.config.ts)
  const dimensionWeights: Record<string, Record<string, number>> = {
    R3_guide: {
      content_depth: 35,
      seo_technical: 25,
      trust_evidence: 25,
      freshness: 15,
    },
    R4_reference: {
      content_depth: 20,
      seo_technical: 25,
      trust_evidence: 35,
      freshness: 20,
    },
    R3_conseils: {
      content_depth: 35,
      seo_technical: 20,
      trust_evidence: 20,
      freshness: 25,
    },
    R1_pieces: {
      content_depth: 10,
      seo_technical: 30,
      trust_evidence: 20,
      freshness: 40,
    },
  };
  const weights = dimensionWeights[ps.page_type] || {};

  return (
    <div className={`rounded-lg border p-3 ${scoreBg(ps.quality_score)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono px-1.5">
            {PAGE_TYPE_SHORT[ps.page_type] || ps.page_type}
          </Badge>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${scoreColor(ps.quality_score)}`}>
            {ps.quality_score}
          </span>
          <StatusBadge status={statusType} label={statusLabel} size="sm" />
        </div>
      </div>

      {/* Dimension subscores */}
      <div className="space-y-1 mb-2">
        {Object.entries(ps.subscores).map(([dim, score]) => (
          <ScoreBar
            key={dim}
            score={score as number}
            max={weights[dim] || 25}
            label={DIMENSION_LABELS[dim] || dim}
          />
        ))}
      </div>

      {/* Penalties (if any) */}
      {ps.penalties.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {ps.penalties.map((p, i) => (
            <span
              key={i}
              className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded"
            >
              {p.rule} ({p.points})
            </span>
          ))}
        </div>
      )}

      {/* Expand toggle for reasons/actions */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
      >
        {showDetails ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {ps.reasons.length} remarque{ps.reasons.length !== 1 ? "s" : ""},{" "}
        {ps.next_actions.length} action{ps.next_actions.length !== 1 ? "s" : ""}
      </button>

      {showDetails && (
        <div className="mt-2 space-y-2">
          {/* Feature data chips */}
          {FEATURE_DISPLAYS[ps.page_type] &&
            Object.keys(ps.features).length > 0 && (
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-1">
                  Donnees
                </div>
                <div className="flex flex-wrap gap-1">
                  {FEATURE_DISPLAYS[ps.page_type].map((fd) => (
                    <FeatureChip
                      key={fd.key}
                      fd={fd}
                      value={ps.features[fd.key]}
                    />
                  ))}
                </div>
              </div>
            )}
          {ps.reasons.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-0.5">
                Remarques
              </div>
              <ul className="space-y-0.5">
                {ps.reasons.map((r, i) => (
                  <li
                    key={i}
                    className="text-[10px] text-muted-foreground flex items-start gap-1"
                  >
                    <XCircle className="h-2.5 w-2.5 text-amber-500 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ps.next_actions.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-0.5">
                Actions
              </div>
              <ul className="space-y-0.5">
                {ps.next_actions.map((a, i) => (
                  <li
                    key={i}
                    className="text-[10px] text-blue-700 flex items-start gap-1"
                  >
                    <Zap className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Expanded Row (extracted for reuse) ──

function GammeExpandedRow({ row }: { row: GammeScore }) {
  return (
    <div className="space-y-3 p-2">
      {/* Page score cards grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {row.page_scores.map((ps) => (
          <PageScoreCard key={ps.page_type} ps={ps} />
        ))}
      </div>

      {/* Missing pages warning */}
      {row.missing_page_types.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-medium text-amber-800">
              Pages manquantes :
            </span>
            <div className="flex gap-1 mt-1">
              {row.missing_page_types.map((pt) => (
                <Badge key={pt} variant="outline" className="text-[10px]">
                  {PAGE_TYPE_LABELS[pt] || pt}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Gamme summary footer */}
      <div className="border-t pt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Composite</span>
          <span
            className={`text-sm font-bold ${scoreColor(row.composite_score)}`}
          >
            {row.composite_score}
          </span>
          <span className="text-[10px] text-muted-foreground">
            (Q: {row.gamme_score} | B: {row.business_value})
          </span>
          <StatusBadge
            status={PRIORITY_MAP[row.priority] || "NEUTRAL"}
            label={PRIORITY_LABELS[row.priority] || row.priority}
            size="sm"
          />
        </div>
        {row.top_actions.length > 0 && (
          <div className="text-right max-w-[300px]">
            <span className="text-[10px] text-blue-700 truncate">
              {row.top_actions[0]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Family Group Component ──

function FamilyGroup({
  name,
  gammes,
  avgComposite,
  columns,
  isLoading,
}: {
  name: string;
  gammes: GammeScore[];
  avgComposite: number;
  columns: DataColumn<GammeScore>[];
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const theme = getFamilyTheme(name);

  return (
    <Card className={`border-t-4 ${theme.borderAccent}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className={`py-3 px-4 ${theme.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div className={`h-2.5 w-2.5 rounded-full ${theme.accent}`} />
              <CardTitle className={`text-sm font-medium ${theme.fgStrong}`}>
                {name}
              </CardTitle>
              <Badge className={`text-[10px] ${theme.badge}`}>
                {gammes.length} gamme{gammes.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`font-mono text-sm font-bold ${scoreColor(avgComposite)}`}
              >
                {avgComposite}
              </span>
              <Progress
                value={avgComposite}
                max={100}
                className={`h-2 w-[60px] ${progressClass(avgComposite)}`}
              />
            </div>
          </div>
        </CardHeader>
      </button>
      {expanded && (
        <CardContent className="pt-0 px-2 pb-2">
          <AdminDataTable<GammeScore>
            data={gammes}
            columns={columns}
            getRowKey={(r) => String(r.pg_id)}
            emptyMessage="Aucune gamme"
            isLoading={isLoading}
            expandable
            renderExpandedRow={(row: GammeScore) => (
              <GammeExpandedRow row={row} />
            )}
          />
        </CardContent>
      )}
    </Card>
  );
}

// ── Main Component ──

export default function AdminRagCockpit() {
  const { dashboard, quality, timeline, serverNow } =
    useLoaderData<typeof loader>();
  const refreshFetcher = useFetcher<typeof loader>();

  const [now, setNow] = useState(serverNow);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [groupByFamily, setGroupByFamily] = useState(true);
  const [sortField, setSortField] = useState<
    "composite" | "quality" | "business" | "products"
  >("composite");

  useEffect(() => {
    setNow(Date.now());
  }, [timeline]);

  // Use refreshed data if available
  const d = refreshFetcher.data ?? { dashboard, quality, timeline };
  const counts = d.dashboard.counts;
  const qual = d.quality;
  const events = d.timeline;
  const isLoading = refreshFetcher.state !== "idle";

  // Quality filter + sort
  const normalizedSearch = searchQuery.toLowerCase().trim();
  const filteredGammes = qual.gammes
    .filter((g: GammeScore) => {
      if (
        normalizedSearch &&
        !g.pg_alias.toLowerCase().includes(normalizedSearch)
      )
        return false;
      if (priorityFilter && g.priority !== priorityFilter) return false;
      if (familyFilter && (g.family_name || "Autres") !== familyFilter)
        return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortField) {
        case "quality":
          return a.gamme_score - b.gamme_score;
        case "business":
          return a.business_value - b.business_value;
        case "products":
          return b.product_count - a.product_count;
        default:
          return a.composite_score - b.composite_score;
      }
    });

  // Group by family for grouped view
  const familyGroups = groupByFamily
    ? [...new Set(filteredGammes.map((g) => g.family_name || "Autres"))]
        .map((name) => ({
          name,
          gammes: filteredGammes.filter(
            (g) => (g.family_name || "Autres") === name,
          ),
          avgComposite: 0,
        }))
        .map((fg) => ({
          ...fg,
          avgComposite:
            fg.gammes.length > 0
              ? parseFloat(
                  (
                    fg.gammes.reduce((s, g) => s + g.composite_score, 0) /
                    fg.gammes.length
                  ).toFixed(1),
                )
              : 0,
        }))
        .sort((a, b) => a.avgComposite - b.avgComposite)
    : [];

  // Count events in last 24h
  const _events24h = events.filter(
    (e: ActivityEvent) => now - new Date(e.created_at).getTime() < 86400000,
  ).length;

  const totalPublished = (counts.published || 0) + (counts.auto_published || 0);
  const hasQualityData = qual.summary.total > 0;

  // ── Activity Timeline Columns ──

  const activityColumns: DataColumn<ActivityEvent>[] = [
    {
      key: "status",
      header: "Etat",
      width: "100px",
      render: (_val, row) => (
        <StatusBadge
          status={STATUS_MAP[row.status] || "NEUTRAL"}
          label={STATUS_LABELS[row.status] || row.status}
          size="sm"
        />
      ),
    },
    {
      key: "pg_alias",
      header: "Gamme",
      render: (_val, row) => (
        <Link
          to={`/admin/gammes-seo/${row.pg_alias}`}
          className="font-medium text-sm text-blue-700 hover:underline"
        >
          {row.pg_alias}
        </Link>
      ),
    },
    {
      key: "page_type",
      header: "Type de page",
      render: (_val, row) => (
        <Badge variant="outline" className="text-xs">
          {PAGE_TYPE_LABELS[row.page_type] || row.page_type}
        </Badge>
      ),
    },
    {
      key: "trigger_source",
      header: "Origine",
      render: (_val, row) => (
        <span className="text-xs text-muted-foreground">
          {SOURCE_LABELS[row.trigger_source] || row.trigger_source}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Quand",
      render: (_val, row) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(row.created_at, now)}
        </span>
      ),
    },
  ];

  // ── Quality Gamme Columns ──

  const qualityColumns: DataColumn<GammeScore>[] = [
    {
      key: "pg_alias",
      header: "Gamme",
      render: (_val, row) => (
        <div className="flex items-center gap-1.5">
          <Link
            to={`/admin/gammes-seo/${row.pg_alias}`}
            className="font-medium text-sm text-blue-700 hover:underline"
          >
            {row.pg_alias}
          </Link>
          {row.product_count > 0 && row.business_value >= 60 && (
            <span title="Top gamme">
              <Crown className="h-3 w-3 text-amber-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "composite_score",
      header: "Composite",
      width: "130px",
      render: (_val, row) => (
        <div className="flex items-center gap-2">
          <Progress
            value={row.composite_score}
            max={100}
            className={`h-2 w-[50px] ${progressClass(row.composite_score)}`}
          />
          <span
            className={`font-mono text-xs font-bold ${scoreColor(row.composite_score)}`}
          >
            {row.composite_score}
          </span>
        </div>
      ),
    },
    {
      key: "gamme_score",
      header: "Qualite",
      width: "70px",
      render: (_val, row) => (
        <span className={`font-mono text-xs ${scoreColor(row.gamme_score)}`}>
          {row.gamme_score}
        </span>
      ),
    },
    {
      key: "product_count",
      header: "Produits",
      width: "70px",
      render: (_val, row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.product_count > 0
            ? row.product_count.toLocaleString("fr-FR")
            : "-"}
        </span>
      ),
    },
    {
      key: "confidence_score",
      header: "Confiance",
      width: "80px",
      render: (_val, row) => {
        const conf = confidenceLabel(row.confidence_score);
        return (
          <Badge variant={conf.variant} className="text-[10px]">
            {conf.text}
          </Badge>
        );
      },
    },
    {
      key: "priority",
      header: "Priorite",
      width: "80px",
      render: (_val, row) => (
        <StatusBadge
          status={PRIORITY_MAP[row.priority] || "NEUTRAL"}
          label={PRIORITY_LABELS[row.priority] || row.priority}
          size="sm"
        />
      ),
    },
    {
      key: "top_actions",
      header: "Actions",
      width: "160px",
      render: (_val, row) => {
        if (row.top_actions.length === 0)
          return <span className="text-xs text-muted-foreground">-</span>;
        // Categorize actions
        const categories: Record<string, number> = {};
        for (const a of row.top_actions) {
          const match = a.match(/^\[(\w+)\]/);
          const cat = match ? match[1] : "Autre";
          categories[cat] = (categories[cat] || 0) + 1;
        }
        return (
          <div className="flex flex-wrap gap-0.5">
            {Object.entries(categories).map(([cat, count]) => (
              <span
                key={cat}
                className="text-[9px] bg-muted px-1 py-0.5 rounded"
              >
                {PAGE_TYPE_SHORT[cat] || cat}: {count}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <DashboardShell
      title="Cockpit Gammes"
      description="Qualite et scoring des gammes par famille"
      breadcrumb={
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <span>/</span>
          <Link to="/admin/rag" className="hover:text-foreground">
            Contenu
          </Link>
          <span>/</span>
          <span className="text-foreground">Tableau de bord</span>
        </div>
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshFetcher.load("/admin/rag/cockpit")}
          className="gap-1.5"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          Rafraichir
        </Button>
      }
      kpis={
        <KpiGrid columns={4}>
          <KpiCard
            title="Score composite"
            value={hasQualityData ? `${qual.summary.avgComposite}` : "0"}
            icon={Target}
            variant="info"
            subtitle={
              hasQualityData
                ? `${qual.summary.total} gammes, qualite moy. ${qual.summary.avgScore}`
                : "Calculer les scores pour commencer"
            }
          />
          <KpiCard
            title="En ligne"
            value={totalPublished}
            icon={CheckCircle2}
            variant="success"
            subtitle="Gammes validees et publiees"
          />
          <KpiCard
            title="A traiter"
            value={
              hasQualityData ? qual.summary.critical + qual.summary.high : 0
            }
            icon={AlertTriangle}
            variant={
              hasQualityData && qual.summary.critical + qual.summary.high > 0
                ? "danger"
                : "default"
            }
            subtitle={
              hasQualityData
                ? `${qual.summary.critical} urgentes, ${qual.summary.high} importantes`
                : "Aucune donnee"
            }
          />
          <KpiCard
            title="Actions prioritaires"
            value={hasQualityData ? qual.summary.totalActions : 0}
            icon={Zap}
            variant={
              hasQualityData && qual.summary.totalActions > 0
                ? "danger"
                : "default"
            }
            subtitle={
              hasQualityData
                ? `${qual.summary.blockedPages} pages bloquees`
                : "Aucune donnee"
            }
          />
        </KpiGrid>
      }
    >
      <Tabs defaultValue="qualite" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="qualite" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Qualite par gamme
          </TabsTrigger>
          <TabsTrigger value="historique" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="vue-ensemble" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Vue d'ensemble
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Qualite par gamme ── */}
        <TabsContent value="qualite">
          <div className="space-y-4">
            {!hasQualityData && (
              <Card>
                <CardContent className="py-6 text-center">
                  <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Les scores qualite n'ont pas encore ete calcules.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Lancez le calcul via{" "}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">
                      POST /api/admin/content-refresh/compute-quality-scores
                    </code>
                  </p>
                </CardContent>
              </Card>
            )}

            {hasQualityData && (
              <>
                <Card>
                  <CardContent className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative sm:w-52">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Rechercher une gamme..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-9 pl-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1 sm:w-40">
                        <Select
                          name="priorityFilter"
                          value={priorityFilter}
                          onValueChange={setPriorityFilter}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <SelectItem value="">Toutes priorites</SelectItem>
                          <SelectItem value="CRITICAL">Urgent</SelectItem>
                          <SelectItem value="HIGH">Important</SelectItem>
                          <SelectItem value="MEDIUM">Normal</SelectItem>
                          <SelectItem value="LOW">OK</SelectItem>
                        </Select>
                      </div>
                      <div className="space-y-1 sm:w-48">
                        <Select
                          name="familyFilter"
                          value={familyFilter}
                          onValueChange={setFamilyFilter}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <SelectItem value="">Toutes familles</SelectItem>
                          {(qual.summary.families || []).map((f) => (
                            <SelectItem key={f.name} value={f.name}>
                              {f.name} ({f.count})
                            </SelectItem>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1 sm:w-40">
                        <Select
                          name="sortField"
                          value={sortField}
                          onValueChange={(v) =>
                            setSortField(v as typeof sortField)
                          }
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <SelectItem value="composite">
                            Tri: Composite
                          </SelectItem>
                          <SelectItem value="quality">Tri: Qualite</SelectItem>
                          <SelectItem value="business">
                            Tri: Business
                          </SelectItem>
                          <SelectItem value="products">
                            Tri: Produits
                          </SelectItem>
                        </Select>
                      </div>
                      <Button
                        variant={groupByFamily ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGroupByFamily(!groupByFamily)}
                        className="gap-1.5 h-9"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        {groupByFamily ? "Par famille" : "Liste plate"}
                      </Button>
                      <Badge variant="secondary" className="h-9 px-3">
                        {filteredGammes.length} gamme
                        {filteredGammes.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Grouped view by family */}
                {groupByFamily && familyGroups.length > 0 ? (
                  <div className="space-y-3">
                    {familyGroups.map((fg) => (
                      <FamilyGroup
                        key={fg.name}
                        name={fg.name}
                        gammes={fg.gammes}
                        avgComposite={fg.avgComposite}
                        columns={qualityColumns}
                        isLoading={isLoading}
                      />
                    ))}
                  </div>
                ) : (
                  <AdminDataTable<GammeScore>
                    data={filteredGammes as GammeScore[]}
                    columns={qualityColumns}
                    getRowKey={(r) => String(r.pg_id)}
                    emptyMessage="Aucune gamme trouvee"
                    isLoading={isLoading}
                    expandable
                    renderExpandedRow={(row: GammeScore) => (
                      <GammeExpandedRow row={row} />
                    )}
                    toolbar={
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Target className="h-4 w-4" />
                        Scoring multi-pages par gamme
                      </div>
                    }
                  />
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Tab 2: Historique ── */}
        <TabsContent value="historique">
          <AdminDataTable<ActivityEvent>
            data={(events as ActivityEvent[]).slice(0, 50)}
            columns={activityColumns}
            getRowKey={(r) => String(r.id)}
            emptyMessage="Aucune modification recente"
            statusColumn={{ key: "status", mapping: STATUS_MAP }}
            isLoading={isLoading}
            toolbar={
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Dernieres modifications de gammes
              </div>
            }
          />
        </TabsContent>

        {/* ── Tab 3: Vue d'ensemble ── */}
        <TabsContent value="vue-ensemble">
          <div className="space-y-4">
            {/* Status counters */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {counts.draft || 0}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3 w-3" />A relire
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  gammes en attente de validation
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {totalPublished}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" />
                  En ligne
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  gammes publiees sur le site
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-gray-500">
                  {counts.skipped || 0}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
                  <SkipForward className="h-3 w-3" />
                  Sans source
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  pas de document source
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {counts.failed || 0}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
                  <XCircle className="h-3 w-3" />
                  En erreur
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  a examiner
                </div>
              </div>
            </div>

            {/* Quality summary (when data available) */}
            {hasQualityData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Repartition qualite
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-xl font-bold">
                        {qual.summary.total}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Gammes
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <div
                        className={`text-xl font-bold ${scoreColor(qual.summary.avgComposite)}`}
                      >
                        {qual.summary.avgComposite}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Composite moy.
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 text-center border-red-200 bg-red-50/30">
                      <div className="text-xl font-bold text-red-600">
                        {qual.summary.critical}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Urgentes
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 text-center border-amber-200 bg-amber-50/30">
                      <div className="text-xl font-bold text-amber-600">
                        {qual.summary.high}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Importantes
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-xl font-bold text-green-600">
                        {qual.summary.low}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Saines
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Outils
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/pipeline">
                      <Activity className="mr-1.5 h-3.5 w-3.5" />
                      Historique complet
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/seo-drafts">
                      <FilePen className="mr-1.5 h-3.5 w-3.5" />
                      Gammes a relire
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/qa-gate">
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      Controle qualite
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/documents">
                      <FileSearch className="mr-1.5 h-3.5 w-3.5" />
                      Sources documentaires
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/ingest">
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Importer des sources
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/content-refresh">
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Actualiser le contenu
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
