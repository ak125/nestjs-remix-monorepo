import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  Shield,
  Activity,
  Settings,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Download,
  Play,
  Loader2,
  Film,
  FileText,
  HardDrive,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface ExecutionLog {
  id: number;
  briefId: string;
  videoType: string;
  vertical: string;
  status: string;
  bullmqJobId: string | null;
  triggerSource: string;
  triggerJobId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  artefactCheck: { canProceed: boolean; missingArtefacts: string[] } | null;
  gateResults: Array<{
    gate: string;
    verdict: "PASS" | "WARN" | "FAIL";
    details: string[];
    measured: number;
    warnThreshold: number;
    failThreshold: number;
  }> | null;
  canPublish: boolean | null;
  qualityScore: number | null;
  qualityFlags: string[] | null;
  errorMessage: string | null;
  durationMs: number | null;
  attemptNumber: number;
  featureFlags: { pipeline_enabled: boolean; gates_blocking: boolean } | null;
  engineName: string | null;
  engineVersion: string | null;
  renderStatus: string | null;
  renderOutputPath: string | null;
  renderMetadata: Record<string, unknown> | null;
  renderDurationMs: number | null;
  renderErrorCode: string | null;
  engineResolution: string | null;
  retryable: boolean;
  // P5: canary tracking
  isCanary: boolean;
  canaryFallback: boolean;
  canaryErrorMessage: string | null;
  canaryErrorCode: string | null;
}

