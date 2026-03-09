/**
 * Hook for diagnostic wizard vehicle selection.
 * Fetches ALL brands/models (includeAll=true) for the Combobox dropdowns.
 */
import { useState, useEffect, useCallback } from "react";
import { type ComboboxItem } from "~/components/ui/combobox";
import { enhancedVehicleApi } from "~/services/api/enhanced-vehicle.api";

export function useDiagnosticVehicleSelector() {
  const [brands, setBrands] = useState<ComboboxItem[]>([]);
  const [models, setModels] = useState<ComboboxItem[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // Fetch all brands on mount
  useEffect(() => {
    setLoadingBrands(true);
    enhancedVehicleApi
      .getBrands({ page: 0, limit: 500, includeAll: true })
      .then((data) =>
        setBrands(
          data.map((b) => ({
            value: String(b.marque_id),
            label: b.marque_name,
          })),
        ),
      )
      .catch(() => setBrands([]))
      .finally(() => setLoadingBrands(false));
  }, []);

  // Fetch models for a specific brand
  const fetchModels = useCallback((brandId: number) => {
    setLoadingModels(true);
    setModels([]);
    enhancedVehicleApi
      .getModels(brandId, { page: 0, limit: 500, includeAll: true })
      .then((data) =>
        setModels(
          data.map((m) => ({
            value: String(m.modele_id),
            label: m.modele_name,
          })),
        ),
      )
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, []);

  const clearModels = useCallback(() => setModels([]), []);

  return {
    brands,
    models,
    loadingBrands,
    loadingModels,
    fetchModels,
    clearModels,
  };
}
