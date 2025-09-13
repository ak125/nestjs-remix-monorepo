// 📁 frontend/app/components/home/VehicleSelector.tsx
// 🚗 Sélecteur de véhicule intelligent - Mode moderne uniquement

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

interface VehicleSelectorProps {
  brands?: VehicleBrand[];
  showMineSearch?: boolean;
  onVehicleSelect?: (selection: {
    brand?: VehicleBrand;
    model?: VehicleModel;
    type?: VehicleType;
    year?: number;
  }) => void;
  navigateOnSelect?: boolean;
}

export function VehicleSelector({ 
  brands = [], 
  showMineSearch = true,
  onVehicleSelect,
  navigateOnSelect = true
}: VehicleSelectorProps) {
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
    console.log('🚀 handleBrandChange appelé avec brandId:', brandId);
    alert(`DEBUG: handleBrandChange appelé avec brandId: ${brandId}`); // DEBUG visible
    const brand = brands.find(b => b.marque_id === brandId) || null;
    console.log('🎯 Marque trouvée:', brand);
    setSelectedBrand(brand);
    setSelectedYear(null);
    setSelectedModel(null);
    setSelectedType(null);
    setModels([]);
    setTypes([]);

    if (brand) {
      setLoadingYears(true);
      console.log('📅 Chargement des années pour marque:', brand.marque_name);
      try {
        const yearsData = await enhancedVehicleApi.getYearsByBrand(brand.marque_id);
        console.log('✅ Années reçues:', yearsData);
        console.log('✅ Type:', typeof yearsData, 'Length:', yearsData?.length);
        setYears(yearsData.sort((a, b) => b - a)); // Tri décroissant
        console.log('✅ Years state après setYears:', yearsData.sort((a, b) => b - a));
      } catch (error) {
        console.warn('❌ Erreur chargement années:', error);
        setYears([]);
      } finally {
        console.log('🔚 setLoadingYears(false) - fin du chargement');
        setLoadingYears(false);
      }
    } else {
      console.log('🚫 Aucune marque sélectionnée, réinitialisation years[]');
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
        // 🗓️ Filtrage côté backend en passant l'année sélectionnée
        const typesData = await enhancedVehicleApi.getTypes(model.modele_id, { year: selectedYear });
        setTypes(typesData);
        
        // Si aucune motorisation trouvée, afficher un message informatif
        if (typesData.length === 0) {
          console.warn(`Aucune motorisation trouvée pour ${model.modele_name} en ${selectedYear}`);
        }
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
    if (!typeSlug) {
      setSelectedType(null);
      return;
    }
    
    const type = types.find(t => t.type_slug === typeSlug || t.type_id.toString() === typeSlug);
    setSelectedType(type || null);
    
    // 🚀 Navigation vers notre page véhicule interne si toutes les données sont disponibles
    if (type && selectedBrand && selectedModel && navigateOnSelect) {
      const vehicleUrl = generateVehicleUrl(selectedBrand, selectedModel, type);
      console.log('🌐 Navigation vers page véhicule:', vehicleUrl);
      
      // Navigation interne avec Remix
      navigate(vehicleUrl);
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

  // 🎨 Mode moderne uniquement
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
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                handleBrandChange(parseInt(value));
              } else {
                // Réinitialisation quand "Sélectionner une marque" est choisi
                setSelectedBrand(null);
                setSelectedYear(null);
                setSelectedModel(null);
                setSelectedType(null);
                setYears([]);
                setModels([]);
                setTypes([]);
              }
            }}
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
              value={selectedType?.type_slug || selectedType?.type_id || ''}
              onChange={(e) => handleTypeSelect(e.target.value)}
              disabled={loadingTypes || types.length === 0}
              className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option key="default-type-modern" value="">
                {loadingTypes ? 'Chargement des motorisations...' : 'Sélectionner une motorisation'}
              </option>
              {types.map((type) => (
                <option key={type.type_id} value={type.type_slug || type.type_id}>
                  {type.type_name}
                  {type.type_fuel && ` (${type.type_fuel})`}
                  {type.type_power && ` - ${type.type_power}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 🎯 Actions et informations */}
      <div className="flex items-center justify-between mb-4">
        <Button
          onClick={handleReset}
          variant="outline"
          size="sm"
          className="text-gray-600 hover:text-gray-800"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Recommencer
        </Button>
        
        {selectedBrand && selectedYear && selectedModel && selectedType && (
          <div className="text-sm text-green-600 font-medium">
            ✅ Véhicule sélectionné
          </div>
        )}
      </div>

      {/* 📋 Résumé de la sélection */}
      {(selectedBrand || selectedYear || selectedModel || selectedType) && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Sélection actuelle :</h4>
          <div className="text-sm text-blue-800 space-y-1">
            {selectedBrand && <div>• Marque : <strong>{selectedBrand.marque_name}</strong></div>}
            {selectedYear && <div>• Année : <strong>{selectedYear}</strong></div>}
            {selectedModel && <div>• Modèle : <strong>{selectedModel.modele_name}</strong></div>}
            {selectedType && <div>• Motorisation : <strong>{selectedType.type_name}</strong></div>}
          </div>
        </div>
      )}

      {/* 🔍 Recherche par type MINE (optionnelle) */}
      {showMineSearch && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            <Search className="w-4 h-4 inline mr-2" />
            Recherche par type MINE
          </h4>
          <Form method="post" action="/search/mine" className="flex gap-2">
            <input
              type="text"
              name="mine"
              value={mineQuery}
              onChange={(e) => setMineQuery(e.target.value)}
              placeholder="Ex: M1XXXX"
              className="flex-1 p-3 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <Button type="submit" className="px-6">
              <Search className="w-4 h-4" />
            </Button>
          </Form>
        </div>
      )}
    </div>
  );
}