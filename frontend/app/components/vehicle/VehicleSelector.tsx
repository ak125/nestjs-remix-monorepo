// 📁 frontend/app/components/home/VehicleSelector.tsx
// 🚗 Sélecteur de véhicule intelligent - Mode moderne uniquement

import { Form, useNavigate } from '@remix-run/react';
import { Search, Car, Calendar, Fuel, Settings, RotateCcw, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { 
  validateVehicleBrand, 
  validateVehicleModel, 
  validateVehicleType,
  validateVehicleSelection,
  validateMineSearch,
  validateFreeSearch,
  validateYearsList,
  type ValidatedVehicleSelection 
} from "../../types/vehicle-validation";
import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";
import { type VehicleBrand, type VehicleModel, type VehicleType } from "../../types/vehicle.types";
import { Button } from "../ui/button";




interface VehicleSelectorProps {
  brands?: VehicleBrand[];
  showMineSearch?: boolean;
  onVehicleSelected?: (selection: {
    brand?: VehicleBrand;
    model?: VehicleModel;
    type?: VehicleType;
    year?: number;
  }) => void;
  navigateOnSelect?: boolean;
  className?: string;
}

export default function VehicleSelector({
  brands: propBrands,
  showMineSearch = false,
  onVehicleSelected,
  navigateOnSelect = true,
  className: _className = ""
}: VehicleSelectorProps) {
  const navigate = useNavigate();
  
  // 📊 Données - charger les marques si non fournies
  const [brands, setBrands] = useState<VehicleBrand[]>(propBrands || []);
  
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
  const [_loadingBrands, setLoadingBrands] = useState(!propBrands);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  
  // 🔍 Recherche libre et MINE
  const [searchQuery, setSearchQuery] = useState('');
  const [mineQuery, setMineQuery] = useState('');

  // 🛡️ États de validation et erreurs
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [hasValidationError, setHasValidationError] = useState(false);

  // 🏗️ Charger les marques au démarrage si nécessaire
  useEffect(() => {
    if (!propBrands) {
      loadBrands();
    }
  }, [propBrands]);

  const loadBrands = async () => {
    try {
      setLoadingBrands(true);
      setValidationErrors(prev => ({ ...prev, brands: '' }));
      
      const brandsData = await enhancedVehicleApi.getBrands();
      
      // 🛡️ Validation Zod des marques reçues
      const validatedBrands = brandsData.map((brand) => {
        try {
          return validateVehicleBrand(brand);
        } catch (error) {
          console.warn('❌ Marque invalide ignorée:', brand, error);
          return null;
        }
      }).filter(Boolean) as VehicleBrand[];
      
      setBrands(validatedBrands);
      
      if (validatedBrands.length !== brandsData.length) {
        setValidationErrors(prev => ({ 
          ...prev, 
          brands: `${brandsData.length - validatedBrands.length} marque(s) invalide(s) ignorée(s)` 
        }));
      }
    } catch (error) {
      console.error('Erreur chargement marques:', error);
      setValidationErrors(prev => ({ 
        ...prev, 
        brands: 'Erreur lors du chargement des marques' 
      }));
    } finally {
      setLoadingBrands(false);
    }
  };

  // 🏷️ Gestion sélection marque
  const handleBrandChange = async (brandId: number) => {
    console.log('🚀 handleBrandChange appelé avec brandId:', brandId);
    
    try {
      // 🛡️ Validation de la sélection
      const selection = { brandId };
      validateVehicleSelection(selection);
      setValidationErrors(prev => ({ ...prev, brand: '' }));
      
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
        setValidationErrors(prev => ({ ...prev, years: '' }));
        console.log('📅 Chargement des années pour marque:', brand.marque_name);
        try {
          const yearsData = await enhancedVehicleApi.getYearsByBrand(brand.marque_id);
          console.log('✅ Années reçues:', yearsData);
          console.log('✅ Type:', typeof yearsData, 'Length:', yearsData?.length);
          
          // 🛡️ Validation Zod des années
          const validatedYears = validateYearsList(yearsData);
          setYears(validatedYears.sort((a, b) => b - a)); // Tri décroissant
          console.log('✅ Years state après setYears:', validatedYears.sort((a, b) => b - a));
        } catch (error) {
          console.warn('❌ Erreur chargement années:', error);
          setYears([]);
          if (error instanceof z.ZodError) {
            setValidationErrors(prev => ({ 
              ...prev, 
              years: 'Données années invalides reçues du serveur' 
            }));
          } else {
            setValidationErrors(prev => ({ 
              ...prev, 
              years: 'Erreur lors du chargement des années' 
            }));
          }
        } finally {
          console.log('🔚 setLoadingYears(false) - fin du chargement');
          setLoadingYears(false);
        }
      } else {
        console.log('🚫 Aucune marque sélectionnée, réinitialisation years[]');
        setYears([]);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('❌ Validation marque échouée:', error.errors);
        setValidationErrors(prev => ({ 
          ...prev, 
          brand: 'Sélection de marque invalide' 
        }));
      } else {
        console.error('❌ Erreur inattendue:', error);
        setValidationErrors(prev => ({ 
          ...prev, 
          brand: 'Erreur lors de la sélection de la marque' 
        }));
      }
    }
  };

  // 📅 Gestion sélection année
  const handleYearChange = async (year: number) => {
    try {
      // 🛡️ Validation de la sélection
      const selection = { 
        brandId: selectedBrand?.marque_id, 
        year 
      };
      validateVehicleSelection(selection);
      setValidationErrors(prev => ({ ...prev, year: '', models: '' }));
      
      setSelectedYear(year);
      setSelectedModel(null);
      setSelectedType(null);
      setTypes([]);

      if (year && selectedBrand) {
        setLoadingModels(true);
        try {
          // 🗓️ Passer l'année pour le filtrage côté backend si supporté
          const modelsData = await enhancedVehicleApi.getModels(selectedBrand.marque_id, { year });
          
          // 🛡️ Validation Zod des modèles
          const validatedModels = modelsData.map((model) => {
            try {
              return validateVehicleModel(model);
            } catch (error) {
              console.warn('❌ Modèle invalide ignoré:', model, error);
              return null;
            }
          }).filter(Boolean) as VehicleModel[];
          
          setModels(validatedModels);
          
          if (validatedModels.length !== modelsData.length) {
            setValidationErrors(prev => ({ 
              ...prev, 
              models: `${modelsData.length - validatedModels.length} modèle(s) invalide(s) ignoré(s)` 
            }));
          }
        } catch (error) {
          console.warn('Erreur chargement modèles:', error);
          setModels([]);
          if (error instanceof z.ZodError) {
            setValidationErrors(prev => ({ 
              ...prev, 
              models: 'Données modèles invalides reçues du serveur' 
            }));
          } else {
            setValidationErrors(prev => ({ 
              ...prev, 
              models: 'Erreur lors du chargement des modèles' 
            }));
          }
        } finally {
          setLoadingModels(false);
        }
      } else {
        setModels([]);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('❌ Validation année échouée:', error.errors);
        setValidationErrors(prev => ({ 
          ...prev, 
          year: 'Sélection incohérente : année sans marque' 
        }));
      } else {
        console.error('❌ Erreur inattendue:', error);
        setValidationErrors(prev => ({ 
          ...prev, 
          year: 'Erreur lors de la sélection de l\'année' 
        }));
      }
    }
  };

  // 🚙 Gestion sélection modèle
  const handleModelChange = async (modelId: number) => {
    try {
      // 🛡️ Validation de la sélection
      const selection = { 
        brandId: selectedBrand?.marque_id, 
        year: selectedYear || undefined,
        modelId 
      };
      validateVehicleSelection(selection);
      setValidationErrors(prev => ({ ...prev, model: '', types: '' }));
      
      const model = models.find(m => m.modele_id === modelId) || null;
      setSelectedModel(model);
      setSelectedType(null);

      if (model && selectedYear) {
        setLoadingTypes(true);
        try {
          // 🗓️ Filtrage côté backend en passant l'année sélectionnée
          const typesData = await enhancedVehicleApi.getTypes(model.modele_id, { year: selectedYear });
          
          // 🛡️ Validation Zod des types
          const validatedTypes = typesData.map((type) => {
            try {
              return validateVehicleType(type);
            } catch (error) {
              console.warn('❌ Type invalide ignoré:', type, error);
              return null;
            }
          }).filter(Boolean) as VehicleType[];
          
          setTypes(validatedTypes);
          
          // Si aucune motorisation trouvée, afficher un message informatif
          if (validatedTypes.length === 0) {
            console.warn(`Aucune motorisation trouvée pour ${model.modele_name} en ${selectedYear}`);
            setValidationErrors(prev => ({ 
              ...prev, 
              types: `Aucune motorisation trouvée pour ${model.modele_name} en ${selectedYear}` 
            }));
          } else if (validatedTypes.length !== typesData.length) {
            setValidationErrors(prev => ({ 
              ...prev, 
              types: `${typesData.length - validatedTypes.length} motorisation(s) invalide(s) ignorée(s)` 
            }));
          }
        } catch (error) {
          console.warn('Erreur chargement types:', error);
          setTypes([]);
          if (error instanceof z.ZodError) {
            setValidationErrors(prev => ({ 
              ...prev, 
              types: 'Données motorisations invalides reçues du serveur' 
            }));
          } else {
            setValidationErrors(prev => ({ 
              ...prev, 
              types: 'Erreur lors du chargement des motorisations' 
            }));
          }
        } finally {
          setLoadingTypes(false);
        }
      } else {
        setTypes([]);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('❌ Validation modèle échouée:', error.errors);
        setValidationErrors(prev => ({ 
          ...prev, 
          model: 'Sélection incohérente : modèle sans marque' 
        }));
      } else {
        console.error('❌ Erreur inattendue:', error);
        setValidationErrors(prev => ({ 
          ...prev, 
          model: 'Erreur lors de la sélection du modèle' 
        }));
      }
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
    try {
      if (!typeSlug) {
        setSelectedType(null);
        setValidationErrors(prev => ({ ...prev, type: '' }));
        return;
      }
      
      // 🛡️ Validation de la sélection complète
      const selection = { 
        brandId: selectedBrand?.marque_id, 
        year: selectedYear || undefined,
        modelId: selectedModel?.modele_id,
        typeSlug 
      };
      validateVehicleSelection(selection);
      setValidationErrors(prev => ({ ...prev, type: '' }));
      
      const type = types.find(t => t.type_slug === typeSlug || t.type_id.toString() === typeSlug);
      setSelectedType(type || null);
      
      // 🚀 Navigation vers notre page véhicule interne si toutes les données sont disponibles
      if (type && selectedBrand && selectedModel && navigateOnSelect) {
        const vehicleUrl = generateVehicleUrl(selectedBrand, selectedModel, type);
        console.log('🌐 Navigation vers page véhicule:', vehicleUrl);
        
        // Navigation interne avec Remix
        navigate(vehicleUrl);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('❌ Validation type échouée:', error.errors);
        setValidationErrors(prev => ({ 
          ...prev, 
          type: 'Sélection incohérente : vérifiez l\'ordre marque → année → modèle → type' 
        }));
      } else {
        console.error('❌ Erreur inattendue:', error);
        setValidationErrors(prev => ({ 
          ...prev, 
          type: 'Erreur lors de la sélection du type' 
        }));
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
    setMineQuery('');
    // 🛡️ Reset des erreurs de validation
    setValidationErrors({});
    setHasValidationError(false);
  };

  // 📢 Notification sélection au parent
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

  // 🛡️ Vérification des erreurs de validation
  useEffect(() => {
    const hasErrors = Object.values(validationErrors).some(error => error.length > 0);
    setHasValidationError(hasErrors);
  }, [validationErrors]);

  // 🛡️ Fonction utilitaire pour valider les recherches
  const handleMineSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const mine = formData.get('mine') as string;
      validateMineSearch({ mine });
      setValidationErrors(prev => ({ ...prev, mine: '' }));
      // Continuer avec la recherche normale
      e.currentTarget.submit();
    } catch (error) {
      e.preventDefault();
      if (error instanceof z.ZodError) {
        setValidationErrors(prev => ({ 
          ...prev, 
          mine: error.errors[0]?.message || 'Format MINE invalide' 
        }));
      }
    }
  };

  const handleFreeSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const query = formData.get('query') as string;
      validateFreeSearch({ query });
      setValidationErrors(prev => ({ ...prev, search: '' }));
      // Continuer avec la recherche normale
      e.currentTarget.submit();
    } catch (error) {
      e.preventDefault();
      if (error instanceof z.ZodError) {
        setValidationErrors(prev => ({ 
          ...prev, 
          search: error.errors[0]?.message || 'Recherche invalide' 
        }));
      }
    }
  };

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
        {/* 🛡️ Affichage des erreurs de validation globales */}
        {hasValidationError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-800 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Erreurs de validation</span>
            </div>
            <div className="text-sm text-red-700 space-y-1">
              {Object.entries(validationErrors).map(([key, error]) => 
                error && (
                  <div key={key}>• {error}</div>
                )
              )}
            </div>
          </div>
        )}

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
            {selectedType && (
              <div>• Motorisation : <strong>
                {selectedType.type_name || 
                 (() => {
                   const liter = selectedType.type_liter ? (parseInt(selectedType.type_liter) / 100).toFixed(1) : '';
                   const fuel = selectedType.type_fuel || '';
                   const power = selectedType.type_power_ps ? `${selectedType.type_power_ps} PS` : '';
                   return `${liter} ${fuel} - ${power}`.replace(/\s+/g, ' ').trim();
                 })() ||
                 'Motorisation sélectionnée'}
              </strong></div>
            )}
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
          <Form method="post" action="/search/mine" onSubmit={handleMineSearch} className="flex gap-2">
            <input
              type="text"
              name="mine"
              value={mineQuery}
              onChange={(e) => {
                setMineQuery(e.target.value);
                // Nettoyer l'erreur quand l'utilisateur tape
                if (validationErrors.mine) {
                  setValidationErrors(prev => ({ ...prev, mine: '' }));
                }
              }}
              placeholder="Ex: M1XXXX"
              className={`flex-1 p-3 border rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                validationErrors.mine ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            <Button type="submit" className="px-6">
              <Search className="w-4 h-4" />
            </Button>
          </Form>
          {validationErrors.mine && (
            <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {validationErrors.mine}
            </p>
          )}
        </div>
      )}

      {/* 🔍 Recherche libre par VIN ou nom */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          <Search className="w-4 h-4 inline mr-2" />
          Recherche libre par VIN ou nom de véhicule
        </h4>
        <Form method="post" action="/search/vehicle" onSubmit={handleFreeSearch} className="flex gap-2">
          <input
            type="text"
            name="query"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Nettoyer l'erreur quand l'utilisateur tape
              if (validationErrors.search) {
                setValidationErrors(prev => ({ ...prev, search: '' }));
              }
            }}
            placeholder="Ex: VF1XXXXXXXXXXXXXXX ou Renault Clio 1.5 dCi"
            className={`flex-1 p-3 border rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              validationErrors.search ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
          />
          <Button type="submit" className="px-6">
            <Search className="w-4 h-4" />
          </Button>
        </Form>
        {validationErrors.search && (
          <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {validationErrors.search}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Entrez un numéro VIN (17 caractères) ou recherchez par nom de marque/modèle
        </p>
      </div>
    </div>
  );
}