// 📁 frontend/app/components/home/VehicleSelectorHybrid.tsx
// 🚗 Sélecteur de véhicule hybride - Combine le meilleur des deux approches

import { Form, useNavigate } from '@remix-run/react';
import { Search, Car, Calendar, Fuel, Settings, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";
import { Button } from "../ui/button";

interface VehicleBrand {
  marque_id: number;
  marque_name: string;
  marque_alias?: string;
  marque_logo?: string;
  marque_country?: string;
  products_count?: number;
  is_featured?: boolean;
}

interface VehicleModel {
  modele_id: number;
  modele_name: string;
  modele_alias?: string;
  modele_ful_name?: string;
  brand_id: number;
  year_from?: number;
  year_to?: number;
}

interface VehicleType {
  type_id: number;
  type_name: string;
  type_fuel?: string;
  type_power?: string;
  type_engine?: string;
  model_id: number;
  year_from?: number;
  year_to?: number;
  type_slug?: string;
}

interface VehicleSelectorHybridProps {
  brands?: VehicleBrand[];
  mode?: 'modern' | 'classic';
  showMineSearch?: boolean;
  onVehicleSelect?: (selection: {
    brand?: VehicleBrand;
    model?: VehicleModel;
    type?: VehicleType;
    year?: number;
  }) => void;
  navigateOnSelect?: boolean;
}

export function VehicleSelectorHybrid({ 
  brands = [], 
  mode = 'modern',
  showMineSearch = true,
  onVehicleSelect,
  navigateOnSelect = true
}: VehicleSelectorHybridProps) {
  const navigate = useNavigate();
  
  // 🎯 États pour la cascade proposée : Marque → Année → Modèle → Type
  const [selectedBrand, setSelectedBrand] = useState<VehicleBrand | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  
  // 📊 Données dynamiques
  const [years, setYears] = useState<number[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  
  // ⏳ États de chargement
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  
  // 🔍 Recherche libre et MINE
  const [searchQuery, setSearchQuery] = useState('');
  const [mineQuery, setMineQuery] = useState('');

  // 🏷️ Gestion sélection marque
  const handleBrandChange = async (brandId: number) => {
    const brand = brands.find(b => b.marque_id === brandId) || null;
    setSelectedBrand(brand);
    setSelectedYear(null);
    setSelectedModel(null);
    setSelectedType(null);
    setModels([]);
    setTypes([]);

    if (brand) {
      setLoadingYears(true);
      try {
        const yearsData = await enhancedVehicleApi.getYearsByBrand(brand.marque_id);
        setYears(yearsData.sort((a, b) => b - a)); // Tri décroissant
      } catch (error) {
        console.warn('Erreur chargement années:', error);
        setYears([]);
      } finally {
        setLoadingYears(false);
      }
    } else {
      setYears([]);
    }
  };

  // 📅 Gestion sélection année
  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    setSelectedModel(null);
    setSelectedType(null);
    setTypes([]);

    if (year && selectedBrand) {
      setLoadingModels(true);
      try {
        // 🗓️ Passer l'année pour le filtrage côté backend si supporté
        const modelsData = await enhancedVehicleApi.getModels(selectedBrand.marque_id, { year });
        setModels(modelsData);
      } catch (error) {
        console.warn('Erreur chargement modèles:', error);
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    } else {
      setModels([]);
    }
  };

  // 🚙 Gestion sélection modèle
  const handleModelChange = async (modelId: number) => {
    const model = models.find(m => m.modele_id === modelId) || null;
    setSelectedModel(model);
    setSelectedType(null);

    if (model && selectedYear) {
      setLoadingTypes(true);
      try {
        // � Filtrage côté backend en passant l'année sélectionnée
        const typesData = await enhancedVehicleApi.getTypes(model.modele_id, { year: selectedYear });
        setTypes(typesData);
      } catch (error) {
        console.warn('Erreur chargement types:', error);
        setTypes([]);
      } finally {
        setLoadingTypes(false);
      }
    } else {
      setTypes([]);
    }
  };

  // 🌐 Génération URL interne pour notre page véhicule
  const generateVehicleUrl = (brand: VehicleBrand, model: VehicleModel, type: VehicleType): string => {
    // Nettoyage des noms pour l'URL (slug-friendly)
    const cleanName = (name: string) => name
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const brandSlug = `${cleanName(brand.marque_name)}-${brand.marque_id}`;
    const modelSlug = `${cleanName(model.modele_name)}-${model.modele_id}`;
    const typeSlug = `${cleanName(type.type_name)}-${type.type_id}`;

    return `/constructeurs/${brandSlug}/${modelSlug}/${typeSlug}.html`;
  };

  // ⚙️ Gestion sélection type (avec navigation vers page véhicule interne)
  const handleTypeSelect = (typeSlug: string) => {
    const type = types.find(t => t.type_slug === typeSlug || t.type_id.toString() === typeSlug);
    setSelectedType(type || null);
    
    // 🚀 Navigation vers notre page véhicule interne si toutes les données sont disponibles
    if (type && selectedBrand && selectedModel) {
      const vehicleUrl = generateVehicleUrl(selectedBrand, selectedModel, type);
      console.log('🌐 Navigation vers page véhicule:', vehicleUrl);
      
      // Navigation vers notre page interne
      navigate(vehicleUrl);
    } else if (navigateOnSelect && typeSlug) {
      // Fallback vers navigation générique si données incomplètes
      navigate(`/vehicule/${typeSlug}`);
    }
  };

  // 🔍 Recherche générale
  const handleSearch = () => {
    if (selectedBrand || searchQuery) {
      const params = new URLSearchParams();
      if (selectedBrand) params.append('brand', selectedBrand.marque_id.toString());
      if (selectedYear) params.append('year', selectedYear.toString());
      if (selectedModel) params.append('model', selectedModel.modele_id.toString());
      if (selectedType) params.append('type', selectedType.type_id.toString());
      if (searchQuery) params.append('search', searchQuery);
      
      navigate(`/catalogue?${params.toString()}`);
    }
  };

  // 🔄 Reset complet
  const resetSelection = () => {
    setSelectedBrand(null);
    setSelectedYear(null);
    setSelectedModel(null);
    setSelectedType(null);
    setYears([]);
    setModels([]);
    setTypes([]);
    setSearchQuery('');
    setMineQuery('');
  };

  // 📢 Notification sélection au parent
  useEffect(() => {
    if (onVehicleSelect) {
      onVehicleSelect({
        brand: selectedBrand || undefined,
        model: selectedModel || undefined,
        type: selectedType || undefined,
        year: selectedYear || undefined,
      });
    }
  }, [selectedBrand, selectedYear, selectedModel, selectedType, onVehicleSelect]);

  // 🎨 Rendu conditionnel selon le mode
  if (mode === 'classic') {
    return (
      <div className="container-fluid containerSeekCar">
        <div className="row">
          <div className="col-12 pb-3">
            <strong>Sélectionnez votre véhicule</strong>
          </div>
          
          {/* 🏷️ Sélecteur de marque */}
          <div className="col-12 col-sm-6 col-md-12 p-1 pb-0">
            <select 
              value={selectedBrand?.marque_id || 0}
              onChange={(e) => handleBrandChange(Number(e.target.value))}
              className="form-select"
            >
              <option key="default-brand" value="0">Constructeur</option>
              {brands.map(brand => (
                <option 
                  key={brand.marque_id} 
                  value={brand.marque_id}
                  className={brand.is_featured ? 'favorite' : ''}
                >
                  {brand.marque_name}
                </option>
              ))}
            </select>
          </div>

          {/* 📅 Sélecteur d'année */}
          <div className="col-12 col-sm-6 col-md-12 p-1 pb-0">
            <select 
              value={selectedYear || 0}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              disabled={years.length === 0 || loadingYears}
              className="form-select"
            >
              <option key="default-year" value="0">
                {loadingYears ? 'Chargement années...' : 'Année'}
              </option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* 🚙 Sélecteur de modèle */}
          <div className="col-12 col-sm-6 col-md-12 p-1 pb-0">
            <select 
              value={selectedModel?.modele_id || 0}
              onChange={(e) => handleModelChange(Number(e.target.value))}
              disabled={models.length === 0 || loadingModels}
              className="form-select"
            >
              <option key="default-model" value="0">
                {loadingModels ? 'Chargement modèles...' : 'Modèle'}
              </option>
              {models.map(model => (
                <option key={model.modele_id} value={model.modele_id}>
                  {model.modele_name}
                </option>
              ))}
            </select>
          </div>

          {/* ⚙️ Sélecteur de motorisation */}
          <div className="col-12 col-sm-6 col-md-12 p-1 pb-0">
            <select 
              onChange={(e) => handleTypeSelect(e.target.value)}
              disabled={types.length === 0 || loadingTypes}
              className="form-select"
              value=""
            >
              <option key="default-type" value="">
                {loadingTypes ? 'Chargement motorisations...' : 'Motorisation'}
              </option>
              {types.map(type => (
                <option key={type.type_id} value={type.type_slug || type.type_id}>
                  {type.type_name}
                </option>
              ))}
            </select>
          </div>

          {/* 🔍 Recherche par type mine */}
          {showMineSearch && (
            <div className="col-12 containermineSeekCar">
              <Form method="post" action="/search/mine">
                <div className="row">
                  <div className="col-12 pb-3">
                    Recherche par type mine
                  </div>
                  <div className="col-9 pr-0">
                    <input 
                      type="text" 
                      name="mine" 
                      value={mineQuery}
                      onChange={(e) => setMineQuery(e.target.value)}
                      className="form-control" 
                      placeholder="Ex: M1XXXX"
                    />
                  </div>
                  <div className="col-3 pl-0">
                    <button type="submit" className="btn btn-primary">
                      <i className="bi bi-search"></i>
                    </button>
                  </div>
                </div>
              </Form>
            </div>
          )}

          {/* ⏳ Indicateur de chargement */}
          {(loadingYears || loadingModels || loadingTypes) && (
            <div className="col-12 text-center mt-3">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Chargement...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 🎨 Mode moderne (défaut)
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-200">
      {/* 🎯 En-tête moderne */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
          <Car className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-gray-800 text-lg font-semibold">Sélecteur véhicule intelligent</h3>
          <p className="text-gray-600 text-sm">Trouvez les pièces parfaitement compatibles</p>
        </div>
      </div>

      {/* 📋 Sélection progressive moderne */}
      <div className="space-y-4 mb-6">
        {/* 🏷️ Sélection marque */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Car className="w-4 h-4 inline mr-2" />
            Marque automobile
          </label>
          <select
            value={selectedBrand?.marque_id || ''}
            onChange={(e) => handleBrandChange(parseInt(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option key="default-brand-modern" value="">Sélectionner une marque</option>
            {brands.map((brand) => (
              <option key={brand.marque_id} value={brand.marque_id}>
                {brand.marque_name}
                {brand.is_featured ? ' ⭐' : ''}
                {brand.products_count && ` (${brand.products_count} pièces)`}
              </option>
            ))}
          </select>
        </div>

        {/* 📅 Sélection année */}
        {selectedBrand && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Année de fabrication
            </label>
            <select
              value={selectedYear || ''}
              onChange={(e) => handleYearChange(parseInt(e.target.value))}
              disabled={loadingYears || years.length === 0}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option key="default-year-modern" value="">
                {loadingYears ? 'Chargement des années...' : 'Sélectionner une année'}
              </option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 🚙 Sélection modèle */}
        {selectedYear && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Settings className="w-4 h-4 inline mr-2" />
              Modèle {selectedBrand?.marque_name}
            </label>
            <select
              value={selectedModel?.modele_id || ''}
              onChange={(e) => handleModelChange(parseInt(e.target.value))}
              disabled={loadingModels || models.length === 0}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option key="default-model-modern" value="">
                {loadingModels ? 'Chargement des modèles...' : 'Sélectionner un modèle'}
              </option>
              {models.map((model) => (
                <option key={model.modele_id} value={model.modele_id}>
                  {model.modele_name}
                  {model.year_from && model.year_to && ` (${model.year_from}-${model.year_to})`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ⚙️ Sélection motorisation */}
        {selectedModel && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Fuel className="w-4 h-4 inline mr-2" />
              Motorisation
            </label>
            <select
              onChange={(e) => handleTypeSelect(e.target.value)}
              disabled={loadingTypes || types.length === 0}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              value=""
            >
              <option key="default-type-modern" value="">
                {loadingTypes ? 'Chargement des motorisations...' : 'Sélectionner une motorisation'}
              </option>
              {types.map((type) => (
                <option key={type.type_id} value={type.type_slug || type.type_id}>
                  {type.type_name}
                  {type.type_fuel && ` - ${type.type_fuel}`}
                  {type.type_power && ` (${type.type_power})`}
                </option>
              ))}
            </select>
            
            {/* 📢 Message informatif quand aucune motorisation disponible */}
            {selectedModel && selectedYear && !loadingTypes && types.length === 0 && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center text-amber-800">
                  <div className="w-4 h-4 mr-2">⚠️</div>
                  <div className="text-sm">
                    <strong>Aucune motorisation disponible</strong>
                    <div className="mt-1 text-amber-700">
                      Le modèle <strong>{selectedModel.modele_name}</strong> n'était pas proposé avec des motorisations en <strong>{selectedYear}</strong>.
                      Essayez une autre année ou un autre modèle.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🔍 Recherche libre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Search className="w-4 h-4 inline mr-2" />
            Recherche libre (optionnel)
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="VIN, référence, nom de pièce..."
            className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* 📊 Informations sélection */}
      {(selectedBrand || selectedYear || selectedModel || selectedType) && (
        <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">Véhicule sélectionné :</h4>
          <div className="text-blue-800 space-y-1 text-sm">
            {selectedBrand && <div>• Marque : <strong>{selectedBrand.marque_name}</strong></div>}
            {selectedYear && <div>• Année : <strong>{selectedYear}</strong></div>}
            {selectedModel && <div>• Modèle : <strong>{selectedModel.modele_name}</strong></div>}
            {selectedType && <div>• Motorisation : <strong>{selectedType.type_name}</strong></div>}
          </div>
        </div>
      )}

      {/* 🎯 Actions */}
      <div className="flex gap-3 mb-6">
        <Button
          onClick={handleSearch}
          disabled={!selectedBrand && !searchQuery}
          className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          <Search className="w-5 h-5 mr-2" />
          Rechercher des pièces
        </Button>
        
        {(selectedBrand || selectedYear || selectedModel || selectedType || searchQuery) && (
          <Button
            onClick={resetSelection}
            variant="outline"
            className="px-4 py-3 rounded-xl border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* 🔍 Recherche par type MINE */}
      {showMineSearch && (
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-gray-800 font-semibold mb-3">Recherche par type MINE</h4>
          <Form method="post" action="/search/mine" className="flex gap-3">
            <input
              type="text"
              name="mine"
              value={mineQuery}
              onChange={(e) => setMineQuery(e.target.value)}
              placeholder="Ex: M1XXXX"
              className="flex-1 p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all"
            >
              <Search className="w-5 h-5" />
            </Button>
          </Form>
        </div>
      )}

      {/* 📈 Statistiques rapides */}
      {selectedBrand && (years.length > 0 || models.length > 0 || types.length > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-gray-900">{models.length}</div>
              <div className="text-xs text-gray-600">Modèles</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{types.length}</div>
              <div className="text-xs text-gray-600">Motorisations</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{years.length}</div>
              <div className="text-xs text-gray-600">Années</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}