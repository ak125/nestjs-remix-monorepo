import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Upload,
  Brain,
  RefreshCw,
  Image,
  Activity,
  CheckCircle2,
  XCircle,
  SkipForward,
  FilePen,
} from "lucide-react";
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
  createNoIndexMeta("RAG Dashboard - Admin");

interface CorpusStats {
  total: number;
  byTruthLevel: Record<string, number>;
  byDocFamily: Record<string, number>;
  bySourceType: Record<string, number>;
  ragStatus: "up" | "down";
}

interface IntentStats {
  totalMessages: number;
  intents: Array<{
    userIntent: string;
    volume: number;
    averageConfidence: number;
    lastSeenAt: string | null;
  }>;
}

interface IngestionJob {
  jobId: string;
  status: string;
  startedAt: number | null;
  finishedAt: number | null;
  returnCode: number | null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";

  const [corpusRes, intentsRes, jobsRes, pipelineRes] =
    await Promise.allSettled([
      fetch(
        getInternalApiUrlFromRequest("/api/rag/admin/corpus/stats", request),
        {
          headers: { Cookie: cookie },
        },
      ),
      fetch(getInternalApiUrlFromRequest("/api/rag/intents/stats", request), {
        headers: { Cookie: cookie },
      }),
      fetch(
        getInternalApiUrlFromRequest("/api/rag/admin/ingest/pdf/jobs", request),
        { headers: { Cookie: cookie } },
      ),
      fetch(
        getInternalApiUrlFromRequest(
          "/api/admin/content-refresh/dashboard",
          request,
        ),
        { headers: { Cookie: cookie } },
      ),
    ]);

  const rawCorpus =
    corpusRes.status === "fulfilled" && corpusRes.value.ok
      ? await corpusRes.value.json()
      : {};

  const corpus: CorpusStats = {
    total: rawCorpus.total ?? 0,
    byTruthLevel: rawCorpus.byTruthLevel ?? {},
    byDocFamily: rawCorpus.byDocFamily ?? {},
    bySourceType: rawCorpus.bySourceType ?? {},
    ragStatus: rawCorpus.ragStatus ?? "down",
  };

  const intents: IntentStats =
    intentsRes.status === "fulfilled" && intentsRes.value.ok
      ? await intentsRes.value.json()
      : { totalMessages: 0, intents: [] };

  const jobs: IngestionJob[] =
    jobsRes.status === "fulfilled" && jobsRes.value.ok
      ? await jobsRes.value.json()
      : [];

  const pipeline: { counts: Record<string, number> } =
    pipelineRes.status === "fulfilled" && pipelineRes.value.ok
      ? await pipelineRes.value.json()
      : { counts: {} };

  return json({ corpus, intents, jobs, pipeline });
}

const TRUTH_STATUS: Record<string, StatusType> = {
  L1: "PASS",
  L2: "INFO",
  L3: "WARN",
  L4: "FAIL",
};

const JOB_STATUS: Record<string, StatusType> = {
  done: "PASS",
  completed: "PASS",
  running: "INFO",
  processing: "INFO",
  queued: "PENDING",
  failed: "FAIL",
  error: "FAIL",
};

