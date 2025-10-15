// 📁 frontend/app/components/advanced-vehicle-selector.tsx
// 🚗 Sélecteur de véhicule avancé - Inspiré des améliorations PHP découvertes
// Version 2.0 - Cascade Marque→Année→Modèle→Type + Recherche Type Mine

import { Search, ChevronDown, Car, Calendar, Cog, FileText } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

// 🏗️ Interfaces TypeScript pour les données véhicules
interface Brand {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  marque_pic?: string;
  models_count?: number;
}

interface VehicleYear {
  year: number;
  models_count: number;
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
interface AdvancedVehicleSelectorProps {
  preselectedBrand?: number;
  cascadeMode?: boolean;
  onVehicleSelect?: (vehicle: VehicleType & { marque_id: number; modele_id: number }) => void;
  enableTypeMineSearch?: boolean;
  showCompactMode?: boolean;
  placeholder?: {
    brand?: string;
    year?: string;
    model?: string;
    type?: string;
    typeMine?: string;
  };
  className?: string;
}

/**
 * 🚗 Composant Advanced Vehicle Selector
 * Basé sur l'analyse des fichiers PHP - Cascade complète + Type Mine
 */
export function AdvancedVehicleSelector({
  preselectedBrand,
  cascadeMode = true,
  onVehicleSelect,
  enableTypeMineSearch = true,
  showCompactMode = false,
  placeholder = {},
  className = ""
}: AdvancedVehicleSelectorProps) {
  
  // 📊 États pour les données
  const [brands, setBrands] = useState<Brand[]>([]);
  const [years, setYears] = useState<VehicleYear[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  
  // 🎯 États pour les sélections
  const [selectedBrand, setSelectedBrand] = useState<number | null>(preselectedBrand || null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  
  // 🔍 États pour la recherche type mine
  const [typeMineQuery, setTypeMineQuery] = useState('');
  const [typeMineResults, setTypeMineResults] = useState<TypeMineSearchResult[]>([]);
  const [showTypeMineResults, setShowTypeMineResults] = useState(false);
  const [isTypeMineMode, setIsTypeMineMode] = useState(false);
  
  // 🔄 États UI
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 📎 Références
  const typeMineInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 🚀 Chargement initial des marques
  useEffect(() => {
    loadBrands();
  }, []);

  // 🔄 Réaction aux changements de sélection
  useEffect(() => {
    if (selectedBrand && cascadeMode) {
      loadModels(selectedBrand);
      resetSelection(['model', 'type']);
    }
  }, [selectedBrand, cascadeMode]);

  useEffect(() => {
    if (selectedBrand && selectedModel && cascadeMode) {
      loadTypes(selectedBrand, selectedModel);
      resetSelection(['type']);
    }
  }, [selectedModel, selectedBrand, cascadeMode]);

  // 🌐 Chargement des marques
  const loadBrands = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/vehicles/brands');
      if (!response.ok) throw new Error('Erreur chargement marques');
      
      const data = await response.json();
      setBrands(data.data || []);
    } catch (error) {
      setErrors(prev => ({ ...prev, brands: 'Erreur chargement des marques' }));
      console.error('Load brands error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 📅 Chargement des années pour une marque (désactivé temporairement)
  const _loadYears = async (brandId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/vehicles/brands/${brandId}/years`);
      if (!response.ok) throw new Error('Erreur chargement années');
      
      const data = await response.json();
      setYears(data.data || []);
    } catch (error) {
      setErrors(prev => ({ ...prev, years: 'Erreur chargement des années' }));
      console.error('Load years error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🚗 Chargement des modèles pour une marque/année
  const loadModels = async (brandId: number, _year?: number | null) => {
    try {
      setLoading(true);
      const url = `/api/vehicles/models/brand/${brandId}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erreur chargement modèles');
      
      const data = await response.json();
      setModels(data.data || []);
    } catch (error) {
      setErrors(prev => ({ ...prev, models: 'Erreur chargement des modèles' }));
      console.error('Load models error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ⚙️ Chargement des types pour un modèle
  const loadTypes = async (brandId: number, modelId: number, _year?: number | null) => {
    try {
      setLoading(true);
      const url = `/api/vehicles/types/model/${modelId}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erreur chargement types');
      
      const data = await response.json();
      setTypes(data.data || []);
    } catch (error) {
      setErrors(prev => ({ ...prev, types: 'Erreur chargement des types' }));
      console.error('Load types error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔍 Recherche par type mine (équivalent PHP)
  const searchTypeMine = async (query: string) => {
    if (query.length < 3) {
      setTypeMineResults([]);
      setShowTypeMineResults(false);
      return;
    }

    try {
      setLoading(true);
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
      setShowTypeMineResults(true);
    } catch (error) {
      setErrors(prev => ({ ...prev, typeMine: 'Erreur recherche type mine' }));
      console.error('Type mine search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🧹 Réinitialisation des sélections
  const resetSelection = (fields: Array<'year' | 'model' | 'type'>) => {
    if (fields.includes('year')) setSelectedYear(null);
    if (fields.includes('model')) setSelectedModel(null);
    if (fields.includes('type')) setSelectedType(null);
  };

  // 🎯 Gestionnaire de sélection finale
  const handleVehicleSelection = (type: VehicleType) => {
    if (onVehicleSelect && selectedBrand && selectedModel) {
      onVehicleSelect({
        ...type,
        marque_id: selectedBrand,
        modele_id: selectedModel
      });
    }
  };

  // 🔍 Gestionnaire sélection type mine
  const handleTypeMineSelection = async (result: TypeMineSearchResult) => {
    setIsTypeMineMode(false);
    setShowTypeMineResults(false);
    setTypeMineQuery(result.type_mine);
    
    // Simuler la sélection du véhicule correspondant
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

  // 🎨 Formatage des années pour affichage
  const formatDateRange = (monthFrom?: number, yearFrom?: number, monthTo?: number, yearTo?: number): string => {
    if (!yearFrom) return "";
    
    if (!yearTo) {
      return `du ${monthFrom ? monthFrom + '/' : ''}${yearFrom}`;
    } else {
      const fromDate = monthFrom ? `${monthFrom}/${yearFrom}` : `${yearFrom}`;
      const toDate = monthTo ? `${monthTo}/${yearTo}` : `${yearTo}`;
      return `de ${fromDate} à ${toDate}`;
    }
  };

  // 🎨 Mode compact ou normal
  if (showCompactMode) {
    return (
      <div className={`advanced-vehicle-selector compact ${className}`}>
        <div className="compact-search-container">
          {enableTypeMineSearch && (
            <div className="type-mine-search">
              <div className="input-group">
                <Search className="input-icon" size={16} />
                <input
                  ref={typeMineInputRef}
                  type="text"
                  value={typeMineQuery}
                  onChange={(e) => {
                    setTypeMineQuery(e.target.value);
                    searchTypeMine(e.target.value);
                  }}
                  placeholder={placeholder.typeMine || "Recherche par type mine (ex: A3B4C5)"}
                  className="type-mine-input compact"
                />
              </div>
              
              {showTypeMineResults && typeMineResults.length > 0 && (
                <div ref={resultsRef} className="type-mine-results compact">
                  {typeMineResults.slice(0, 5).map((result, index) => (
                    <div
                      key={index}
                      className="result-item compact"
                      onClick={() => handleTypeMineSelection(result)}
                    >
                      <div className="result-main">
                        <span className="type-mine">{result.type_mine}</span>
                        <span className="vehicle-info">
                          {result.marque_name} {result.modele_name} {result.type_name}
                        </span>
                      </div>
                      {result.type_power_ps && (
                        <span className="power">{result.type_power_ps} ch</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 🎨 Mode normal avec cascade complète
  return (
    <div className={`advanced-vehicle-selector ${className}`}>
      <div className="selector-header">
        <h3 className="selector-title">
          <Car className="title-icon" size={20} />
          Sélectionnez votre véhicule
        </h3>
        
        {enableTypeMineSearch && (
          <button
            type="button"
            className={`mode-toggle ${isTypeMineMode ? 'active' : ''}`}
            onClick={() => setIsTypeMineMode(!isTypeMineMode)}
          >
            <FileText size={16} />
            Type Mine
          </button>
        )}
      </div>

      {isTypeMineMode ? (
        // 🔍 Mode recherche type mine
        <div className="type-mine-search-mode">
          <div className="search-container">
            <div className="input-group">
              <Search className="input-icon" size={20} />
              <input
                ref={typeMineInputRef}
                type="text"
                value={typeMineQuery}
                onChange={(e) => {
                  setTypeMineQuery(e.target.value);
                  searchTypeMine(e.target.value);
                }}
                placeholder={placeholder.typeMine || "Saisir le type mine de votre véhicule (ex: A3B4C5)"}
                className="type-mine-input"
                autoFocus
              />
            </div>
            
            <div className="search-help">
              Le type mine se trouve sur votre carte grise dans la case D.2
            </div>
          </div>
          
          {showTypeMineResults && (
            <div ref={resultsRef} className="type-mine-results">
              {typeMineResults.length > 0 ? (
                typeMineResults.map((result, index) => (
                  <div
                    key={index}
                    className="result-item"
                    onClick={() => handleTypeMineSelection(result)}
                  >
                    <div className="result-header">
                      <span className="type-mine-badge">{result.type_mine}</span>
                      <span className="vehicle-name">
                        {result.marque_name} {result.modele_name}
                      </span>
                    </div>
                    <div className="result-details">
                      <span className="type-name">{result.type_name}</span>
                      {result.type_power_ps && (
                        <span className="power">{result.type_power_ps} ch</span>
                      )}
                      {result.type_fuel && (
                        <span className="fuel">{result.type_fuel}</span>
                      )}
                      {result.vehicle_years && (
                        <span className="years">{result.vehicle_years}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-results">
                  Aucun véhicule trouvé pour ce type mine
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // 🔄 Mode cascade classique
        <div className="cascade-selector">
          {/* 🏭 Sélection de la marque */}
          <div className="selector-step">
            <label className="step-label">
              <Car className="label-icon" size={16} />
              Marque
            </label>
            <div className="input-group">
              <select
                value={selectedBrand || ''}
                onChange={(e) => setSelectedBrand(Number(e.target.value) || null)}
                className="selector-select"
                disabled={loading}
              >
                <option value="">{placeholder.brand || "Choisir une marque"}</option>
                {brands.map(brand => (
                  <option key={brand.marque_id} value={brand.marque_id}>
                    {brand.marque_name}
                    {brand.models_count && ` (${brand.models_count} modèles)`}
                  </option>
                ))}
              </select>
              <ChevronDown className="select-icon" size={16} />
            </div>
            {errors.brands && <div className="error-message">{errors.brands}</div>}
          </div>

          {/* 📅 Sélection de l'année - Temporairement désactivée */}
          {false && selectedBrand && years.length > 0 && (
            <div className="selector-step">
              <label className="step-label">
                <Calendar className="label-icon" size={16} />
                Année
              </label>
              <div className="input-group">
                <select
                  value={selectedYear || ''}
                  onChange={(e) => setSelectedYear(Number(e.target.value) || null)}
                  className="selector-select"
                  disabled={loading}
                >
                  <option value="">{placeholder.year || "Choisir une année"}</option>
                  {years.map(year => (
                    <option key={year.year} value={year.year}>
                      {year.year}
                      {year.models_count && ` (${year.models_count} modèles)`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="select-icon" size={16} />
              </div>
              {errors.years && <div className="error-message">{errors.years}</div>}
            </div>
          )}

          {/* 🚗 Sélection du modèle */}
          {selectedBrand && models.length > 0 && (
            <div className="selector-step">
              <label className="step-label">
                <Car className="label-icon" size={16} />
                Modèle
              </label>
              <div className="input-group">
                <select
                  value={selectedModel || ''}
                  onChange={(e) => setSelectedModel(Number(e.target.value) || null)}
                  className="selector-select"
                  disabled={loading}
                >
                  <option value="">{placeholder.model || "Choisir un modèle"}</option>
                  {models.map(model => (
                    <option key={model.modele_id} value={model.modele_id}>
                      {model.modele_name}
                      {model.types_count && ` (${model.types_count} types)`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="select-icon" size={16} />
              </div>
              {errors.models && <div className="error-message">{errors.models}</div>}
            </div>
          )}

          {/* ⚙️ Sélection du type */}
          {selectedModel && types.length > 0 && (
            <div className="selector-step">
              <label className="step-label">
                <Cog className="label-icon" size={16} />
                Type / Motorisation
              </label>
              <div className="types-grid">
                {types.map(type => (
                  <div
                    key={type.cgc_type_id}
                    className={`type-card ${selectedType === type.cgc_type_id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedType(type.cgc_type_id);
                      handleVehicleSelection(type);
                    }}
                  >
                    <div className="type-header">
                      <span className="type-name">{type.type_name}</span>
                      {type.type_power_ps && (
                        <span className="type-power">{type.type_power_ps} ch</span>
                      )}
                    </div>
                    
                    <div className="type-details">
                      {type.type_fuel && (
                        <span className="type-fuel">{type.type_fuel}</span>
                      )}
                      {type.type_engine_code && (
                        <span className="type-engine">{type.type_engine_code}</span>
                      )}
                      {type.type_mine && (
                        <span className="type-mine">Type mine: {type.type_mine}</span>
                      )}
                    </div>
                    
                    <div className="type-period">
                      {formatDateRange(
                        type.type_month_from,
                        type.type_year_from,
                        type.type_month_to,
                        type.type_year_to
                      )}
                    </div>
                    
                    {type.parts_count && (
                      <div className="parts-count">
                        {type.parts_count} pièces disponibles
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {errors.types && <div className="error-message">{errors.types}</div>}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>Chargement...</span>
        </div>
      )}
    </div>
  );
}