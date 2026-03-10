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
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { useDiagnosticVehicleSelector } from "./hooks/use-diagnostic-vehicle-selector";
import { DiagnosticResults } from "./results/DiagnosticResults";
import { StepSymptom } from "./steps/StepSymptom";
import { StepVehicle } from "./steps/StepVehicle";
import {
  type WizardState,
  type WizardAction,
  type DiagnosticApiResponse,
} from "./types";

const STORAGE_KEY = "diag-wizard-draft";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

const STEPS = [
  { id: 1, label: "Vehicule", description: "Identifiez votre vehicule" },
  { id: 2, label: "Symptome", description: "Decrivez le probleme" },
  { id: 3, label: "Diagnostic", description: "Resultat et recommandations" },
];

const LOADING_STEPS = [
  "Analyse des symptomes...",
  "Evaluation des hypotheses...",
  "Verification securite...",
  "Consultation documentation...",
  "Preparation du rapport...",
];

const initialState: WizardState = {
  step: 1,
  vehicle: { brand: "", model: "" },
  systemScope: "freinage",
  symptomSlugs: [],
  result: null,
  loading: false,
  error: null,
};

/** Restore draft from localStorage (steps 1-2 only, with TTL) */
function loadDraft(): Partial<WizardState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // TTL check
    if (draft.savedAt && Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (draft.step && draft.step <= 2) return draft;
    return null;
  } catch {
    return null;
  }
}

/** Save draft to localStorage (only steps 1-2, skip result) */
function saveDraft(state: WizardState) {
  if (typeof window === "undefined") return;
  try {
    if (state.step > 2) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const draft = {
      step: state.step,
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
  const [loadingStep, setLoadingStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Vehicle selector (lifted from StepVehicle for draft restore)
  const vehicleSelector = useDiagnosticVehicleSelector();

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
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
      if (draft.usageProfile || draft.lastServiceKm) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save draft on change (steps 1-2)
  useEffect(() => {
    saveDraft(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.step,
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
      setLoadingStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [state.loading]);

  // Scroll to results when they arrive
  useEffect(() => {
    if (state.step === 3 && state.result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.step, state.result]);

  const handleStepChange = useCallback((action: WizardAction) => {
    setTransitioning(true);
    setTimeout(() => {
      dispatch(action);
      setTransitioning(false);
    }, 150);
  }, []);

  const submitDiagnostic = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "NEXT_STEP" });

    try {
      const body = {
        intent_type: "diagnostic_symptom",
        system_scope: state.systemScope,
        vehicle_context: {
          brand: state.vehicle.brand || undefined,
          model: state.vehicle.model || undefined,
          year: state.vehicle.year || undefined,
          mileage_km: state.vehicle.mileage_km || undefined,
          fuel: state.vehicle.fuel || undefined,
        },
        usage_context: state.usageProfile
          ? {
              usage_profile: state.usageProfile,
              last_service_km: state.lastServiceKm || undefined,
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

      const response = await fetch("/api/diagnostic-engine/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: DiagnosticApiResponse = await response.json();

      if (data.success) {
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
        ? state.symptomSlugs.length > 0
        : false;

  const progressValue = (state.step / STEPS.length) * 100;

  return (
    <div className="space-y-6" ref={resultsRef}>
      {/* Stepper with connector lines */}
      <div
        className="space-y-3 print:hidden"
        aria-label="Progression du diagnostic"
        role="navigation"
      >
        <div className="flex items-center justify-between text-sm">
          {STEPS.map((s, idx) => (
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
                        : "bg-gray-100 text-gray-400 border border-gray-200"
                  }`}
                  aria-current={s.id === state.step ? "step" : undefined}
                >
                  {s.id < state.step ? "\u2713" : s.id}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {/* Connector line */}
              {idx < STEPS.length - 1 && (
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
        {state.step === 2 && <StepSymptom state={state} dispatch={dispatch} />}
        {state.step === 3 && (
          <DiagnosticResults
            state={state}
            dispatch={dispatch}
            loadingStepLabel={LOADING_STEPS[loadingStep]}
            onRetry={() => {
              dispatch({ type: "SET_STEP", payload: 2 });
              dispatch({ type: "SET_ERROR", payload: "" });
              dispatch({ type: "SET_LOADING", payload: false });
            }}
          />
        )}
      </div>

      {/* Navigation */}
      {state.step < 3 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 print:hidden">
          <Button
            variant="outline"
            onClick={() => handleStepChange({ type: "PREV_STEP" })}
            disabled={state.step === 1}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>

          {state.step === 2 ? (
            <Button
              onClick={submitDiagnostic}
              disabled={!canGoNext || state.loading}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {state.loading ? "Analyse en cours..." : "Lancer le diagnostic"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => handleStepChange({ type: "NEXT_STEP" })}
              disabled={!canGoNext}
              className="gap-2"
            >
              Suivant
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {state.step === 3 && !state.loading && (
        <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-200 print:hidden">
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "RESET" })}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Nouveau diagnostic
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
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
