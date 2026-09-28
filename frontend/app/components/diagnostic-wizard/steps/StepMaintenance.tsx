import { useEffect, useId, useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export interface MaintenanceRecord {
  operation_slug: string;
  last_service_km?: number;
  last_service_date?: string;
}

interface MaintenanceOperation {
  slug: string;
  label: string;
  description: string | null;
}

interface Props {
  records: MaintenanceRecord[];
  onChange: (records: MaintenanceRecord[]) => void;
  onAvailabilityChange: (ready: boolean) => void;
}

function isOperation(value: unknown): value is MaintenanceOperation {
  return (
    typeof value === "object" &&
    value !== null &&
    "slug" in value &&
    typeof value.slug === "string" &&
    value.slug.trim().length > 0 &&
    "label" in value &&
    typeof value.label === "string" &&
    value.label.trim().length > 0 &&
    "description" in value &&
    (value.description === null || typeof value.description === "string")
  );
}

export function StepMaintenance({
  records,
  onChange,
  onAvailabilityChange,
}: Props) {
  const [operations, setOperations] = useState<MaintenanceOperation[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const inputPrefix = useId();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOperations() {
      setStatus("loading");
      try {
        const response = await fetch(
          "/api/diagnostic-engine/maintenance-operations",
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Operations unavailable");
        const payload: unknown = await response.json();
        if (
          typeof payload !== "object" ||
          payload === null ||
          !("success" in payload) ||
          payload.success !== true ||
          !("operations" in payload) ||
          !Array.isArray(payload.operations) ||
          !payload.operations.every(isOperation) ||
          new Set(payload.operations.map((operation) => operation.slug))
            .size !== payload.operations.length
        ) {
          throw new Error("Invalid operations response");
        }
        if (!controller.signal.aborted) {
          setOperations(payload.operations);
          setStatus("loaded");
        }
      } catch {
        if (!controller.signal.aborted) {
          setOperations([]);
          setStatus("error");
        }
      }
    }
    void loadOperations();
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    onAvailabilityChange(
      status === "loaded" &&
        operations.length > 0 &&
        records.every((record) =>
          operations.some(
            (operation) => operation.slug === record.operation_slug,
          ),
        ),
    );
  }, [status, operations, records, onAvailabilityChange]);

  const retry = () => {
    setStatus("loading");
    setAttempt((value) => value + 1);
  };
  const remove = (slug: string) =>
    onChange(records.filter((record) => record.operation_slug !== slug));
  const update = (slug: string, patch: Partial<MaintenanceRecord>) =>
    onChange(
      records.map((record) =>
        record.operation_slug === slug ? { ...record, ...patch } : record,
      ),
    );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Votre entretien</h2>
        <p className="text-sm text-gray-600">
          Sélectionnez uniquement les opérations concernant votre véhicule. Les
          intervalles sont génériques ; leur applicabilité constructeur
          n&apos;est pas vérifiée. Référez-vous au carnet d&apos;entretien du
          véhicule.
        </p>
        <p className="text-sm text-gray-600">
          Renseignez les derniers entretiens connus pour chaque opération.
          Laissez les informations inconnues vides.
        </p>
      </div>
      {status === "loading" && (
        <p role="status">Chargement des opérations d&apos;entretien...</p>
      )}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>
            Impossible de charger les opérations d&apos;entretien. Vos
            historiques sont conservés.
          </AlertDescription>
        </Alert>
      )}
      {status === "loaded" && operations.length === 0 && (
        <p>Aucune opération disponible pour le moment.</p>
      )}
      {(status === "error" ||
        (status === "loaded" && operations.length === 0)) && (
        <Button type="button" variant="outline" onClick={retry}>
          Réessayer
        </Button>
      )}
      {status === "loaded" && operations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Opérations à examiner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {operations.map((operation) => (
              <div key={operation.slug} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`${inputPrefix}-select-${operation.slug}`}
                    checked={records.some(
                      (record) => record.operation_slug === operation.slug,
                    )}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        if (
                          !records.some(
                            (record) =>
                              record.operation_slug === operation.slug,
                          )
                        )
                          onChange([
                            ...records,
                            { operation_slug: operation.slug },
                          ]);
                      } else remove(operation.slug);
                    }}
                  />
                  <Label htmlFor={`${inputPrefix}-select-${operation.slug}`}>
                    {operation.label}
                  </Label>
                </div>
                {operation.description && (
                  <p className="text-xs text-gray-500 pl-6">
                    {operation.description}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {records.map((record) => {
        const operation = operations.find(
          (item) => item.slug === record.operation_slug,
        );
        const label = operation?.label ?? record.operation_slug;
        return (
          <Card key={record.operation_slug}>
            <CardHeader>
              <CardTitle className="text-base">Historique — {label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === "loaded" && !operation && (
                <p role="alert" className="text-sm text-amber-800">
                  Opération indisponible : {record.operation_slug}. Historique
                  conservé ; retirez cette sélection pour poursuivre avec les
                  opérations disponibles.
                </p>
              )}
              {record.last_service_km === undefined &&
                !record.last_service_date && (
                  <p className="text-sm text-gray-500">
                    Historique inconnu : aucune date ni aucun kilométrage
                    renseigné.
                  </p>
                )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${inputPrefix}-km-${record.operation_slug}`}>
                    Kilométrage du dernier entretien — {label}
                  </Label>
                  <Input
                    id={`${inputPrefix}-km-${record.operation_slug}`}
                    type="number"
                    min={0}
                    value={record.last_service_km ?? ""}
                    onChange={(event) =>
                      update(record.operation_slug, {
                        last_service_km:
                          event.target.value === ""
                            ? undefined
                            : event.target.valueAsNumber,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`${inputPrefix}-date-${record.operation_slug}`}
                  >
                    Date du dernier entretien — {label}
                  </Label>
                  <Input
                    id={`${inputPrefix}-date-${record.operation_slug}`}
                    type="date"
                    max={today}
                    value={record.last_service_date ?? ""}
                    onChange={(event) =>
                      update(record.operation_slug, {
                        last_service_date: event.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => remove(record.operation_slug)}
                aria-label={`Retirer ${label}`}
              >
                Retirer cette opération
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