function formatTimestamp(ts: number | null): string {
  if (!ts) return "\u2014";
  return new Date(ts * 1000).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminRagDashboard() {
  const { corpus, intents, jobs, pipeline } = useLoaderData<typeof loader>();
  const refreshFetcher = useFetcher<typeof loader>();
  const navigate = useNavigate();

  const displayData = refreshFetcher.data ?? {
    corpus,
    intents,
    jobs,
    pipeline,
  };
  const c = displayData.corpus;
  const i = displayData.intents;
  const j = displayData.jobs;
  const p = displayData.pipeline?.counts ?? {};

  const isLoading = refreshFetcher.state !== "idle";

  const verifiedCount =
    (c.byTruthLevel["L1"] || 0) + (c.byTruthLevel["L2"] || 0);
  const unverifiedCount =
    (c.byTruthLevel["L3"] || 0) + (c.byTruthLevel["L4"] || 0);

  return (
    <DashboardShell
      title="RAG & Knowledge"
      description="Tableau de bord du corpus de connaissances et du pipeline d'enrichissement"
      breadcrumb={
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <span>/</span>
          <span className="text-foreground">RAG & Knowledge</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshFetcher.load("/admin/rag")}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Rafraichir
          </Button>
          <StatusBadge
            status={c.ragStatus === "up" ? "PASS" : "FAIL"}
            label={c.ragStatus === "up" ? "RAG En ligne" : "RAG Hors ligne"}
          />
        </div>
      }
      kpis={
        <KpiGrid columns={4}>
          <KpiCard
            title="Documents"
            value={c.total}
            icon={FileText}
            variant="info"
          />
          <KpiCard
            title="Verifies (L1+L2)"
            value={verifiedCount}
            icon={ShieldCheck}
            variant="success"
          />
          <KpiCard
            title="Non verifies (L3+L4)"
            value={unverifiedCount}
            icon={AlertTriangle}
            variant="warning"
          />
          <KpiCard
            title="Jobs ingestion"
            value={j.length}
            icon={Upload}
            variant="default"
          />
        </KpiGrid>
      }
    >
      {/* D4: Actions rapides — SEO Drafts ajoute */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/documents">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Documents
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/ingest">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Ingestion
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/pipeline">
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Pipeline
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/qa-gate">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            QA Gate
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/seo-drafts">
            <FilePen className="mr-1.5 h-3.5 w-3.5" />
            Brouillons SEO
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/images">
            <Image className="mr-1.5 h-3.5 w-3.5" />
            Images
          </Link>
        </Button>
      </div>

      {/* D1: Loading overlay sur le contenu principal */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Repartition par niveau de verite */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Niveau de verite
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(c.byTruthLevel)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([level, count]) => {
                      const status = TRUTH_STATUS[level];
                      return status ? (
                        <StatusBadge
                          key={level}
                          status={status}
                          label={`${level}: ${count}`}
                        />
                      ) : (
                        <Badge key={level} variant="secondary">
                          {level}: {count}
                        </Badge>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* D3: Repartition par famille — Badge component */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Par famille
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(c.byDocFamily)
                    .sort(([, a], [, b]) => b - a)
                    .map(([family, count]) => (
                      <Badge key={family} variant="outline">
                        {count} {family}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Repartition par type source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Par type source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(c.bySourceType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <Badge key={type} variant="secondary">
                        {count} {type}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Intent Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Intents RAG ({i.totalMessages} messages)
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {i.intents
                    .filter((intent) => intent.volume > 0)
                    .sort((a, b) => b.volume - a.volume)
                    .map((intent) => (
                      <div
                        key={intent.userIntent}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium">{intent.userIntent}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">
                            {(intent.averageConfidence * 100).toFixed(0)}%
                          </span>
                          <Badge variant="secondary">{intent.volume}</Badge>
                        </div>
                      </div>
                    ))}
                  {i.intents.filter((intent) => intent.volume > 0).length ===
                    0 && (
                    <div className="rounded-lg border bg-muted/30 p-6 text-center">
                      <Brain className="mx-auto h-8 w-8 text-muted-foreground/30" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Aucun message classifie
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* D2: Pipeline Content Refresh — couleurs semantiques + FR */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Pipeline Content Refresh
                </div>
              </CardTitle>
              <Button variant="outline" size="sm" asChild className="gap-1">
                <Link to="/admin/rag/pipeline">Voir tout &rarr;</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-info">
                    {p.draft || 0}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Brouillon
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-success">
                    {(p.published || 0) + (p.auto_published || 0)}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3" />
                    Publie
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {p.skipped || 0}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <SkipForward className="h-3 w-3" />
                    Ignore
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {p.failed || 0}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <XCircle className="h-3 w-3" />
                    Echoue
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* D5+D6+D7: Jobs recents — empty state + Badge ID + en-tetes FR */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Jobs d&apos;ingestion recents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {j.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-8 text-center">
                  <Upload className="mx-auto h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Aucun job d&apos;ingestion recent
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Identifiant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Demarre</TableHead>
                        <TableHead>Termine</TableHead>
                        <TableHead className="text-right">
                          Code retour
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {j.slice(0, 10).map((job) => (
                        <TableRow
                          key={job.jobId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            navigate(
                              `/admin/rag/ingest/${encodeURIComponent(job.jobId)}`,
                            )
                          }
                        >
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="font-mono text-xs"
                            >
                              {job.jobId.slice(0, 12)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={JOB_STATUS[job.status] || "NEUTRAL"}
                              label={job.status}
                              size="sm"
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTimestamp(job.startedAt)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTimestamp(job.finishedAt)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {job.returnCode ?? "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
