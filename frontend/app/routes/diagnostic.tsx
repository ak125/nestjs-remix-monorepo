import { json, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Search,
  Wrench,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";

// Types
interface Observable {
  node_id: string;
  node_label: string;
  node_category: string;
}

interface DiagnosticResult {
  primaryFault?: {
    faultId: string;
    faultLabel: string;
    faultCategory: string;
    score: number;
    matchedObservables: string[];
    parts: Array<{
      partNodeId: string;
      partLabel: string;
      gammeId: string;
    }>;
    actions: Array<{
      actionNodeId: string;
      actionLabel: string;
      actionCategory: string;
    }>;
  };
  faults: Array<{
    faultId: string;
    faultLabel: string;
    score: number;
  }>;
  confidence: number;
  explanation: string;
  matchedSymptoms: string[];
  unmatchedSymptoms: string[];
}

// Loader: Charge les observables disponibles
export async function loader() {
  try {
    const response = await fetch(
      "http://127.0.0.1:3000/api/knowledge-graph/nodes?type=Observable",
    );
    if (!response.ok) {
      return json({
        observables: [],
        error: "Erreur de chargement des symptômes",
      });
    }
    const data = await response.json();
    return json({ observables: data || [], error: null });
  } catch (error) {
    console.error("Loader error:", error);
    return json({ observables: [], error: "Service indisponible" });
  }
}

// Action: Appelle le diagnostic
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const symptoms = formData.getAll("symptoms") as string[];

  if (symptoms.length === 0) {
    return json({ error: "Veuillez sélectionner au moins un symptôme" });
  }

  try {
    const response = await fetch(
      "http://127.0.0.1:3000/api/knowledge-graph/diagnose",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observables: symptoms }),
      },
    );

    if (!response.ok) {
      return json({ error: "Erreur lors du diagnostic" });
    }

    return json(await response.json());
  } catch (error) {
    console.error("Action error:", error);
    return json({ error: "Service de diagnostic indisponible" });
  }
}

// Meta
export const meta = () => [
  { title: "Diagnostic Auto - Trouvez la panne | Automecanik" },
  {
    name: "description",
    content:
      "Identifiez la panne de votre véhicule en sélectionnant les symptômes observés. Diagnostic intelligent avec recommandations de pièces.",
  },
];

// Component
export default function DiagnosticPage() {
  const { observables, error: loaderError } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<DiagnosticResult & { error?: string }>();
  const [selected, setSelected] = useState<string[]>([]);

  const isLoading = fetcher.state === "submitting";
  const result = fetcher.data;
  const hasResult = result && !result.error;

  const toggleSymptom = (label: string) => {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label],
    );
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.9) return "Très probable";
    if (score >= 0.7) return "Probable";
    if (score >= 0.5) return "Possible";
    return "Incertain";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Search className="h-8 w-8 text-blue-600" />
            Diagnostic Auto
          </h1>
          <p className="text-gray-600">
            Sélectionnez les symptômes observés sur votre véhicule pour
            identifier la panne probable
          </p>
        </div>

        {/* Error State */}
        {loaderError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{loaderError}</AlertDescription>
          </Alert>
        )}

        {/* Symptom Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Symptômes observés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <fetcher.Form method="post">
              {observables.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Aucun symptôme disponible
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {observables.map((obs: Observable) => (
                    <label
                      key={obs.node_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selected.includes(obs.node_label)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <Checkbox
                        name="symptoms"
                        value={obs.node_label}
                        checked={selected.includes(obs.node_label)}
                        onCheckedChange={() => toggleSymptom(obs.node_label)}
                      />
                      <span className="text-sm">{obs.node_label}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Selected count */}
              {selected.length > 0 && (
                <p className="mt-4 text-sm text-gray-600">
                  {selected.length} symptôme{selected.length > 1 ? "s" : ""}{" "}
                  sélectionné{selected.length > 1 ? "s" : ""}
                </p>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                className="mt-6 w-full"
                size="lg"
                disabled={selected.length === 0 || isLoading}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Analyser les symptômes
                  </>
                )}
              </Button>
            </fetcher.Form>
          </CardContent>
        </Card>

        {/* Error from action */}
        {result?.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {hasResult && result.primaryFault && (
          <Card className="border-green-300 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span>{result.primaryFault.faultLabel}</span>
                </div>
                <Badge
                  className={`${getConfidenceColor(result.confidence)} text-white`}
                >
                  {Math.round(result.confidence * 100)}% -{" "}
                  {getConfidenceLabel(result.confidence)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Confidence bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Niveau de confiance</span>
                  <span>{Math.round(result.confidence * 100)}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getConfidenceColor(result.confidence)} transition-all duration-500`}
                    style={{ width: `${result.confidence * 100}%` }}
                  />
                </div>
              </div>

              {/* Explanation */}
              <div className="p-4 bg-white rounded-lg border">
                <p className="text-gray-700">{result.explanation}</p>
              </div>

              {/* Matched symptoms */}
              {result.matchedSymptoms && result.matchedSymptoms.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">
                    Symptômes correspondants:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.matchedSymptoms.map((symptom, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-green-100 text-green-800"
                      >
                        {symptom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {result.primaryFault.actions &&
                result.primaryFault.actions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-blue-600" />
                      Actions recommandées
                    </h4>
                    <ul className="space-y-2">
                      {result.primaryFault.actions.map((action, i) => (
                        <li
                          key={action.actionNodeId || i}
                          className="flex items-start gap-2 p-3 bg-white rounded-lg border"
                        >
                          <span className="text-blue-600 font-bold">
                            {i + 1}.
                          </span>
                          <div>
                            <span className="font-medium">
                              {action.actionLabel}
                            </span>
                            {action.actionCategory && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {action.actionCategory}
                              </Badge>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Parts */}
              {result.primaryFault.parts &&
                result.primaryFault.parts.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-orange-600" />
                      Pièces concernées
                    </h4>
                    <div className="space-y-2">
                      {result.primaryFault.parts.map((part, i) => (
                        <a
                          key={part.partNodeId || i}
                          href={
                            part.gammeId ? `/pieces/gamme-${part.gammeId}` : "#"
                          }
                          className="flex items-center justify-between p-4 bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition-all"
                        >
                          <span className="font-medium">{part.partLabel}</span>
                          {part.gammeId && (
                            <span className="text-blue-600 text-sm flex items-center gap-1">
                              Voir la gamme
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              {/* Other faults */}
              {result.faults && result.faults.length > 1 && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-gray-700 mb-3">
                    Autres pannes possibles:
                  </h4>
                  <div className="space-y-2">
                    {result.faults.slice(1, 4).map((fault, i) => (
                      <div
                        key={fault.faultId || i}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border"
                      >
                        <span>{fault.faultLabel}</span>
                        <Badge variant="outline">
                          {Math.round(fault.score * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No results */}
        {hasResult && !result.primaryFault && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Aucune panne identifiée</AlertTitle>
            <AlertDescription>
              Les symptômes sélectionnés ne correspondent à aucune panne connue
              dans notre base. Essayez d'ajouter plus de détails ou de
              sélectionner des symptômes différents.
            </AlertDescription>
          </Alert>
        )}

        {/* Info footer */}
        <div className="text-center text-sm text-gray-500 pt-4">
          <p>
            Ce diagnostic est basé sur notre Knowledge Graph automobile avec{" "}
            {observables.length} symptômes référencés.
            <br />
            Il est fourni à titre indicatif et ne remplace pas l'avis d'un
            professionnel.
          </p>
        </div>
      </div>
    </div>
  );
}
