import { useNavigate } from '@remix-run/react';
import { Search, Car, Calendar, Fuel, Settings, RotateCcw, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";
import { Button } from "../ui/button";
import { Spinner } from '../ui/spinner';

interface VehicleBrand {
  marque_id: number;
  marque_name: string;
  marque_alias?: string;
  is_featured?: boolean;
}

interface VehicleModel {
  modele_id: number;
  modele_name: string;
}

interface VehicleType {
  type_id: number;
  type_name: string;
  type_fuel?: string;
  type_power?: string;
}

interface VehicleSelectorGammeProps {
  brands?: VehicleBrand[];
  compact?: boolean;
  onVehicleSelected?: (selection: {
    brand?: VehicleBrand;
    model?: VehicleModel;
    type?: VehicleType;
    year?: number;
  }) => void;
  className?: string;
  currentGamme?: {
    name: string;
    id: number;
  };
}

// Composant Select stylisé avec gestion du chargement
function StyledSelect({
  icon: Icon,
  label,
  value,
  onChange,
  disabled,
  loading,
  options,
  placeholder
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled: boolean;
  loading: boolean;
  options: { key: string | number; value: string | number; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <Icon className="w-4 h-4 inline mr-2 text-gray-500" />
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled || loading}
          className="w-full appearance-none p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">{loading ? 'Chargement...' : placeholder}</option>
          {options.map(opt => (
            <option key={opt.key} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          {loading ? (
            <Spinner className="w-5 h-5 text-blue-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function VehicleSelectorGamme({
  brands: propBrands,
  compact = false,
  onVehicleSelected,
  className = "",
  currentGamme
}: VehicleSelectorGammeProps) {
  const navigate = useNavigate();
  
  const [brands, setBrands] = useState<VehicleBrand[]>(propBrands || []);
  const [selectedBrand, setSelectedBrand] = useState<VehicleBrand | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  
  const [years, setYears] = useState<number[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);

  useEffect(() => {
    if (!propBrands) {
      loadBrands();
    }
  }, [propBrands]);

  const loadBrands = async () => {
    try {
      const brandsData = await enhancedVehicleApi.getBrands();
      setBrands(brandsData);
    } catch (error) {
      console.error('Erreur chargement marques:', error);
    }
  };

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
        setYears(yearsData.sort((a, b) => b - a));
      } catch (error) {
        console.warn('Erreur chargement années:', error);
        setYears([]);
      } finally {
        setLoadingYears(false);
      }
    }
  };

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    setSelectedModel(null);
    setSelectedType(null);
    setTypes([]);

    if (selectedBrand && year) {
      setLoadingModels(true);
      try {
        // FIX: Utiliser getModels avec l'année
        const modelsData = await enhancedVehicleApi.getModels(selectedBrand.marque_id, {
          year: year,
          limit: 100
        });
        console.log('🔧 Modèles récupérés avec année:', modelsData);
        setModels(modelsData);
      } catch (error) {
        console.warn('Erreur chargement modèles:', error);
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    }
  };

  const handleModelChange = async (modelId: number) => {
    const model = models.find(m => m.modele_id === modelId) || null;
    setSelectedModel(model);
    setSelectedType(null);

    if (model) {
      setLoadingTypes(true);
      try {
        // FIX: Utiliser getTypes pour récupérer les motorisations du modèle
        const typesData = await enhancedVehicleApi.getTypes(model.modele_id, {
          year: selectedYear || undefined,
          limit: 50
        });
        console.log('🔧 Motorisations récupérées pour modèle:', model.modele_name, typesData);
        setTypes(typesData);
      } catch (error) {
        console.warn('Erreur chargement types:', error);
        setTypes([]);
      } finally {
        setLoadingTypes(false);
      }
    }
  };

  const handleTypeChange = (typeId: number) => {
    const type = types.find(t => t.type_id === typeId) || null;
    setSelectedType(type);

    if (type && selectedBrand && selectedModel) {
      const brandSlug = selectedBrand.marque_name.toLowerCase().replace(/\s+/g, '-');
      const modelSlug = selectedModel.modele_name.toLowerCase().replace(/\s+/g, '-');
      const typeSlug = type.type_name.toLowerCase().replace(/\s+/g, '-');
      
      const vehicleUrl = `/gammes/${brandSlug}-${modelSlug}-${typeSlug}`;
      navigate(vehicleUrl);
    }
  };

  const handleReset = () => {
    setSelectedBrand(null);
    setSelectedYear(null);
    setSelectedModel(null);
    setSelectedType(null);
    setYears([]);
    setModels([]);
    setTypes([]);
  };

  useEffect(() => {
    if (onVehicleSelected) {
      onVehicleSelected({
        brand: selectedBrand || undefined,
        model: selectedModel || undefined,
        type: selectedType || undefined,
        year: selectedYear || undefined,
      });
    }
  }, [selectedBrand, selectedYear, selectedModel, selectedType, onVehicleSelected]);

  if (compact) {
    return (
      <div className={`bg-white rounded-lg p-4 shadow-md border border-gray-200 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Car className="w-5 h-5 text-blue-600" />
          <h4 className="font-medium text-gray-800">Trouvez vos gammes</h4>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <select
            value={selectedBrand?.marque_id || ''}
            onChange={(e) => handleBrandChange(parseInt(e.target.value))}
            className="p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">Marque</option>
            {brands.map((brand) => (
              <option key={brand.marque_id} value={brand.marque_id}>
                {brand.marque_name}
              </option>
            ))}
          </select>
          
          <select
            value={selectedYear || ''}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            disabled={!selectedBrand || loadingYears}
            className="p-2 border border-gray-300 rounded text-sm disabled:bg-gray-100"
          >
            <option value="">Année</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 shadow-lg border border-blue-200 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-gray-800 text-lg font-semibold">Recherche par véhicule</h3>
            <p className="text-gray-600 text-sm">
              {currentGamme ? (
                <>Trouvez des <strong>{currentGamme.name}</strong> pour votre véhicule</>
              ) : (
                'Trouvez les gammes compatibles avec votre véhicule'
              )}
            </p>
          </div>
        </div>
        
        {(selectedBrand || selectedYear || selectedModel || selectedType) && (
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className="text-gray-600 hover:text-gray-800"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <StyledSelect
          icon={Car}
          label="Marque automobile"
          value={selectedBrand?.marque_id || ''}
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              handleBrandChange(parseInt(value));
            } else {
              handleReset();
            }
          }}
          disabled={false}
          loading={!propBrands && brands.length === 0}
          options={brands.map(b => ({ key: b.marque_id, value: b.marque_id, label: `${b.marque_name}${b.is_featured ? ' ⭐' : ''}` }))}
          placeholder="Sélectionner une marque"
        />

        {selectedBrand && (
          <StyledSelect
            icon={Calendar}
            label="Année de fabrication"
            value={selectedYear || ''}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            disabled={loadingYears || years.length === 0}
            loading={loadingYears}
            options={years.map(y => ({ key: y, value: y, label: y.toString() }))}
            placeholder="Sélectionner une année"
          />
        )}

        {selectedBrand && selectedYear && (
          <StyledSelect
            icon={Settings}
            label="Modèle"
            value={selectedModel?.modele_id || ''}
            onChange={(e) => handleModelChange(parseInt(e.target.value))}
            disabled={loadingModels || models.length === 0}
            loading={loadingModels}
            options={models.map(m => ({ key: m.modele_id, value: m.modele_id, label: m.modele_name }))}
            placeholder="Sélectionner un modèle"
          />
        )}

        {selectedBrand && selectedYear && selectedModel && (
          <StyledSelect
            icon={Fuel}
            label="Motorisation"
            value={selectedType?.type_id || ''}
            onChange={(e) => handleTypeChange(parseInt(e.target.value))}
            disabled={loadingTypes || types.length === 0}
            loading={loadingTypes}
            options={types.map(t => ({ 
              key: t.type_id, 
              value: t.type_id, 
              label: `${t.type_name}${t.type_fuel ? ` - ${t.type_fuel}` : ''}${t.type_power ? ` (${t.type_power})` : ''}` 
            }))}
            placeholder="Sélectionner une motorisation"
          />
        )}

        {selectedBrand && selectedYear && selectedModel && selectedType && (
          <div className="pt-4 border-t border-blue-200">
            <Button
              onClick={() => handleTypeChange(selectedType!.type_id)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
            >
              <Search className="w-4 h-4 mr-2" />
              Voir les gammes compatibles
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
