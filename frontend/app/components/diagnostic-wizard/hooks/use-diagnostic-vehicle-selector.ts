/**
 * Hook for diagnostic wizard vehicle selection.
 * Fetches ALL brands/models (includeAll=true) for the Combobox dropdowns.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { type ComboboxItem } from "~/components/ui/combobox";
import { enhancedVehicleApi } from "~/services/api/enhanced-vehicle.api";

export function useDiagnosticVehicleSelector() {
  const [brands, setBrands] = useState<ComboboxItem[]>([]);
  const [models, setModels] = useState<ComboboxItem[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const modelsRequest = useRef(0);

  useEffect(
    () => () => {
      modelsRequest.current += 1;
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

  return {
    brands,
    models,
    loadingBrands,
    loadingModels,
    fetchModels,
    clearModels,
  };
}
