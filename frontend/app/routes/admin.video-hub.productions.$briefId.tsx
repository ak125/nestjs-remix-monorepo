import {
  json,
  redirect,
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
  Play,
  Loader2,
  Sparkles,
  Volume2,
  Copy,
  Zap,
  Film,
  Layers,
  Music,
  Clapperboard,
  SkipForward,
  Eye,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { getInternalApiUrl } from "~/utils/internal-api.server";

// ─── Types ───────────────────────────────────────────────────

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
  renderOutputPath: string | null;
  durationMs: number | null;
  attemptNumber: number;
  createdAt: string;
  retryable: boolean;
}

// ─── Pipeline Logic ──────────────────────────────────────────

interface PipelineStep {
  key: string;
  label: string;
  shortLabel: string;
  icon: typeof Sparkles;
  done: boolean;
}

function getPipelineSteps(
  prod: Production,
  executions: ExecutionRow[],
  derivatives: DerivativeRow[],
): { steps: PipelineStep[]; currentIndex: number } {
  const steps: PipelineStep[] = [
    {
      key: "script",
      label: "Script IA",
      shortLabel: "SCR",
      icon: Sparkles,
      done: prod.scriptText !== null,
    },
    {
      key: "audio",
      label: "Voix Off",
      shortLabel: "TTS",
      icon: Music,
      done: prod.masterAudioUrl !== null,
    },
    {
      key: "template",
      label: "Template",
      shortLabel: "TPL",
      icon: Layers,
      done: false,
    },
    {
      key: "render",
      label: "Rendu",
      shortLabel: "RND",
      icon: Clapperboard,
      done: executions.some((e) => e.status === "completed"),
    },
    {
      key: "derivatives",
      label: "Derivees",
      shortLabel: "DRV",
      icon: Copy,
      done: derivatives.length > 0,
    },
  ];
  const currentIndex = steps.findIndex((s) => !s.done);
  return {
    steps,
    currentIndex: currentIndex === -1 ? steps.length : currentIndex,
  };
}

// ─── Loader (unchanged) ─────────────────────────────────────

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
        { headers },
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

// ─── Action (unchanged) ─────────────────────────────────────

