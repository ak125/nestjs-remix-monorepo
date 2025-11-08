// 📁 frontend/app/components/vehicle/VehicleSelectorTest.tsx
// 🚗 VehicleSelector simplifié pour page de test

import { useNavigate } from '@remix-run/react';
import { Search, Car, Calendar, Settings, RotateCcw, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface VehicleSelectorTestProps {
  className?: string;
  onVehicleSelect?: (vehicle: any) => void;
}

export default function VehicleSelectorTest({ 
  className = '',
  onVehicleSelect 
}: VehicleSelectorTestProps) {
  const navigate = useNavigate();
  
  // Mode de recherche : 'vehicle' ou 'mine'
  const [searchMode, setSearchMode] = useState<'vehicle' | 'mine'>('vehicle');
  
  // États pour recherche par véhicule
  const [brands, setBrands] = useState<any[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  
  // État pour recherche par type mine
  const [mineCode, setMineCode] = useState('');
  
  const [loading, setLoading] = useState(false);

  // Charger les marques au montage
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const data = await enhancedVehicleApi.getBrands();
        setBrands(data);
      } catch (error) {
        console.error('Erreur chargement marques:', error);
      }
    };
    loadBrands();
  }, []);

  // Charger les années quand une marque est sélectionnée
  useEffect(() => {
    if (!selectedBrandId) {
      setYears([]);
      setSelectedYear(null);
      return;
    }

    const loadYears = async () => {
      try {
        setLoading(true);
        const data = await enhancedVehicleApi.getYearsByBrand(selectedBrandId);
        setYears(data);
      } catch (error) {
        console.error('Erreur chargement années:', error);
        setYears([]);
      } finally {
        setLoading(false);
      }
    };
    loadYears();
  }, [selectedBrandId]);

  // Charger les modèles quand marque + année sont sélectionnés
  useEffect(() => {
    if (!selectedBrandId || !selectedYear) {
      setModels([]);
      setSelectedModelId(null);
      return;
    }

    const loadModels = async () => {
      try {
        setLoading(true);
        const data = await enhancedVehicleApi.getModels(selectedBrandId, { 
          year: selectedYear,
          page: 1,
          limit: 1000
        });
        setModels(data);
      } catch (error) {
        console.error('Erreur chargement modèles:', error);
        setModels([]);
      } finally {
        setLoading(false);
      }
    };
    loadModels();
  }, [selectedBrandId, selectedYear]);

  // Charger les types/motorisations quand marque + année + modèle sont sélectionnés
  useEffect(() => {
    if (!selectedBrandId || !selectedYear || !selectedModelId) {
      setTypes([]);
      setSelectedTypeId(null);
      return;
    }

    const loadTypes = async () => {
      try {
        setLoading(true);
        const data = await enhancedVehicleApi.getTypes(selectedModelId, {
          year: selectedYear,
          page: 1,
          limit: 1000
        });
        setTypes(data);
      } catch (error) {
        console.error('Erreur chargement motorisations:', error);
        setTypes([]);
      } finally {
        setLoading(false);
      }
    };
    loadTypes();
  }, [selectedBrandId, selectedYear, selectedModelId]);

  // Handler de sélection de marque
  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const brandId = e.target.value ? parseInt(e.target.value) : null;
    setSelectedBrandId(brandId);
    setSelectedYear(null);
    setSelectedModelId(null);
    setSelectedTypeId(null);
    setModels([]);
    setTypes([]);
  };

  // Handler de sélection d'année
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = e.target.value ? parseInt(e.target.value) : null;
    setSelectedYear(year);
    setSelectedModelId(null);
    setSelectedTypeId(null);
    setTypes([]);
  };

  // Handler de sélection de modèle
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value ? parseInt(e.target.value) : null;
    setSelectedModelId(modelId);
    setSelectedTypeId(null);
  };

  // Handler de sélection de motorisation
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const typeId = e.target.value ? parseInt(e.target.value) : null;
    setSelectedTypeId(typeId);
  };

  // Handler de recherche
  const handleSearch = () => {
    if (!selectedTypeId) {
      return;
    }

    const selectedBrand = brands.find(b => b.marque_id === selectedBrandId);
    const selectedModel = models.find(m => m.modele_id === selectedModelId);
    const selectedType = types.find(t => t.type_id === selectedTypeId);

    if (!selectedBrand || !selectedModel || !selectedType) {
      return;
    }

    const vehicle = {
      brand: selectedBrand,
      year: selectedYear,
      model: selectedModel,
      type: selectedType
    };

    // Callback si fourni
    if (onVehicleSelect) {
      onVehicleSelect(vehicle);
    }

    // Navigation vers la page véhicule
    const url = `/pieces/${selectedBrand.marque_alias}-${selectedModel.modele_alias}-${selectedYear}-${selectedType.type_alias}-${selectedTypeId}.html`;
    navigate(url);
  };

  // Handler de réinitialisation
  const handleReset = () => {
    setSelectedBrandId(null);
    setSelectedYear(null);
    setSelectedModelId(null);
    setSelectedTypeId(null);
    setYears([]);
    setModels([]);
    setTypes([]);
  };

  // Handler recherche par Type Mine
  const handleMineSearch = () => {
    if (!mineCode || mineCode.length < 5) {
      return;
    }
    navigate(`/search/mine?code=${mineCode.toUpperCase()}`);
  };

  return (
    <Card className={`bg-white/95 backdrop-blur-sm shadow-2xl border-0 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 text-center flex items-center justify-center gap-2">
          <Car className="w-5 h-5 text-blue-600" />
          Sélectionnez votre véhicule
        </CardTitle>
        
        {/* Onglets de sélection du mode */}
        <div className="flex gap-2 mt-4 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setSearchMode('vehicle')}
            className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              searchMode === 'vehicle'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Car className="w-4 h-4 inline mr-2" />
            Par véhicule
          </button>
          <button
            onClick={() => setSearchMode('mine')}
            className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              searchMode === 'mine'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Type Mine
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Mode: Recherche par véhicule */}
          {searchMode === 'vehicle' && (
            <>
          {/* Grid des sélecteurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Constructeur */}
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-2">
                <Car className="w-4 h-4 inline mr-1" />
                Constructeur
              </label>
              <select
                id="brand"
                value={selectedBrandId || ''}
                onChange={handleBrandChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                <option value="">Choisir...</option>
                {brands.map(brand => (
                  <option key={brand.marque_id} value={brand.marque_id}>
                    {brand.marque_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Année */}
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Année
              </label>
              <select
                id="year"
                value={selectedYear || ''}
                onChange={handleYearChange}
                disabled={!selectedBrandId || loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Année</option>
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Modèle */}
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Modèle
              </label>
              <select
                id="model"
                value={selectedModelId || ''}
                onChange={handleModelChange}
                disabled={!selectedYear || loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Modèle</option>
                {models.map(model => (
                  <option key={model.modele_id} value={model.modele_id}>
                    {model.modele_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Motorisation */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                <Settings className="w-4 h-4 inline mr-1" />
                Motorisation
              </label>
              <select
                id="type"
                value={selectedTypeId || ''}
                onChange={handleTypeChange}
                disabled={!selectedModelId || loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Motorisation</option>
                {types.map(type => (
                  <option key={type.type_id} value={type.type_id}>
                    {type.type_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleSearch}
              disabled={!selectedTypeId || loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Search className="w-5 h-5 mr-2" />
              Rechercher mes pièces
            </Button>
            
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={!selectedBrandId}
              className="sm:w-auto border-2 border-gray-300 hover:bg-gray-50 py-6"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Réinitialiser
            </Button>
          </div>

          {/* Indicateur de chargement */}
          {loading && (
            <div className="text-center py-2">
              <div className="inline-flex items-center gap-2 text-sm text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                Chargement...
              </div>
            </div>
          )}
            </>
          )}

          {/* Mode: Recherche par Type Mine */}
          {searchMode === 'mine' && (
            <div className="space-y-4">
              {/* Aide */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-900">
                    <p className="font-medium mb-1">Le Type Mine se trouve sur votre carte grise</p>
                    <p className="text-purple-700">Champ D.2 • Format : 10 à 15 caractères alphanumériques</p>
                    <p className="text-purple-600 mt-2 font-mono text-xs">Exemple : M10RENAAG0D001</p>
                  </div>
                </div>
              </div>

              {/* Input Type Mine */}
              <div>
                <label htmlFor="mineCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Code Type Mine
                </label>
                <input
                  id="mineCode"
                  type="text"
                  value={mineCode}
                  onChange={(e) => setMineCode(e.target.value.toUpperCase())}
                  placeholder="Ex: M10RENAAG0D001"
                  maxLength={20}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white font-mono uppercase"
                />
                {mineCode && mineCode.length < 5 && (
                  <p className="text-xs text-red-600 mt-1">Minimum 5 caractères requis</p>
                )}
              </div>

              {/* Bouton recherche */}
              <Button
                onClick={handleMineSearch}
                disabled={!mineCode || mineCode.length < 5}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-6 text-lg font-semibold disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed"
              >
                <Search className="w-5 h-5 mr-2" />
                Rechercher par Type Mine
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
