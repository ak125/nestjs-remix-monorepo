import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import  { type VehicleModel, type ModelSelectorProps } from "../../types/vehicle.types";
import { Combobox, type ComboboxItem } from "../ui/combobox";

// Garder la compatibilité avec l'ancienne interface Model
export type Model = VehicleModel;

export function ModelSelector({
  value,
  onValueChange,
  brandId,
  placeholder = "Sélectionner un modèle...",
  searchPlaceholder = "Rechercher un modèle...",
  disabled = false,
  className,
  allowClear = true,
  autoLoadOnMount = true
}: ModelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(autoLoadOnMount);
  
  // Utilise useFetcher pour les appels API
  const fetcher = useFetcher<{ 
    data?: Model[];
    total?: number;
    error?: string;
  }>();

  // Charge les modèles avec useCallback pour éviter les re-créations
  const loadModels = useCallback((search: string = "") => {
    const params = new URLSearchParams();
    
    if (search.trim()) {
      params.append('search', search.trim());
    }
    
    if (brandId) {
      params.append('brandId', brandId.toString());
    }
    
    // Limite plus élevée pour une meilleure expérience utilisateur
    params.append('limit', '100');
    params.append('onlyActive', 'true');

    const queryString = params.toString();
    fetcher.load(`/api/vehicles/forms/models?${queryString}`);
  }, [brandId, fetcher]);

  // Charge au montage si activé
  useEffect(() => {
    if (isInitialLoad) {
      loadModels();
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, loadModels]);

  // Recharge si brandId change
  useEffect(() => {
    if (brandId !== undefined) {
      loadModels(searchQuery);
    }
  }, [brandId, loadModels, searchQuery]);

  // Convertit les modèles en items pour le Combobox
  const models = fetcher.data?.data || [];
  const items: ComboboxItem[] = models.map(model => ({
    value: model.modele_id.toString(),
    label: model.modele_ful_name || 
           `${model.auto_marque?.marque_name || ''} ${model.modele_name}`.trim() ||
           model.modele_name,
    data: model // Stocke le modèle complet
  }));

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
      loadModels(query);
    }, 300); // 300ms de delay
    
    setSearchTimeout(timeout);
  };

  // Gestionnaire de sélection
  const handleValueChange = (modelId: string, item?: ComboboxItem) => {
    const selectedModel = item?.data as Model | undefined;
    onValueChange?.(modelId, selectedModel);
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
      return "Chargement des modèles...";
    }
    
    if (fetcher.data?.error) {
      return `Erreur: ${fetcher.data.error}`;
    }
    
    if (searchQuery.trim()) {
      return `Aucun modèle trouvé pour "${searchQuery}"`;
    }
    
    if (brandId) {
      return "Aucun modèle disponible pour cette marque";
    }
    
    return "Aucun modèle disponible";
  };

  return (
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
      className={className}
      allowClear={allowClear}
      maxHeight={300} // Plus de hauteur pour les modèles
    />
  );
}

// Export du type pour réutilisation
export type { Model as VehicleModel };
