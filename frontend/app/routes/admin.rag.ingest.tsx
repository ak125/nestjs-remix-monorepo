import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { Upload, RefreshCw, Info, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardShell } from "~/components/admin/patterns/DashboardShell";
import {
  StatusBadge,
  type StatusType,
} from "~/components/admin/patterns/StatusBadge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Select, SelectItem } from "~/components/ui/select";
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
  createNoIndexMeta("Ingestion - Admin RAG");

interface IngestionJob {
  jobId: string;
  status: string;
  startedAt: number | null;
  finishedAt: number | null;
  returnCode: number | null;
}

interface IngestResult {
  success?: boolean;
  error?: string;
  jobId?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const apiUrl = getInternalApiUrlFromRequest(
    "/api/rag/admin/ingest/pdf/jobs",
    request,
  );

  const response = await fetch(apiUrl, { headers: { Cookie: cookie } });
  const jobs: IngestionJob[] = response.ok ? await response.json() : [];

  return json({ jobs });
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ResultBanner({
  result,
  type,
}: {
  result: IngestResult | null;
  type: string;
}) {
  if (!result) return null;

  if (result.error) {
    return (
      <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
        {result.error}
      </div>
    );
  }

  if (result.success && result.jobId) {
    return (
      <div className="mt-3 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center justify-between">
        <span>Job {type} lancé avec succès</span>
        <Link
          to={`/admin/rag/ingest/${encodeURIComponent(result.jobId)}`}
          className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-200 transition-colors"
        >
          Voir les logs →
        </Link>
      </div>
    );
  }

  return null;
}

export default function AdminRagIngest() {
  const { jobs } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const refreshFetcher = useFetcher<typeof loader>();

  const [pdfPath, setPdfPath] = useState("");
  const [truthLevel, setTruthLevel] = useState("L2");
  const [pdfSubmitting, setPdfSubmitting] = useState(false);
  const [pdfResult, setPdfResult] = useState<IngestResult | null>(null);

  const [webUrl, setWebUrl] = useState("");
  const [webTruthLevel, setWebTruthLevel] = useState("L3");
  const [webSubmitting, setWebSubmitting] = useState(false);
  const [webResult, setWebResult] = useState<IngestResult | null>(null);

  // Auto-refresh jobs every 10s when there are running jobs
  const displayJobs = refreshFetcher.data?.jobs ?? jobs;
  const hasRunningJobs = displayJobs.some(
    (j) =>
      j.status === "running" ||
      j.status === "processing" ||
      j.status === "queued",
  );

  useEffect(() => {
    if (!hasRunningJobs) return;
    const interval = setInterval(() => {
      refreshFetcher.load("/admin/rag/ingest");
    }, 10_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRunningJobs]);

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfPath.trim()) {
      setPdfResult({ error: "Le chemin du PDF est requis" });
      return;
    }
    setPdfSubmitting(true);
    setPdfResult(null);
    try {
      const res = await fetch("/api/rag/admin/ingest/pdf/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfPath: pdfPath.trim(), truthLevel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPdfResult({
          error: `Erreur ${res.status}: ${data.message || JSON.stringify(data)}`,
        });
      } else {
        setPdfResult({ success: true, jobId: data.jobId });
      }
    } catch (err) {
      setPdfResult({
        error: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setPdfSubmitting(false);
      refreshFetcher.load("/admin/rag/ingest");
    }
  }

  async function handleWebSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!webUrl.trim()) {
      setWebResult({ error: "L'URL est requise" });
      return;
    }
    setWebSubmitting(true);
    setWebResult(null);
    try {
      const res = await fetch("/api/rag/admin/ingest/web/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webUrl.trim(), truthLevel: webTruthLevel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWebResult({
          error: `Erreur ${res.status}: ${data.message || JSON.stringify(data)}`,
        });
      } else {
        setWebResult({ success: true, jobId: data.jobId });
      }
    } catch (err) {
      setWebResult({
        error: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setWebSubmitting(false);
      refreshFetcher.load("/admin/rag/ingest");
    }
  }

  return (
    <DashboardShell
      title="Ingestion"
      description="Ingérer un PDF ou une URL dans le corpus RAG"
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
          <span className="text-foreground">Ingestion</span>
        </div>
      }
      actions={
        <Badge variant="secondary" className="gap-1">
          <Upload className="h-3 w-3" />
          {displayJobs.length} job(s)
        </Badge>
      }
    >
      {/* Guide d'utilisation */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-900">
                Comment ingérer un document
              </p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>
                  <strong>PDF :</strong> Placez le fichier sur le serveur via
                  SFTP dans{" "}
                  <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono">
                    /opt/automecanik/rag/pdfs/inbox/
                  </code>
                </li>
                <li>
                  <strong>URL :</strong> Collez l&apos;adresse de la page web
                  dans le formulaire ci-dessous
                </li>
                <li>Choisissez le niveau de confiance selon la source</li>
                <li>
                  Le document sera analysé, découpé et indexé automatiquement
                </li>
              </ol>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-blue-200 bg-white p-2">
                  <span className="block text-xs font-semibold text-green-700">
                    L1 — Officiel
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Doc constructeur OEM, normes
                  </span>
                </div>
                <div className="rounded-md border border-blue-200 bg-white p-2">
                  <span className="block text-xs font-semibold text-blue-700">
                    L2 — Technique
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Manuels ATE, Bosch, guides montage
                  </span>
                </div>
                <div className="rounded-md border border-blue-200 bg-white p-2">
                  <span className="block text-xs font-semibold text-amber-700">
                    L3 — Générique
                  </span>
                  <span className="text-xs text-muted-foreground">
                    FAQ, analyses, estimations
                  </span>
                </div>
                <div className="rounded-md border border-blue-200 bg-white p-2">
                  <span className="block text-xs font-semibold text-red-700">
                    L4 — Non vérifié
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Forum, retours non confirmés
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF ingest form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Nouveau PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handlePdfSubmit}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1">
              <label
                htmlFor="pdfPath"
                className="text-sm font-medium text-foreground"
              >
                Chemin complet du PDF sur le serveur
              </label>
              <Input
                id="pdfPath"
                name="pdfPath"
                placeholder="/opt/automecanik/rag/pdfs/inbox/mon-document.pdf"
                value={pdfPath}
                onChange={(e) => setPdfPath(e.target.value)}
                disabled={pdfSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Le fichier doit être accessible sur le serveur. Déposez-le via
                SFTP dans le dossier inbox.
              </p>
            </div>
            <div className="w-44 space-y-1">
              <label
                htmlFor="truthLevel"
                className="text-sm font-medium text-foreground"
              >
                Niveau de confiance
              </label>
              <Select
                value={truthLevel}
                onValueChange={setTruthLevel}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                disabled={pdfSubmitting}
                name="truthLevel"
              >
                <SelectItem value="L1">L1 — Officiel</SelectItem>
                <SelectItem value="L2">L2 — Technique</SelectItem>
                <SelectItem value="L3">L3 — Générique</SelectItem>
                <SelectItem value="L4">L4 — Non vérifié</SelectItem>
              </Select>
            </div>
            <Button type="submit" disabled={pdfSubmitting} className="gap-1.5">
              {pdfSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {pdfSubmitting ? "En cours..." : "Lancer l'ingestion"}
            </Button>
          </form>
          <ResultBanner result={pdfResult} type="PDF" />
        </CardContent>
      </Card>

      {/* Web URL ingest form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Nouvelle URL</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleWebSubmit}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1">
              <label
                htmlFor="webUrl"
                className="text-sm font-medium text-foreground"
              >
                URL de la page web
              </label>
              <Input
                id="webUrl"
                name="webUrl"
                type="url"
                placeholder="https://www.brembo.com/fr/disques-de-frein"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                disabled={webSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                La page sera fetched, convertie en markdown, puis indexée dans
                le corpus RAG.
              </p>
            </div>
            <div className="w-44 space-y-1">
              <label
                htmlFor="webTruthLevel"
                className="text-sm font-medium text-foreground"
              >
                Niveau de confiance
              </label>
              <Select
                value={webTruthLevel}
                onValueChange={setWebTruthLevel}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                disabled={webSubmitting}
                name="webTruthLevel"
              >
                <SelectItem value="L1">L1 — Officiel</SelectItem>
                <SelectItem value="L2">L2 — Technique</SelectItem>
                <SelectItem value="L3">L3 — Générique</SelectItem>
                <SelectItem value="L4">L4 — Non vérifié</SelectItem>
              </Select>
            </div>
            <Button type="submit" disabled={webSubmitting} className="gap-1.5">
              {webSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              {webSubmitting ? "En cours..." : "Ingérer l'URL"}
            </Button>
          </form>
          <ResultBanner result={webResult} type="URL" />
        </CardContent>
      </Card>

      {/* Jobs table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Jobs d&apos;ingestion
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshFetcher.load("/admin/rag/ingest")}
            className="gap-1"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshFetcher.state !== "idle" ? "animate-spin" : ""}`}
            />
            Rafraîchir
          </Button>
        </CardHeader>
        <CardContent>
          {displayJobs.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-8 text-center">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun job d&apos;ingestion
              </p>
            </div>
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
                  {displayJobs.map((job) => (
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
                        {job.jobId.slice(0, 12)}
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
