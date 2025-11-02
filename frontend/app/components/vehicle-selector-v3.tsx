// 📁 frontend/app/components/vehicle-selector-v3.tsx
// 🚗 VehicleSelector v3 - Intégration Design System avec Combobox
// Basé sur advanced-vehicle-selector.tsx avec composants @fafa/ui

import { Combobox, type ComboboxItem } from '@fafa/ui';
import { useState, useEffect } from 'react';

// 🏗️ Interfaces TypeScript pour les données véhicules
interface Brand {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  marque_pic?: string;
  models_count?: number;
}

interface VehicleModel {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  modele_pic?: string;
  year_from?: number;
  year_to?: number;
  types_count?: number;
}

interface VehicleType {
  cgc_type_id: number;
  type_name: string;
  type_alias: string;
  type_power_ps?: number;
  type_power_kw?: number;
  type_fuel?: string;
  type_engine_code?: string;
  type_mine?: string;
  type_year_from?: number;
  type_year_to?: number;
  type_month_from?: number;
  type_month_to?: number;
  parts_count?: number;
}

interface TypeMineSearchResult {
  type_mine: string;
  cgc_type_id: number;
  type_name: string;
  modele_name: string;
  marque_name: string;
  type_power_ps?: number;
  type_fuel?: string;
  vehicle_years?: string;
}

// 🎛️ Props du composant
interface VehicleSelectorV3Props {
  preselectedBrand?: number;
  onVehicleSelect?: (vehicle: VehicleType & { marque_id: number; modele_id: number }) => void;
  enableTypeMineSearch?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  density?: 'compact' | 'comfy';
  radius?: 'sm' | 'md' | 'lg' | 'full';
}

// 🔄 Adapter Brand pour ComboboxItem
interface BrandItem extends ComboboxItem {
  marque_id: number;
  marque_name: string;
  models_count?: number;
}

interface ModelItem extends ComboboxItem {
  modele_id: number;
  modele_name: string;
  types_count?: number;
  year_from?: number;
  year_to?: number;
}

interface TypeItem extends ComboboxItem {
  cgc_type_id: number;
  type_name: string;
  type_power_ps?: number;
  type_fuel?: string;
  type_mine?: string;
}

/**
 * 🚗 Composant VehicleSelector v3
 * Design System ready avec Combobox générique
 */
