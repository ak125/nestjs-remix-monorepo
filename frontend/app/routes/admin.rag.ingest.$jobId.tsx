import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { ArrowLeft, RefreshCw, Terminal } from "lucide-react";
import { useEffect } from "react";
import { DashboardShell } from "~/components/admin/patterns/DashboardShell";
import {
  StatusBadge,
  type StatusType,
} from "~/components/admin/patterns/StatusBadge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  createNoIndexMeta(
    data?.job?.jobId ? `Job ${data.job.jobId.slice(0, 12)}` : "Job Ingestion",
  );

interface JobStatus {
  jobId: string;
  status: string;
  pid: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  returnCode: number | null;
  logPath: string;
  logTail: string[];
  type?: "pdf" | "web";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const jobId = params.jobId || "";
  const headers = { Cookie: cookie };

  // Try PDF endpoint first
  const pdfUrl = getInternalApiUrlFromRequest(
    `/api/rag/admin/ingest/pdf/jobs/${encodeURIComponent(jobId)}?tailLines=500`,
    request,
  );
  const pdfRes = await fetch(pdfUrl, { headers });

  if (pdfRes.ok) {
    const job: JobStatus = await pdfRes.json();
    job.type = "pdf";
    return json({ job, jobType: "pdf" as const });
  }

  // Fallback to WEB endpoint
  const webUrl = getInternalApiUrlFromRequest(
    `/api/rag/admin/ingest/web/jobs/${encodeURIComponent(jobId)}`,
    request,
  );
  const webRes = await fetch(webUrl, { headers });

  if (webRes.ok) {
    const raw = await webRes.json();
    const job: JobStatus = {
      ...raw,
      logPath: raw.logPath ?? "",
      logTail: raw.logTail ?? [],
      type: "web",
    };
    return json({ job, jobType: "web" as const });
  }

  throw new Response("Job introuvable", { status: 404 });
}

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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(start: number | null, end: number | null): string {
  if (!start) return "\u2014";
  const endTs = end ?? Math.floor(Date.now() / 1000);
  const seconds = endTs - start;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-mono">{value}</span>
    </div>
  );
}

export default function AdminRagIngestJobDetail() {
  const { job, jobType } = useLoaderData<typeof loader>();
  const refreshFetcher = useFetcher<typeof loader>();

  const displayJob = refreshFetcher.data?.job ?? job;
  const isRunning =
    displayJob.status === "running" || displayJob.status === "processing";

  // Auto-refresh every 3s while job is running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      refreshFetcher.load(
        `/admin/rag/ingest/${encodeURIComponent(displayJob.jobId)}`,
      );
    }, 3_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, displayJob.jobId]);

  return (
    <DashboardShell
      title={`Job ${displayJob.jobId.slice(0, 12)}`}
      description={`Ingestion ${jobType === "web" ? "Web" : "PDF"} — ${displayJob.status}`}
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
          <Link to="/admin/rag/ingest" className="hover:text-foreground">
            Ingestion
          </Link>
          <span>/</span>
          <span className="text-foreground">
            Job {displayJob.jobId.slice(0, 12)}
          </span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/rag/ingest">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Retour
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              refreshFetcher.load(
                `/admin/rag/ingest/${encodeURIComponent(displayJob.jobId)}`,
              )
            }
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshFetcher.state !== "idle" ? "animate-spin" : ""}`}
            />
            Rafraîchir
          </Button>
          <StatusBadge
            status={JOB_STATUS[displayJob.status] || "NEUTRAL"}
            label={displayJob.status}
          />
        </div>
      }
    >
      {/* Job metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Métadonnées du job
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MetaRow label="Job ID" value={displayJob.jobId} />
          <MetaRow label="PID" value={displayJob.pid?.toString() ?? "\u2014"} />
          <MetaRow
            label="Démarré"
            value={formatTimestamp(displayJob.startedAt)}
          />
          <MetaRow
            label="Terminé"
            value={formatTimestamp(displayJob.finishedAt)}
          />
          <MetaRow
            label="Durée"
            value={formatDuration(displayJob.startedAt, displayJob.finishedAt)}
          />
          <MetaRow
            label="Return code"
            value={displayJob.returnCode?.toString() ?? "\u2014"}
          />
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Logs
              {isRunning && (
                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {displayJob.logTail.length} ligne(s)
          </span>
        </CardHeader>
        <CardContent>
          {displayJob.logTail.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-8 text-center">
              <Terminal className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun log disponible
              </p>
            </div>
          ) : (
            <pre className="max-h-[600px] overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-200">
              <code>
                {displayJob.logTail.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.includes("ERROR") || line.includes("[stderr]")
                        ? "text-red-400"
                        : line.includes("WARNING")
                          ? "text-amber-400"
                          : line.includes("INFO")
                            ? "text-zinc-300"
                            : "text-zinc-400"
                    }
                  >
                    {line}
                  </div>
                ))}
              </code>
            </pre>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
