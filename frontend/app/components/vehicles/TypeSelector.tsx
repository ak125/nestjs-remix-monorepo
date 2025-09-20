import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import type { VehicleType, TypeSelectorProps } from "../../types/vehicle.types";
import { Combobox, type ComboboxItem } from "../ui/combobox";

export function TypeSelector({
  value,
  onValueChange,
  modelId,
  brandId,
  placeholder = "Sélectionner un type / motorisation...",
  searchPlaceholder = "Rechercher un type...",
  disabled = false,
  className,
  allowClear = true,
  autoLoadOnMount = true,
  onlyActive = false,
  showDetails = true
}: TypeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(autoLoadOnMount);
  
  // Utilise useFetcher pour les appels API
  const fetcher = useFetcher<VehicleType[]>();

  // Charge les types avec useCallback pour éviter les re-créations
  const loadTypes = useCallback((search: string = "") => {
    const params = new URLSearchParams();
    
    if (search.trim()) {
      params.append('search', search.trim());
    }
    
    if (modelId) {
      params.append('modelId', modelId.toString());
    }
    
    if (brandId) {
      params.append('brandId', brandId.toString());
    }
    
    if (onlyActive) {
      params.append('onlyActive', 'true');
    }
    
    // Limite plus élevée pour une meilleure expérience utilisateur
    params.append('limit', '200');

    const queryString = params.toString();
    
    // 🔧 Utilisation de l'API standard qui filtre correctement par année
    if (modelId) {
      fetcher.load(`/api/vehicles/models/${modelId}/types?${queryString}`);
    } else {
      fetcher.load(`/api/vehicles/forms/types?${queryString}`);
    }
  }, [modelId, brandId, onlyActive, fetcher]);

  // Charge au montage si activé
  useEffect(() => {
    if (isInitialLoad) {
      loadTypes();
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, loadTypes]);

  // Recharge si modelId ou brandId change
  useEffect(() => {
    if (modelId !== undefined || brandId !== undefined) {
      loadTypes(searchQuery);
    }
  }, [modelId, brandId, loadTypes, searchQuery]);

  // Convertit les types en items pour le Combobox
  const types = Array.isArray(fetcher.data) ? fetcher.data : [];
  const items: ComboboxItem[] = types.map(type => {
    // Construction du label avec détails
    let label = type.type_name || '';
    
    // Ajoute le code moteur si disponible
    if (type.type_engine_code) {
      label += (label ? ` - ${type.type_engine_code}` : type.type_engine_code);
    }
    
    // Ajoute le carburant si disponible
    if (type.type_fuel) {
      label += (label ? ` (${type.type_fuel})` : `(${type.type_fuel})`);
    }
    
    // Ajoute la puissance en CV si disponible
    if (type.type_power_ps) {
      label += (label ? ` - ${type.type_power_ps}cv` : `${type.type_power_ps}cv`);
    }
    
    // Ajoute le modèle si pas filtré par modelId
    if (!modelId && type.auto_modele) {
      const brandName = type.auto_modele.auto_marque?.marque_name || '';
      const modelName = type.auto_modele.modele_name || '';
      if (brandName && modelName) {
        label = `${brandName} ${modelName} - ${label}`;
      }
    }

    return {
      value: type.type_id.toString(),
      label,
      data: type // Stocke le type complet
    };
  });

  // Gestionnaire de recherche avec debounce
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    // Annule le timeout précédent
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Démarre un nouveau timeout pour debounce
    const timeout = setTimeout(() => {
      loadTypes(query);
    }, 300); // 300ms de delay
    
    setSearchTimeout(timeout);
  };

  // Gestionnaire de sélection
  const handleValueChange = (typeId: string, item?: ComboboxItem) => {
    const selectedType = item?.data as VehicleType | undefined;
    onValueChange?.(typeId, selectedType);
  };

  // Nettoyage du timeout
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Messages d'état
  const getEmptyMessage = () => {
    if (fetcher.state === "loading") {
      return "Chargement des types...";
    }
    
    if (searchQuery.trim()) {
      return `Aucun type trouvé pour "${searchQuery}"`;
    }
    
    if (modelId) {
      return "Aucun type disponible pour ce modèle";
    }
    
    if (brandId) {
      return "Aucun type disponible pour cette marque";
    }
    
    return "Aucun type disponible";
  };

  // Type sélectionné pour affichage des détails
  const selectedType = types.find(type => type.type_id.toString() === value);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Type / Motorisation
      </label>
      
      <Combobox
        items={items}
        value={value}
        onValueChange={handleValueChange}
        onSearch={handleSearch}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={getEmptyMessage()}
        loading={fetcher.state === "loading"}
        disabled={disabled}
        allowClear={allowClear}
        maxHeight={300} // Plus de hauteur pour les types
      />
      
      {/* Détails du type sélectionné */}
      {showDetails && selectedType && (
        <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs space-y-1">
          <div className="font-medium text-gray-900">
            {selectedType.type_name || 
             `${selectedType.type_fuel || ''} ${selectedType.type_power_ps ? `- ${selectedType.type_power_ps}cv` : ''}`.trim() ||
             'Motorisation sélectionnée'}
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-gray-600">
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
                <strong>Cylindrée:</strong> {selectedType.type_liter}
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
                {selectedType.type_year_to ? ` - ${selectedType.type_year_to}` : ' - actuel'}
              </span>
            )}
          </div>
          
          {!modelId && selectedType.auto_modele && (
            <div className="pt-1 border-t border-gray-200 text-gray-500">
              <strong>Véhicule:</strong> {' '}
              {selectedType.auto_modele.auto_marque?.marque_name}{' '}
              {selectedType.auto_modele.modele_name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export du type pour réutilisation
export type { VehicleType };
