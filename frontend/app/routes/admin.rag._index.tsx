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

  const [corpusRes, intentsRes, jobsRes] = await Promise.allSettled([
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
  ]);

  const corpus: CorpusStats =
    corpusRes.status === "fulfilled" && corpusRes.value.ok
      ? await corpusRes.value.json()
      : {
          total: 0,
          byTruthLevel: {},
          byDocFamily: {},
          bySourceType: {},
          ragStatus: "down" as const,
        };

  const intents: IntentStats =
    intentsRes.status === "fulfilled" && intentsRes.value.ok
      ? await intentsRes.value.json()
      : { totalMessages: 0, intents: [] };

  const jobs: IngestionJob[] =
    jobsRes.status === "fulfilled" && jobsRes.value.ok
      ? await jobsRes.value.json()
      : [];

  return json({ corpus, intents, jobs });
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

const FAMILY_COLORS: Record<string, string> = {
  knowledge: "bg-indigo-100 text-indigo-800",
  catalog: "bg-emerald-100 text-emerald-800",
  diagnostic: "bg-orange-100 text-orange-800",
  media: "bg-purple-100 text-purple-800",
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
  const { corpus, intents, jobs } = useLoaderData<typeof loader>();
  const refreshFetcher = useFetcher<typeof loader>();
  const navigate = useNavigate();

  const displayData = refreshFetcher.data ?? { corpus, intents, jobs };
  const c = displayData.corpus;
  const i = displayData.intents;
  const j = displayData.jobs;

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
              className={`h-3.5 w-3.5 ${refreshFetcher.state !== "idle" ? "animate-spin" : ""}`}
            />
            Rafraîchir
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
            title="Vérifiés (L1+L2)"
            value={verifiedCount}
            icon={ShieldCheck}
            variant="success"
          />
          <KpiCard
            title="Non vérifiés (L3+L4)"
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
      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/documents">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Voir les documents
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/ingest">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Ingérer un PDF
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/images">
            <Image className="mr-1.5 h-3.5 w-3.5" />
            Images
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Répartition par niveau de vérité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Niveau de vérité
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

        {/* Répartition par famille */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Par famille</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(c.byDocFamily)
                .sort(([, a], [, b]) => b - a)
                .map(([family, count]) => (
                  <span
                    key={family}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${FAMILY_COLORS[family] || "bg-gray-100 text-gray-800"}`}
                  >
                    {count} {family}
                  </span>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Répartition par type source */}
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
              {i.intents.filter((intent) => intent.volume > 0).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun message classifié
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs récents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Jobs d&apos;ingestion récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {j.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun job</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Démarré</TableHead>
                    <TableHead>Terminé</TableHead>
                    <TableHead className="text-right">Return code</TableHead>
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
                      <TableCell className="font-mono text-xs">
                        <span className="underline decoration-muted-foreground/40">
                          {job.jobId.slice(0, 12)}
                        </span>
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
    </DashboardShell>
  );
}