interface VariantRecord {
  name: string;
  s3Path: string;
  codec: string;
  resolution: string;
  fileSizeBytes: number;
  durationSecs: number | null;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const executionLogId = params.executionLogId;

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/video/executions/${executionLogId}`,
      { headers: { Cookie: cookieHeader } },
    );

    if (!res.ok) return json({ execution: null, error: "Not found" });

    const data = await res.json();
    const execution = data.data as ExecutionLog;

    // Fetch variants if execution completed
    let variants: VariantRecord[] = [];
    if (execution.status === "completed") {
      try {
        const varRes = await fetch(
          `${backendUrl}/api/admin/video/executions/${executionLogId}/variants`,
          { headers: { Cookie: cookieHeader } },
        );
        if (varRes.ok) {
          const varData = await varRes.json();
          variants = varData.data ?? [];
        }
      } catch {
        // Non-fatal
      }
    }

    return json({ execution, variants, error: null });
  } catch {
    return json({ execution: null, variants: [], error: "Erreur chargement" });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const executionLogId = params.executionLogId;

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/video/executions/${executionLogId}/retry`,
      { method: "POST", headers: { Cookie: cookieHeader } },
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      return json({
        ok: false,
        error: data.error ?? data.message ?? "Erreur retry",
      });
    }
    return json({ ok: true, newExecutionId: data.data?.id ?? null });
  } catch {
    return json({ ok: false, error: "Erreur reseau" });
  }
}

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; icon: typeof Clock }
> = {
  pending: {
    color: "text-gray-600",
    bg: "bg-gray-100 text-gray-700",
    icon: Clock,
  },
  processing: {
    color: "text-blue-600",
    bg: "bg-blue-100 text-blue-700",
    icon: Activity,
  },
  completed: {
    color: "text-green-600",
    bg: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  failed: {
    color: "text-red-600",
    bg: "bg-red-100 text-red-700",
    icon: XCircle,
  },
};

const VERDICT_CONFIG = {
  PASS: {
    bg: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-700",
  },
  WARN: {
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
  },
  FAIL: { bg: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-700" },
};

const GATE_LABELS: Record<string, string> = {
  truth: "G1 Truth",
  safety: "G2 Safety (STRICT)",
  brand: "G3 Brand",
  platform: "G4 Platform",
  reuse_risk: "G5 Reuse Risk",
  visual_role: "G6 Visual Role (STRICT)",
  final_qa: "G7 Final QA",
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function computeDuration(
  startIso: string | null,
  endIso: string | null,
): string {
  if (!startIso || !endIso) return "\u2014";
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (diff < 0 || isNaN(diff)) return "\u2014";
  if (diff < 1000) return `${diff}ms`;
  return `${(diff / 1000).toFixed(1)}s`;
}

function CopyJsonButton({ data, label }: { data: unknown; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [data]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="text-xs gap-1"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copie !" : label}
    </Button>
  );
}

function RenderMetadataSection({
  metadata,
}: {
  metadata: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">Render Metadata</div>
        <div className="flex gap-2">
          <CopyJsonButton data={metadata} label="Copy JSON" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs gap-1"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {expanded ? "Reduire" : "Voir"}
          </Button>
        </div>
      </div>
      {expanded && (
        <pre className="mt-2 text-xs bg-gray-50 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

function VideoPreviewSection({
  executionLogId,
  renderOutputPath,
}: {
  executionLogId: number;
  renderOutputPath: string;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const streamUrl = `/api/admin/video/executions/${executionLogId}/stream`;

  return (
    <div className="mt-3 border-t pt-3">
      <div className="text-xs text-gray-500 mb-2">Output Video</div>
      <div className="font-mono text-xs text-gray-400 mb-2">
        {renderOutputPath}
      </div>
      {showVideo ? (
        <video
          controls
          autoPlay
          src={streamUrl}
          className="max-w-lg rounded border border-gray-200"
        >
          Votre navigateur ne supporte pas la lecture video.
        </video>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVideo(true)}
            className="text-xs gap-1"
          >
            <Play className="h-3 w-3" />
            Charger la video
          </Button>
          <a
            href={streamUrl}
            download={`render-${executionLogId}.mp4`}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <Download className="h-3 w-3" />
            Telecharger
          </a>
        </div>
      )}
    </div>
  );
}

export default function ExecutionDetail() {
  const { execution, variants, error } = useLoaderData<typeof loader>();
  const retryFetcher = useFetcher<{
    ok: boolean;
    error?: string;
    newExecutionId?: number | null;
  }>();

  if (!execution) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/video-hub/productions"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            {error || "Execution introuvable."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[execution.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConf.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/admin/video-hub/productions/${execution.briefId}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" /> Production
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">
            Execution #{execution.id}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1"
            onClick={() => {
              const incident = {
                schemaVersion: "1.1.0",
                exportedAt: new Date().toISOString(),
                execution: {
                  id: execution.id,
                  briefId: execution.briefId,
                  status: execution.status,
                  attemptNumber: execution.attemptNumber,
                  triggerSource: execution.triggerSource,
                  durationMs: execution.durationMs,
                  createdAt: execution.createdAt,
                  startedAt: execution.startedAt,
                  completedAt: execution.completedAt,
                },
                error: {
                  errorMessage: execution.errorMessage,
                  renderErrorCode: execution.renderErrorCode,
                  retryable: execution.retryable,
                },
                render: {
                  engineName: execution.engineName,
                  engineVersion: execution.engineVersion,
                  renderStatus: execution.renderStatus,
                  engineResolution: execution.engineResolution,
                  renderDurationMs: execution.renderDurationMs,
                  renderOutputPath: execution.renderOutputPath,
                  renderMetadata: execution.renderMetadata,
                },
                canary: {
                  isCanary: execution.isCanary,
                  canaryFallback: execution.canaryFallback,
                  canaryErrorCode: execution.canaryErrorCode,
                  canaryErrorMessage: execution.canaryErrorMessage,
                },
                gates: execution.gateResults,
                quality: {
                  qualityScore: execution.qualityScore,
                  qualityFlags: execution.qualityFlags,
                },
                featureFlags: execution.featureFlags,
              };
              const blob = new Blob([JSON.stringify(incident, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `incident-exec-${execution.id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-3 w-3" />
            Export Incident
          </Button>
          <Badge className={statusConf.bg}>
            <StatusIcon className={`h-3 w-3 mr-1 ${statusConf.color}`} />
            {execution.status}
          </Badge>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Brief ID</div>
            <Link
              to={`/admin/video-hub/productions/${execution.briefId}`}
              className="font-medium text-blue-600 hover:underline text-sm"
            >
              {execution.briefId}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Trigger</div>
            <div className="font-medium capitalize">
              {execution.triggerSource}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Attempt</div>
            <div className="font-medium">#{execution.attemptNumber}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Duree totale</div>
            <div className="font-medium">
              {formatDuration(execution.durationMs)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500">Cree</div>
              <div>{formatDate(execution.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Demarre</div>
              <div>{formatDate(execution.startedAt)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Termine</div>
              <div>{formatDate(execution.completedAt)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Queue Wait</div>
              <div className="font-mono text-xs">
                {computeDuration(execution.createdAt, execution.startedAt)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Processing</div>
              <div className="font-mono text-xs">
                {computeDuration(execution.startedAt, execution.completedAt)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">BullMQ Job</div>
              <div className="font-mono text-xs">
                {execution.bullmqJobId ?? "\u2014"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Render Engine */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Render Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500">Engine</div>
              <div className="font-medium">
                {execution.engineName ?? "\u2014"}
                {execution.engineVersion ? ` v${execution.engineVersion}` : ""}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Render Status</div>
              <div>
                {execution.renderStatus ? (
                  <Badge
                    className={
                      execution.renderStatus === "success"
                        ? "bg-green-100 text-green-700"
                        : execution.renderStatus === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                    }
                  >
                    {execution.renderStatus}
                  </Badge>
                ) : (
                  "\u2014"
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Render Duration</div>
              <div>{formatDuration(execution.renderDurationMs)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Error Code</div>
              <div>
                {execution.renderErrorCode ? (
                  <Badge className="bg-red-100 text-red-700 text-xs">
                    {execution.renderErrorCode}
                  </Badge>
                ) : (
                  <span className="text-green-600">None</span>
                )}
              </div>
            </div>
          </div>
          {/* Row 2: Resolution + Retryable + Canary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
            <div>
              <div className="text-xs text-gray-500">Engine Resolution</div>
              <div>
                {execution.engineResolution ? (
                  <Badge
                    className={
                      execution.engineResolution === "requested"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }
                  >
                    {execution.engineResolution}
                  </Badge>
                ) : (
                  "\u2014"
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Retryable</div>
              <div>
                <Badge
                  className={
                    execution.retryable
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  }
                >
                  {execution.retryable ? "Oui" : "Non"}
                </Badge>
              </div>
            </div>
            {execution.isCanary && (
              <div>
                <div className="text-xs text-gray-500">Canary</div>
                <div className="flex gap-1">
                  <Badge className="bg-purple-100 text-purple-700">
                    Canary
                  </Badge>
                  {execution.canaryFallback && (
                    <Badge className="bg-amber-100 text-amber-700">
                      Fallback
                    </Badge>
                  )}
                </div>
              </div>
            )}
            {execution.canaryErrorCode && (
              <div>
                <div className="text-xs text-gray-500">Canary Error</div>
                <Badge className="bg-red-100 text-red-700 text-xs">
                  {execution.canaryErrorCode}
                </Badge>
              </div>
            )}
          </div>
          {execution.renderOutputPath && (
            <VideoPreviewSection
              executionLogId={execution.id}
              renderOutputPath={execution.renderOutputPath}
            />
          )}
          {execution.renderMetadata &&
            Object.keys(execution.renderMetadata).length > 0 && (
              <RenderMetadataSection metadata={execution.renderMetadata} />
            )}
        </CardContent>
      </Card>

      {/* Variants (postprocess outputs) */}
      {variants && variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Film className="h-4 w-4" />
              Variantes ({variants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {variants.map((v: VariantRecord) => (
                <div
                  key={v.name}
                  className="border rounded-lg p-4 bg-gray-50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{v.name}</span>
                    <Badge className="bg-blue-100 text-blue-700 text-xs">
                      {v.codec}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {v.resolution}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {v.fileSizeBytes
                        ? `${(v.fileSizeBytes / 1024 / 1024).toFixed(1)} MB`
                        : "\u2014"}
                    </div>
                  </div>
                  {v.durationSecs != null && (
                    <div className="text-xs text-gray-400">
                      {v.durationSecs.toFixed(1)}s
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {execution.errorMessage && (
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Erreur
              </CardTitle>
              <CopyJsonButton
                data={{
                  errorMessage: execution.errorMessage,
                  renderErrorCode: execution.renderErrorCode,
                }}
                label="Copy"
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 font-mono bg-red-50 p-3 rounded">
              {execution.errorMessage}
            </p>
            {execution.retryable && execution.status === "failed" && (
              <div className="mt-3 pt-3 border-t">
                <retryFetcher.Form method="post">
                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={retryFetcher.state !== "idle"}
                      className="gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      {retryFetcher.state !== "idle" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      {retryFetcher.state !== "idle"
                        ? "Relance..."
                        : "Relancer cette execution"}
                    </Button>
                    <span className="text-xs text-blue-600">
                      Cette execution peut etre relancee (retryable)
                    </span>
                  </div>
                </retryFetcher.Form>
                {retryFetcher.data?.ok === true && (
                  <div className="mt-2 rounded bg-green-50 border border-green-200 p-2 text-sm text-green-700 flex items-center justify-between">
                    <span>Nouvelle execution soumise.</span>
                    {retryFetcher.data.newExecutionId != null && (
                      <Link
                        to={`/admin/video-hub/executions/${retryFetcher.data.newExecutionId}`}
                        className="text-green-800 font-medium underline"
                      >
                        Voir execution #{retryFetcher.data.newExecutionId}
                      </Link>
                    )}
                  </div>
                )}
                {retryFetcher.data?.ok === false && (
                  <div className="mt-2 rounded bg-red-50 border border-red-200 p-2 text-sm text-red-700">
                    {retryFetcher.data.error ?? "Erreur inconnue"}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gates */}
      {execution.gateResults && execution.gateResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Gates ({execution.gateResults.length})
              </CardTitle>
              <CopyJsonButton data={execution.gateResults} label="Copy JSON" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {execution.gateResults.map((gate) => {
                const config = VERDICT_CONFIG[gate.verdict];
                return (
                  <div
                    key={gate.gate}
                    className={`flex items-center justify-between p-3 rounded-lg border ${config.bg}`}
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {GATE_LABELS[gate.gate] ?? gate.gate}
                      </div>
                      <div className="text-xs text-gray-500">
                        {gate.details.join(" | ")}
                      </div>
                    </div>
                    <Badge className={config.badge}>{gate.verdict}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality */}
      {(execution.qualityScore != null ||
        (execution.qualityFlags && execution.qualityFlags.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {execution.qualityScore != null && (
                <div>
                  <div className="text-xs text-gray-500">Score</div>
                  <div className="text-2xl font-bold">
                    {execution.qualityScore}/100
                  </div>
                </div>
              )}
              {execution.qualityFlags && execution.qualityFlags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {execution.qualityFlags.map((flag) => (
                    <Badge key={flag} variant="outline" className="text-xs">
                      {flag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Flags */}
      {execution.featureFlags && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Feature Flags (snapshot)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 text-sm">
              <Badge
                className={
                  execution.featureFlags.pipeline_enabled
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }
              >
                Pipeline:{" "}
                {execution.featureFlags.pipeline_enabled ? "ON" : "OFF"}
              </Badge>
              <Badge
                className={
                  execution.featureFlags.gates_blocking
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-500"
                }
              >
                Gates:{" "}
                {execution.featureFlags.gates_blocking ? "BLOCKING" : "OBSERVE"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
