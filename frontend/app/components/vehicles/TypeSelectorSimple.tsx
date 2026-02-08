import { useFetcher } from "@remix-run/react";
import { useEffect, useState, memo } from "react";
import { Select } from "../ui/select";

interface VehicleType {
  type_id: number;
  type_alias?: string;
  type_name: string;
  type_engine_code?: string;
  type_fuel?: string;
  type_power_ps?: number;
  type_power_kw?: number;
  type_liter?: string;
  type_year_from?: string;
  type_year_to?: string | null;
  modele_id: number;
}

interface TypeSelectorProps {
  modelId?: number;
  onSelect: (type: VehicleType | null) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  showDetails?: boolean;
}

export const TypeSelector = memo(function TypeSelector({
  modelId,
  onSelect,
  className = "",
  disabled = false,
  placeholder = "Sélectionnez un type",
  showDetails = true,
}: TypeSelectorProps) {
  const fetcher = useFetcher<VehicleType[]>();
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);

  useEffect(() => {
    if (!modelId) {
      setSelectedType(null);
      return;
    }

    const params = new URLSearchParams();
    params.append("modelId", modelId.toString());
    params.append("limit", "100");

    fetcher.load(`/api/vehicles/forms/types?${params.toString()}`);
  }, [modelId, fetcher]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!e.target.value) {
      setSelectedType(null);
      onSelect(null);
      return;
    }

    const typeId = parseInt(e.target.value);
    const types = Array.isArray(fetcher.data) ? fetcher.data : [];
    const type = types.find((t: VehicleType) => t.type_id === typeId) || null;

    setSelectedType(type);
    onSelect(type);
  };

  const types = Array.isArray(fetcher.data) ? fetcher.data : [];
  const isLoading = fetcher.state === "loading";

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Type / Motorisation
      </label>
      <Select
        value={selectedType?.type_id?.toString() || ""}
        onChange={handleChange}
        disabled={disabled || isLoading || !types.length}
        className="w-full"
      >
        <option value="">{isLoading ? "Chargement..." : placeholder}</option>
        {types.map((type: VehicleType) => (
          <option key={type.type_id} value={type.type_id}>
            {type.type_name || ""}
            {type.type_engine_code && ` - ${type.type_engine_code}`}
            {type.type_fuel && ` (${type.type_fuel})`}
            {type.type_power_ps && ` - ${type.type_power_ps}cv`}
          </option>
        ))}
      </Select>

      {showDetails && selectedType && (
        <div className="mt-2 text-xs text-gray-600 space-y-1">
          <div className="font-medium text-gray-900">
            {selectedType.type_name ||
              `${selectedType.type_fuel || ""} ${selectedType.type_power_ps ? `- ${selectedType.type_power_ps}cv` : ""}`.trim() ||
              "Motorisation sélectionnée"}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {selectedType.type_engine_code && (
              <span>
                <strong>Code moteur:</strong> {selectedType.type_engine_code}
              </span>
            )}
            {selectedType.type_fuel && (
              <span>
                <strong>Carburant:</strong> {selectedType.type_fuel}
              </span>
            )}
            {selectedType.type_liter && (
              <span>
                <strong>Cylindrée:</strong> {selectedType.type_liter}cc
              </span>
            )}
            {selectedType.type_power_ps && (
              <span>
                <strong>Puissance:</strong> {selectedType.type_power_ps}cv
              </span>
            )}
            {selectedType.type_power_kw && (
              <span>
                <strong>Puissance:</strong> {selectedType.type_power_kw}kW
              </span>
            )}
            {selectedType.type_year_from && (
              <span>
                <strong>Période:</strong> {selectedType.type_year_from}
                {selectedType.type_year_to
                  ? ` - ${selectedType.type_year_to}`
                  : " - actuel"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// Export du type pour réutilisation
export type { VehicleType };
