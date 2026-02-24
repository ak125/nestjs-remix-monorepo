import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import {
  Activity,
  CheckCircle2,
  FileText,
  RefreshCw,
  XCircle,
  SkipForward,
  Map,
  Clock,
  Heart,
  AlertTriangle,
  Check,
  X,
  Upload,
  ShieldCheck,
  FilePen,
  FileSearch,
  Zap,
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
import { Progress } from "~/components/ui/progress";
import { Select, SelectItem } from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Cockpit Contenu - Admin");

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

interface CoverageRow {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  has_how_to_choose: boolean;
  has_anti_mistakes: boolean;
  has_selection_criteria: boolean;
  has_decision_tree: boolean;
  has_faq: boolean;
  has_symptoms: boolean;
  conseil_sections: string[];
  conseil_count: number;
  has_rag_file: boolean;
  coverage_score: number;
  priority: string;
}

interface CoverageData {
  gammes: CoverageRow[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    avgScore: number;
  };
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookie };

  const [dashboardRes, coverageRes, timelineRes] = await Promise.allSettled([
    fetch(
      getInternalApiUrlFromRequest(
        "/api/admin/content-refresh/dashboard",
        request,
      ),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest(
        "/api/admin/content-refresh/coverage-map",
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

  // Safe parse with AdminResponseInterceptor unwrapping
  const dashRaw =
    dashboardRes.status === "fulfilled" && dashboardRes.value.ok
      ? await dashboardRes.value.json()
      : null;
  const dashboard: DashboardData = dashRaw?.data ?? dashRaw ?? { counts: {} };

  const covRaw =
    coverageRes.status === "fulfilled" && coverageRes.value.ok
      ? await coverageRes.value.json()
      : null;
  const coverage: CoverageData = covRaw?.data ??
    covRaw ?? {
      gammes: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        avgScore: 0,
      },
    };

  const tlRaw =
    timelineRes.status === "fulfilled" && timelineRes.value.ok
      ? await timelineRes.value.json()
      : null;
  const timeline: ActivityEvent[] = tlRaw?.data ?? tlRaw ?? [];

  return json({ dashboard, coverage, timeline });
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

const PRIORITY_MAP: Record<string, StatusType> = {
  CRITICAL: "FAIL",
  HIGH: "WARN",
  MEDIUM: "INFO",
  LOW: "PASS",
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Critique",
  HIGH: "Eleve",
  MEDIUM: "Moyen",
  LOW: "Faible",
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  R1_pieces: "R1",
  R3_conseils: "R3 Conseils",
  R3_guide_achat: "R3 Guide",
  R4_reference: "R4",
  R5_diagnostic: "R5",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manuel",
  rag_web_ingest: "Ingestion web",
  rag_pdf_ingest: "Ingestion PDF",
};

const GUIDE_SECTIONS = [
  { key: "has_how_to_choose" as const, label: "Comment choisir" },
  { key: "has_anti_mistakes" as const, label: "Erreurs a eviter" },
  { key: "has_selection_criteria" as const, label: "Criteres selection" },
  { key: "has_decision_tree" as const, label: "Arbre decision" },
  { key: "has_faq" as const, label: "FAQ" },
  { key: "has_symptoms" as const, label: "Symptomes" },
];

const CONSEIL_SECTION_LABELS: Record<string, string> = {
  S1: "Fonction",
  S2: "Quand changer",
  S3: "Comment choisir",
  S4_DEPOSE: "Demontage",
  S4_REPOSE: "Remontage",
  S5: "Erreurs",
  S7: "Pieces associees",
  S8: "FAQ",
};

const ALL_CONSEIL_SECTIONS = [
  "S1",
  "S2",
  "S3",
  "S4_DEPOSE",
  "S4_REPOSE",
  "S5",
  "S7",
  "S8",
];

// ── Helpers ──

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
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

function QualityBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-muted-foreground">{"\u2014"}</span>;
  }
  const color =
    score >= 70
      ? "bg-green-100 text-green-800"
      : score >= 50
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";
  return (
    <Badge variant="outline" className={`font-mono text-xs ${color}`}>
      {score}
    </Badge>
  );
}

function CoverageDot({ filled, label }: { filled: boolean; label: string }) {
  return (
    <div
      title={label}
      className={`h-3 w-3 rounded-full cursor-help ${
        filled ? "bg-green-500" : "bg-red-200"
      }`}
    />
  );
}

function CoverageProgress({ score }: { score: number }) {
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
        className={`h-2 max-w-[80px] flex-1 ${progressClass}`}
      />
      <span className="font-mono text-xs text-muted-foreground">{score}%</span>
    </div>
  );
}

// ── Main Component ──

export default function AdminRagCockpit() {
  const { dashboard, coverage, timeline } = useLoaderData<typeof loader>();
  const refreshFetcher = useFetcher<typeof loader>();

  const [priorityFilter, setPriorityFilter] = useState("");

  // Use refreshed data if available
  const d = refreshFetcher.data ?? { dashboard, coverage, timeline };
  const counts = d.dashboard.counts;
  const cov = d.coverage;
  const events = d.timeline;
  const isLoading = refreshFetcher.state !== "idle";

  // Coverage filter
  const filteredGammes = priorityFilter
    ? cov.gammes.filter((g: CoverageRow) => g.priority === priorityFilter)
    : cov.gammes;

  // Count events in last 24h
  const events24h = events.filter(
    (e: ActivityEvent) =>
      Date.now() - new Date(e.created_at).getTime() < 86400000,
  ).length;

  const totalPublished = (counts.published || 0) + (counts.auto_published || 0);

  // ── Activity Timeline Columns ──

  const activityColumns: DataColumn<ActivityEvent>[] = [
    {
      key: "status",
      header: "Statut",
      width: "80px",
      render: (_val, row) => (
        <StatusBadge
          status={STATUS_MAP[row.status] || "NEUTRAL"}
          label={row.status}
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
      header: "Type",
      render: (_val, row) => (
        <Badge variant="outline" className="font-mono text-xs">
          {PAGE_TYPE_LABELS[row.page_type] || row.page_type}
        </Badge>
      ),
    },
    {
      key: "trigger_source",
      header: "Source",
      render: (_val, row) => (
        <span className="text-xs text-muted-foreground">
          {SOURCE_LABELS[row.trigger_source] || row.trigger_source}
        </span>
      ),
    },
    {
      key: "quality_score",
      header: "Qualite",
      render: (_val, row) => <QualityBadge score={row.quality_score} />,
    },
    {
      key: "created_at",
      header: "Date",
      render: (_val, row) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(row.created_at)}
        </span>
      ),
    },
  ];

  // ── Coverage Map Columns ──

  const coverageColumns: DataColumn<CoverageRow>[] = [
    {
      key: "pg_alias",
      header: "Gamme",
      render: (_val, row) => (
        <div>
          <span className="font-medium text-sm">{row.pg_alias}</span>
          {row.pg_name && row.pg_name !== row.pg_alias && (
            <span className="block text-xs text-muted-foreground truncate max-w-[200px]">
              {row.pg_name}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "coverage_score",
      header: "Couverture",
      render: (_val, row) => <CoverageProgress score={row.coverage_score} />,
    },
    {
      key: "priority",
      header: "Priorite",
      render: (_val, row) => (
        <StatusBadge
          status={PRIORITY_MAP[row.priority] || "NEUTRAL"}
          label={PRIORITY_LABELS[row.priority] || row.priority}
          size="sm"
        />
      ),
    },
    {
      key: "has_how_to_choose",
      header: "Guide achat",
      render: (_val, row) => (
        <div className="flex items-center gap-1">
          {GUIDE_SECTIONS.map((s) => (
            <CoverageDot key={s.key} filled={row[s.key]} label={s.label} />
          ))}
        </div>
      ),
    },
    {
      key: "conseil_count",
      header: "Conseils",
      render: (_val, row) => {
        const pct = Math.round((row.conseil_count / 8) * 100);
        const color =
          pct >= 75
            ? "[&>div]:bg-green-500"
            : pct >= 50
              ? "[&>div]:bg-yellow-500"
              : "[&>div]:bg-red-500";
        return (
          <div className="flex items-center gap-2">
            <Progress
              value={pct}
              max={100}
              className={`h-2 max-w-[50px] flex-1 ${color}`}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {row.conseil_count}/8
            </span>
          </div>
        );
      },
    },
    {
      key: "has_rag_file",
      header: "RAG",
      width: "60px",
      render: (_val, row) =>
        row.has_rag_file ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <X className="h-4 w-4 text-red-400" />
        ),
    },
  ];

  return (
    <DashboardShell
      title="Centre de Pilotage Contenu"
      description="Vue unifiee du pipeline, couverture et activite recente"
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
          <span className="text-foreground">Cockpit</span>
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
            title="Gammes couvertes"
            value={`${cov.summary.total}`}
            icon={Map}
            variant="info"
            subtitle={`Score moyen ${cov.summary.avgScore}%`}
          />
          <KpiCard
            title="Publies"
            value={totalPublished}
            icon={CheckCircle2}
            variant="success"
          />
          <KpiCard
            title="Gaps a traiter"
            value={cov.summary.critical + cov.summary.high}
            icon={AlertTriangle}
            variant={
              cov.summary.critical + cov.summary.high > 0 ? "danger" : "default"
            }
            subtitle={`${cov.summary.critical} critique, ${cov.summary.high} eleve`}
          />
          <KpiCard
            title="Activite 24h"
            value={events24h}
            icon={Activity}
            variant="default"
          />
        </KpiGrid>
      }
    >
      <Tabs defaultValue="activite" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="activite" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Activite recente
          </TabsTrigger>
          <TabsTrigger value="couverture" className="gap-1.5">
            <Map className="h-3.5 w-3.5" />
            Carte couverture
          </TabsTrigger>
          <TabsTrigger value="sante" className="gap-1.5">
            <Heart className="h-3.5 w-3.5" />
            Sante pipeline
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Activite recente ── */}
        <TabsContent value="activite">
          <AdminDataTable<ActivityEvent>
            data={(events as ActivityEvent[]).slice(0, 50)}
            columns={activityColumns}
            getRowKey={(r) => String(r.id)}
            emptyMessage="Aucune activite recente"
            statusColumn={{ key: "status", mapping: STATUS_MAP }}
            isLoading={isLoading}
            toolbar={
              <div className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4" />
                Derniers evenements du pipeline
              </div>
            }
          />
        </TabsContent>

        {/* ── Tab 2: Carte couverture ── */}
        <TabsContent value="couverture">
          <div className="space-y-4">
            {/* Filters + Legend */}
            <Card>
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="space-y-1 sm:w-48">
                      <Select
                        name="priorityFilter"
                        value={priorityFilter}
                        onValueChange={setPriorityFilter}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <SelectItem value="">Toutes priorites</SelectItem>
                        <SelectItem value="CRITICAL">Critique</SelectItem>
                        <SelectItem value="HIGH">Eleve</SelectItem>
                        <SelectItem value="MEDIUM">Moyen</SelectItem>
                        <SelectItem value="LOW">Faible</SelectItem>
                      </Select>
                    </div>
                    <Badge variant="secondary" className="h-9 px-3">
                      {filteredGammes.length} gamme
                      {filteredGammes.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      Present
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full bg-red-200" />
                      Manquant
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <AdminDataTable<CoverageRow>
              data={filteredGammes as CoverageRow[]}
              columns={coverageColumns}
              getRowKey={(r) => String(r.pg_id)}
              emptyMessage="Aucune gamme trouvee"
              isLoading={isLoading}
              expandable
              renderExpandedRow={(row: CoverageRow) => {
                const missingGuide = GUIDE_SECTIONS.filter((s) => !row[s.key]);
                const missingConseil = ALL_CONSEIL_SECTIONS.filter(
                  (s) => !row.conseil_sections.includes(s),
                );
                return (
                  <div className="grid grid-cols-1 gap-4 p-2 sm:grid-cols-2">
                    {/* Missing guide sections */}
                    <div>
                      <h4 className="text-xs font-medium mb-2">
                        Guide achat — sections manquantes
                      </h4>
                      {missingGuide.length === 0 ? (
                        <p className="text-xs text-green-600">
                          Toutes les sections sont presentes
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {missingGuide.map((s) => (
                            <li
                              key={s.key}
                              className="flex items-center gap-1.5 text-xs text-red-600"
                            >
                              <X className="h-3 w-3" />
                              {s.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {/* Missing conseil sections */}
                    <div>
                      <h4 className="text-xs font-medium mb-2">
                        Conseils — sections manquantes
                      </h4>
                      {missingConseil.length === 0 ? (
                        <p className="text-xs text-green-600">
                          Toutes les sections sont presentes
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {missingConseil.map((s) => (
                            <li
                              key={s}
                              className="flex items-center gap-1.5 text-xs text-red-600"
                            >
                              <X className="h-3 w-3" />
                              {CONSEIL_SECTION_LABELS[s] || s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {/* RAG status */}
                    {!row.has_rag_file && (
                      <div className="col-span-full">
                        <div className="rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                          <AlertTriangle className="inline h-3 w-3 mr-1" />
                          Aucun fichier RAG trouve pour cette gamme. Le pipeline
                          ne peut pas enrichir le contenu sans source.
                        </div>
                      </div>
                    )}
                  </div>
                );
              }}
              toolbar={
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Map className="h-4 w-4" />
                  Couverture par gamme
                </div>
              }
            />
          </div>
        </TabsContent>

        {/* ── Tab 3: Sante pipeline ── */}
        <TabsContent value="sante">
          <div className="space-y-4">
            {/* Status counters */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {counts.draft || 0}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  Brouillons
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {totalPublished}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" />
                  Publies
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-gray-500">
                  {counts.skipped || 0}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <SkipForward className="h-3 w-3" />
                  Ignores
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {counts.failed || 0}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <XCircle className="h-3 w-3" />
                  Echoues
                </div>
              </div>
            </div>

            {/* Coverage summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Resume couverture
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-xl font-bold">{cov.summary.total}</div>
                    <div className="text-xs text-muted-foreground">
                      Total gammes
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-xl font-bold text-green-600">
                      {cov.summary.avgScore}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Score moyen
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 text-center border-red-200 bg-red-50/30">
                    <div className="text-xl font-bold text-red-600">
                      {cov.summary.critical}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Critiques
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 text-center border-amber-200 bg-amber-50/30">
                    <div className="text-xl font-bold text-amber-600">
                      {cov.summary.high}
                    </div>
                    <div className="text-xs text-muted-foreground">Eleves</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-xl font-bold text-blue-600">
                      {cov.summary.medium}
                    </div>
                    <div className="text-xs text-muted-foreground">Moyens</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Acces rapide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/pipeline">
                      <Activity className="mr-1.5 h-3.5 w-3.5" />
                      Pipeline detail
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/seo-drafts">
                      <FilePen className="mr-1.5 h-3.5 w-3.5" />
                      Brouillons SEO
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/qa-gate">
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      QA Gate
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/documents">
                      <FileSearch className="mr-1.5 h-3.5 w-3.5" />
                      Documents RAG
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/rag/ingest">
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Ingestion
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/content-refresh">
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Content Refresh
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