export async function action({ request, params }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const briefId = params.briefId!;
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "dry-run") {
    try {
      const prodRes = await fetch(
        `${backendUrl}/api/admin/video/productions/${briefId}`,
        { headers: { Cookie: cookieHeader } },
      );
      if (!prodRes.ok)
        return json({
          _intent: "dry-run" as const,
          ok: false,
          error: "Production introuvable",
        });
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
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
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

  if (intent === "save-script") {
    const scriptText = formData.get("scriptText") as string;
    try {
      const res = await fetch(
        `${backendUrl}/api/admin/video/productions/${briefId}`,
        {
          method: "PATCH",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ scriptText }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success)
        return json({
          _intent: "save-script" as const,
          ok: false,
          error: data.error ?? "Erreur sauvegarde",
        });
      return redirect(`/admin/video-hub/productions/${briefId}`);
    } catch {
      return json({
        _intent: "save-script" as const,
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
      if (!res.ok || !data.success)
        return json({
          _intent: "generate-script" as const,
          ok: false,
          error: data.error ?? data.message ?? "Erreur generation",
        });
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
      if (!res.ok || !data.success)
        return json({
          _intent: "generate-audio" as const,
          ok: false,
          error: data.error ?? data.message ?? "Erreur TTS",
        });
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
      if (!res.ok || !data.success)
        return json({
          _intent: "derive" as const,
          ok: false,
          error: data.error ?? data.message ?? "Erreur derivation",
        });
      return json({ _intent: "derive" as const, ok: true, data: data.data });
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
      if (!res.ok || !data.success)
        return json({
          _intent: "batch-execute" as const,
          ok: false,
          error: data.error ?? data.message ?? "Erreur batch",
        });
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

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/video/productions/${briefId}/execute`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader },
      },
    );
    const data = await res.json();
    if (!res.ok || !data.success)
      return json({
        _intent: "execute" as const,
        ok: false,
        error: data.error ?? "Erreur execution",
      });
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

// ─── Gate Config ─────────────────────────────────────────────

const GATE_LABELS: Record<string, string> = {
  truth: "TRUTH",
  safety: "SAFETY",
  brand: "BRAND",
  platform: "PLATFORM",
  reuse_risk: "REUSE",
  visual_role: "VISUAL",
  final_qa: "QA",
};

const ARTEFACT_KEYS = [
  { key: "claimTable", label: "CLM", full: "Claims" },
  { key: "evidencePack", label: "EVD", full: "Evidence" },
  { key: "disclaimerPlan", label: "DSC", full: "Disclaimers" },
  { key: "approvalRecord", label: "APR", full: "Approval" },
  { key: "knowledgeContract", label: "KNW", full: "Knowledge" },
] as const;

function formatDuration(ms: number | null): string {
  if (ms == null) return "--:--";
  if (ms < 1000) return `0.${Math.floor(ms / 100)}s`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

// ─── Main Component ──────────────────────────────────────────

export default function VideoProductionDetail() {
  const { production, executions, derivatives, error } =
    useLoaderData<typeof loader>();
  const [activePanel, setActivePanel] = useState<
    "script" | "claims" | "gates" | "exec" | "deriv" | null
  >(null);
  const [showVideo, setShowVideo] = useState(false);

  const fetcher = useFetcher<{
    _intent: "execute";
    ok: boolean;
    error?: string;
    executionId?: number | null;
  }>();
  const saveScriptFetcher = useFetcher<{
    _intent: "save-script";
    ok: boolean;
    error?: string;
  }>();
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
  const audioFetcher = useFetcher<{
    _intent: "generate-audio";
    ok: boolean;
    error?: string;
    data?: { audioUrl: string; durationSecs: number; cached: boolean };
  }>();
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
  const deriveFetcher = useFetcher<{
    _intent: "derive";
    ok: boolean;
    error?: string;
    data?: {
      derivativesCreated: number;
      derivatives: Array<{ briefId: string; claimText: string }>;
    };
  }>();
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

  const isExecuting = fetcher.state !== "idle";
  const isGeneratingScript = scriptFetcher.state !== "idle";
  const isGeneratingAudio = audioFetcher.state !== "idle";
  const isDryRunning = dryRunFetcher.state !== "idle";
  const isDeriving = deriveFetcher.state !== "idle";
  const isBatchExecuting = batchFetcher.state !== "idle";

  // Not found
  if (!production) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <Film className="h-16 w-16 text-neutral-700 mx-auto mb-4" />
          <p className="text-neutral-400 text-lg">
            {error || "Production introuvable"}
          </p>
          <Link
            to="/admin/video-hub/productions"
            className="text-blue-400 hover:text-blue-300 text-sm mt-3 inline-block"
          >
            Retour aux productions
          </Link>
        </div>
      </div>
    );
  }

  const { steps, currentIndex } = getPipelineSteps(
    production,
    executions,
    derivatives,
  );
  const hasRender = executions.some((e) => e.status === "completed");
  const completedExec = executions.find((e) => e.status === "completed");
  const streamUrl = completedExec
    ? `/api/admin/video/executions/${completedExec.id}/stream`
    : null;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-neutral-200">
      {/* ═══ TOP BAR ═══ */}
      <div className="border-b border-neutral-800 bg-[#111111]">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4">
            <Link
              to="/admin/video-hub/productions"
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-mono text-sm font-semibold tracking-wide text-neutral-100">
                {production.briefId}
              </span>
              <span
                className={`
                text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded
                ${production.status === "draft" ? "bg-neutral-800 text-neutral-400" : ""}
                ${production.status === "completed" ? "bg-emerald-900/50 text-emerald-400" : ""}
                ${production.status === "processing" ? "bg-blue-900/50 text-blue-400" : ""}
                ${production.status === "failed" ? "bg-red-900/50 text-red-400" : ""}
                ${!["draft", "completed", "processing", "failed"].includes(production.status) ? "bg-neutral-800 text-neutral-400" : ""}
              `}
              >
                {production.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-neutral-600">
              {production.videoType.toUpperCase()} /{" "}
              {production.vertical.toUpperCase()}
            </span>
            <span className="text-neutral-700">|</span>
            <span className="text-[10px] font-mono text-neutral-600">
              {new Date(production.createdAt).toLocaleDateString("fr-FR")}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ FEEDBACK TOAST ═══ */}
      <FeedbackToasts
        scriptFetcher={scriptFetcher}
        audioFetcher={audioFetcher}
        fetcher={fetcher}
        deriveFetcher={deriveFetcher}
        batchFetcher={batchFetcher}
        dryRunFetcher={dryRunFetcher}
      />

      {/* ═══ MAIN LAYOUT: Preview + Inspector ═══ */}
      <div className="flex h-[calc(100vh-180px)]">
        {/* ─── LEFT: Media Preview ─── */}
        <div className="flex-1 flex flex-col">
          {/* Preview Area */}
          <div className="flex-1 flex items-center justify-center p-6 bg-[#0a0a0a]">
            <div className="w-full max-w-4xl">
              {hasRender && streamUrl ? (
                <div className="aspect-video bg-black rounded-lg border border-neutral-800 relative overflow-hidden shadow-2xl shadow-black/50">
                  {showVideo ? (
                    <video
                      controls
                      autoPlay
                      src={streamUrl}
                      className="w-full h-full rounded-lg"
                    >
                      Votre navigateur ne supporte pas la lecture video.
                    </video>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <Film className="h-16 w-16 text-neutral-600 mb-6" />
                      <button
                        onClick={() => setShowVideo(true)}
                        className="relative z-10 w-16 h-16 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-105 transition-all"
                      >
                        <Play className="h-7 w-7 text-white ml-1" />
                      </button>
                      <p className="relative z-10 text-white/60 text-sm mt-4">
                        Cliquer pour charger la video
                      </p>
                      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-white/30">
                          Execution #{completedExec?.id}
                        </span>
                        <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-1 rounded">
                          {completedExec?.durationMs
                            ? formatDuration(completedExec.durationMs)
                            : "--:--"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : production.masterAudioUrl ? (
                <div className="aspect-video bg-gradient-to-b from-[#0f1729] to-[#0a0a0a] rounded-lg border border-neutral-800 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl shadow-black/50">
                  {/* Waveform decoration */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1 mx-px bg-blue-400 rounded-full"
                        style={{
                          height: `${20 + Math.sin(i * 0.5) * 40 + Math.random() * 20}%`,
                          opacity: 0.3 + Math.sin(i * 0.3) * 0.3,
                        }}
                      />
                    ))}
                  </div>
                  <div className="relative z-10 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto">
                      <Volume2 className="h-8 w-8 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-neutral-200 font-medium">Audio pret</p>
                      <p className="text-neutral-500 text-xs mt-1">
                        Voix: {production.ttsVoice ?? "onyx"} — En attente du
                        rendu
                      </p>
                    </div>
                    <audio
                      controls
                      src={production.masterAudioUrl}
                      className="w-80 mx-auto"
                    />
                  </div>
                </div>
              ) : production.scriptText ? (
                <div className="aspect-video bg-gradient-to-b from-[#111827] to-[#0a0a0a] rounded-lg border border-neutral-800 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl shadow-black/50">
                  <div className="absolute inset-0 flex items-center justify-center opacity-5">
                    <pre className="text-[8px] text-neutral-400 leading-relaxed max-w-2xl text-center overflow-hidden max-h-full">
                      {production.scriptText}
                    </pre>
                  </div>
                  <div className="relative z-10 text-center space-y-3">
                    <Sparkles className="h-12 w-12 text-amber-400/60 mx-auto" />
                    <p className="text-neutral-200 font-medium">
                      Script genere
                    </p>
                    <p className="text-neutral-500 text-xs font-mono">
                      {production.scriptText.split(/\s+/).length} mots
                      {production.scriptModel && ` — ${production.scriptModel}`}
                    </p>
                    <p className="text-neutral-600 text-xs">
                      Prochaine etape : voix off
                    </p>
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-[#0a0a0a] rounded-lg border-2 border-dashed border-neutral-800 flex flex-col items-center justify-center shadow-2xl shadow-black/50">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto">
                      <Play className="h-8 w-8 text-neutral-700 ml-1" />
                    </div>
                    <div>
                      <p className="text-neutral-500 font-medium">
                        Pipeline non demarre
                      </p>
                      <p className="text-neutral-700 text-xs mt-1">
                        Generez le scenario pour commencer
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── ACTION BAR (below preview) ─── */}
          <div className="border-t border-neutral-800 bg-[#111111] px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Step 1: Script */}
                <scriptFetcher.Form method="post">
                  <input type="hidden" name="_intent" value="generate-script" />
                  {production.scriptText && (
                    <input type="hidden" name="regenerate" value="true" />
                  )}
                  <button
                    type="submit"
                    disabled={isGeneratingScript}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-all
                      ${
                        currentIndex === 0
                          ? "bg-blue-600 text-white hover:bg-blue-500"
                          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                      }
                      disabled:opacity-40 disabled:cursor-wait
                    `}
                  >
                    {isGeneratingScript ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {isGeneratingScript
                      ? "GEN..."
                      : production.scriptText
                        ? "RE-SCR"
                        : "GEN SCRIPT"}
                  </button>
                </scriptFetcher.Form>

                <ChevronRight className="h-3 w-3 text-neutral-700" />

                {/* Step 2: Audio */}
                <audioFetcher.Form method="post">
                  <input type="hidden" name="_intent" value="generate-audio" />
                  <input type="hidden" name="voice" value="onyx" />
                  <button
                    type="submit"
                    disabled={isGeneratingAudio || !production.scriptText}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-all
                      ${
                        currentIndex === 1
                          ? "bg-blue-600 text-white hover:bg-blue-500"
                          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                      }
                      disabled:opacity-20 disabled:cursor-not-allowed
                    `}
                  >
                    {isGeneratingAudio ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Volume2 className="h-3 w-3" />
                    )}
                    {isGeneratingAudio
                      ? "TTS..."
                      : production.masterAudioUrl
                        ? "RE-TTS"
                        : "GEN AUDIO"}
                  </button>
                </audioFetcher.Form>

                <ChevronRight className="h-3 w-3 text-neutral-700" />

                {/* Step 3: Template */}
                <Link
                  to="/admin/video-hub/templates"
                  className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-all"
                >
                  <Layers className="h-3 w-3" />
                  TEMPLATE
                </Link>

                <ChevronRight className="h-3 w-3 text-neutral-700" />

                {/* Step 4: Render */}
                <fetcher.Form method="post">
                  <input type="hidden" name="_intent" value="execute" />
                  <button
                    type="submit"
                    disabled={isExecuting}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-all
                      ${
                        currentIndex === 3
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                      }
                      disabled:opacity-40 disabled:cursor-wait
                    `}
                  >
                    {isExecuting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    {isExecuting ? "RENDER..." : "RENDER"}
                  </button>
                </fetcher.Form>

                <ChevronRight className="h-3 w-3 text-neutral-700" />

                {/* Step 5: Derive */}
                <deriveFetcher.Form method="post">
                  <input type="hidden" name="_intent" value="derive" />
                  <button
                    type="submit"
                    disabled={isDeriving || !hasRender}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    {isDeriving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {isDeriving ? "DERIV..." : "DERIVE"}
                  </button>
                </deriveFetcher.Form>
              </div>

              {/* Right side: dry-run + batch */}
              <div className="flex items-center gap-2">
                <dryRunFetcher.Form method="post">
                  <input type="hidden" name="_intent" value="dry-run" />
                  <button
                    type="submit"
                    disabled={isDryRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono bg-neutral-800/50 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300 disabled:opacity-40 transition-all"
                  >
                    {isDryRunning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Shield className="h-3 w-3" />
                    )}
                    GATES
                  </button>
                </dryRunFetcher.Form>
                {derivatives.length > 0 && (
                  <batchFetcher.Form method="post">
                    <input type="hidden" name="_intent" value="batch-execute" />
                    <input
                      type="hidden"
                      name="briefIds"
                      value={derivatives.map((d) => d.brief_id).join(",")}
                    />
                    <button
                      type="submit"
                      disabled={isBatchExecuting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono bg-neutral-800/50 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300 disabled:opacity-40 transition-all"
                    >
                      {isBatchExecuting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                      BATCH ({derivatives.length})
                    </button>
                  </batchFetcher.Form>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Inspector Panel ─── */}
        <div className="w-80 border-l border-neutral-800 bg-[#111111] flex flex-col overflow-hidden">
          {/* Inspector Tabs */}
          <div className="flex border-b border-neutral-800 bg-[#0f0f0f]">
            {[
              { id: "script" as const, icon: FileText, label: "Script" },
              { id: "claims" as const, icon: Shield, label: "Claims" },
              { id: "gates" as const, icon: Eye, label: "Gates" },
              { id: "exec" as const, icon: Activity, label: "Exec" },
              { id: "deriv" as const, icon: SkipForward, label: "Deriv" },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActivePanel(activePanel === id ? null : id)}
                className={`
                  flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-all
                  ${
                    activePanel === id
                      ? "text-blue-400 bg-blue-500/5 border-b-2 border-blue-500"
                      : "text-neutral-600 hover:text-neutral-400 border-b-2 border-transparent"
                  }
                `}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Inspector Content */}
          <div className="flex-1 overflow-y-auto">
            {activePanel === null && (
              <InspectorOverview
                production={production}
                executions={executions}
                derivatives={derivatives}
                steps={steps}
                currentIndex={currentIndex}
              />
            )}
            {activePanel === "script" && (
              <InspectorScript
                production={production}
                saveScriptFetcher={saveScriptFetcher}
              />
            )}
            {activePanel === "claims" && (
              <InspectorClaims production={production} />
            )}
            {activePanel === "gates" && (
              <InspectorGates
                production={production}
                dryRunFetcher={dryRunFetcher}
              />
            )}
            {activePanel === "exec" && (
              <InspectorExec executions={executions} />
            )}
            {activePanel === "deriv" && (
              <InspectorDeriv derivatives={derivatives} />
            )}
          </div>
        </div>
      </div>

      {/* ═══ TIMELINE (bottom) ═══ */}
      <div className="border-t border-neutral-800 bg-[#0f0f0f] px-5 py-3">
        <div className="flex items-center gap-1">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isDone = step.done;
            const isCurrent = i === currentIndex;
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div
                  className={`
                    flex items-center gap-2 flex-1 px-3 py-2 rounded transition-all
                    ${isDone ? "bg-emerald-900/20" : isCurrent ? "bg-blue-900/20" : "bg-neutral-900/30"}
                  `}
                >
                  <div
                    className={`
                      w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold
                      ${isDone ? "bg-emerald-500/20 text-emerald-400" : ""}
                      ${isCurrent ? "bg-blue-500/20 text-blue-400" : ""}
                      ${!isDone && !isCurrent ? "bg-neutral-800 text-neutral-600" : ""}
                    `}
                  >
                    {isDone ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[10px] font-mono font-semibold truncate ${
                        isDone
                          ? "text-emerald-400"
                          : isCurrent
                            ? "text-blue-400"
                            : "text-neutral-600"
                      }`}
                    >
                      {step.shortLabel}
                    </p>
                    <p
                      className={`text-[9px] truncate ${
                        isDone
                          ? "text-emerald-600"
                          : isCurrent
                            ? "text-blue-600"
                            : "text-neutral-700"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-3 h-px mx-0.5 ${isDone ? "bg-emerald-700" : "bg-neutral-800"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Inspector Panels ────────────────────────────────────────

function InspectorOverview({
  production,
  executions,
  derivatives,
  steps,
  currentIndex,
}: {
  production: Production;
  executions: ExecutionRow[];
  derivatives: DerivativeRow[];
  steps: PipelineStep[];
  currentIndex: number;
}) {
  const completedSteps = steps.filter((s) => s.done).length;
  return (
    <div className="p-4 space-y-5">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
            Pipeline
          </span>
          <span className="text-[10px] font-mono text-neutral-400">
            {completedSteps}/{steps.length}
          </span>
        </div>
        <div className="flex gap-1">
          {steps.map((step) => (
            <div
              key={step.key}
              className={`h-1.5 flex-1 rounded-full ${
                step.done ? "bg-emerald-500" : "bg-neutral-800"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Meta Grid */}
      <div className="space-y-2">
        <MetaRow label="TYPE" value={production.videoType.toUpperCase()} />
        <MetaRow label="VERTICAL" value={production.vertical.toUpperCase()} />
        <MetaRow
          label="SCORE"
          value={
            production.qualityScore !== null
              ? String(production.qualityScore)
              : "--"
          }
        />
        <MetaRow
          label="ROLE"
          value={production.contentRole.replace("_", " ").toUpperCase()}
        />
        <MetaRow label="AUTEUR" value={production.createdBy.split("@")[0]} />
        {production.parentBriefId && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider">
              PARENT
            </span>
            <Link
              to={`/admin/video-hub/productions/${production.parentBriefId}`}
              className="text-[11px] font-mono text-blue-400 hover:text-blue-300"
            >
              {production.parentBriefId}
            </Link>
          </div>
        )}
      </div>

      {/* Artefacts */}
      <div>
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block mb-2">
          Artefacts
        </span>
        <div className="grid grid-cols-5 gap-1">
          {ARTEFACT_KEYS.map(({ key, label, full }) => {
            const present =
              production[key as keyof Production] !== null &&
              production[key as keyof Production] !== undefined;
            return (
              <div
                key={key}
                title={full}
                className={`
                  text-center py-1.5 rounded text-[9px] font-mono font-bold
                  ${present ? "bg-emerald-900/30 text-emerald-400" : "bg-neutral-900 text-neutral-700"}
                `}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quality Flags */}
      {production.qualityFlags.length > 0 && (
        <div>
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block mb-2">
            Flags
          </span>
          <div className="flex flex-wrap gap-1">
            {production.qualityFlags.map((flag) => (
              <span
                key={flag}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-500"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="EXEC" value={String(executions.length)} />
        <StatBox label="DERIV" value={String(derivatives.length)} />
        <StatBox
          label="STEP"
          value={currentIndex < steps.length ? `${currentIndex + 1}/5` : "DONE"}
        />
      </div>
    </div>
  );
}

function InspectorScript({
  production,
  saveScriptFetcher,
}: {
  production: Production;
  saveScriptFetcher: ReturnType<
    typeof useFetcher<{ _intent: "save-script"; ok: boolean; error?: string }>
  >;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(production.scriptText ?? "");
  const isSaving = saveScriptFetcher.state !== "idle";

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
          Scenario
        </span>
        <div className="flex items-center gap-2">
          {production.scriptModel && (
            <span className="text-[9px] font-mono text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded">
              {production.scriptModel}
            </span>
          )}
          <button
            onClick={() => {
              setEditing(!editing);
              setDraft(production.scriptText ?? "");
            }}
            className="text-[9px] font-mono text-amber-400 hover:text-amber-300 bg-amber-900/20 px-1.5 py-0.5 rounded transition"
          >
            {editing ? "ANNULER" : "EDITER"}
          </button>
        </div>
      </div>

      {editing ? (
        <saveScriptFetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="_intent" value="save-script" />
          <textarea
            name="scriptText"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="w-full text-[11px] leading-relaxed text-neutral-200 bg-[#0a0a0a] rounded-lg p-3 border border-neutral-700 focus:border-amber-500 focus:outline-none resize-y font-mono placeholder:text-neutral-700"
            placeholder="Collez ou ecrivez le script de la video ici..."
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-neutral-600">
              {draft.trim()
                ? `${draft.trim().split(/\s+/).length} mots`
                : "vide"}
            </span>
            <button
              type="submit"
              disabled={isSaving || !draft.trim()}
              className="text-[10px] font-mono px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition"
            >
              {isSaving ? "SAUVEGARDE..." : "SAUVEGARDER"}
            </button>
          </div>
          {saveScriptFetcher.data?.ok === false && (
            <p className="text-[10px] text-red-400">
              {saveScriptFetcher.data.error}
            </p>
          )}
          {saveScriptFetcher.data?.ok === true && (
            <p className="text-[10px] text-green-400">Script sauvegarde</p>
          )}
        </saveScriptFetcher.Form>
      ) : production.scriptText ? (
        <>
          <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-600">
            <span>{production.scriptText.split(/\s+/).length} mots</span>
            {production.scriptGeneratedAt && (
              <span>
                {new Date(production.scriptGeneratedAt).toLocaleString("fr-FR")}
              </span>
            )}
          </div>
          <pre className="text-[11px] leading-relaxed text-neutral-300 bg-[#0a0a0a] rounded-lg p-3 max-h-[60vh] overflow-y-auto border border-neutral-800 whitespace-pre-wrap font-mono">
            {production.scriptText}
          </pre>
        </>
      ) : (
        <div className="text-center py-8">
          <Sparkles className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
          <p className="text-xs text-neutral-600">Aucun script</p>
          <p className="text-[10px] text-neutral-700 mt-1">
            Cliquez EDITER pour coller votre script ou GEN SCRIPT pour generer
          </p>
        </div>
      )}

      {/* Disclaimers */}
      {production.disclaimerPlan &&
        production.disclaimerPlan.disclaimers.length > 0 && (
          <div className="mt-4 pt-3 border-t border-neutral-800">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block mb-2">
              Disclaimers ({production.disclaimerPlan.disclaimers.length})
            </span>
            {production.disclaimerPlan.disclaimers.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[10px] py-1.5 border-b border-neutral-900 last:border-0"
              >
                <span className="font-mono text-amber-500 uppercase shrink-0">
                  {d.type}
                </span>
                <span className="text-neutral-500 shrink-0">
                  [{d.position}]
                </span>
                <span className="text-neutral-400">{d.text}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function InspectorClaims({ production }: { production: Production }) {
  const claims = production.claimTable ?? [];
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
          Claims
        </span>
        <span className="text-[10px] font-mono text-neutral-600">
          {claims.length} total
        </span>
      </div>
      {claims.length > 0 ? (
        <div className="space-y-1.5">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="bg-[#0a0a0a] rounded-lg border border-neutral-800 p-2.5"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-mono text-neutral-600">
                  {claim.id}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                    claim.status === "verified"
                      ? "bg-emerald-900/30 text-emerald-400"
                      : claim.status === "blocked"
                        ? "bg-red-900/30 text-red-400"
                        : "bg-amber-900/30 text-amber-400"
                  }`}
                >
                  {claim.status}
                </span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                {claim.rawText}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[9px] font-mono text-neutral-600">
                <span className="uppercase">{claim.kind}</span>
                <span>
                  {claim.value}
                  {claim.unit}
                </span>
                {claim.sourceRef && (
                  <span className="truncate max-w-[100px]">
                    {claim.sourceRef}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Shield className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
          <p className="text-xs text-neutral-600">Aucun claim</p>
        </div>
      )}
    </div>
  );
}

function InspectorGates({
  production,
  dryRunFetcher,
}: {
  production: Production;
  dryRunFetcher: ReturnType<typeof useFetcher>;
}) {
  const drd = dryRunFetcher.data as
    | {
        ok: boolean;
        result?: { canPublish: boolean; gates: GateResult[] | null };
      }
    | undefined;
  const dryRunGates = drd?.ok === true && drd.result ? drd.result.gates : null;
  const canPublish =
    drd?.ok === true && drd.result ? drd.result.canPublish : null;
  const gates = dryRunGates ?? production.gateResults;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
          Quality Gates
        </span>
        {dryRunGates && (
          <span className="text-[9px] font-mono text-purple-400 bg-purple-900/20 px-1.5 py-0.5 rounded">
            DRY-RUN
          </span>
        )}
      </div>

      {canPublish !== null && (
        <div
          className={`text-center py-1.5 rounded text-[10px] font-mono font-bold ${
            canPublish
              ? "bg-emerald-900/20 text-emerald-400"
              : "bg-red-900/20 text-red-400"
          }`}
        >
          {canPublish ? "PUBLISHABLE" : "BLOCKED"}
        </div>
      )}

      {gates ? (
        <div className="space-y-1.5">
          {gates.map((gate) => (
            <div
              key={gate.gate}
              className={`flex items-center justify-between px-2.5 py-2 rounded border ${
                gate.verdict === "PASS"
                  ? "bg-emerald-900/10 border-emerald-900/30"
                  : gate.verdict === "WARN"
                    ? "bg-amber-900/10 border-amber-900/30"
                    : "bg-red-900/10 border-red-900/30"
              }`}
            >
              <div className="flex items-center gap-2">
                {gate.verdict === "PASS" ? (
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                ) : gate.verdict === "WARN" ? (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span className="text-[10px] font-mono font-bold text-neutral-300">
                  {GATE_LABELS[gate.gate] ?? gate.gate}
                </span>
              </div>
              <span
                className={`text-[9px] font-mono font-bold ${
                  gate.verdict === "PASS"
                    ? "text-emerald-400"
                    : gate.verdict === "WARN"
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              >
                {gate.verdict}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Shield className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
          <p className="text-xs text-neutral-600">Aucun gate execute</p>
          <p className="text-[10px] text-neutral-700 mt-1">Lancez un dry-run</p>
        </div>
      )}
    </div>
  );
}

function InspectorExec({ executions }: { executions: ExecutionRow[] }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
          Executions
        </span>
        <span className="text-[10px] font-mono text-neutral-600">
          {executions.length} total
        </span>
      </div>
      {executions.length > 0 ? (
        <div className="space-y-1.5">
          {executions.map((exec) => (
            <Link
              key={exec.id}
              to={`/admin/video-hub/executions/${exec.id}`}
              className="block bg-[#0a0a0a] rounded-lg border border-neutral-800 p-2.5 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-neutral-500">
                  #{exec.id}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                    exec.status === "completed"
                      ? "bg-emerald-900/30 text-emerald-400"
                      : exec.status === "failed"
                        ? "bg-red-900/30 text-red-400"
                        : exec.status === "processing"
                          ? "bg-blue-900/30 text-blue-400"
                          : "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {exec.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-mono text-neutral-600">
                <span>{formatDuration(exec.durationMs)}</span>
                {exec.engineName && <span>{exec.engineName}</span>}
                <span>#{exec.attemptNumber}</span>
                {exec.renderErrorCode && (
                  <span className="text-red-500">{exec.renderErrorCode}</span>
                )}
              </div>
              <div className="text-[9px] font-mono text-neutral-700 mt-1">
                {new Date(exec.createdAt).toLocaleString("fr-FR")}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Activity className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
          <p className="text-xs text-neutral-600">Aucune execution</p>
        </div>
      )}
    </div>
  );
}

function InspectorDeriv({ derivatives }: { derivatives: DerivativeRow[] }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
          Derivees
        </span>
        <span className="text-[10px] font-mono text-neutral-600">
          {derivatives.length} total
        </span>
      </div>
      {derivatives.length > 0 ? (
        <div className="space-y-1.5">
          {derivatives.map((d) => (
            <Link
              key={d.brief_id}
              to={`/admin/video-hub/productions/${d.brief_id}`}
              className="block bg-[#0a0a0a] rounded-lg border border-neutral-800 p-2.5 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-blue-400">
                  {d.brief_id}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                    d.status === "completed"
                      ? "bg-emerald-900/30 text-emerald-400"
                      : d.status === "failed"
                        ? "bg-red-900/30 text-red-400"
                        : "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {d.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-mono text-neutral-600">
                <span>#{d.derivative_index}</span>
                <span>{d.video_type}</span>
                <span>
                  {new Date(d.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Copy className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
          <p className="text-xs text-neutral-600">Aucune derivee</p>
          <p className="text-[10px] text-neutral-700 mt-1">Utilisez DERIVE</p>
        </div>
      )}
    </div>
  );
}

// ─── Shared UI Atoms ─────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-900">
      <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-[11px] font-mono text-neutral-300">{value}</span>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-neutral-800 p-2.5 text-center">
      <p className="text-sm font-mono font-bold text-neutral-200">{value}</p>
      <p className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider mt-0.5">
        {label}
      </p>
    </div>
  );
}

// ─── Feedback Toasts ─────────────────────────────────────────

function FeedbackToasts({
  scriptFetcher,
  audioFetcher,
  fetcher,
  deriveFetcher,
  batchFetcher,
  dryRunFetcher,
}: {
  scriptFetcher: ReturnType<typeof useFetcher>;
  audioFetcher: ReturnType<typeof useFetcher>;
  fetcher: ReturnType<typeof useFetcher>;
  deriveFetcher: ReturnType<typeof useFetcher>;
  batchFetcher: ReturnType<typeof useFetcher>;
  dryRunFetcher: ReturnType<typeof useFetcher>;
}) {
  const toasts: Array<{ ok: boolean; msg: string }> = [];

  const sd = scriptFetcher.data as Record<string, unknown> | undefined;
  if (sd?.ok === true && sd?.data) {
    const d = sd.data as Record<string, unknown>;
    toasts.push({
      ok: true,
      msg: `Script: ${d.claimCount} claims, ~${Math.round(((d.estimatedDurationSecs as number) ?? 0) / 60)}min`,
    });
  }
  if (sd?.ok === false)
    toasts.push({ ok: false, msg: (sd.error as string) ?? "Erreur script" });

  const ad = audioFetcher.data as Record<string, unknown> | undefined;
  if (ad?.ok === true && ad?.data) {
    const d = ad.data as Record<string, unknown>;
    toasts.push({
      ok: true,
      msg: `Audio: ${(d.durationSecs as number)?.toFixed(1)}s${d.cached ? " (cache)" : ""}`,
    });
  }
  if (ad?.ok === false)
    toasts.push({ ok: false, msg: (ad.error as string) ?? "Erreur TTS" });

  const fd = fetcher.data as Record<string, unknown> | undefined;
  if (fd?.ok === true) toasts.push({ ok: true, msg: "Execution soumise" });
  if (fd?.ok === false)
    toasts.push({ ok: false, msg: (fd.error as string) ?? "Erreur execution" });

  const dd = deriveFetcher.data as Record<string, unknown> | undefined;
  if (dd?.ok === true && dd?.data)
    toasts.push({
      ok: true,
      msg: `${(dd.data as Record<string, unknown>).derivativesCreated} derivees creees`,
    });
  if (dd?.ok === false)
    toasts.push({
      ok: false,
      msg: (dd.error as string) ?? "Erreur derivation",
    });

  const bd = batchFetcher.data as Record<string, unknown> | undefined;
  if (bd?.ok === true && bd?.data) {
    const d = bd.data as Record<string, unknown>;
    toasts.push({
      ok: true,
      msg: `Batch: ${(d.submitted as unknown[]).length} soumises`,
    });
  }
  if (bd?.ok === false)
    toasts.push({ ok: false, msg: (bd.error as string) ?? "Erreur batch" });

  const drd = dryRunFetcher.data as Record<string, unknown> | undefined;
  if (drd?.ok === false)
    toasts.push({ ok: false, msg: (drd.error as string) ?? "Erreur dry-run" });

  if (toasts.length === 0) return null;

  return (
    <div className="absolute top-16 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((t, i) => (
        <div
          key={i}
          className={`
            px-4 py-2.5 rounded-lg text-xs font-mono border backdrop-blur-sm shadow-lg
            ${
              t.ok
                ? "bg-emerald-900/80 border-emerald-700/50 text-emerald-200"
                : "bg-red-900/80 border-red-700/50 text-red-200"
            }
          `}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
