/**
 * Hook for diagnostic wizard vehicle selection.
 * Fetches ALL brands/models (includeAll=true) for the Combobox dropdowns,
 * then the motorisations of the chosen model.
 */
import { type VehicleType } from "@repo/database-types";
import { useState, useEffect, useCallback, useRef } from "react";
import { type ComboboxItem } from "~/components/ui/combobox";
import { enhancedVehicleApi } from "~/services/api/enhanced-vehicle.api";

// Values accepted by the diagnostic engine's `vehicle_context.fuel`.
const ENGINE_FUELS = ["essence", "diesel", "hybride", "electrique", "gpl"];

/** Map a catalogue fuel label only when it names one engine fuel exactly. */
export function toEngineFuel(label: string | null | undefined) {
  const fuel = label
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return fuel && ENGINE_FUELS.includes(fuel) ? fuel : undefined;
}

function toTypeItem(t: VehicleType): ComboboxItem {
  const power = t.type_power_ps ? `${t.type_power_ps} ch` : undefined;
  const years = t.year_from ? `${t.year_from}–${t.year_to ?? "…"}` : undefined;
  const engine = [t.type_name, power].filter(Boolean).join(" ");
  return {
    value: String(t.type_id),
    // Engines of one model often share a name: power, fuel and years tell
    // them apart in the list.
    label: [t.type_name, power, t.type_fuel, years].filter(Boolean).join(" · "),
    typeName: t.type_name,
    typeAlias: t.type_alias,
    engine: engine.length <= 64 ? engine : undefined,
    fuel: toEngineFuel(t.type_fuel),
  };
}

export function useDiagnosticVehicleSelector() {
  const [brands, setBrands] = useState<ComboboxItem[]>([]);
  const [models, setModels] = useState<ComboboxItem[]>([]);
  const [types, setTypes] = useState<ComboboxItem[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const modelsRequest = useRef(0);
  const typesRequest = useRef(0);

  useEffect(
    () => () => {
      modelsRequest.current += 1;
      typesRequest.current += 1;
    },
    [],
  );

  // Fetch all brands on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingBrands(true);
    enhancedVehicleApi
      .getBrands({ page: 0, limit: 500, includeAll: true })
      .then((data) => {
        if (!cancelled)
          setBrands(
            data.map((b) => ({
              value: String(b.marque_id),
              label: b.marque_name,
              alias: b.marque_alias,
            })),
          );
      })
      .catch(() => {
        if (!cancelled) setBrands([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBrands(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch models for a specific brand
  const fetchModels = useCallback((brandId: number) => {
    const request = ++modelsRequest.current;
    setLoadingModels(true);
    setModels([]);
    enhancedVehicleApi
      .getModels(brandId, { page: 0, limit: 500, includeAll: true })
      .then((data) => {
        if (request === modelsRequest.current)
          setModels(
            data.map((m) => ({
              value: String(m.modele_id),
              label: m.modele_name,
              alias: m.modele_alias,
            })),
          );
      })
      .catch(() => {
        if (request === modelsRequest.current) setModels([]);
      })
      .finally(() => {
        if (request === modelsRequest.current) setLoadingModels(false);
      });
  }, []);

  const clearModels = useCallback(() => {
    modelsRequest.current += 1;
    setModels([]);
    setLoadingModels(false);
  }, []);

  // Fetch motorisations for a specific model
  const fetchTypes = useCallback((modelId: number) => {
    const request = ++typesRequest.current;
    setLoadingTypes(true);
    setTypes([]);
    enhancedVehicleApi
      .getTypes(modelId)
      .then((data) => {
        if (request === typesRequest.current) setTypes(data.map(toTypeItem));
      })
      .catch(() => {
        if (request === typesRequest.current) setTypes([]);
      })
      .finally(() => {
        if (request === typesRequest.current) setLoadingTypes(false);
      });
  }, []);

  const clearTypes = useCallback(() => {
    typesRequest.current += 1;
    setTypes([]);
    setLoadingTypes(false);
  }, []);

  return {
    brands,
    models,
    types,
    loadingBrands,
    loadingModels,
    loadingTypes,
    fetchModels,
    clearModels,
    fetchTypes,
    clearTypes,
  };
}
