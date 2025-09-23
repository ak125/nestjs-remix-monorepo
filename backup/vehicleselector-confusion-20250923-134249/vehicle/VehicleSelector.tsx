/**
 * 🚗 SÉLECTEUR DE VÉHICULE MODERNE
 * 
 * Composant pour la sélection progressive de véhicules (Marque > Année > Modèle > Type)
 * Version entreprise avec TypeScript strict, Tailwind CSS, et UX optimisée
 * 
 * @version 2.0.0
 * @since 2025-09-13
 * @author Enterprise Development Team
 */

import { useNavigate, Link } from "@remix-run/react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { z } from "zod";

// ====================================
// 🌐 DÉCLARATIONS GLOBALES
// ====================================

declare global {
  function gtag(...args: any[]): void;
}

// ====================================
// 🎯 INTERFACES & TYPES TYPESCRIPT
// ====================================

/**
 * Interface pour les marques dans le sélecteur
 */
interface VehicleBrand {
  id: number;
  name: string;
  slug: string;
  is_favorite?: boolean;
  logo_url?: string;
}

/**
 * Interface pour les modèles dans le sélecteur  
 */
interface VehicleModel {
  id: number;
  name: string;
  slug: string;
  brand_id: number;
  year_from?: number;
  year_to?: number;
}

/**
 * Interface pour les types/motorisations dans le sélecteur
 */
interface VehicleTypeOption {
  id: number;
  name: string;
  slug: string;
  brand_slug: string;
  model_slug: string;
  engine_info?: string;
  power_hp?: number;
  fuel_type?: string;
}

/**
 * Interface pour les années disponibles
 */
interface VehicleYear {
  year: number;
  count: number; // Nombre de modèles disponibles pour cette année
}

/**
 * État de chargement pour chaque sélecteur
 */
interface LoadingState {
  brands: boolean;
  years: boolean;
  models: boolean;
  types: boolean;
}

/**
 * État d'erreur pour chaque sélecteur
 */
interface ErrorState {
  brands: string | null;
  years: string | null;
  models: string | null;
  types: string | null;
  mine: string | null;
}

/**
 * Props du composant VehicleSelector
 */
interface VehicleSelectorProps {
  /** Véhicule actuellement sélectionné */
  currentVehicle?: {
    brand?: { id: number; name: string; slug: string };
    model?: { id: number; name: string; slug: string };
    type?: { id: number; name: string; slug: string };
  };
  /** Callback appelé lors du changement de sélection */
  onSelectionChange?: (selection: VehicleSelection) => void;
  /** Mode compact pour l'affichage mobile */
  compact?: boolean;
  /** Classes CSS personnalisées */
  className?: string;
}

/**
 * Sélection actuelle du véhicule
 */
interface VehicleSelection {
  brandId: string;
  year: string;
  modelId: string;
  typeData?: string;
}

// ====================================
// 🔍 SCHÉMAS DE VALIDATION ZOD
// ====================================

const BrandSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  is_favorite: z.boolean().optional(),
  logo_url: z.string().optional(),
});

const ModelSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  brand_id: z.number(),
  year_from: z.number().optional(),
  year_to: z.number().optional(),
});

const TypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  brand_slug: z.string(),
  model_slug: z.string(),
  engine_info: z.string().optional(),
  power_hp: z.number().optional(),
  fuel_type: z.string().optional(),
});

const YearSchema = z.object({
  year: z.number(),
  count: z.number(),
});

// ====================================
// 🎨 COMPOSANT PRINCIPAL
// ====================================

