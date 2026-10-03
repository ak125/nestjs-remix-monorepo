/**
 * StepSymptom — Step 2: System scope + symptom picker
 *
 * Systems loaded dynamically from API.
 * Error handling with retry on fetch failures.
 */
import { AlertTriangle, CheckCircle2, Cog, RefreshCw, X } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  type WizardState,
  type WizardAction,
  type SymptomOption,
} from "../types";

interface SystemOption {
  slug: string;
  label: string;
  description: string;
}

interface Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onAvailabilityChange?: (ready: boolean) => void;
}

const OptionSchema = z.object({
  slug: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z
    .string()
    .nullable()
    .transform((value) => value ?? ""),
});
const SystemsResponseSchema = z.object({
  success: z.literal(true),
  systems: z
    .array(OptionSchema)
    .min(1)
    .refine(
      (items) => new Set(items.map((item) => item.slug)).size === items.length,
    ),
});
const SymptomsResponseSchema = z.object({
  success: z.literal(true),
  symptoms: z
    .array(
      OptionSchema.extend({
        urgency: z.enum(["critique", "haute", "moyenne", "basse"]),
      }),
    )
    .refine(
      (items) => new Set(items.map((item) => item.slug)).size === items.length,
    ),
});

const URGENCY_COLORS: Record<string, string> = {
  critique: "bg-red-100 text-red-800 border-red-300",
  haute: "bg-red-100 text-red-700 border-red-200",
  moyenne: "bg-amber-100 text-amber-700 border-amber-200",
  basse: "bg-green-100 text-green-700 border-green-200",
};

const URGENCY_LABELS: Record<string, string> = {
  critique: "Urgence critique",
  haute: "Urgence haute",
  moyenne: "Urgence moyenne",
  basse: "Urgence basse",
};

