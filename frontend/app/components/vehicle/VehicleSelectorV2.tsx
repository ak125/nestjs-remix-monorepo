// 📁 frontend/app/components/vehicle/VehicleSelectorV2.tsx
// 🚗 VehicleSelector unifié - Un seul composant pour tous les besoins

import  { type VehicleBrand, type VehicleModel, type VehicleType } from "@monorepo/shared-types";
import { useNavigate } from '@remix-run/react';
import { Search, Car, Calendar, Settings, RotateCcw, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface VehicleSelectorV2Props {
  // 🎨 Mode d'affichage
  mode?: 'compact' | 'full';
  
  // 🔧 Fonctionnalités
  showVinSearch?: boolean;
  showRecommendation?: boolean;
  enableTypeMineSearch?: boolean;
  
  // 📞 Callbacks
  onVehicleSelect?: (vehicle: {
    brand: VehicleBrand;
    year: number;
    model: VehicleModel;
    type: VehicleType;
  }) => void;
  
  // 🧭 Navigation
  redirectOnSelect?: boolean;
  redirectTo?: 'vehicle-page' | 'search' | 'custom';
  customRedirectUrl?: (vehicle: any) => string;
  
  // 🎯 Présélection
  currentVehicle?: {
    brand?: { id: number; name: string };
    year?: number;
    model?: { id: number; name: string };
    type?: { id: number; name: string };
  };
  
  // 🎨 Style
  className?: string;
  variant?: 'default' | 'minimal' | 'card';
  
  // 🏷️ Contexte
  context?: 'homepage' | 'detail' | 'pieces' | 'search';
}

export default function VehicleSelectorV2({
  mode = 'full',
  showVinSearch: _showVinSearch = false,
  showRecommendation: _showRecommendation = false,
  enableTypeMineSearch = false,
  onVehicleSelect,
  redirectOnSelect = true,
  redirectTo = 'vehicle-page',
  customRedirectUrl,
  currentVehicle: _currentVehicle,
  className = '',
  variant = 'default',
  context = 'homepage'
}: VehicleSelectorV2Props) {
  
  // 📊 État unifié
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  
  const [selectedBrand, setSelectedBrand] = useState<VehicleBrand | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  
  const [_searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'vehicle' | 'mine'>('vehicle');
  const [mineCode, setMineCode] = useState('');
  
  const navigate = useNavigate();

  // 🚀 Chargement lazy des marques au premier focus (optimisation performance)
  useEffect(() => {
    // Ne charge pas au montage, attendre interaction utilisateur
    const handleFocus = () => {
      if (brands.length === 0 && !loadingBrands) {
        loadBrands();
      }
    };
    
    // Pré-charger si currentVehicle fourni
    if (_currentVehicle?.brand?.id) {
      loadBrands();
    }
    
    // Écouter focus sur le select marque pour lazy load
    const brandSelect = document.getElementById('brand-v2') || document.getElementById('brand');
    brandSelect?.addEventListener('focus', handleFocus, { once: true });
    
    return () => {
      brandSelect?.removeEventListener('focus', handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_currentVehicle]);

  const loadBrands = async () => {
    if (loadingBrands || brands.length > 0) return;
    
    setLoadingBrands(true);
    try {
      const brandsData = await enhancedVehicleApi.getBrands();
      setBrands(brandsData);
      console.log(`🏭 ${brandsData.length} marques chargées pour contexte: ${context}`);
      
      // 🎯 Pré-sélectionner la marque si fournie dans currentVehicle
      if (_currentVehicle?.brand?.id && brandsData.length > 0) {
        const preselectedBrand = brandsData.find(b => b.marque_id === _currentVehicle.brand!.id);
        if (preselectedBrand) {
          console.log(`🎯 Marque pré-sélectionnée: ${preselectedBrand.marque_name}`);
          setSelectedBrand(preselectedBrand);
          
          // Charger les années pour cette marque
          try {
            const yearsData = await enhancedVehicleApi.getYearsByBrand(preselectedBrand.marque_id);
            setYears(yearsData.sort((a, b) => b - a));
          } catch (error) {
            console.warn('❌ Erreur chargement années pour marque pré-sélectionnée:', error);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur chargement marques:', error);
      setBrands([]);
    } finally {
      setLoadingBrands(false);
    }
  };

  // 🏷️ Gestion sélection marque
  const handleBrandChange = async (brandId: number) => {
    console.log(`🚀 Sélection marque ${brandId} (contexte: ${context})`);
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

  // 📅 Gestion sélection année
  const handleYearChange = async (year: number) => {
    console.log(`📅 Sélection année ${year} (contexte: ${context})`);
    setSelectedYear(year);
    setSelectedModel(null);
    setSelectedType(null);
    setTypes([]);

    if (selectedBrand && year) {
      setLoadingModels(true);
      try {
        const modelsData = await enhancedVehicleApi.getModels(selectedBrand.marque_id, { 
          year, 
          page: 0, // 🔧 Backend uses zero-indexed pages
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

  // 🚗 Gestion sélection modèle
  const handleModelChange = async (modelId: number) => {
    console.log(`🚗 Sélection modèle ${modelId} (contexte: ${context})`);
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

  // ⚙️ Gestion sélection type avec navigation configurée
  const handleTypeSelect = (type: VehicleType) => {
    console.log('🎯 handleTypeSelect appelé avec:', {
      type: type?.type_name,
      brand: selectedBrand?.marque_name,
      year: selectedYear,
      model: selectedModel?.modele_name,
      redirectOnSelect,
      redirectTo
    });
    
    if (!selectedBrand || !selectedModel || !type) {
      console.log('🚫 Données incomplètes pour la navigation:', {
        brand: selectedBrand?.marque_name,
        model: selectedModel?.modele_name,
        type: type?.type_name
      });
      return;
    }
    
    setSelectedType(type);
    
    // 📞 Callback si fourni - toujours appeler même si redirectOnSelect est false
    if (selectedYear && onVehicleSelect) {
      console.log('📞 Appel du callback onVehicleSelect');
      onVehicleSelect({
        brand: selectedBrand,
        year: selectedYear,
        model: selectedModel,
        type
      });
    }
    
    // 🧭 Navigation selon configuration avec format alias-id
    if (redirectOnSelect) {
      console.log('🧭 redirectOnSelect activé, redirectTo:', redirectTo);
      let url = '';
      let brandSlug = '';
      let modelSlug = '';
      let typeSlug = '';
      
      switch (redirectTo) {
        case 'vehicle-page':
          // 🔧 Fonction helper pour créer un slug propre
          const createSlug = (name: string): string => {
            return name
              .toLowerCase()
              .normalize('NFD') // Normaliser les caractères accentués
              .replace(/[\u0300-\u036f]/g, '') // Retirer les accents
              .replace(/[^\w\s-]/g, '') // Garder uniquement lettres, chiffres, espaces et tirets
              .trim()
              .replace(/[\s_]+/g, '-') // Remplacer espaces et underscores par tirets
              .replace(/-+/g, '-') // Éviter plusieurs tirets consécutifs
              .replace(/^-+|-+$/g, ''); // Retirer tirets début/fin
          };
          
          // 🔧 Construire les slugs avec format alias-id requis par le loader
          // Gérer les cas où les alias sont vides ou manquants
          const brandAlias = selectedBrand.marque_alias && selectedBrand.marque_alias.trim() !== '' 
            ? selectedBrand.marque_alias 
            : createSlug(selectedBrand.marque_name);
          
          const modelAlias = selectedModel.modele_alias && selectedModel.modele_alias.trim() !== '' 
            ? selectedModel.modele_alias 
            : createSlug(selectedModel.modele_name);
          
          const typeAlias = (type.type_alias && type.type_alias.trim() !== '') 
            ? type.type_alias 
            : createSlug(type.type_name);
          
          brandSlug = `${brandAlias}-${selectedBrand.marque_id}`;
          modelSlug = `${modelAlias}-${selectedModel.modele_id}`;
          typeSlug = `${typeAlias}-${type.type_id}`;
          
          url = `/constructeurs/${brandSlug}/${modelSlug}/${typeSlug}.html`;
          break;
          
        case 'search':
          url = `/recherche?brand=${selectedBrand.marque_id}&model=${selectedModel.modele_id}&type=${type.type_id}`;
          break;
          
        case 'custom':
          url = customRedirectUrl ? customRedirectUrl({ brand: selectedBrand, model: selectedModel, type }) : '';
          break;
      }
      
      if (url && !url.includes('undefined') && !url.includes('--')) {
        console.log(`🌐 Navigation ${context} vers:`, url);
        console.log('🔍 Slugs générés:', {
          brand: brandSlug,
          model: modelSlug,
          type: typeSlug,
          originalData: {
            brandAlias: selectedBrand.marque_alias,
            modelAlias: selectedModel.modele_alias,
            typeAlias: type.type_alias
          }
        });
        
        // 🚀 Navigation client-side rapide via Remix (pas de rechargement complet)
        // Gain de 40-50% de performance en évitant le rechargement des assets JS/CSS
        console.log('🚀 Navigation client-side rapide');
        navigate(url);
      } else {
        console.error('🚫 Navigation annulée - URL invalide:', url);
        console.error('🔍 Données problématiques:', { 
          brand: selectedBrand, 
          model: selectedModel, 
          type 
        });
      }
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
    setSearchQuery('');
  };

  // 🔍 Handler recherche par Type Mine
  const handleMineSearch = () => {
    if (!mineCode || mineCode.length < 5) {
      return;
    }
    navigate(`/search/mine?code=${mineCode.toUpperCase()}`);
  };

  // 🎨 Styles adaptatifs selon variant
  const containerClass = `
    ${variant === 'card' ? 'bg-white rounded-xl shadow-lg p-6' : ''}
    ${variant === 'minimal' ? 'border rounded-lg p-4' : ''}
    ${className}
  `.trim();

  // 🎨 Mode compact (horizontal)
  if (mode === 'compact') {
    return (
      <div 
        className={`vehicle-selector-compact flex gap-4 items-center ${containerClass}`}
        data-nosnippet
        data-noindex
      >
        <Car className="w-5 h-5 text-blue-600" />
        
        {/* Marque */}
        <select
          value={selectedBrand?.marque_id || ''}
          onChange={(e) => handleBrandChange(Number(e.target.value))}
          className="flex-1 p-2 border rounded"
          aria-label="Sélectionner la marque"
        >
          <option value="">Marque</option>
          {brands.map(brand => (
            <option key={brand.marque_id} value={brand.marque_id}>
              {brand.marque_name}
            </option>
          ))}
        </select>

        {/* Année */}
        <select
          value={selectedYear || ''}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          disabled={!selectedBrand || loadingYears}
          className="p-2 border rounded"
          aria-label="Sélectionner l'année"
        >
          <option value="">Année</option>
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        {/* Modèle */}
        <select
          value={selectedModel?.modele_id || ''}
          onChange={(e) => handleModelChange(Number(e.target.value))}
          disabled={!selectedYear || loadingModels}
          className="flex-1 p-2 border rounded"
          aria-label="Sélectionner le modèle"
        >
          <option value="">Modèle</option>
          {models.map(model => (
            <option key={model.modele_id} value={model.modele_id}>
              {model.modele_name}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={selectedType?.type_id || ''}
          onChange={(e) => {
            const selectedType = types.find(t => t.type_id.toString() === e.target.value);
            if (selectedType) handleTypeSelect(selectedType);
          }}
          disabled={!selectedModel || loadingTypes}
          className="p-2 border rounded"
          aria-label="Sélectionner la motorisation"
        >
          <option value="">Motorisation</option>
          {types.map(type => (
            <option key={type.type_id} value={type.type_id}>
              {type.type_name}
            </option>
          ))}
        </select>

        <Button onClick={handleReset} variant="outline" size="sm" aria-label="Réinitialiser la sélection de véhicule">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // 🎨 Mode full (vertical) - Design moderne avec Card + onglets
  return (
    <Card 
      className={`bg-white/95 backdrop-blur-sm shadow-2xl border-0 ${className}`}
      data-nosnippet
      data-noindex
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 text-center flex items-center justify-center gap-2">
          <Car className="w-5 h-5 text-blue-600" />
          {context === 'homepage' && 'Sélectionnez votre véhicule'}
          {context === 'pieces' && 'Trouvez les pièces compatibles'}
          {context === 'detail' && 'Changer de véhicule'}
          {context === 'search' && 'Recherche par véhicule'}
          {!context && 'Sélectionnez votre véhicule'}
        </CardTitle>
        
        {/* Onglets de sélection du mode */}
        {enableTypeMineSearch && (
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
        )}
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Mode: Recherche par véhicule */}
          {searchMode === 'vehicle' && (
            <>
        {/* Grid des sélecteurs - 4 colonnes responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Constructeur */}
          <div>
            <label htmlFor="brand-v2" className="block text-sm font-medium text-gray-700 mb-2">
              <Car className="w-4 h-4 inline mr-1" />
              Marque
            </label>
            <select
              id="brand-v2"
              value={selectedBrand?.marque_id || ''} 
              onChange={(e) => handleBrandChange(Number(e.target.value))}
              onFocus={() => !brands.length && !loadingBrands && loadBrands()}
              disabled={loadingBrands}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">{loadingBrands ? 'Chargement...' : 'Constructeur'}</option>
              {brands.map(brand => (
                <option key={brand.marque_id} value={brand.marque_id}>
                  {brand.marque_name} {brand.is_featured ? '⭐' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Année */}
          <div>
            <label htmlFor="year-v2" className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Année
            </label>
            <select
              id="year-v2"
              value={selectedYear || ''} 
              onChange={(e) => handleYearChange(Number(e.target.value))}
              disabled={!selectedBrand || loadingYears}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">
                {loadingYears ? 'Chargement...' : 'Année'}
              </option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Modèle */}
          <div>
            <label htmlFor="model-v2" className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Modèle
            </label>
            <select
              id="model-v2"
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
            <label htmlFor="type-v2" className="block text-sm font-medium text-gray-700 mb-2">
              <Settings className="w-4 h-4 inline mr-1" />
              Motorisation
            </label>
            <select
              id="type-v2"
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
                  {type.type_name} ({type.type_fuel}) - {type.type_power_ps} PS
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Indicateur de chargement */}
        {(loadingBrands || loadingYears || loadingModels || loadingTypes) && (
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
          {searchMode === 'mine' && enableTypeMineSearch && (
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