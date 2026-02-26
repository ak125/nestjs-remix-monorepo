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
  FileText,
  Shield,
  Activity,
  Clock,
  Play,
  Loader2,
  Sparkles,
  Volume2,
  ChevronDown,
  ChevronUp,
  Copy,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface GateResult {
  gate: string;
  verdict: "PASS" | "WARN" | "FAIL";
  details: string[];
  measured: number;
  warnThreshold: number;
  failThreshold: number;
}

interface ClaimEntry {
  id: string;
  kind: string;
  rawText: string;
  value: string;
  unit: string;
  sectionKey: string;
  sourceRef: string | null;
  status: "verified" | "unverified" | "blocked";
  requiresHumanValidation: boolean;
}

interface DisclaimerEntry {
  type: string;
  text: string;
  position: string;
}

interface Production {
  id: number;
  briefId: string;
  videoType: string;
  vertical: string;
  status: string;
  qualityScore: number | null;
  qualityFlags: string[];
  gateResults: GateResult[] | null;
  claimTable: ClaimEntry[] | null;
  evidencePack: unknown[] | null;
  disclaimerPlan: { disclaimers: DisclaimerEntry[] } | null;
  approvalRecord: { briefId: string; stages: unknown[] } | null;
  knowledgeContract: Record<string, unknown> | null;
  scriptText: string | null;
  scriptGeneratedAt: string | null;
  scriptModel: string | null;
  masterAudioUrl: string | null;
  ttsVoice: string | null;
  parentBriefId: string | null;
  contentRole: string;
  derivativePolicy: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface DerivativeRow {
  brief_id: string;
  video_type: string;
  status: string;
  derivative_index: number;
  script_text: string | null;
  created_at: string;
}

interface ExecutionRow {
  id: number;
  status: string;
  engineName: string | null;
  renderErrorCode: string | null;
  durationMs: number | null;
  attemptNumber: number;
  createdAt: string;
  retryable: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const briefId = params.briefId;

  try {
    const headers = { Cookie: cookieHeader };
    const [prodRes, execRes, derivRes] = await Promise.all([
      fetch(`${backendUrl}/api/admin/video/productions/${briefId}`, {
        headers,
      }),
      fetch(`${backendUrl}/api/admin/video/productions/${briefId}/executions`, {
        headers,
      }),
      fetch(
        `${backendUrl}/api/admin/video/productions/${briefId}/derivatives`,
        {
          headers,
        },
      ),
    ]);

    if (!prodRes.ok)
      return json({
        production: null,
        executions: [],
        derivatives: [],
        error: "Not found",
      });

    const prodData = await prodRes.json();
    let executions: ExecutionRow[] = [];
    if (execRes.ok) {
      const execData = await execRes.json();
      executions = (execData.data ?? []) as ExecutionRow[];
    }
    let derivatives: DerivativeRow[] = [];
    if (derivRes.ok) {
      const derivData = await derivRes.json();
      derivatives = (derivData.data ?? []) as DerivativeRow[];
    }

    return json({
      production: prodData.data as Production,
      executions,
      derivatives,
      error: null,
    });
  } catch {
    return json({
      production: null,
      executions: [],
      derivatives: [],
      error: "Erreur chargement",
    });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const briefId = params.briefId!;
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "dry-run") {
    try {
      // Fetch the production to assemble VideoGateInput
      const prodRes = await fetch(
        `${backendUrl}/api/admin/video/productions/${briefId}`,
        { headers: { Cookie: cookieHeader } },
      );
      if (!prodRes.ok) {
        return json({
          _intent: "dry-run" as const,
          ok: false,
          error: "Production introuvable",
        });
      }
      const prodData = await prodRes.json();
      const prod = prodData.data;

      const gateInput = {
        brief: {
          briefId: prod.briefId,
          videoType: prod.videoType,
          vertical: prod.vertical,
        },
        claims: prod.claimTable ?? [],
        evidencePack: prod.evidencePack ?? [],
        disclaimerPlan: prod.disclaimerPlan ?? { disclaimers: [] },
        approvalRecord: prod.approvalRecord ?? { briefId, stages: [] },
      };

      const res = await fetch(`${backendUrl}/api/admin/video/validate-gates`, {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gateInput),
      });
      const data = await res.json();
      return json({ _intent: "dry-run" as const, ok: true, result: data });
    } catch {
      return json({
        _intent: "dry-run" as const,
        ok: false,
        error: "Erreur reseau",
      });
    }
  }