export function StepSymptom({ state, dispatch, onAvailabilityChange }: Props) {
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(true);
  const [systemsError, setSystemsError] = useState(false);

  const [symptoms, setSymptoms] = useState<SymptomOption[]>([]);
  const [loadingSymptoms, setLoadingSymptoms] = useState(true);
  const [symptomsError, setSymptomsError] = useState(false);

  const [symptomsSystem, setSymptomsSystem] = useState<string | null>(null);
  const systemsRequest = useRef<AbortController | null>(null);
  const symptomsRequest = useRef<AbortController | null>(null);

  const fetchSystems = useCallback(async () => {
    systemsRequest.current?.abort();
    const controller = new AbortController();
    systemsRequest.current = controller;
    setLoadingSystems(true);
    setSystemsError(false);
    setSystems([]);
    try {
      const res = await fetch("/api/diagnostic-engine/systems", {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Systems unavailable");
      const data = SystemsResponseSchema.parse(await res.json());
      if (controller.signal.aborted) return;
      setSystems(data.systems);
      if (!data.systems.some((item) => item.slug === state.systemScope)) {
        dispatch({ type: "SET_SYSTEM", payload: data.systems[0].slug });
      }
    } catch {
      if (!controller.signal.aborted) setSystemsError(true);
    } finally {
      if (!controller.signal.aborted) setLoadingSystems(false);
    }
  }, [state.systemScope, dispatch]);

  const fetchSymptoms = useCallback(async () => {
    symptomsRequest.current?.abort();
    const controller = new AbortController();
    symptomsRequest.current = controller;
    setLoadingSymptoms(true);
    setSymptomsError(false);
    setSymptoms([]);
    setSymptomsSystem(null);
    try {
      const res = await fetch(
        `/api/diagnostic-engine/symptoms?system=${encodeURIComponent(state.systemScope)}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error("Symptoms unavailable");
      const data = SymptomsResponseSchema.parse(await res.json());
      if (controller.signal.aborted) return;
      setSymptoms(data.symptoms);
      setSymptomsSystem(state.systemScope);
    } catch {
      if (!controller.signal.aborted) setSymptomsError(true);
    } finally {
      if (!controller.signal.aborted) setLoadingSymptoms(false);
    }
  }, [state.systemScope]);

  useEffect(() => {
    void fetchSystems();
    return () => systemsRequest.current?.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchSymptoms();
    return () => symptomsRequest.current?.abort();
  }, [fetchSymptoms]);

  useEffect(() => {
    onAvailabilityChange?.(
      !loadingSystems &&
        !systemsError &&
        systems.some((system) => system.slug === state.systemScope) &&
        !loadingSymptoms &&
        !symptomsError &&
        symptomsSystem === state.systemScope &&
        symptoms.length > 0 &&
        state.symptomSlugs.every((slug) =>
          symptoms.some((item) => item.slug === slug),
        ),
    );
  }, [
    loadingSystems,
    systemsError,
    systems,
    loadingSymptoms,
    symptomsError,
    symptomsSystem,
    symptoms,
    state.systemScope,
    state.symptomSlugs,
    onAvailabilityChange,
  ]);

  useEffect(() => () => onAvailabilityChange?.(false), [onAvailabilityChange]);

  const isSelected = (slug: string) => state.symptomSlugs.includes(slug);
  const primarySymptom = state.symptomSlugs[0];
  const activeSystem = systems.find((s) => s.slug === state.systemScope);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">
          Décrivez le problème
        </h2>
        <p className="text-sm text-gray-500">
          Choisissez le système concerné, puis sélectionnez vos symptômes.
        </p>
      </div>

      {/* System selector */}
      {loadingSystems ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : systemsError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center space-y-2">
          <p className="text-sm text-red-700">
            Impossible de charger les systèmes disponibles.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSystems}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Réessayer
          </Button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          role="radiogroup"
          aria-label="Système mécanique"
        >
          {systems.map((sys) => {
            const active = state.systemScope === sys.slug;
            return (
              <button
                key={sys.slug}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  if (!active) {
                    dispatch({ type: "SET_SYSTEM", payload: sys.slug });
                    dispatch({ type: "SET_SYMPTOMS", payload: [] });
                  }
                }}
                className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all min-h-[56px] ${
                  active
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Cog
                  className={`w-5 h-5 mt-0.5 shrink-0 ${
                    active ? "text-blue-600" : "text-gray-400"
                  }`}
                />
                <span>
                  <span
                    className={`font-medium text-sm ${
                      active ? "text-blue-900 font-semibold" : "text-gray-900"
                    }`}
                  >
                    {sys.label}
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {sys.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected symptoms summary */}
      {state.symptomSlugs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {state.symptomSlugs.map((slug, i) => {
            const symptom = symptoms.find((s) => s.slug === slug);
            return (
              <Badge
                key={slug}
                variant="outline"
                className={`gap-1.5 py-1.5 px-3 text-sm ${
                  i === 0
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-gray-50 border-gray-300 text-blue-900"
                }`}
              >
                {i === 0 && <CheckCircle2 className="w-3.5 h-3.5" />}
                {symptom?.label || slug}
                <button
                  type="button"
                  aria-label={`Retirer ${symptom?.label || slug}`}
                  onClick={() =>
                    dispatch({ type: "REMOVE_SYMPTOM", payload: slug })
                  }
                  className="ml-1 hover:text-red-500 min-w-[24px] min-h-[24px] flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Symptom picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cog className="w-5 h-5 text-blue-600" />
            {activeSystem?.label || state.systemScope} — Symptômes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSymptoms ||
          (!symptomsError && symptomsSystem !== state.systemScope) ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-gray-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : symptomsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center space-y-2">
              <p className="text-sm text-red-700">
                Impossible de charger les symptômes pour ce système.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSymptoms}
                className="gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Réessayer
              </Button>
            </div>
          ) : symptoms.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Aucun symptôme disponible pour ce système.
            </p>
          ) : (
            <div
              className="space-y-2"
              role="group"
              aria-label="Symptômes disponibles"
            >
              {symptoms.map((symptom) => {
                const selected = isSelected(symptom.slug);
                const isPrimary = primarySymptom === symptom.slug;

                return (
                  <button
                    key={symptom.slug}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    aria-label={`${symptom.label} — ${URGENCY_LABELS[symptom.urgency] || symptom.urgency}`}
                    onClick={() => {
                      if (selected) {
                        dispatch({
                          type: "REMOVE_SYMPTOM",
                          payload: symptom.slug,
                        });
                      } else {
                        dispatch({
                          type: "ADD_SYMPTOM",
                          payload: symptom.slug,
                        });
                      }
                    }}
                    className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-all min-h-[56px] ${
                      selected
                        ? isPrimary
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                          : "border-blue-300 bg-blue-50/50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}
                    >
                      {selected && (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      )}
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-medium text-sm ${
                            selected ? "text-blue-900" : "text-gray-900"
                          }`}
                        >
                          {symptom.label}
                        </span>
                        {isPrimary && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-blue-100 border-blue-200 text-blue-700"
                          >
                            Principal
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            URGENCY_COLORS[symptom.urgency] || ""
                          }`}
                        >
                          {(symptom.urgency === "haute" ||
                            symptom.urgency === "critique") && (
                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                          )}
                          {URGENCY_LABELS[symptom.urgency] || symptom.urgency}
                        </Badge>
                      </span>
                      <span className="block text-xs text-gray-500 mt-1 leading-relaxed">
                        {symptom.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