export function VehicleSelector({ 
  currentVehicle, 
  onSelectionChange, 
  compact = false,
  className = ""
}: VehicleSelectorProps) {
  const navigate = useNavigate();

  // ====================================
  // 📊 ÉTAT DU COMPOSANT
  // ====================================

  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [years, setYears] = useState<VehicleYear[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [types, setTypes] = useState<VehicleTypeOption[]>([]);
  
  const [selectedBrand, setSelectedBrand] = useState(
    currentVehicle?.brand?.id?.toString() || "0"
  );
  const [selectedYear, setSelectedYear] = useState("0");
  const [selectedModel, setSelectedModel] = useState(
    currentVehicle?.model?.id?.toString() || "0"
  );
  
  const [loading, setLoading] = useState<LoadingState>({
    brands: false,
    years: false,
    models: false,
    types: false,
  });
  
  const [errors, setErrors] = useState<ErrorState>({
    brands: null,
    years: null,
    models: null,
    types: null,
    mine: null,
  });

  const [mineQuery, setMineQuery] = useState("");
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});

  // ====================================
  // 🚀 FONCTIONS UTILITAIRES
  // ====================================

  /**
   * Fonction générique pour les appels API avec retry et validation
   */
  const fetchWithRetry = useCallback(async (
    url: string,
    schema: z.ZodSchema<any>,
    retryKey: string,
    maxRetries = 3
  ): Promise<any[]> => {
    const currentRetries = retryCount[retryKey] || 0;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validation avec Zod
      const validatedData = z.array(schema).parse(data);
      
      // Reset retry count en cas de succès
      setRetryCount(prev => ({ ...prev, [retryKey]: 0 }));
      
      return validatedData;
    } catch (error) {
      console.error(`Erreur lors du fetch ${url}:`, error);
      
      if (currentRetries < maxRetries) {
        setRetryCount(prev => ({ ...prev, [retryKey]: currentRetries + 1 }));
        
        // Délai exponentiel pour le retry
        const delay = Math.pow(2, currentRetries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return fetchWithRetry(url, schema, retryKey, maxRetries);
      }
      
      throw error;
    }
  }, [retryCount]);

  /**
   * Clear les erreurs pour un champ spécifique
   */
  const clearError = useCallback((field: keyof ErrorState) => {
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  /**
   * Met à jour l'état de loading pour un champ spécifique
   */
  const setFieldLoading = useCallback((field: keyof LoadingState, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [field]: isLoading }));
  }, []);

  /**
   * Met à jour l'état d'erreur pour un champ spécifique
   */
  const setFieldError = useCallback((field: keyof ErrorState, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  // ====================================
  // 🔄 FONCTIONS DE CHARGEMENT DES DONNÉES
  // ====================================

  /**
   * Charge la liste des marques
   */
  const loadBrands = useCallback(async () => {
    setFieldLoading("brands", true);
    clearError("brands");
    
    try {
      const data = await fetchWithRetry(
        "/api/vehicles/brands",
        BrandSchema,
        "brands"
      );
      setBrands(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors du chargement des marques";
      setFieldError("brands", message);
      setBrands([]);
    } finally {
      setFieldLoading("brands", false);
    }
  }, [fetchWithRetry, setFieldLoading, clearError, setFieldError]);

  /**
   * Charge les années pour une marque donnée
   */
  const loadYears = useCallback(async (brandId: string) => {
    if (brandId === "0") {
      setYears([]);
      return;
    }

    setFieldLoading("years", true);
    clearError("years");
    
    try {
      const data = await fetchWithRetry(
        `/api/vehicles/brands/${brandId}/years`,
        YearSchema,
        "years"
      );
      setYears(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors du chargement des années";
      setFieldError("years", message);
      setYears([]);
    } finally {
      setFieldLoading("years", false);
    }
  }, [fetchWithRetry, setFieldLoading, clearError, setFieldError]);

  /**
   * Charge les modèles pour une marque et année données
   */
  const loadModels = useCallback(async (brandId: string, year: string) => {
    if (brandId === "0" || year === "0") {
      setModels([]);
      return;
    }

    setFieldLoading("models", true);
    clearError("models");
    
    try {
      const data = await fetchWithRetry(
        `/api/vehicles/brands/${brandId}/models?year=${year}`,
        ModelSchema,
        "models"
      );
      setModels(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors du chargement des modèles";
      setFieldError("models", message);
      setModels([]);
    } finally {
      setFieldLoading("models", false);
    }
  }, [fetchWithRetry, setFieldLoading, clearError, setFieldError]);

  /**
   * Charge les types/motorisations pour un modèle donné
   */
  const loadTypes = useCallback(async (modelId: string) => {
    if (modelId === "0") {
      setTypes([]);
      return;
    }

    setFieldLoading("types", true);
    clearError("types");
    
    try {
      const data = await fetchWithRetry(
        `/api/vehicles/models/${modelId}/types`,
        TypeSchema,
        "types"
      );
      setTypes(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors du chargement des motorisations";
      setFieldError("types", message);
      setTypes([]);
    } finally {
      setFieldLoading("types", false);
    }
  }, [fetchWithRetry, setFieldLoading, clearError, setFieldError]);

  // ====================================
  // 🎯 GESTIONNAIRES D'ÉVÉNEMENTS
  // ====================================

  /**
   * Gestion du changement de marque
   */
  const handleBrandChange = useCallback(async (brandId: string) => {
    setSelectedBrand(brandId);
    setSelectedYear("0");
    setSelectedModel("0");
    setYears([]);
    setModels([]);
    setTypes([]);

    if (brandId !== "0") {
      await loadYears(brandId);
    }

    // Analytics
    if (typeof gtag !== "undefined") {
      gtag("event", "vehicle_selector_brand_change", {
        event_category: "Vehicle Selection",
        event_label: brandId,
        brand_id: brandId,
      });
    }

    // Callback externe
    onSelectionChange?.({
      brandId,
      year: "0",
      modelId: "0",
    });
  }, [loadYears, onSelectionChange]);

  /**
   * Gestion du changement d'année
   */
  const handleYearChange = useCallback(async (year: string) => {
    setSelectedYear(year);
    setSelectedModel("0");
    setModels([]);
    setTypes([]);

    if (year !== "0" && selectedBrand !== "0") {
      await loadModels(selectedBrand, year);
    }

    // Analytics
    if (typeof gtag !== "undefined") {
      gtag("event", "vehicle_selector_year_change", {
        event_category: "Vehicle Selection",
        event_label: year,
        brand_id: selectedBrand,
        year: year,
      });
    }

    // Callback externe
    onSelectionChange?.({
      brandId: selectedBrand,
      year,
      modelId: "0",
    });
  }, [selectedBrand, loadModels, onSelectionChange]);

  /**
   * Gestion du changement de modèle
   */
  const handleModelChange = useCallback(async (modelId: string) => {
    setSelectedModel(modelId);
    setTypes([]);

    if (modelId !== "0") {
      await loadTypes(modelId);
    }

    // Analytics
    if (typeof gtag !== "undefined") {
      gtag("event", "vehicle_selector_model_change", {
        event_category: "Vehicle Selection",
        event_label: modelId,
        brand_id: selectedBrand,
        year: selectedYear,
        model_id: modelId,
      });
    }

    // Callback externe
    onSelectionChange?.({
      brandId: selectedBrand,
      year: selectedYear,
      modelId,
    });
  }, [selectedBrand, selectedYear, loadTypes, onSelectionChange]);

  /**
   * Gestion de la sélection du type/motorisation
   */
  const handleTypeSelect = useCallback((typeData: string) => {
    if (typeData) {
      const [brandSlug, modelSlug, typeSlug] = typeData.split("|");
      
      // Analytics
      if (typeof gtag !== "undefined") {
        gtag("event", "vehicle_selector_complete", {
          event_category: "Vehicle Selection",
          event_label: `${brandSlug}/${modelSlug}/${typeSlug}`,
          brand_id: selectedBrand,
          year: selectedYear,
          model_id: selectedModel,
          type_slug: typeSlug,
        });
      }

      // Navigation
      navigate(`/constructeurs/${brandSlug}/${modelSlug}/${typeSlug}.html`);
    }
  }, [selectedBrand, selectedYear, selectedModel, navigate]);

  /**
   * Gestion de la recherche par type mine
   */
  const handleMineSearch = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!mineQuery.trim()) {
      setFieldError("mine", "Veuillez saisir un type mine");
      return;
    }

    clearError("mine");

    // Analytics
    if (typeof gtag !== "undefined") {
      gtag("event", "vehicle_mine_search", {
        event_category: "Vehicle Selection",
        event_label: mineQuery,
        search_term: mineQuery,
      });
    }

    // Navigation vers la page de recherche
    navigate(`/searchmine?mine=${encodeURIComponent(mineQuery)}`);
  }, [mineQuery, navigate, setFieldError, clearError]);

  // ====================================
  // 🔄 EFFETS ET CHARGEMENT INITIAL
  // ====================================

  /**
   * Chargement initial des marques
   */
  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  /**
   * Chargement initial basé sur le véhicule courant
   */
  useEffect(() => {
    if (currentVehicle?.brand?.id && selectedBrand !== "0") {
      loadYears(selectedBrand);
    }
  }, [currentVehicle, selectedBrand, loadYears]);

  // ====================================
  // 🎨 COMPOSANTS DE RENDU
  // ====================================

  /**
   * Composant Select personnalisé avec gestion d'erreur
   */
  const CustomSelect = ({ 
    name, 
    value, 
    onChange, 
    disabled, 
    placeholder, 
    options, 
    loading: isLoading, 
    error,
    ariaLabel 
  }: {
    name: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder: string;
    options: Array<{ id: string | number; name: string; className?: string }>;
    loading?: boolean;
    error?: string | null;
    ariaLabel: string;
  }) => (
    <div className="space-y-1">
      <div className="relative">
        <select
          name={name}
          id={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isLoading}
          aria-label={ariaLabel}
          className={`
            w-full px-4 py-3 pr-8 text-sm font-medium text-gray-900 bg-white border rounded-lg shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
            transition-colors duration-200
          `}
        >
          <option value="0">{placeholder}</option>
          {options.map((option) => (
            <option
              key={option.id}
              value={option.id}
              className={option.className || ""}
            >
              {option.name}
            </option>
          ))}
        </select>
        
        {/* Icône de chargement */}
        {isLoading && (
          <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      {/* Message d'erreur */}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );

  /**
   * Options formatées pour les sélecteurs
   */
  const brandOptions = useMemo(() => 
    brands.map(brand => ({
      id: brand.id,
      name: brand.name,
      className: brand.is_favorite ? "font-semibold text-blue-600" : ""
    })), [brands]
  );

  const yearOptions = useMemo(() => 
    years.map(year => ({
      id: year.year,
      name: `${year.year} (${year.count} modèle${year.count > 1 ? 's' : ''})`
    })), [years]
  );

  const modelOptions = useMemo(() => 
    models.map(model => ({
      id: model.id,
      name: model.name
    })), [models]
  );

  const typeOptions = useMemo(() => 
    types.map(type => ({
      id: `${type.brand_slug}|${type.model_slug}|${type.slug}`,
      name: type.engine_info ? `${type.name} - ${type.engine_info}` : type.name
    })), [types]
  );

  // ====================================
  // 🎨 RENDU PRINCIPAL
  // ====================================

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          Sélectionnez votre véhicule
        </h2>
      </div>

      <div className="p-6">
        <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
          {/* Sélecteur de marque */}
          <CustomSelect
            name="form-marq"
            value={selectedBrand}
            onChange={handleBrandChange}
            placeholder="Constructeur"
            options={brandOptions}
            loading={loading.brands}
            error={errors.brands}
            ariaLabel="Sélectionner un constructeur"
          />

          {/* Sélecteur d'année */}
          <CustomSelect
            name="form-year"
            value={selectedYear}
            onChange={handleYearChange}
            disabled={years.length === 0}
            placeholder="Année"
            options={yearOptions}
            loading={loading.years}
            error={errors.years}
            ariaLabel="Sélectionner une année"
          />

          {/* Sélecteur de modèle */}
          <CustomSelect
            name="form-model"
            value={selectedModel}
            onChange={handleModelChange}
            disabled={models.length === 0}
            placeholder="Modèle"
            options={modelOptions}
            loading={loading.models}
            error={errors.models}
            ariaLabel="Sélectionner un modèle"
          />

          {/* Sélecteur de motorisation */}
          <CustomSelect
            name="form-type"
            value=""
            onChange={handleTypeSelect}
            disabled={types.length === 0}
            placeholder="Motorisation"
            options={typeOptions}
            loading={loading.types}
            error={errors.types}
            ariaLabel="Sélectionner une motorisation"
          />
        </div>

        {/* Section recherche par type mine */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            Recherche par type mine
          </h3>
          
          <form onSubmit={handleMineSearch} className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                name="MINE"
                value={mineQuery}
                onChange={(e) => setMineQuery(e.target.value)}
                placeholder="Ex: 7671AAL, A123BC456..."
                aria-label="Saisir le type mine"
                className={`
                  w-full px-4 py-3 text-sm font-medium text-gray-900 bg-white border rounded-lg shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors.mine ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
                  transition-colors duration-200
                `}
              />
              {errors.mine && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.mine}
                </p>
              )}
            </div>
            
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 flex items-center gap-2"
              aria-label="Lancer la recherche par type mine"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              Rechercher
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook personnalisé pour l'utilisation du VehicleSelector
 */
export function useVehicleSelector(initialSelection?: Partial<VehicleSelection>) {
  const [selection, setSelection] = useState<VehicleSelection>({
    brandId: initialSelection?.brandId || "0",
    year: initialSelection?.year || "0",
    modelId: initialSelection?.modelId || "0",
    typeData: initialSelection?.typeData,
  });

  const isComplete = useMemo(() => {
    return selection.brandId !== "0" && 
           selection.year !== "0" && 
           selection.modelId !== "0" && 
           Boolean(selection.typeData);
  }, [selection]);

  const reset = useCallback(() => {
    setSelection({
      brandId: "0",
      year: "0",
      modelId: "0",
      typeData: undefined,
    });
  }, []);

  return {
    selection,
    setSelection,
    isComplete,
    reset,
  };
}

export default VehicleSelector;