  if (intent === "generate-script") {
    const regenerate = formData.get("regenerate") === "true";
    try {
      const res = await fetch(
        `${backendUrl}/api/admin/video/productions/${briefId}/generate-script`,
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        return json({
          _intent: "generate-script" as const,
          ok: false,
          error: data.error ?? data.message ?? "Erreur generation",
        });
      }
      return json({
        _intent: "generate-script" as const,
        ok: true,
        data: data.data,
      });
    } catch {
      return json({
        _intent: "generate-script" as const,
        ok: false,
        error: "Erreur reseau",
      });
    }
  }

  if (intent === "generate-audio") {
    try {
      const voice = formData.get("voice") as string | null;
      const res = await fetch(
        `${backendUrl}/api/admin/video/productions/${briefId}/generate-audio`,
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ voice: voice || "onyx" }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        return json({
          _intent: "generate-audio" as const,
          ok: false,
          error: data.error ?? data.message ?? "Erreur TTS",
        });
      }
      return json({
        _intent: "generate-audio" as const,
        ok: true,
        data: data.data,
      });
    } catch {
      return json({
        _intent: "generate-audio" as const,
        ok: false,
        error: "Erreur reseau",
      });
    }
  }

  if (intent === "derive") {
    try {
      const res = await fetch(
        `${backendUrl}/api/admin/video/productions/${briefId}/derive`,
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        return json({
          _intent: "derive" as const,
          ok: false,
          error: data.error ?? data.message ?? "Erreur derivation",
        });
      }
      return json({
        _intent: "derive" as const,
        ok: true,
        data: data.data,
      });
    } catch {
      return json({
        _intent: "derive" as const,
        ok: false,
        error: "Erreur reseau",
      });
    }
  }

  if (intent === "batch-execute") {
    const briefIdsRaw = formData.get("briefIds") as string;
    const briefIdsArr = briefIdsRaw ? briefIdsRaw.split(",") : [];
    try {
      const res = await fetch(`${backendUrl}/api/admin/video/batch-execute`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ briefIds: briefIdsArr }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return json({
          _intent: "batch-execute" as const,
          ok: false,
          error: data.error ?? data.message ?? "Erreur batch",
        });
      }
      return json({
        _intent: "batch-execute" as const,
        ok: true,
        data: data.data,
      });
    } catch {
      return json({
        _intent: "batch-execute" as const,
        ok: false,
        error: "Erreur reseau",
      });
    }
  }

  // Default: execute
  try {
    const res = await fetch(
      `${backendUrl}/api/admin/video/productions/${briefId}/execute`,
      { method: "POST", headers: { Cookie: cookieHeader } },
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      return json({
        _intent: "execute" as const,
        ok: false,
        error: data.error ?? "Erreur execution",
      });
    }
    return json({
      _intent: "execute" as const,
      ok: true,
      executionId: data.data?.id ?? null,
    });
  } catch {
    return json({
      _intent: "execute" as const,
      ok: false,
      error: "Erreur reseau",
    });
  }
}

const VERDICT_CONFIG = {
  PASS: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-700",
  },
  WARN: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
  },
  FAIL: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
  },
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

