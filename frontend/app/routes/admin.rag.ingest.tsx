import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import {
  Upload,
  RefreshCw,
  Info,
  Globe,
  FlaskConical,
  Eye,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminDataTable, type DataColumn } from "~/components/admin/patterns";
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
  type: "pdf" | "web";
  url?: string;
  errorMessage?: string | null;
}

interface IngestResult {
  success?: boolean;
  error?: string;
  jobId?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookie };

  const [pdfRes, webRes] = await Promise.all([
    fetch(
      getInternalApiUrlFromRequest("/api/rag/admin/ingest/pdf/jobs", request),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest("/api/rag/admin/ingest/web/jobs", request),
      { headers },
    ),
  ]);

  const pdfRaw: Omit<IngestionJob, "type">[] = pdfRes.ok
    ? await pdfRes.json()
    : [];
  const webRaw: (Omit<IngestionJob, "type"> & {
    url?: string;
    errorMessage?: string | null;
  })[] = webRes.ok ? await webRes.json() : [];

  const jobs: IngestionJob[] = [
    ...pdfRaw.map((j) => ({ ...j, type: "pdf" as const })),
    ...webRaw.map((j) => ({
      ...j,
      type: "web" as const,
      url: j.url,
      errorMessage: j.errorMessage,
    })),
  ].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

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
        <span>Job {type} lance avec succes</span>
        <Link
          to={`/admin/rag/ingest/${encodeURIComponent(result.jobId)}`}
          className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-200 transition-colors"
        >
          Voir les logs &rarr;
        </Link>
      </div>
    );
  }

  return null;
}

