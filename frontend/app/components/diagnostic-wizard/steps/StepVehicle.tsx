/**
 * StepVehicle — Step 1: Vehicle + usage context
 * Hybrid selector: Combobox for brand/model, free text for year/km
 */
import { Car, Gauge, Route } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Combobox } from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useDiagnosticVehicleSelector } from "../hooks/use-diagnostic-vehicle-selector";
import { type WizardState, type WizardAction } from "../types";

const USAGE_PROFILES = [
  { value: "urban_short_trips", label: "Urbain / courts trajets", icon: "🏙️" },
  { value: "mixed", label: "Mixte quotidien", icon: "🚗" },
  { value: "highway", label: "Autoroute fréquent", icon: "🛣️" },
  { value: "professional", label: "Usage professionnel", icon: "🔧" },
  { value: "occasional", label: "Usage occasionnel", icon: "📅" },
];

interface Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function StepVehicle({ state, dispatch }: Props) {
  const {
    brands,
    models,
    loadingBrands,
    loadingModels,
    fetchModels,
    clearModels,
  } = useDiagnosticVehicleSelector();

  const handleBrandChange = (value: string, item?: { label: string }) => {
    if (!value) {
      // Clear brand → reset model too
      dispatch({
        type: "SET_VEHICLE",
        payload: {
          ...state.vehicle,
          brand: "",
          brandId: undefined,
          model: "",
          modelId: undefined,
        },
      });
      clearModels();
      return;
    }
    const brandId = parseInt(value, 10);
    dispatch({
      type: "SET_VEHICLE",
      payload: {
        ...state.vehicle,
        brand: item?.label || "",
        brandId,
        model: "",
        modelId: undefined,
      },
    });
    fetchModels(brandId);
  };

  const handleModelChange = (value: string, item?: { label: string }) => {
    if (!value) {
      dispatch({
        type: "SET_VEHICLE",
        payload: { ...state.vehicle, model: "", modelId: undefined },
      });
      return;
    }
    dispatch({
      type: "SET_VEHICLE",
      payload: {
        ...state.vehicle,
        model: item?.label || "",
        modelId: parseInt(value, 10),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">
          Identifiez votre véhicule
        </h2>
        <p className="text-sm text-gray-500">
          Plus vous êtes précis, plus le diagnostic sera pertinent. Tous les
          champs sont optionnels.
        </p>
      </div>

      {/* Vehicle info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="w-5 h-5 text-blue-600" />
            Véhicule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Marque</Label>
              <Combobox
                items={brands}
                value={
                  state.vehicle.brandId
                    ? String(state.vehicle.brandId)
                    : undefined
                }
                onValueChange={handleBrandChange}
                placeholder="Sélectionner une marque"
                searchPlaceholder="Rechercher..."
                emptyMessage="Aucune marque trouvée"
                loading={loadingBrands}
                allowClear
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modèle</Label>
              <Combobox
                items={models}
                value={
                  state.vehicle.modelId
                    ? String(state.vehicle.modelId)
                    : undefined
                }
                onValueChange={handleModelChange}
                placeholder="Sélectionner un modèle"
                searchPlaceholder="Rechercher..."
                emptyMessage={
                  state.vehicle.brandId
                    ? "Aucun modèle trouvé"
                    : "Sélectionnez d'abord une marque"
                }
                loading={loadingModels}
                disabled={!state.vehicle.brandId}
                allowClear
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="year">Année</Label>
              <Input
                id="year"
                type="number"
                placeholder="ex: 2018"
                min={1970}
                max={2030}
                value={state.vehicle.year || ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_VEHICLE",
                    payload: {
                      ...state.vehicle,
                      year: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mileage" className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                Kilométrage
              </Label>
              <Input
                id="mileage"
                type="number"
                placeholder="ex: 95000"
                min={0}
                value={state.vehicle.mileage_km || ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_VEHICLE",
                    payload: {
                      ...state.vehicle,
                      mileage_km: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="w-5 h-5 text-blue-600" />
            Profil d'utilisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {USAGE_PROFILES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SET_USAGE",
                    payload: {
                      profile:
                        state.usageProfile === p.value ? undefined : p.value,
                      lastServiceKm: state.lastServiceKm,
                    },
                  })
                }
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  state.usageProfile === p.value
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="lastService">
              Dernier entretien (km au compteur)
            </Label>
            <Input
              id="lastService"
              type="number"
              placeholder="ex: 75000"
              value={state.lastServiceKm || ""}
              onChange={(e) =>
                dispatch({
                  type: "SET_USAGE",
                  payload: {
                    profile: state.usageProfile,
                    lastServiceKm: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  },
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