const ARTEFACT_KEYS = [
  { key: "claimTable", label: "Claim Table" },
  { key: "evidencePack", label: "Evidence Pack" },
  { key: "disclaimerPlan", label: "Disclaimer Plan" },
  { key: "approvalRecord", label: "Approval Record" },
  { key: "knowledgeContract", label: "Knowledge Contract" },
] as const;

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function VideoProductionDetail() {
  const { production, executions, derivatives, error } =
    useLoaderData<typeof loader>();
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [claimsExpanded, setClaimsExpanded] = useState(false);
  const fetcher = useFetcher<{
    _intent: "execute";
    ok: boolean;
    error?: string;
    executionId?: number | null;
  }>();
  const isSubmitting = fetcher.state !== "idle";
  const scriptFetcher = useFetcher<{
    _intent: "generate-script";
    ok: boolean;
    error?: string;
    data?: {
      scriptText: string;
      claimCount: number;
      evidenceCount: number;
      estimatedDurationSecs: number;
      model: string;
    };
  }>();
  const isGeneratingScript = scriptFetcher.state !== "idle";
  const audioFetcher = useFetcher<{
    _intent: "generate-audio";
    ok: boolean;
    error?: string;
    data?: { audioUrl: string; durationSecs: number; cached: boolean };
  }>();
  const isGeneratingAudio = audioFetcher.state !== "idle";
  const dryRunFetcher = useFetcher<{
    _intent: "dry-run";
    ok: boolean;
    error?: string;
    result?: {
      canPublish: boolean;
      gates: GateResult[] | null;
      flags: string[];
      message: string;
      artefacts: { canProceed: boolean; missingArtefacts: string[] };
    };
  }>();
  const isDryRunning = dryRunFetcher.state !== "idle";
  const deriveFetcher = useFetcher<{
    _intent: "derive";
    ok: boolean;
    error?: string;
    data?: {
      derivativesCreated: number;
      derivatives: Array<{ briefId: string; claimText: string }>;
    };
  }>();
  const isDeriving = deriveFetcher.state !== "idle";
  const batchFetcher = useFetcher<{
    _intent: "batch-execute";
    ok: boolean;
    error?: string;
    data?: {
      batchId: string;
      submitted: Array<{ briefId: string }>;
      skipped: Array<{ briefId: string; reason: string }>;
    };
  }>();
  const isBatchExecuting = batchFetcher.state !== "idle";

  if (!production) {
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
            {error || "Production introuvable."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/video-hub/productions"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">
            {production.briefId}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <fetcher.Form method="post">
            <input type="hidden" name="_intent" value="execute" />
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || production.status === "archived"}
              className="gap-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isSubmitting ? "Lancement..." : "Lancer rendu"}
            </Button>
          </fetcher.Form>
          <Badge variant="outline" className="capitalize">
            {production.status}
          </Badge>
        </div>
      </div>
      {/* Trigger feedback */}
      {fetcher.data?.ok === true && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center justify-between">
          <span>Execution soumise avec succes.</span>
          {fetcher.data.executionId != null && (
            <Link
              to={`/admin/video-hub/executions/${fetcher.data.executionId}`}
              className="text-green-800 font-medium underline"
            >
              Voir execution #{fetcher.data.executionId}
            </Link>
          )}
        </div>
      )}
      {fetcher.data?.ok === false && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {fetcher.data.error ?? "Erreur inconnue"}
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Type</div>
            <div className="font-medium capitalize">
              {production.videoType.replace("_", " ")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Vertical</div>
            <div className="font-medium capitalize">{production.vertical}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Score</div>
            <div className="font-medium">{production.qualityScore ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Cree par</div>
            <div className="font-medium">{production.createdBy}</div>
          </CardContent>
        </Card>
      </div>

      {/* Artefacts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Artefacts (5 obligatoires)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ARTEFACT_KEYS.map(({ key, label }) => {
              const value = production[key as keyof Production];
              const present = value !== null && value !== undefined;
              return (
                <Badge
                  key={key}
                  className={
                    present
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }
                >
                  {present ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {label}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Script & Artefacts (Step 1) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Script & Scenario
            </CardTitle>
            {!production.scriptText ? (
              <scriptFetcher.Form method="post">
                <input type="hidden" name="_intent" value="generate-script" />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isGeneratingScript}
                  className="gap-1"
                >
                  {isGeneratingScript ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {isGeneratingScript
                    ? "Generation en cours..."
                    : "Generer le scenario (IA)"}
                </Button>
              </scriptFetcher.Form>
            ) : (
              <scriptFetcher.Form method="post">
                <input type="hidden" name="_intent" value="generate-script" />
                <input type="hidden" name="regenerate" value="true" />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={isGeneratingScript}
                  className="gap-1"
                >
                  {isGeneratingScript ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Regenerer
                </Button>
              </scriptFetcher.Form>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Script generation feedback */}
          {scriptFetcher.data?.ok === true && scriptFetcher.data.data && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              Script genere : {scriptFetcher.data.data.claimCount} claims,{" "}
              {scriptFetcher.data.data.evidenceCount} evidences, ~
              {Math.round(
                (scriptFetcher.data.data.estimatedDurationSecs ?? 0) / 60,
              )}
              min ({scriptFetcher.data.data.model})
            </div>
          )}
          {scriptFetcher.data?.ok === false && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {scriptFetcher.data.error ?? "Erreur generation"}
            </div>
          )}

          {production.scriptText ? (
            <div className="space-y-4">
              {/* Script metadata */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {production.scriptModel && (
                  <Badge variant="outline">{production.scriptModel}</Badge>
                )}
                {production.scriptGeneratedAt && (
                  <span>
                    Genere le{" "}
                    {new Date(production.scriptGeneratedAt).toLocaleString(
                      "fr-FR",
                    )}
                  </span>
                )}
              </div>

              {/* Script text (collapsible) */}
              <div>
                <button
                  onClick={() => setScriptExpanded(!scriptExpanded)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  {scriptExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Texte du scenario ({production.scriptText.split(/\s+/).length}{" "}
                  mots)
                </button>
                {scriptExpanded && (
                  <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto border">
                    {production.scriptText}
                  </pre>
                )}
              </div>

              {/* Claims table (collapsible) */}
              {production.claimTable && production.claimTable.length > 0 && (
                <div>
                  <button
                    onClick={() => setClaimsExpanded(!claimsExpanded)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    {claimsExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    Claims ({production.claimTable.length})
                  </button>
                  {claimsExpanded && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="pb-2 pr-2">ID</th>
                            <th className="pb-2 pr-2">Kind</th>
                            <th className="pb-2 pr-2">Text</th>
                            <th className="pb-2 pr-2">Value</th>
                            <th className="pb-2 pr-2">Source</th>
                            <th className="pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {production.claimTable.map((claim: ClaimEntry) => (
                            <tr
                              key={claim.id}
                              className="border-b last:border-0"
                            >
                              <td className="py-1.5 pr-2 font-mono">
                                {claim.id}
                              </td>
                              <td className="py-1.5 pr-2">
                                <Badge
                                  variant="outline"
                                  className="text-xs capitalize"
                                >
                                  {claim.kind}
                                </Badge>
                              </td>
                              <td className="py-1.5 pr-2 max-w-xs truncate">
                                {claim.rawText}
                              </td>
                              <td className="py-1.5 pr-2 font-mono">
                                {claim.value}
                                {claim.unit}
                              </td>
                              <td className="py-1.5 pr-2 text-gray-500 max-w-[120px] truncate">
                                {claim.sourceRef ?? "—"}
                              </td>
                              <td className="py-1.5">
                                <Badge
                                  className={`text-xs ${
                                    claim.status === "verified"
                                      ? "bg-green-100 text-green-700"
                                      : claim.status === "blocked"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {claim.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Disclaimers */}
              {production.disclaimerPlan &&
                production.disclaimerPlan.disclaimers.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Disclaimers (
                      {production.disclaimerPlan.disclaimers.length})
                    </div>
                    <div className="space-y-1">
                      {production.disclaimerPlan.disclaimers.map(
                        (d: DisclaimerEntry, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs bg-gray-50 rounded p-2"
                          >
                            <Badge variant="outline" className="capitalize">
                              {d.type}
                            </Badge>
                            <span className="text-gray-500">
                              [{d.position}]
                            </span>
                            <span className="text-gray-700 truncate">
                              {d.text}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Aucun script. Cliquez sur &quot;Generer le scenario&quot; pour
              creer le contenu via IA.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Audio / Voix Off (Step 3) */}
      {production.scriptText && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Audio / Voix Off
              </CardTitle>
              <audioFetcher.Form method="post">
                <input type="hidden" name="_intent" value="generate-audio" />
                <input type="hidden" name="voice" value="onyx" />
                <Button
                  type="submit"
                  size="sm"
                  variant={production.masterAudioUrl ? "outline" : "default"}
                  disabled={isGeneratingAudio}
                  className="gap-1"
                >
                  {isGeneratingAudio ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                  {isGeneratingAudio
                    ? "Generation..."
                    : production.masterAudioUrl
                      ? "Regenerer audio"
                      : "Generer la voix off (TTS)"}
                </Button>
              </audioFetcher.Form>
            </div>
          </CardHeader>
          <CardContent>
            {audioFetcher.data?.ok === true && audioFetcher.data.data && (
              <div className="mb-3 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                Audio genere : {audioFetcher.data.data.durationSecs?.toFixed(1)}
                s{audioFetcher.data.data.cached ? " (cache)" : " (nouveau)"}
              </div>
            )}
            {audioFetcher.data?.ok === false && (
              <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {audioFetcher.data.error ?? "Erreur TTS"}
              </div>
            )}

            {production.masterAudioUrl ? (
              <div className="space-y-2">
                <audio
                  controls
                  src={production.masterAudioUrl}
                  className="w-full"
                />
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {production.ttsVoice && (
                    <Badge variant="outline">Voix: {production.ttsVoice}</Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Aucun audio. Generez la voix off une fois le script valide.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Gates (7 — dernier run)
            </CardTitle>
            <dryRunFetcher.Form method="post">
              <input type="hidden" name="_intent" value="dry-run" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={isDryRunning}
                className="gap-1"
              >
                {isDryRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Shield className="h-3 w-3" />
                )}
                {isDryRunning ? "Validation..." : "Dry-run gates"}
              </Button>
            </dryRunFetcher.Form>
          </div>
        </CardHeader>
        <CardContent>
          {/* Dry-run results */}
          {dryRunFetcher.data?.ok === true && dryRunFetcher.data.result && (
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge
                  className={
                    dryRunFetcher.data.result.canPublish
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }
                >
                  {dryRunFetcher.data.result.canPublish
                    ? "Peut publier"
                    : "Ne peut pas publier"}
                </Badge>
                <span className="text-xs text-gray-500">
                  {dryRunFetcher.data.result.message}
                </span>
              </div>
              {dryRunFetcher.data.result.artefacts &&
                !dryRunFetcher.data.result.artefacts.canProceed && (
                  <div className="text-xs text-red-600">
                    Artefacts manquants :{" "}
                    {dryRunFetcher.data.result.artefacts.missingArtefacts.join(
                      ", ",
                    )}
                  </div>
                )}
              {dryRunFetcher.data.result.gates && (
                <div className="space-y-2">
                  {dryRunFetcher.data.result.gates.map((gate) => {
                    const config = VERDICT_CONFIG[gate.verdict];
                    const Icon = config.icon;
                    return (
                      <div
                        key={gate.gate}
                        className={`flex items-center justify-between p-3 rounded-lg border ${config.bg}`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${config.color}`} />
                          <div>
                            <div className="font-medium text-sm">
                              {GATE_LABELS[gate.gate] ?? gate.gate}
                            </div>
                            <div className="text-xs text-gray-500">
                              {gate.details.join(" | ")}
                            </div>
                          </div>
                        </div>
                        <Badge className={config.badge}>{gate.verdict}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="border-b border-gray-200 pt-2" />
              <div className="text-xs text-gray-400">
                Resultats ci-dessus : dry-run (non enregistres)
              </div>
            </div>
          )}
          {dryRunFetcher.data?.ok === false && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 p-2 text-sm text-red-700">
              {dryRunFetcher.data.error ?? "Erreur dry-run"}
            </div>
          )}

          {/* Stored gate results */}
          {production.gateResults ? (
            <div className="space-y-3">
              {production.gateResults.map((gate) => {
                const config = VERDICT_CONFIG[gate.verdict];
                const Icon = config.icon;
                return (
                  <div
                    key={gate.gate}
                    className={`flex items-center justify-between p-3 rounded-lg border ${config.bg}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <div>
                        <div className="font-medium text-sm">
                          {GATE_LABELS[gate.gate] ?? gate.gate}
                        </div>
                        <div className="text-xs text-gray-500">
                          {gate.details.join(" | ")}
                        </div>
                      </div>
                    </div>
                    <Badge className={config.badge}>{gate.verdict}</Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Aucun gate execute. Utilisez le dry-run pour valider.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quality Flags */}
      {production.qualityFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quality Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {production.qualityFlags.map((flag) => (
                <Badge key={flag} variant="outline" className="text-xs">
                  {flag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Derivees (Step 5) */}
      {production.contentRole === "master_truth" &&
        production.claimTable &&
        production.claimTable.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Derivees ({derivatives.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  {derivatives.length > 0 && (
                    <batchFetcher.Form method="post">
                      <input
                        type="hidden"
                        name="_intent"
                        value="batch-execute"
                      />
                      <input
                        type="hidden"
                        name="briefIds"
                        value={derivatives.map((d) => d.brief_id).join(",")}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={isBatchExecuting}
                        className="gap-1"
                      >
                        {isBatchExecuting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        {isBatchExecuting
                          ? "Lancement batch..."
                          : `Lancer batch (${derivatives.length})`}
                      </Button>
                    </batchFetcher.Form>
                  )}
                  <deriveFetcher.Form method="post">
                    <input type="hidden" name="_intent" value="derive" />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isDeriving}
                      className="gap-1"
                    >
                      {isDeriving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {isDeriving
                        ? "Derivation..."
                        : derivatives.length > 0
                          ? "Re-deriver"
                          : "Generer les derivees"}
                    </Button>
                  </deriveFetcher.Form>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Derive feedback */}
              {deriveFetcher.data?.ok === true && deriveFetcher.data.data && (
                <div className="mb-3 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                  {deriveFetcher.data.data.derivativesCreated} derivees creees
                </div>
              )}
              {deriveFetcher.data?.ok === false && (
                <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {deriveFetcher.data.error ?? "Erreur derivation"}
                </div>
              )}
              {/* Batch feedback */}
              {batchFetcher.data?.ok === true && batchFetcher.data.data && (
                <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                  Batch {batchFetcher.data.data.batchId} :{" "}
                  {batchFetcher.data.data.submitted.length} soumises,{" "}
                  {batchFetcher.data.data.skipped.length} ignorees
                </div>
              )}
              {batchFetcher.data?.ok === false && (
                <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {batchFetcher.data.error ?? "Erreur batch"}
                </div>
              )}

              {derivatives.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-2 pr-3">#</th>
                        <th className="pb-2 pr-3">Brief ID</th>
                        <th className="pb-2 pr-3">Type</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2 pr-3">Script</th>
                        <th className="pb-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {derivatives.map((d) => (
                        <tr key={d.brief_id} className="border-b last:border-0">
                          <td className="py-2 pr-3 text-gray-500">
                            {d.derivative_index}
                          </td>
                          <td className="py-2 pr-3">
                            <Link
                              to={`/admin/video-hub/productions/${d.brief_id}`}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {d.brief_id}
                            </Link>
                          </td>
                          <td className="py-2 pr-3 capitalize">
                            {d.video_type}
                          </td>
                          <td className="py-2 pr-3">
                            <Badge
                              className={`text-xs ${STATUS_BADGE[d.status] ?? STATUS_BADGE.pending}`}
                            >
                              {d.status}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 max-w-[200px] truncate text-gray-600">
                            {d.script_text ?? "—"}
                          </td>
                          <td className="py-2 text-xs text-gray-500">
                            {new Date(d.created_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Aucune derivee. Cliquez sur &quot;Generer les derivees&quot;
                  pour extraire des shorts depuis les claims.
                </p>
              )}
            </CardContent>
          </Card>
        )}

      {/* Executions recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Executions recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-3">#</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Engine</th>
                    <th className="pb-2 pr-3">Erreur</th>
                    <th className="pb-2 pr-3">Duree</th>
                    <th className="pb-2 pr-3">Attempt</th>
                    <th className="pb-2 pr-3">Retry?</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((exec) => (
                    <tr key={exec.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <Link
                          to={`/admin/video-hub/executions/${exec.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {exec.id}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          className={`text-xs ${STATUS_BADGE[exec.status] ?? STATUS_BADGE.pending}`}
                        >
                          {exec.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {exec.engineName ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {exec.renderErrorCode ? (
                          <Badge className="bg-red-100 text-red-700 text-xs">
                            {exec.renderErrorCode}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {formatDuration(exec.durationMs)}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        #{exec.attemptNumber}
                      </td>
                      <td className="py-2 pr-3">
                        {exec.status === "failed" && exec.retryable ? (
                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                            Oui
                          </Badge>
                        ) : exec.status === "failed" ? (
                          <Badge className="bg-gray-100 text-gray-500 text-xs">
                            Non
                          </Badge>
                        ) : null}
                      </td>
                      <td className="py-2 text-xs text-gray-500">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(exec.createdAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Aucune execution. Lancez un dry-run ou une execution depuis
              l&apos;API.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
