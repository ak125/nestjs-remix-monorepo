// 📁 frontend/app/components/home/VehicleSelector.tsx
// 🚗 Sélecteur de véhicule intelligent

import { useState, useEffect } from 'react';
import { Search, Car, Calendar, Fuel, Settings } from 'lucide-react';
import { Button } from "~/components/ui/button";
import type { VehicleBrand, VehicleModel, VehicleType } from "~/services/api/enhanced-vehicle.api";
import { enhancedVehicleApi } from "~/services/api/enhanced-vehicle.api";

interface VehicleSelectorProps {
  brands: VehicleBrand[];
  onVehicleSelect?: (selection: {
    brand?: VehicleBrand;
    model?: VehicleModel;
    type?: VehicleType;
  }) => void;
}

export function VehicleSelector({ brands, onVehicleSelect }: VehicleSelectorProps) {
  const [selectedBrand, setSelectedBrand] = useState<VehicleBrand | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [years, setYears] = useState<number[]>([]);
  
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Charger les modèles quand une marque est sélectionnée
  useEffect(() => {
    if (selectedBrand) {
      setLoadingModels(true);
      setSelectedModel(null);
      setSelectedType(null);
      setTypes([]);
      
      Promise.all([
        enhancedVehicleApi.getModels(selectedBrand.marque_id),
        enhancedVehicleApi.getYearsByBrand(selectedBrand.marque_id)
      ]).then(([modelsData, yearsData]) => {
        setModels(modelsData);
        setYears(yearsData);
        setLoadingModels(false);
      }).catch(() => {
        setModels([]);
        setYears([]);
        setLoadingModels(false);
      });
    } else {
      setModels([]);
      setYears([]);
    }
  }, [selectedBrand]);

  // Charger les types quand un modèle est sélectionné
  useEffect(() => {
    if (selectedModel) {
      setLoadingTypes(true);
      setSelectedType(null);
      
      enhancedVehicleApi.getTypes(selectedModel.modele_id).then((typesData) => {
        setTypes(typesData);
        setLoadingTypes(false);
      }).catch(() => {
        setTypes([]);
        setLoadingTypes(false);
      });
    } else {
      setTypes([]);
    }
  }, [selectedModel]);

  // Notifier la sélection
  useEffect(() => {
    if (onVehicleSelect) {
      onVehicleSelect({
        brand: selectedBrand || undefined,
        model: selectedModel || undefined,
        type: selectedType || undefined,
      });
    }
  }, [selectedBrand, selectedModel, selectedType, onVehicleSelect]);

  const handleSearch = () => {
    if (selectedBrand || searchQuery) {
      const params = new URLSearchParams();
      if (selectedBrand) params.append('brand', selectedBrand.marque_id.toString());
      if (selectedModel) params.append('model', selectedModel.modele_id.toString());
      if (selectedType) params.append('type', selectedType.type_id.toString());
      if (searchQuery) params.append('search', searchQuery);
      
      // Redirection vers la page de recherche
      window.location.href = `/catalogue?${params.toString()}`;
    }
  };

  const resetSelection = () => {
    setSelectedBrand(null);
    setSelectedModel(null);
    setSelectedType(null);
    setSearchQuery('');
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-200">
      {/* 🎯 En-tête */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
          <Car className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-gray-800 text-lg font-semibold">Sélecteur véhicule intelligent</h3>
          <p className="text-gray-600 text-sm">Trouvez les pièces parfaitement compatibles</p>
        </div>
      </div>

      {/* 📋 Sélection progressive */}
      <div className="space-y-4 mb-6">
        {/* 🏷️ Sélection marque */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Car className="w-4 h-4 inline mr-2" />
            Marque automobile
          </label>
          <select
            value={selectedBrand?.marque_id || ''}
            onChange={(e) => {
              const brandId = parseInt(e.target.value);
              const brand = brands.find(b => b.marque_id === brandId);
              setSelectedBrand(brand || null);
            }}
            className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">Sélectionner une marque</option>
            {brands.map((brand) => (
              <option key={brand.marque_id} value={brand.marque_id}>
                {brand.marque_name}
                {brand.products_count && ` (${brand.products_count} pièces)`}
              </option>
            ))}
          </select>
        </div>

        {/* 🚙 Sélection modèle */}
        {selectedBrand && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Settings className="w-4 h-4 inline mr-2" />
              Modèle {selectedBrand.marque_name}
            </label>
            <select
              value={selectedModel?.modele_id || ''}
              onChange={(e) => {
                const modelId = parseInt(e.target.value);
                const model = models.find(m => m.modele_id === modelId);
                setSelectedModel(model || null);
              }}
              disabled={loadingModels || models.length === 0}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
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

        {/* ⚙️ Sélection type/motorisation */}
        {selectedModel && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Fuel className="w-4 h-4 inline mr-2" />
              Motorisation
            </label>
            <select
              value={selectedType?.type_id || ''}
              onChange={(e) => {
                const typeId = parseInt(e.target.value);
                const type = types.find(t => t.type_id === typeId);
                setSelectedType(type || null);
              }}
              disabled={loadingTypes || types.length === 0}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingTypes ? 'Chargement des motorisations...' : 'Sélectionner une motorisation'}
              </option>
              {types.map((type) => (
                <option key={type.type_id} value={type.type_id}>
                  {type.type_name}
                  {type.type_fuel && ` - ${type.type_fuel}`}
                  {type.type_power && ` (${type.type_power})`}
                </option>
              ))}
            </select>
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
      {(selectedBrand || selectedModel || selectedType) && (
        <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">Véhicule sélectionné :</h4>
          <div className="text-blue-800 space-y-1 text-sm">
            {selectedBrand && <div>• Marque : <strong>{selectedBrand.marque_name}</strong></div>}
            {selectedModel && <div>• Modèle : <strong>{selectedModel.modele_name}</strong></div>}
            {selectedType && <div>• Motorisation : <strong>{selectedType.type_name}</strong></div>}
            {years.length > 0 && (
              <div>• Années disponibles : <strong>{Math.min(...years)} - {Math.max(...years)}</strong></div>
            )}
          </div>
        </div>
      )}

      {/* 🎯 Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSearch}
          disabled={!selectedBrand && !searchQuery}
          className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          <Search className="w-5 h-5 mr-2" />
          Rechercher des pièces
        </Button>
        
        {(selectedBrand || selectedModel || selectedType || searchQuery) && (
          <Button
            onClick={resetSelection}
            variant="outline"
            className="px-4 py-3 rounded-xl border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50 transition-all"
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {/* 📈 Statistiques rapides */}
      {years.length > 0 && (
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