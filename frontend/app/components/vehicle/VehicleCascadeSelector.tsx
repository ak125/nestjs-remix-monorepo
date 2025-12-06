// 📁 frontend/app/components/vehicle/VehicleCascadeSelector.tsx
// 🚗 Sélecteur de véhicule en cascade - Design professionnel

import { Calendar, Car, ChevronDown, Fuel, Search, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';

import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";

interface VehicleCascadeSelectorProps {
  onVehicleSelect?: (vehicle: {
    brand: any;
    year: number;
    model: any;
    type: any;
  }) => void;
  currentVehicle?: {
    brand?: { id: number; name: string };
    model?: { id: number; name: string };
    type?: { id: number; name: string };
  };
  className?: string;
}

export default function VehicleCascadeSelector({
  onVehicleSelect,
  currentVehicle,
  className = ""
}: VehicleCascadeSelectorProps) {
  
  // États pour les données
  const [brands, setBrands] = useState<any[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  
  // États des sélections
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<any>(null);
  
  // États de chargement
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // 🔄 Charger les marques au montage
  useEffect(() => {
    loadBrands();
  }, []);

  // 🔄 Pré-remplir si véhicule actuel
  useEffect(() => {
    if (currentVehicle?.brand) {
      const brand = brands.find(b => b.marque_id === currentVehicle.brand?.id);
      if (brand) {
        setSelectedBrand(brand);
      }
    }
  }, [currentVehicle, brands]);

  const loadBrands = async () => {
    setLoadingBrands(true);
    try {
      const data = await enhancedVehicleApi.getBrands();
      setBrands(data);
    } catch (error) {
      console.error('❌ Erreur chargement marques:', error);
    } finally {
      setLoadingBrands(false);
    }
  };

  const loadYears = async (brandId: number) => {
    setLoadingYears(true);
    try {
      const data = await enhancedVehicleApi.getYearsByBrand(brandId);
      setYears(data);
    } catch (error) {
      console.error('❌ Erreur chargement années:', error);
    } finally {
      setLoadingYears(false);
    }
  };

  const loadModels = async (brandId: number, year: number) => {
    setLoadingModels(true);
    try {
      const data = await enhancedVehicleApi.getModels(brandId, { year, page: 1, limit: 100 });
      setModels(data);
    } catch (error) {
      console.error('❌ Erreur chargement modèles:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const loadTypes = async (modelId: number) => {
    setLoadingTypes(true);
    try {
      const data = await enhancedVehicleApi.getTypes(modelId);
      setTypes(data);
    } catch (error) {
      console.error('❌ Erreur chargement motorisations:', error);
    } finally {
      setLoadingTypes(false);
    }
  };

  // 🎯 Gestion sélection marque
  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const brandId = parseInt(e.target.value);
    const brand = brands.find(b => b.marque_id === brandId);
    
    setSelectedBrand(brand);
    setSelectedYear(null);
    setSelectedModel(null);
    setSelectedType(null);
    setYears([]);
    setModels([]);
    setTypes([]);
    
    if (brand) {
      loadYears(brand.marque_id);
    }
  };

  // 🎯 Gestion sélection année
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = parseInt(e.target.value);
    
    setSelectedYear(year);
    setSelectedModel(null);
    setSelectedType(null);
    setModels([]);
    setTypes([]);
    
    if (selectedBrand && year) {
      loadModels(selectedBrand.marque_id, year);
    }
  };

  // 🎯 Gestion sélection modèle
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = parseInt(e.target.value);
    const model = models.find(m => m.modele_id === modelId);
    
    setSelectedModel(model);
    setSelectedType(null);
    setTypes([]);
    
    if (model) {
      loadTypes(model.modele_id);
    }
  };

  // 🎯 Gestion sélection type
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const typeId = parseInt(e.target.value);
    const type = types.find(t => t.type_id === typeId);
    
    setSelectedType(type);
    
    // ✅ Sélection complète - appeler le callback
    if (selectedBrand && selectedYear && selectedModel && type && onVehicleSelect) {
      onVehicleSelect({
        brand: selectedBrand,
        year: selectedYear,
        model: selectedModel,
        type: type
      });
    }
  };

  return (
    <div className={`${className}`}>
      
      {/* 📋 Formulaire en cascade */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1️⃣ Constructeur */}
        <div className="relative">
          <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
            <Car className="w-4 h-4 text-semantic-info" />
            Constructeur
          </label>
          <div className="relative">
            <select
              value={selectedBrand?.marque_id || ''}
              onChange={handleBrandChange}
              disabled={loadingBrands}
              className="w-full px-4 py-3 pr-10 bg-white border-2 border-neutral-200 rounded-lg appearance-none focus:border-semantic-info focus:ring-4 focus:ring-semantic-info/10 transition-all disabled:bg-neutral-100 disabled:cursor-not-allowed text-base"
            >
              <option value="">Sélectionnez une marque</option>
              {brands.map((brand) => (
                <option key={brand.marque_id} value={brand.marque_id}>
                  {brand.marque_name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
            {loadingBrands && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-semantic-info border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>

        {/* 2️⃣ Année */}
        <div className="relative">
          <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-semantic-info" />
            Année
          </label>
          <div className="relative">
            <select
              value={selectedYear || ''}
              onChange={handleYearChange}
              disabled={!selectedBrand || loadingYears}
              className="w-full px-4 py-3 pr-10 bg-white border-2 border-neutral-200 rounded-lg appearance-none focus:border-semantic-info focus:ring-4 focus:ring-semantic-info/10 transition-all disabled:bg-neutral-100 disabled:cursor-not-allowed text-base"
            >
              <option value="">Choisir l'année</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
            {loadingYears && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-semantic-info border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>

        {/* 3️⃣ Modèle */}
        <div className="relative">
          <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
            <Settings className="w-4 h-4 text-semantic-info" />
            Modèle
          </label>
          <div className="relative">
            <select
              value={selectedModel?.modele_id || ''}
              onChange={handleModelChange}
              disabled={!selectedYear || loadingModels}
              className="w-full px-4 py-3 pr-10 bg-white border-2 border-neutral-200 rounded-lg appearance-none focus:border-semantic-info focus:ring-4 focus:ring-semantic-info/10 transition-all disabled:bg-neutral-100 disabled:cursor-not-allowed text-base"
            >
              <option value="">Sélectionnez le modèle</option>
              {models.map((model) => (
                <option key={model.modele_id} value={model.modele_id}>
                  {model.modele_name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
            {loadingModels && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-semantic-info border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>

        {/* 4️⃣ Motorisation */}
        <div className="relative">
          <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
            <Fuel className="w-4 h-4 text-semantic-info" />
            Motorisation
          </label>
          <div className="relative">
            <select
              value={selectedType?.type_id || ''}
              onChange={handleTypeChange}
              disabled={!selectedModel || loadingTypes}
              className="w-full px-4 py-3 pr-10 bg-white border-2 border-neutral-200 rounded-lg appearance-none focus:border-semantic-info focus:ring-4 focus:ring-semantic-info/10 transition-all disabled:bg-neutral-100 disabled:cursor-not-allowed text-base"
            >
              <option value="">Choisir la motorisation</option>
              {types.map((type) => (
                <option key={type.type_id} value={type.type_id}>
                  {type.type_name} {type.type_puissance_ch && `(${type.type_puissance_ch} ch)`}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
            {loadingTypes && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-semantic-info border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 🔍 Recherche par type mine */}
      <div className="mt-6 pt-6 border-t border-neutral-200">
        <button
          type="button"
          className="text-sm text-semantic-info hover:text-semantic-info/80 font-medium flex items-center gap-2 transition-colors"
          onClick={() => {
            // TODO: Implémenter recherche type mine
            alert('Recherche par type mine - À implémenter');
          }}
        >
          <Search className="w-4 h-4" />
          Recherche par type mine
        </button>
      </div>

      {/* ℹ️ Aide contextuelle */}
      {!selectedBrand && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Commencez par sélectionner le constructeur</strong> de votre véhicule
          </p>
        </div>
      )}
      
      {selectedBrand && !selectedYear && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            📅 <strong>Sélectionnez l'année</strong> de mise en circulation
          </p>
        </div>
      )}
      
      {selectedYear && !selectedModel && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            🚗 <strong>Choisissez le modèle</strong> de votre {selectedBrand.marque_name}
          </p>
        </div>
      )}
      
      {selectedModel && !selectedType && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            ⚙️ <strong>Sélectionnez la motorisation</strong> de votre {selectedBrand.marque_name} {selectedModel.modele_name}
          </p>
        </div>
      )}
      
      {selectedType && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 font-medium">
            ✅ Véhicule sélectionné : <strong>{selectedBrand.marque_name} {selectedModel.modele_name} {selectedType.type_name}</strong>
          </p>
        </div>
      )}

    </div>
  );
}