function RetryButton({
  job,
  onRetry,
}: {
  job: IngestionJob;
  onRetry: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  async function handleRetry(e: React.MouseEvent) {
    e.stopPropagation();
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(
        `/api/rag/admin/ingest/web/jobs/${encodeURIComponent(job.jobId)}/retry`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRetryError(data.message || `Erreur ${res.status}`);
      } else {
        onRetry();
      }
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRetry}
        disabled={retrying}
        className="gap-1 text-xs h-7 px-2"
      >
        <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
        Relancer
      </Button>
      {retryError && (
        <span className="text-xs text-red-600 max-w-[160px] text-right">
          {retryError}
        </span>
      )}
    </div>
  );
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

  // PDF → RAG Merge state
  const [mergePdfPath, setMergePdfPath] = useState("");
  const [mergePgAlias, setMergePgAlias] = useState("");
  const [mergeTruthLevel, setMergeTruthLevel] = useState("L2");
  const [mergeSourceRef, setMergeSourceRef] = useState("");
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [mergeMode, setMergeMode] = useState<"preview" | "apply">("preview");
  const [mergeResult, setMergeResult] = useState<{
    status?: string;
    extractedChars?: number;
    pages?: number;
    confidence?: number;
    patch?: unknown;
    mergedFile?: string;
    dbSync?: { inserted: number; updated: number; skipped: number };
    queuedPageTypes?: string[];
    error?: string;
  } | null>(null);

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

  const ingestColumns: DataColumn<IngestionJob>[] = [
    {
      key: "jobId",
      header: "Job ID",
      render: (_val, row) => (
        <span className="font-mono text-xs">{row.jobId.slice(0, 12)}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (_val, row) => (
        <Badge
          variant={row.type === "web" ? "default" : "secondary"}
          className={
            row.type === "web"
              ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
              : "bg-gray-100 text-gray-700 hover:bg-gray-100"
          }
        >
          {row.type === "web" ? "URL" : "PDF"}
        </Badge>
      ),
    },
    {
      key: "url" as keyof IngestionJob,
      header: "URL",
      render: (_val, row) =>
        row.url ? (
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-[250px] truncate text-xs text-blue-600 hover:underline"
            title={row.url}
          >
            {row.url.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (_val, row) => (
        <StatusBadge
          status={JOB_STATUS[row.status] || "NEUTRAL"}
          label={row.status}
          size="sm"
        />
      ),
    },
    {
      key: "startedAt",
      header: "Demarre",
      render: (_val, row) => (
        <span className="text-sm text-muted-foreground">
          {formatTimestamp(row.startedAt)}
        </span>
      ),
    },
    {
      key: "finishedAt",
      header: "Termine",
      render: (_val, row) => (
        <span className="text-sm text-muted-foreground">
          {formatTimestamp(row.finishedAt)}
        </span>
      ),
    },
    {
      key: "returnCode",
      header: "Code",
      align: "right" as const,
      render: (_val, row) => (
        <span className="font-mono text-sm">{row.returnCode ?? "\u2014"}</span>
      ),
    },
    {
      key: "errorMessage" as keyof IngestionJob,
      header: "Erreur",
      render: (_val, row) =>
        row.status === "failed" && row.errorMessage ? (
          <span
            className="block max-w-[220px] truncate text-xs text-red-600"
            title={row.errorMessage}
          >
            {row.errorMessage}
          </span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
    {
      key: "jobId" as keyof IngestionJob,
      header: "",
      render: (_val, row) =>
        row.type === "web" && row.status === "failed" ? (
          <RetryButton
            job={row}
            onRetry={() => refreshFetcher.load("/admin/rag/ingest")}
          />
        ) : null,
    },
  ];

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

  async function handleMerge(mode: "preview" | "apply") {
    if (!mergePdfPath.trim() || !mergePgAlias.trim()) {
      setMergeResult({
        error: "Le chemin PDF et la gamme (pgAlias) sont requis",
      });
      return;
    }
    setMergeSubmitting(true);
    setMergeMode(mode);
    setMergeResult(null);
    try {
      const res = await fetch(`/api/admin/rag/pdf-merge/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfPath: mergePdfPath.trim(),
          pgAlias: mergePgAlias.trim(),
          truthLevel: mergeTruthLevel,
          ...(mergeSourceRef.trim() && { sourceRef: mergeSourceRef.trim() }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMergeResult({
          error: `Erreur ${res.status}: ${data.message || JSON.stringify(data)}`,
        });
      } else {
        setMergeResult(data);
      }
    } catch (err) {
      setMergeResult({
        error: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setMergeSubmitting(false);
    }
  }

  return (
    <DashboardShell
      title="Ingestion"
      description="Ingerer un PDF ou une URL dans le corpus RAG"
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
                Comment ingerer un document
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
                  Le document sera analyse, decoupe et indexe automatiquement
                </li>
              </ol>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-blue-200 bg-white p-2">
                  <span className="block text-xs font-semibold text-green-700">
                    L1 &mdash; Officiel
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Doc constructeur OEM, normes
                  </span>
                </div>
                <div className="rounded-md border border-blue-200 bg-white p-2">
                  <span className="block text-xs font-semibold text-blue-700">
                    L2 &mdash; Technique
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Manuels ATE, Bosch, guides montage
                  </span>
                </div>
                <div className="rounded-md border border-blue-200 bg-white p-2">
                  <span className="block text-xs font-semibold text-amber-700">
                    L3 &mdash; Generique
                  </span>
                  <span className="text-xs text-muted-foreground">
                    FAQ, analyses, estimations
                  </span>
                </div>
                <div className="rounded-md border border-blue-200 bg-white p-2">
                  <span className="block text-xs font-semibold text-red-700">
                    L4 &mdash; Non verifie
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Forum, retours non confirmes
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
                Le fichier doit etre accessible sur le serveur. Deposez-le via
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
                <SelectItem value="L1">L1 &mdash; Officiel</SelectItem>
                <SelectItem value="L2">L2 &mdash; Technique</SelectItem>
                <SelectItem value="L3">L3 &mdash; Generique</SelectItem>
                <SelectItem value="L4">L4 &mdash; Non verifie</SelectItem>
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
                La page sera fetched, convertie en markdown, puis indexee dans
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
                <SelectItem value="L1">L1 &mdash; Officiel</SelectItem>
                <SelectItem value="L2">L2 &mdash; Technique</SelectItem>
                <SelectItem value="L3">L3 &mdash; Generique</SelectItem>
                <SelectItem value="L4">L4 &mdash; Non verifie</SelectItem>
              </Select>
            </div>
            <Button type="submit" disabled={webSubmitting} className="gap-1.5">
              {webSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              {webSubmitting ? "En cours..." : "Ingerer l'URL"}
            </Button>
          </form>
          <ResultBanner result={webResult} type="URL" />
        </CardContent>
      </Card>

      {/* PDF → RAG Merge */}
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="h-4 w-4 text-purple-600" />
            PDF &rarr; RAG Merge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Extrait le texte d&apos;un PDF, le classifie par sections RAG, puis
            fusionne dans le fichier .md de la gamme. Utilisez{" "}
            <strong>Preview</strong> pour voir le patch avant d&apos;appliquer.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="mergePdfPath" className="text-sm font-medium">
                Chemin du PDF
              </label>
              <Input
                id="mergePdfPath"
                placeholder="/opt/automecanik/rag/pdfs/inbox/doc.pdf"
                value={mergePdfPath}
                onChange={(e) => setMergePdfPath(e.target.value)}
                disabled={mergeSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="mergePgAlias" className="text-sm font-medium">
                Gamme cible (pgAlias)
              </label>
              <Input
                id="mergePgAlias"
                placeholder="filtre-a-huile"
                value={mergePgAlias}
                onChange={(e) => setMergePgAlias(e.target.value)}
                disabled={mergeSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="mergeTruthLevel" className="text-sm font-medium">
                Niveau de confiance
              </label>
              <Select
                value={mergeTruthLevel}
                onValueChange={setMergeTruthLevel}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                disabled={mergeSubmitting}
                name="mergeTruthLevel"
              >
                <SelectItem value="L1">L1 &mdash; Officiel</SelectItem>
                <SelectItem value="L2">L2 &mdash; Technique</SelectItem>
                <SelectItem value="L3">L3 &mdash; Generique</SelectItem>
                <SelectItem value="L4">L4 &mdash; Non verifie</SelectItem>
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="mergeSourceRef" className="text-sm font-medium">
                Reference source{" "}
                <span className="text-muted-foreground">(optionnel)</span>
              </label>
              <Input
                id="mergeSourceRef"
                placeholder="ex: bosch-filtre-2024.pdf"
                value={mergeSourceRef}
                onChange={(e) => setMergeSourceRef(e.target.value)}
                disabled={mergeSubmitting}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleMerge("preview")}
              disabled={mergeSubmitting}
              className="gap-1.5"
            >
              {mergeSubmitting && mergeMode === "preview" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview
            </Button>
            <Button
              onClick={() => handleMerge("apply")}
              disabled={mergeSubmitting}
              className="gap-1.5 bg-purple-600 hover:bg-purple-700"
            >
              {mergeSubmitting && mergeMode === "apply" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              Apply
            </Button>
          </div>

          {/* Merge result */}
          {mergeResult && (
            <div
              className={`rounded-md border p-3 text-sm ${mergeResult.error ? "bg-red-50 border-red-200 text-red-800" : "bg-purple-50 border-purple-200 text-purple-900"}`}
            >
              {mergeResult.error ? (
                <p>{mergeResult.error}</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-purple-100 text-purple-700"
                    >
                      {mergeResult.status === "preview" ? "Preview" : "Applied"}
                    </Badge>
                    {mergeResult.confidence !== undefined && (
                      <Badge
                        variant="secondary"
                        className={
                          mergeResult.confidence >= 0.8
                            ? "bg-green-100 text-green-700"
                            : mergeResult.confidence >= 0.5
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }
                      >
                        Confidence: {(mergeResult.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                    {mergeResult.extractedChars !== undefined && (
                      <Badge variant="outline">
                        {mergeResult.extractedChars.toLocaleString()} chars
                      </Badge>
                    )}
                    {mergeResult.pages !== undefined && (
                      <Badge variant="outline">{mergeResult.pages} pages</Badge>
                    )}
                  </div>
                  {mergeResult.mergedFile && (
                    <p className="text-xs">
                      Fichier merge :{" "}
                      <code className="rounded bg-purple-100 px-1 py-0.5 font-mono text-xs">
                        {mergeResult.mergedFile}
                      </code>
                    </p>
                  )}
                  {mergeResult.dbSync && (
                    <p className="text-xs">
                      DB Sync : {mergeResult.dbSync.inserted} inseres,{" "}
                      {mergeResult.dbSync.updated} mis a jour,{" "}
                      {mergeResult.dbSync.skipped} ignores
                    </p>
                  )}
                  {mergeResult.queuedPageTypes &&
                    mergeResult.queuedPageTypes.length > 0 && (
                      <p className="text-xs">
                        En queue : {mergeResult.queuedPageTypes.join(", ")}
                      </p>
                    )}
                  {mergeResult.patch != null && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-purple-700 hover:underline">
                        Voir le patch YAML
                      </summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-900 p-2 text-xs text-green-300">
                        {typeof mergeResult.patch === "string"
                          ? mergeResult.patch
                          : JSON.stringify(mergeResult.patch, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
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
            Rafraichir
          </Button>
        </CardHeader>
        <CardContent>
          <AdminDataTable<IngestionJob>
            data={displayJobs as IngestionJob[]}
            columns={ingestColumns}
            getRowKey={(row) => `${row.jobId}-${row.type}`}
            onRowClick={(job) =>
              navigate(`/admin/rag/ingest/${encodeURIComponent(job.jobId)}`)
            }
            emptyMessage="Aucun job d'ingestion"
            isLoading={refreshFetcher.state !== "idle"}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