export function VehicleSelectorV3({
  preselectedBrand,
  onVehicleSelect,
  enableTypeMineSearch = true,
  className = '',
  size = 'md',
  density = 'comfy',
  radius = 'md',
}: VehicleSelectorV3Props) {
  
  // 📊 États pour les données (API data)
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [types, setTypes] = useState<TypeItem[]>([]);
  
  // 🎯 États pour les sélections (controlled values)
  const [selectedBrandId, setSelectedBrandId] = useState<number | string | null>(preselectedBrand || null);
  const [selectedModelId, setSelectedModelId] = useState<number | string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<number | string | null>(null);
  
  // 🔍 États pour la recherche type mine
  const [typeMineQuery, setTypeMineQuery] = useState('');
  const [typeMineResults, setTypeMineResults] = useState<TypeMineSearchResult[]>([]);
  const [isTypeMineMode, setIsTypeMineMode] = useState(false);
  
  // 🔄 États UI
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingTypeMine, setLoadingTypeMine] = useState(false);

  // 🚀 Chargement initial des marques
  useEffect(() => {
    loadBrands();
  }, []);

  // 🔄 Chargement des modèles quand marque sélectionnée
  useEffect(() => {
    if (selectedBrandId) {
      loadModels(Number(selectedBrandId));
      setSelectedModelId(null);
      setSelectedTypeId(null);
      setModels([]);
      setTypes([]);
    }
  }, [selectedBrandId]);

  // 🔄 Chargement des types quand modèle sélectionné
  useEffect(() => {
    if (selectedModelId) {
      loadTypes(Number(selectedModelId));
      setSelectedTypeId(null);
      setTypes([]);
    }
  }, [selectedModelId]);

  // 🎯 Déclencher callback quand type sélectionné
  useEffect(() => {
    if (selectedTypeId && selectedBrandId && selectedModelId) {
      const selectedType = types.find(t => t.cgc_type_id === Number(selectedTypeId));
      if (selectedType && onVehicleSelect) {
        onVehicleSelect({
          cgc_type_id: selectedType.cgc_type_id,
          type_name: selectedType.type_name,
          type_alias: selectedType.type_name.toLowerCase().replace(/\s+/g, '-'),
          type_power_ps: selectedType.type_power_ps,
          type_fuel: selectedType.type_fuel,
          type_mine: selectedType.type_mine,
          marque_id: Number(selectedBrandId),
          modele_id: Number(selectedModelId),
        });
      }
    }
  }, [selectedTypeId, selectedBrandId, selectedModelId, types, onVehicleSelect]);

  // 🌐 Chargement des marques
  const loadBrands = async () => {
    try {
      setLoadingBrands(true);
      const response = await fetch('/api/vehicles/brands');
      if (!response.ok) throw new Error('Erreur chargement marques');
      
      const data = await response.json();
      const brandsData: Brand[] = data.data || [];
      
      // Adapter pour Combobox
      const adaptedBrands: BrandItem[] = brandsData.map(brand => ({
        value: brand.marque_id,
        label: brand.marque_name,
        marque_id: brand.marque_id,
        marque_name: brand.marque_name,
        models_count: brand.models_count,
      }));
      
      setBrands(adaptedBrands);
    } catch (error) {
      console.error('Load brands error:', error);
    } finally {
      setLoadingBrands(false);
    }
  };

  // 🚗 Chargement des modèles pour une marque
  const loadModels = async (brandId: number) => {
    try {
      setLoadingModels(true);
      const response = await fetch(`/api/vehicles/models/brand/${brandId}`);
      if (!response.ok) throw new Error('Erreur chargement modèles');
      
      const data = await response.json();
      const modelsData: VehicleModel[] = data.data || [];
      
      // Adapter pour Combobox
      const adaptedModels: ModelItem[] = modelsData.map(model => ({
        value: model.modele_id,
        label: model.modele_name,
        modele_id: model.modele_id,
        modele_name: model.modele_name,
        types_count: model.types_count,
        year_from: model.year_from,
        year_to: model.year_to,
      }));
      
      setModels(adaptedModels);
    } catch (error) {
      console.error('Load models error:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  // ⚙️ Chargement des types pour un modèle
  const loadTypes = async (modelId: number) => {
    try {
      setLoadingTypes(true);
      const response = await fetch(`/api/vehicles/types/model/${modelId}`);
      if (!response.ok) throw new Error('Erreur chargement types');
      
      const data = await response.json();
      const typesData: VehicleType[] = data.data || [];
      
      // Adapter pour Combobox
      const adaptedTypes: TypeItem[] = typesData.map(type => ({
        value: type.cgc_type_id,
        label: type.type_name,
        cgc_type_id: type.cgc_type_id,
        type_name: type.type_name,
        type_power_ps: type.type_power_ps,
        type_fuel: type.type_fuel,
        type_mine: type.type_mine,
      }));
      
      setTypes(adaptedTypes);
    } catch (error) {
      console.error('Load types error:', error);
    } finally {
      setLoadingTypes(false);
    }
  };

  // 🔍 Recherche par type mine (équivalent PHP)
  const searchTypeMine = async (query: string) => {
    if (query.length < 3) {
      setTypeMineResults([]);
      return;
    }

    try {
      setLoadingTypeMine(true);
      const response = await fetch(`/api/vehicles/search/mine/${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Erreur recherche type mine');
      
      const data = await response.json();
      
      // Adapter les données pour notre interface
      const adaptedResults: TypeMineSearchResult[] = (data.data || []).map((item: any) => ({
        type_mine: item.type_mine_code || item.type_mine || query,
        cgc_type_id: item.cgc_type_id || item.type_id,
        type_name: item.type_name,
        modele_name: item.modele_name,
        marque_name: item.marque_name,
        type_power_ps: item.type_power_ps,
        type_fuel: item.type_fuel,
        vehicle_years: item.type_year_from && item.type_year_to ? 
          `${item.type_year_from}-${item.type_year_to}` : 
          item.type_year_from ? `depuis ${item.type_year_from}` : undefined
      }));
      
      setTypeMineResults(adaptedResults);
    } catch (error) {
      console.error('Type mine search error:', error);
    } finally {
      setLoadingTypeMine(false);
    }
  };

  // 🔍 Gestionnaire sélection type mine
  const handleTypeMineSelection = (result: TypeMineSearchResult) => {
    setIsTypeMineMode(false);
    setTypeMineQuery(result.type_mine);
    
    if (onVehicleSelect) {
      onVehicleSelect({
        cgc_type_id: result.cgc_type_id,
        type_name: result.type_name,
        type_alias: result.type_name.toLowerCase().replace(/\s+/g, '-'),
        type_mine: result.type_mine,
        type_power_ps: result.type_power_ps,
        type_fuel: result.type_fuel,
        marque_id: 0, // À déterminer via API
        modele_id: 0  // À déterminer via API
      });
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 🎯 Header avec toggle mode */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
          Sélectionnez votre véhicule
        </h3>
        
        {enableTypeMineSearch && (
          <button
            type="button"
            onClick={() => setIsTypeMineMode(!isTypeMineMode)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-colors
              ${isTypeMineMode 
                ? 'bg-[var(--color-primary-600)] text-[var(--text-inverse)]' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--color-primary-50)]'
              }
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Type Mine
          </button>
        )}
      </div>

      {isTypeMineMode ? (
        // 🔍 Mode recherche type mine
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Recherche par Type Mine
            </label>
            <div className="relative">
              <input
                type="text"
                value={typeMineQuery}
                onChange={(e) => {
                  setTypeMineQuery(e.target.value);
                  searchTypeMine(e.target.value);
                }}
                placeholder="Saisir le type mine (ex: A3B4C5)"
                className={`
                  w-full px-4 py-2 border-2 border-[var(--border-primary)] rounded-${radius}
                  bg-[var(--bg-primary)] text-[var(--text-primary)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]
                  placeholder:text-[var(--text-secondary)]
                `}
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              💡 Le type mine se trouve sur votre carte grise dans la case D.2
            </p>
          </div>
          
          {loadingTypeMine && (
            <div className="text-center py-4 text-sm text-[var(--text-secondary)]">
              Recherche en cours...
            </div>
          )}
          
          {!loadingTypeMine && typeMineResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {typeMineResults.length} résultat{typeMineResults.length > 1 ? 's' : ''} trouvé{typeMineResults.length > 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {typeMineResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleTypeMineSelection(result)}
                    className="w-full text-left p-4 border-2 border-[var(--border-primary)] rounded-md hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-500)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[var(--color-primary-600)] text-[var(--text-inverse)] text-xs font-mono rounded">
                            {result.type_mine}
                          </span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {result.marque_name} {result.modele_name}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {result.type_name}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                          {result.type_power_ps && (
                            <span>{result.type_power_ps} ch</span>
                          )}
                          {result.type_fuel && (
                            <span>{result.type_fuel}</span>
                          )}
                          {result.vehicle_years && (
                            <span>{result.vehicle_years}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {!loadingTypeMine && typeMineQuery.length >= 3 && typeMineResults.length === 0 && (
            <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
              Aucun véhicule trouvé pour ce type mine
            </div>
          )}
        </div>
      ) : (
        // 🔄 Mode cascade avec Combobox
        <div className="space-y-4">
          {/* 🏭 Sélection de la marque */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              1. Marque
            </label>
            <Combobox
              items={brands}
              value={selectedBrandId}
              onChange={(value) => setSelectedBrandId(value)}
              placeholder="Choisir une marque"
              searchPlaceholder="Rechercher une marque..."
              emptyText="Aucune marque trouvée"
              loading={loadingBrands}
              size={size}
              density={density}
              radius={radius}
              renderItem={(brand) => (
                <div className="flex items-center justify-between w-full">
                  <span>{brand.marque_name}</span>
                  {brand.models_count && (
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {brand.models_count} modèles
                    </span>
                  )}
                </div>
              )}
              aria-label="Sélection de la marque du véhicule"
            />
          </div>

          {/* 🚗 Sélection du modèle */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              2. Modèle
            </label>
            <Combobox
              items={models}
              value={selectedModelId}
              onChange={(value) => setSelectedModelId(value)}
              placeholder="Choisir un modèle"
              searchPlaceholder="Rechercher un modèle..."
              emptyText="Sélectionnez d'abord une marque"
              loading={loadingModels}
              disabled={!selectedBrandId}
              size={size}
              density={density}
              radius={radius}
              renderItem={(model) => (
                <div className="flex items-center justify-between w-full">
                  <span>{model.modele_name}</span>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    {model.year_from && model.year_to && (
                      <span>{model.year_from}-{model.year_to}</span>
                    )}
                    {model.types_count && (
                      <span>{model.types_count} types</span>
                    )}
                  </div>
                </div>
              )}
              aria-label="Sélection du modèle du véhicule"
            />
          </div>

          {/* ⚙️ Sélection du type */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              3. Motorisation / Type
            </label>
            <Combobox
              items={types}
              value={selectedTypeId}
              onChange={(value) => setSelectedTypeId(value)}
              placeholder="Choisir une motorisation"
              searchPlaceholder="Rechercher une motorisation..."
              emptyText="Sélectionnez d'abord un modèle"
              loading={loadingTypes}
              disabled={!selectedModelId}
              size={size}
              density={density}
              radius={radius}
              renderItem={(type) => (
                <div className="space-y-1 w-full">
                  <div className="font-medium">{type.type_name}</div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                    {type.type_power_ps && (
                      <span>{type.type_power_ps} ch</span>
                    )}
                    {type.type_fuel && (
                      <span>{type.type_fuel}</span>
                    )}
                    {type.type_mine && (
                      <span className="font-mono">Mine: {type.type_mine}</span>
                    )}
                  </div>
                </div>
              )}
              aria-label="Sélection de la motorisation du véhicule"
            />
          </div>
        </div>
      )}
    </div>
  );
}
