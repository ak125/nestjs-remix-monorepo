/**
 * DiagnosticWizard — Orchestrateur 3 steps + session persistence
 *
 * Step 1: Vehicule + usage
 * Step 2: Systeme + symptomes
 * Step 3: Resultat (8 blocs)
 *
 * Slice 11: Enhanced UX — transitions, loading progress, print, stepper
 */
/* eslint-disable no-restricted-syntax */ // print:hidden is intentional (print media query)
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Link2,
  Check,
  Printer,
} from "lucide-react";
import { useReducer, useCallback, useEffect, useState, useRef } from "react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { useDiagnosticVehicleSelector } from "./hooks/use-diagnostic-vehicle-selector";
import { DiagnosticResults } from "./results/DiagnosticResults";
import { StepMaintenance } from "./steps/StepMaintenance";
import { StepSymptom } from "./steps/StepSymptom";
import { StepVehicle } from "./steps/StepVehicle";
import {
  type WizardState,
  type WizardAction,
  type DiagnosticApiResponse,
} from "./types";

const STORAGE_KEY = "diag-wizard-draft";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

interface StepEntry {
  id: number;
  label: string;
  description: string;
}

interface WizardStepsContent {
  steps: StepEntry[];
  loading_steps: string[];
}

// Fallback used during initial client render (before useEffect fetch completes)
// AND if /api/diagnostic-engine/wizard-steps endpoint is unreachable.
// Wiki source: automecanik-wiki/wiki/diagnostic/wizard-steps.md
const FALLBACK_STEPS: StepEntry[] = [
  { id: 1, label: "Vehicule", description: "Identifiez votre vehicule" },
  { id: 2, label: "Symptome", description: "Decrivez le probleme" },
  { id: 3, label: "Diagnostic", description: "Resultat et recommandations" },
];

const FALLBACK_LOADING_STEPS: string[] = [
  "Analyse des symptomes...",
  "Evaluation des hypotheses...",
  "Verification securite...",
  "Consultation documentation...",
  "Preparation du rapport...",
];

const initialState: WizardState = {
  step: 1,
  analysisMode: "diagnostic",
  maintenanceRecords: [],
  vehicle: { brand: "", model: "" },
  systemScope: "freinage",
  symptomSlugs: [],
  result: null,
  loading: false,
  error: null,
};

// The local draft is a resumable input snapshot, never a stored diagnosis.
const DraftSchema = z.object({
  version: z.literal(1).optional(), // Existing unversioned drafts remain readable.
  savedAt: z.number().int().nonnegative(),
  step: z.union([z.literal(1), z.literal(2)]),
  analysisMode: z.enum(["diagnostic", "maintenance"]).optional(),
  vehicle: z.object({
    brand: z.string(),
    model: z.string(),
    brandId: z.number().int().positive().optional(),
    modelId: z.number().int().positive().optional(),
    year: z.number().int().min(1970).max(2030).optional(),
    mileage_km: z.number().finite().nonnegative().optional(),
    fuel: z.string().optional(),
  }),
  systemScope: z.string().min(1).optional(),
  symptomSlugs: z.array(z.string().min(1)).optional(),
  usageProfile: z.string().optional(),
  lastServiceKm: z.number().finite().nonnegative().optional(),
  maintenanceRecords: z
    .array(
      z.object({
        operation_slug: z.string().trim().min(1),
        last_service_km: z.number().finite().nonnegative().optional(),
        last_service_date: z.string().optional(),
      }),
    )
    .optional(),
});

