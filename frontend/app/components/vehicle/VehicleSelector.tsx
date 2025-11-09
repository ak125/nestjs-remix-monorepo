// 📁 frontend/app/components/vehicle/VehicleSelector.tsx
// 🚗 VehicleSelector simplifié pour page principale

import { useNavigate } from '@remix-run/react';
import { Search, Car, Calendar, Settings, RotateCcw, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface VehicleSelectorProps {
  className?: string;
  onVehicleSelect?: (vehicle: any) => void;
}

export default function VehicleSelector({ 
  className = '',
  onVehicleSelect 
}: VehicleSelectorProps) {
  const navigate = useNavigate();
  
  // Mode de recherche : 'vehicle' ou 'mine'
  const [searchMode, setSearchMode] = useState<'vehicle' | 'mine'>('vehicle');
  
  // États pour recherche par véhicule
  const [brands, setBrands] = useState<any[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  
  const [selectedBrand, setSelectedBrand] = useState<any | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
  const [selectedType, setSelectedType] = useState<any | null>(null);
  
  // État pour recherche par type mine
  const [mineCode, setMineCode] = useState('');
  
  // États de chargement séparés pour chaque niveau
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // 🚀 Chargement initial des marques
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const brandsData = await enhancedVehicleApi.getBrands();
        setBrands(brandsData);
        console.log(`🏭 ${brandsData.length} marques chargées`);
      } catch (error) {
        console.error('❌ Erreur chargement marques:', error);
        setBrands([]);
      }
    };
    loadBrands();
  }, []);

  // 🏷️ Handler sélection marque
  const handleBrandChange = async (brandId: number) => {
    console.log(`🚀 Sélection marque ${brandId}`);
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
        setYears(yearsData.sort((a, b) => b - a));
      } catch (error) {
        console.warn('❌ Erreur chargement années:', error);
        setYears([]);
      } finally {
        setLoadingYears(false);
      }
    } else {
      setYears([]);
    }
  };

  // 📅 Handler sélection année
  const handleYearChange = async (year: number) => {
    console.log(`📅 Sélection année ${year}`);
    setSelectedYear(year);
    setSelectedModel(null);
    setSelectedType(null);
    setTypes([]);

    if (selectedBrand && year) {
      setLoadingModels(true);
      try {
        const modelsData = await enhancedVehicleApi.getModels(selectedBrand.marque_id, { 
          year, 
          page: 0, // Backend uses zero-indexed pages
          limit: 100 
        });
        setModels(modelsData);
      } catch (error) {
        console.warn('❌ Erreur chargement modèles:', error);
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    }
  };

  // 🚗 Handler sélection modèle
  const handleModelChange = async (modelId: number) => {
    console.log(`🚗 Sélection modèle ${modelId}`);
    const model = models.find(m => m.modele_id === modelId) || null;
    setSelectedModel(model);
    setSelectedType(null);

    if (model && selectedYear) {
      setLoadingTypes(true);
      try {
        const typesData = await enhancedVehicleApi.getTypes(model.modele_id, { year: selectedYear });
        setTypes(typesData);
      } catch (error) {
        console.warn('❌ Erreur chargement types:', error);
        setTypes([]);
      } finally {
        setLoadingTypes(false);
      }
    }
  };

  // ⚙️ Handler sélection type avec navigation
  const handleTypeSelect = (type: any) => {
    console.log('🎯 handleTypeSelect appelé avec:', {
      type: type?.type_name,
      brand: selectedBrand?.marque_name,
      year: selectedYear,
      model: selectedModel?.modele_name
    });
    
    if (!selectedBrand || !selectedModel || !type) {
      console.log('🚫 Données incomplètes pour la navigation');
      return;
    }
    
    setSelectedType(type);
    
    // 📞 Callback si fourni
    if (selectedYear && onVehicleSelect) {
      console.log('📞 Appel du callback onVehicleSelect');
      onVehicleSelect({
        brand: selectedBrand,
        year: selectedYear,
        model: selectedModel,
        type
      });
    }
    
    // 🔧 Fonction helper pour créer un slug propre
    const createSlug = (name: string): string => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    };
    
    // 🔧 Construire les slugs avec format alias-id
    const brandAlias = selectedBrand.marque_alias && selectedBrand.marque_alias.trim() !== '' 
      ? selectedBrand.marque_alias 
      : createSlug(selectedBrand.marque_name);
    
    const modelAlias = selectedModel.modele_alias && selectedModel.modele_alias.trim() !== '' 
      ? selectedModel.modele_alias 
      : createSlug(selectedModel.modele_name);
    
    const typeAlias = (type.type_alias && type.type_alias.trim() !== '') 
      ? type.type_alias 
      : createSlug(type.type_name);
    
    const brandSlug = `${brandAlias}-${selectedBrand.marque_id}`;
    const modelSlug = `${modelAlias}-${selectedModel.modele_id}`;
    const typeSlug = `${typeAlias}-${type.type_id}`;
    
    const url = `/constructeurs/${brandSlug}/${modelSlug}/${typeSlug}.html`;
    
    if (url && !url.includes('undefined') && !url.includes('--')) {
      console.log('🌐 Navigation vers:', url);
      console.log('🔍 Slugs générés:', { brand: brandSlug, model: modelSlug, type: typeSlug });
      
      // 🔄 Forcer un rechargement complet via window.location.href
      console.log('🔄 Rechargement complet de la page via window.location.href');
      window.location.href = url;
    } else {
      console.error('🚫 Navigation annulée - URL invalide:', url);
    }
  };

  // 🧹 Reset complet
  const handleReset = () => {
    setSelectedBrand(null);
    setSelectedYear(null);
    setSelectedModel(null);
    setSelectedType(null);
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
                value={selectedBrand?.marque_id || ''}
                onChange={(e) => handleBrandChange(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                <option value="">Marque</option>
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
                onChange={(e) => handleYearChange(Number(e.target.value))}
                disabled={!selectedBrand || loadingYears}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {loadingYears ? 'Chargement...' : 'Année'}
                </option>
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
                value={selectedModel?.modele_id || ''}
                onChange={(e) => handleModelChange(Number(e.target.value))}
                disabled={!selectedYear || loadingModels}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {loadingModels ? 'Chargement...' : 'Modèle'}
                </option>
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
                value={selectedType?.type_id || ''}
                onChange={(e) => {
                  const selectedType = types.find(t => t.type_id.toString() === e.target.value);
                  if (selectedType) handleTypeSelect(selectedType);
                }}
                disabled={!selectedModel || loadingTypes}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {loadingTypes ? 'Chargement...' : 'Motorisation'}
                </option>
                {types.map(type => (
                  <option key={type.type_id} value={type.type_id}>
                    {type.type_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Indicateur de chargement */}
          {(loadingYears || loadingModels || loadingTypes) && (
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
