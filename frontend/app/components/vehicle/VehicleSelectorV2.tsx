// 📁 frontend/app/components/vehicle/VehicleSelectorV2.tsx
// 🚗 VehicleSelector unifié - Un seul composant pour tous les besoins

import { Form, useNavigate } from '@remix-run/react';
import { Search, Car, Calendar, Fuel, Settings, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";
import type { VehicleBrand, VehicleModel, VehicleType } from "@monorepo/shared-types";
import { Button } from "../ui/button";

interface VehicleSelectorV2Props {
  // 🎨 Mode d'affichage
  mode?: 'compact' | 'full';
  
  // 🔧 Fonctionnalités
  showVinSearch?: boolean;
  showRecommendation?: boolean;
  
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
  showVinSearch = false,
  showRecommendation: _showRecommendation = false,
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
  
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const navigate = useNavigate();

  // 🚀 Chargement initial des marques
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const brandsData = await enhancedVehicleApi.getBrands();
        setBrands(brandsData);
        console.log(`🏭 ${brandsData.length} marques chargées pour contexte: ${context}`);
      } catch (error) {
        console.error('❌ Erreur chargement marques:', error);
        setBrands([]);
      }
    };

    loadBrands();
  }, [context]);

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
        const modelsData = await enhancedVehicleApi.getModels(selectedBrand.marque_id, { year });
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
      onVehicleSelect({
        brand: selectedBrand,
        year: selectedYear,
        model: selectedModel,
        type
      });
    }
    
    // 🧭 Navigation selon configuration avec format alias-id
    if (redirectOnSelect) {
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

  // 🎨 Styles adaptatifs selon variant
  const containerClass = `
    ${variant === 'card' ? 'bg-white rounded-xl shadow-lg p-6' : ''}
    ${variant === 'minimal' ? 'border rounded-lg p-4' : ''}
    ${className}
  `.trim();

  // 🎨 Mode compact (horizontal)
  if (mode === 'compact') {
    return (
      <div className={`vehicle-selector-compact flex gap-4 items-center ${containerClass}`}>
        <Car className="w-5 h-5 text-blue-600" />
        
        {/* Marque */}
        <select 
          value={selectedBrand?.marque_id || ''} 
          onChange={(e) => handleBrandChange(Number(e.target.value))}
          className="flex-1 p-2 border rounded"
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
        >
          <option value="">Motorisation</option>
          {types.map(type => (
            <option key={type.type_id} value={type.type_id}>
              {type.type_name}
            </option>
          ))}
        </select>

        <Button onClick={handleReset} variant="outline" size="sm">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // 🎨 Mode full (vertical) - reprendre la logique de VehicleSelectorUnified
  return (
    <div className={`vehicle-selector-full ${containerClass}`}>
      <div className="space-y-6">
        {/* Header adaptatif selon contexte */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {context === 'homepage' && '🚗 Sélectionnez votre véhicule'}
            {context === 'pieces' && '🔧 Trouvez les pièces compatibles'}
            {context === 'detail' && '🚗 Changer de véhicule'}
            {context === 'search' && '🔍 Recherche par véhicule'}
          </h3>
          <p className="text-gray-600">
            Sélecteur véhicule intelligent pour une compatibilité parfaite
          </p>
        </div>

        {/* Grid des sélecteurs */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Marque */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              <Car className="w-4 h-4 inline mr-2" />
              Marque automobile
            </label>
            <select 
              value={selectedBrand?.marque_id || ''} 
              onChange={(e) => handleBrandChange(Number(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Sélectionnez une marque</option>
              {brands.map(brand => (
                <option key={brand.marque_id} value={brand.marque_id}>
                  {brand.marque_name} {brand.is_featured ? '⭐' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Année */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              <Calendar className="w-4 h-4 inline mr-2" />
              Année de fabrication
            </label>
            <select 
              value={selectedYear || ''} 
              onChange={(e) => handleYearChange(Number(e.target.value))}
              disabled={!selectedBrand || loadingYears}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
            >
              <option value="">
                {loadingYears ? 'Chargement...' : 'Sélectionnez une année'}
              </option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Modèle */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              <Settings className="w-4 h-4 inline mr-2" />
              Modèle {selectedBrand?.marque_name}
            </label>
            <select 
              value={selectedModel?.modele_id || ''} 
              onChange={(e) => handleModelChange(Number(e.target.value))}
              disabled={!selectedYear || loadingModels}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
            >
              <option value="">
                {loadingModels ? 'Chargement...' : 'Sélectionnez un modèle'}
              </option>
              {models.map(model => (
                <option key={model.modele_id} value={model.modele_id}>
                  {model.modele_name}
                </option>
              ))}
            </select>
          </div>

          {/* Motorisation */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              <Fuel className="w-4 h-4 inline mr-2" />
              Motorisation
            </label>
            <select 
              value={selectedType?.type_id || ''} 
              onChange={(e) => {
                const selectedType = types.find(t => t.type_id.toString() === e.target.value);
                if (selectedType) handleTypeSelect(selectedType);
              }}
              disabled={!selectedModel || loadingTypes}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
            >
              <option value="">
                {loadingTypes ? 'Chargement...' : 'Sélectionnez une motorisation'}
              </option>
              {types.map(type => (
                <option key={type.type_id} value={type.type_id}>
                  {type.type_name} ({type.type_fuel}) - {type.type_power_ps} PS
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset button */}
        <div className="text-center">
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Recommencer
          </Button>
        </div>

        {/* Recherche VIN (optionnelle) */}
        {showVinSearch && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              <Search className="w-4 h-4 inline mr-2" />
              Recherche par VIN ou nom de véhicule
            </h4>
            <Form method="post" action="/search/vehicle" className="flex gap-2">
              <input
                type="text"
                name="query"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Saisissez votre VIN ou le nom du véhicule..."
                className="flex-1 p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <Button type="submit" className="px-6">
                <Search className="w-4 h-4" />
              </Button>
            </Form>
          </div>
        )}

        {/* Résultat sélection */}
        {selectedType && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <h4 className="text-green-800 font-medium mb-2">✅ Véhicule sélectionné</h4>
            <div className="text-sm text-green-700">
              <p>• Marque : {selectedBrand?.marque_name}</p>
              <p>• Année : {selectedYear}</p>
              <p>• Modèle : {selectedModel?.modele_name}</p>
              <p>• Motorisation : {selectedType.type_name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}