/** Restore draft from localStorage (steps 1-2 only, with TTL) */
function loadDraft(): Partial<WizardState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = DraftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const draft = parsed.data;
    const age = Date.now() - draft.savedAt;
    if (age < 0 || age > DRAFT_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

/** Save draft to localStorage (only steps 1-2, skip result) */
function saveDraft(state: WizardState) {
  if (typeof window === "undefined") return;
  try {
    if (
      state.analysisMode !== "maintenance" &&
      state.result?.success &&
      state.result.evidence_pack
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const draft = {
      version: 1,
      step: Math.min(state.step, 2),
      analysisMode: state.analysisMode,
      maintenanceRecords: state.maintenanceRecords,
      vehicle: state.vehicle,
      usageProfile: state.usageProfile,
      lastServiceKm: state.lastServiceKm,
      systemScope: state.systemScope,
      symptomSlugs: state.symptomSlugs,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable
  }
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_MODE":
      return {
        ...state,
        analysisMode: action.payload,
        step: 1,
        result: null,
        error: null,
      };
    case "SET_MAINTENANCE_RECORDS":
      return { ...state, maintenanceRecords: action.payload };
    case "SET_VEHICLE":
      return { ...state, vehicle: action.payload };
    case "SET_USAGE":
      return {
        ...state,
        usageProfile: action.payload.profile,
        lastServiceKm: action.payload.lastServiceKm,
      };
    case "SET_SYSTEM":
      return { ...state, systemScope: action.payload, symptomSlugs: [] };
    case "SET_SYMPTOMS":
      return { ...state, symptomSlugs: action.payload };
    case "ADD_SYMPTOM":
      return {
        ...state,
        symptomSlugs: state.symptomSlugs.includes(action.payload)
          ? state.symptomSlugs
          : [...state.symptomSlugs, action.payload],
      };
    case "REMOVE_SYMPTOM":
      return {
        ...state,
        symptomSlugs: state.symptomSlugs.filter((s) => s !== action.payload),
      };
    case "SET_STEP":
      return { ...state, step: action.payload };
    case "NEXT_STEP":
      return { ...state, step: Math.min(state.step + 1, 3) };
    case "PREV_STEP":
      return { ...state, step: Math.max(state.step - 1, 1) };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_RESULT":
      return { ...state, result: action.payload, loading: false, error: null };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

export function DiagnosticWizard() {
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [steps, setSteps] = useState<StepEntry[]>(FALLBACK_STEPS);
  const [loadingMessages, setLoadingMessages] = useState<string[]>(
    FALLBACK_LOADING_STEPS,
  );
  const [draftReady, setDraftReady] = useState(false);
  const [symptomsAvailable, setSymptomsAvailable] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [maintenanceAvailable, setMaintenanceAvailable] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Vehicle selector (lifted from StepVehicle for draft restore)
  const vehicleSelector = useDiagnosticVehicleSelector();

  // Fetch wizard content from wiki/diagnostic/wizard-steps.md (ADR-032).
  // Client-side fetch keeps DiagnosticWizard parent-agnostic (used in 2+ pages).
  // FALLBACK_* drive initial render — endpoint failure leaves them in place.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/diagnostic-engine/wizard-steps")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        const content = json?.entity_data as WizardStepsContent | undefined;
        if (content?.steps?.length) setSteps(content.steps);
        if (content?.loading_steps?.length)
          setLoadingMessages(content.loading_steps);
      })
      .catch(() => {
        // Silent fallback — fallbacks above already in state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A shared result takes precedence over a local draft without changing it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("session")) {
      setSessionId(params.get("session") ?? "");
      dispatch({ type: "SET_STEP", payload: 3 });
      dispatch({ type: "SET_LOADING", payload: true });
      return;
    }
    const draft = loadDraft();
    if (draft) {
      if (draft.analysisMode === "maintenance")
        dispatch({ type: "SET_MODE", payload: "maintenance" });
      if (
        Array.isArray(draft.maintenanceRecords) &&
        draft.maintenanceRecords.every(
          (record) => record && typeof record.operation_slug === "string",
        )
      ) {
        dispatch({
          type: "SET_MAINTENANCE_RECORDS",
          payload: draft.maintenanceRecords,
        });
      }
      if (draft.vehicle) {
        dispatch({
          type: "SET_VEHICLE",
          payload: draft.vehicle as WizardState["vehicle"],
        });
        // Re-fetch models if brand was saved
        if (draft.vehicle.brandId) {
          vehicleSelector.fetchModels(draft.vehicle.brandId);
        }
      }
      if (draft.usageProfile || draft.lastServiceKm != null) {
        dispatch({
          type: "SET_USAGE",
          payload: {
            profile: draft.usageProfile,
            lastServiceKm: draft.lastServiceKm,
          },
        });
      }
      if (draft.systemScope)
        dispatch({ type: "SET_SYSTEM", payload: draft.systemScope });
      if (draft.symptomSlugs && draft.symptomSlugs.length > 0) {
        dispatch({ type: "SET_SYMPTOMS", payload: draft.symptomSlugs });
      }
      if (draft.step && draft.step === 2)
        dispatch({ type: "SET_STEP", payload: 2 });
    }
    setDraftReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read the stored result only. Reopening a link must never run /analyze.
  useEffect(() => {
    if (sessionId === null) return;
    let cancelled = false;
    const abort = new AbortController();
    setSessionDate(null);
    dispatch({ type: "SET_ERROR", payload: "" });
    dispatch({ type: "SET_LOADING", payload: true });
    const restore = async () => {
      if (!z.string().uuid().safeParse(sessionId).success) {
        dispatch({ type: "SET_ERROR", payload: "Lien de session invalide." });
        return;
      }
      try {
        const response = await fetch(
          `/api/diagnostic-engine/sessions/${sessionId}`,
          { signal: abort.signal },
        );
        if (!response.ok) throw new Error("unavailable");
        const data: {
          success?: boolean;
          error?: string;
          session?: {
            id: string;
            created_at: string;
            result: Pick<DiagnosticApiResponse, "evidence_pack">;
          };
        } = await response.json();
        if (cancelled) return;
        if (!data.success) {
          dispatch({
            type: "SET_ERROR",
            payload:
              typeof data.error === "string"
                ? data.error
                : "Session indisponible.",
          });
          return;
        }
        const saved = data.session;
        if (
          typeof saved?.id !== "string" ||
          saved.id.toLowerCase() !== sessionId.toLowerCase() ||
          !z.string().datetime({ offset: true }).safeParse(saved.created_at)
            .success ||
          !saved.result?.evidence_pack ||
          typeof saved.result.evidence_pack !== "object"
        )
          throw new Error("unreadable");
        // The API validates EvidencePack with the canonical backend schema.
        dispatch({
          type: "SET_RESULT",
          payload: {
            success: true,
            session_id: saved.id,
            evidence_pack: saved.result.evidence_pack,
          },
        });
        setSessionDate(saved.created_at);
      } catch {
        if (!cancelled)
          dispatch({
            type: "SET_ERROR",
            payload:
              "Impossible de charger le résultat sauvegardé. Réessayez ou lancez un nouveau diagnostic.",
          });
      }
    };
    void restore();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [sessionId, sessionAttempt]);

  const startNewDiagnostic = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    setSessionId(null);
    setSessionDate(null);
    dispatch({ type: "RESET" });
    setDraftReady(true);
  }, []);

  // Save draft on change (steps 1-2)
  useEffect(() => {
    if (draftReady) saveDraft(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftReady,
    state.result,
    state.step,
    state.analysisMode,
    state.maintenanceRecords,
    state.vehicle,
    state.systemScope,
    state.symptomSlugs,
    state.usageProfile,
    state.lastServiceKm,
  ]);

  // Animated loading steps
  useEffect(() => {
    if (!state.loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [state.loading, loadingMessages.length]);

  // Scroll to results when they arrive
  useEffect(() => {
    if (state.step === 3 && state.result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.step, state.result]);

  useEffect(
    () => () => {
      if (transitionTimer.current !== null)
        clearTimeout(transitionTimer.current);
    },
    [],
  );

  const handleStepChange = useCallback((action: WizardAction) => {
    if (transitionTimer.current !== null) return;
    setTransitioning(true);
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      dispatch(action);
      setTransitioning(false);
    }, 150);
  }, []);

  const submitDiagnostic = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "NEXT_STEP" });

    try {
      const diagnosticBody = {
        intent_type: "diagnostic_symptom",
        system_scope: state.systemScope,
        vehicle_context: {
          brand: state.vehicle.brand || undefined,
          model: state.vehicle.model || undefined,
          year: state.vehicle.year || undefined,
          mileage_km: state.vehicle.mileage_km ?? undefined,
          fuel: state.vehicle.fuel || undefined,
        },
        usage_context:
          state.usageProfile || state.lastServiceKm != null
            ? {
                usage_profile: state.usageProfile,
                last_service_km: state.lastServiceKm ?? undefined,
              }
            : undefined,
        signal_input: {
          primary_signal: state.symptomSlugs[0],
          secondary_signals:
            state.symptomSlugs.length > 1
              ? state.symptomSlugs.slice(1)
              : undefined,
          signal_mode: "symptom_slugs",
        },
      };

      const body =
        state.analysisMode === "maintenance"
          ? {
              intent_type: "maintenance_check",
              vehicle_context: diagnosticBody.vehicle_context,
              usage_context: {
                maintenance_records: state.maintenanceRecords ?? [],
              },
            }
          : diagnosticBody;

      const response = await fetch("/api/diagnostic-engine/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: DiagnosticApiResponse = await response.json();

      if (response.ok && data.success) {
        dispatch({ type: "SET_RESULT", payload: data });
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: data.error || "Erreur inconnue",
        });
      }
    } catch {
      dispatch({
        type: "SET_ERROR",
        payload: "Erreur de connexion au serveur. Reessayez.",
      });
    }
  }, [state]);

  const copySessionLink = useCallback(() => {
    const sessionId = state.result?.session_id;
    if (!sessionId) return;
    const url = `${window.location.origin}/diagnostic-auto?session=${sessionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [state.result?.session_id]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const canGoNext =
    state.step === 1
      ? true
      : state.step === 2
        ? state.analysisMode === "maintenance"
          ? maintenanceAvailable && (state.maintenanceRecords?.length ?? 0) > 0
          : symptomsAvailable && state.symptomSlugs.length > 0
        : false;

  const displayedSteps =
    state.analysisMode === "maintenance"
      ? [
          { id: 1, label: "Véhicule" },
          { id: 2, label: "Entretien" },
          { id: 3, label: "Échéances" },
        ]
      : steps;
  const progressValue = (state.step / displayedSteps.length) * 100;

  return (
    <div className="space-y-6" ref={resultsRef}>
      {state.step === 1 && (
        <div
          className="flex flex-wrap gap-3"
          role="group"
          aria-label="Choisir le parcours"
        >
          <Button
            type="button"
            variant={
              state.analysisMode !== "maintenance" ? "default" : "outline"
            }
            disabled={transitioning}
            aria-pressed={state.analysisMode !== "maintenance"}
            onClick={() =>
              dispatch({ type: "SET_MODE", payload: "diagnostic" })
            }
          >
            Comprendre un symptôme
          </Button>
          <Button
            type="button"
            variant={
              state.analysisMode === "maintenance" ? "default" : "outline"
            }
            disabled={transitioning}
            aria-pressed={state.analysisMode === "maintenance"}
            onClick={() =>
              dispatch({ type: "SET_MODE", payload: "maintenance" })
            }
          >
            Vérifier mon entretien
          </Button>
        </div>
      )}
      {/* Stepper with connector lines */}
      <div
        className="space-y-3 print:hidden"
        aria-label={
          state.analysisMode === "maintenance"
            ? "Progression du bilan entretien"
            : "Progression du diagnostic"
        }
        role="navigation"
      >
        <div className="flex items-center justify-between text-sm">
          {displayedSteps.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1">
              <div
                className={`flex items-center gap-2 transition-colors duration-300 ${
                  s.id === state.step
                    ? "text-blue-600 font-semibold"
                    : s.id < state.step
                      ? "text-green-600"
                      : "text-gray-400"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 ${
                    s.id === state.step
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : s.id < state.step
                        ? "bg-green-100 text-green-700 border border-green-300"
                        : "bg-gray-100 text-white border border-gray-200"
                  }`}
                  aria-current={s.id === state.step ? "step" : undefined}
                >
                  {s.id < state.step ? "\u2713" : s.id}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {/* Connector line */}
              {idx < displayedSteps.length - 1 && (
                <div className="flex-1 mx-3 hidden sm:block">
                  <div
                    className={`h-0.5 rounded transition-colors duration-500 ${
                      s.id < state.step ? "bg-green-300" : "bg-gray-200"
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <Progress
          value={progressValue}
          className="h-1.5 transition-all duration-500"
        />
      </div>

      {sessionDate && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          role="status"
        >
          <p>
            Résultat enregistré le{" "}
            {new Date(sessionDate).toLocaleString("fr-FR")}.
          </p>
          <p>
            Il reflète les informations disponibles à cette date ; aucune
            réévaluation n’a été effectuée. Lancez un nouveau diagnostic si la
            situation a changé.
          </p>
        </div>
      )}

      {/* Step content with transition */}
      <div
        className={`min-h-[400px] transition-opacity duration-150 ${
          transitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        {state.step === 1 && (
          <StepVehicle
            state={state}
            dispatch={dispatch}
            vehicleSelector={vehicleSelector}
          />
        )}
        {state.step === 2 &&
          (state.analysisMode === "maintenance" ? (
            <StepMaintenance
              records={state.maintenanceRecords ?? []}
              onChange={(records) =>
                dispatch({ type: "SET_MAINTENANCE_RECORDS", payload: records })
              }
              onAvailabilityChange={setMaintenanceAvailable}
            />
          ) : (
            <StepSymptom
              state={state}
              dispatch={dispatch}
              onAvailabilityChange={setSymptomsAvailable}
            />
          ))}
        {state.step === 3 && (
          <DiagnosticResults
            state={state}
            dispatch={dispatch}
            loadingStepLabel={
              sessionId !== null
                ? "Chargement du résultat sauvegardé..."
                : state.analysisMode === "maintenance"
                  ? "Calcul des échéances à partir de votre historique..."
                  : loadingMessages[loadingStep]
            }
            onRetry={
              sessionId !== null
                ? undefined
                : () => {
                    dispatch({ type: "SET_STEP", payload: 2 });
                    dispatch({ type: "SET_ERROR", payload: "" });
                    dispatch({ type: "SET_LOADING", payload: false });
                  }
            }
          />
        )}
      </div>

      {sessionId !== null && state.error && !state.loading && (
        <Button
          variant="outline"
          onClick={() => setSessionAttempt((attempt) => attempt + 1)}
        >
          Réessayer le chargement
        </Button>
      )}

      {/* Navigation */}
      {state.step < 3 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 print:hidden">
          <Button
            variant="outline"
            onClick={() => handleStepChange({ type: "PREV_STEP" })}
            disabled={state.step === 1 || transitioning}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>

          {state.step === 2 ? (
            <Button
              onClick={submitDiagnostic}
              disabled={!canGoNext || state.loading || transitioning}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {state.loading
                ? "Analyse en cours..."
                : state.analysisMode === "maintenance"
                  ? "Estimer les échéances"
                  : "Lancer le diagnostic"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => handleStepChange({ type: "NEXT_STEP" })}
              disabled={!canGoNext || transitioning}
              className="gap-2"
            >
              Suivant
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {state.step === 3 && (!state.loading || sessionId !== null) && (
        <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-200 print:hidden">
          <Button
            variant="outline"
            onClick={startNewDiagnostic}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {state.analysisMode === "maintenance"
              ? "Nouvelle analyse"
              : "Nouveau diagnostic"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            disabled={!state.result?.evidence_pack}
            className="gap-1.5 text-gray-500 hover:text-gray-700"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimer
          </Button>

          {state.result?.session_id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={copySessionLink}
              className="gap-1.5 text-gray-500 hover:text-gray-700"
            >
              {linkCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-green-600">Lien copie</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  Copier le lien
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
