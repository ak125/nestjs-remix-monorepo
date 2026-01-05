import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSubmit } from '@remix-run/react';
import { Search, Download, Users, Heart, Save, RotateCcw, Package, Star, ShoppingCart, Eye } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Badge } from "~/components/ui";
import { Button } from '~/components/ui/button';
import { ModelSelector, type Model } from '../components/forms/ModelSelector';
import { TypeSelector, type VehicleType } from '../components/forms/TypeSelector';
import { YearSelector } from '../components/forms/YearSelector';

// Types pour les produits compatibles avec nouvelles propriétés
interface CompatibleProduct {
  id: string;
  name: string;
  reference: string;
  price: number;
  description?: string;
  brand?: string;
  category?: string;
  availability?: string;
  rating?: number;
}

// Types pour les statistiques
interface VehicleStats {
  totalBrands: number;
  totalModels: number;
  totalTypes: number;
  totalProducts: number;
}

// Types pour les produits compatibles
interface CompatibleProduct {
  id: string;
  name: string;
  reference: string;
  price: number;
  description?: string;
  brand?: string;
  category?: string;
}

interface LoaderData {
  compatibleProducts: CompatibleProduct[];
  stats: VehicleStats;
  searchParams: {
    modelId?: string;
    typeId?: string;
    year?: string;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const modelId = url.searchParams.get('modelId');
  const typeId = url.searchParams.get('typeId');
  const year = url.searchParams.get('year');
  
  let compatibleProducts: CompatibleProduct[] = [];
  let stats: VehicleStats = {
    totalBrands: 40,
    totalModels: 1495,
    totalTypes: 16791,
    totalProducts: 15000
  };

  // Récupérer les statistiques temps réel depuis l'API
  try {
    const dashboardResponse = await fetch('http://localhost:3000/api/dashboard/stats');
    if (dashboardResponse.ok) {
      const dashboardData = await dashboardResponse.json();
      // Enrichir les stats avec des données réelles
      stats.totalProducts = dashboardData.totalOrders * 10 || 15000; // Estimation basée sur les commandes
    }
  } catch (error) {
    console.warn('Impossible de récupérer les stats dashboard:', error);
  }

  // Recherche de produits compatibles si des critères sont fournis
  if (modelId || typeId || year) {
    // Simuler des produits plus réalistes avec variations selon les critères
    const productVariations = [
      {
        id: '1',
        name: 'Filtre à huile premium',
        reference: 'FO-2024-001',
        price: 24.99,
        brand: 'AutoParts Pro',
        category: 'Filtration',
        description: 'Filtre à huile haute performance pour moteurs essence et diesel',
        availability: 'En stock',
        rating: 4.8
      },
      {
        id: '2',
        name: 'Plaquettes de frein avant',
        reference: 'BR-2024-045',
        price: 89.99,
        brand: 'SafeBrake',
        category: 'Freinage',
        description: 'Plaquettes de frein céramiques longue durée',
        availability: 'En stock',
        rating: 4.6
      },
      {
        id: '3',
        name: 'Disques de frein ventilés',
        reference: 'BR-2024-046',
        price: 156.50,
        brand: 'SafeBrake',
        category: 'Freinage',
        description: 'Disques de frein ventilés haute performance',
        availability: '2-3 jours',
        rating: 4.7
      },
      {
        id: '4',
        name: 'Kit distribution complet',
        reference: 'EN-2024-012',
        price: 245.00,
        brand: 'MotorTech',
        category: 'Moteur',
        description: 'Kit complet courroie de distribution avec tendeur et galets',
        availability: 'En stock',
        rating: 4.9
      },
      {
        id: '5',
        name: 'Amortisseurs avant (paire)',
        reference: 'SU-2024-023',
        price: 198.75,
        brand: 'ComfortRide',
        category: 'Suspension',
        description: 'Paire d\'amortisseurs avant hydrauliques renforcés',
        availability: 'En stock',
        rating: 4.5
      }
    ];
    
    // Varier le nombre de produits selon les critères
    const numProducts = year ? 5 : (typeId ? 4 : 3);
    compatibleProducts = productVariations.slice(0, numProducts);
  }
  
  return json<LoaderData>({ 
    compatibleProducts,
    stats,
    searchParams: {
      modelId: modelId || undefined,
      typeId: typeId || undefined,
      year: year || undefined
    }
  });
}

export default function AdvancedVehicleSearch() {
  const { compatibleProducts, stats, searchParams } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  
  // États pour les sélections
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  
  // États pour les nouvelles fonctionnalités
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'price' | 'rating' | 'name'>('price');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showFavorites, setShowFavorites] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Fonctions optimisées avec useCallback
  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, []);

  // Produits filtrés et triés avec useMemo pour optimiser les performances
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = compatibleProducts;
    
    if (filterCategory) {
      filtered = filtered.filter(product => product.category === filterCategory);
    }
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price;
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [compatibleProducts, filterCategory, sortBy]);

  // Catégories uniques pour le filtre
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(compatibleProducts.map(p => p.category).filter(Boolean))] as string[];
    return uniqueCategories;
  }, [compatibleProducts]);

  // Fonctions avec états de chargement
  const handleSaveSearch = useCallback(async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const searchCriteria = {
        model: selectedModel?.modele_name,
        type: selectedType?.type_name,
        year: selectedYear,
        timestamp: new Date().toISOString()
      };
      
      // Sauvegarder dans localStorage
      const savedSearches = JSON.parse(localStorage.getItem('vehicleSearches') || '[]');
      savedSearches.unshift(searchCriteria);
      localStorage.setItem('vehicleSearches', JSON.stringify(savedSearches.slice(0, 10))); // Garder seulement les 10 dernières
      
      // Simuler une petite attente pour l'UX
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Recherche sauvegardée !', {
        description: 'Vos critères ont été enregistrés',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedModel, selectedType, selectedYear, isSaving]);

  const handleExport = useCallback(async () => {
    if (isExporting || filteredAndSortedProducts.length === 0) return;
    
    setIsExporting(true);
    try {
      // Simuler une petite attente pour l'UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + "Nom,Référence,Prix,Marque,Catégorie,Disponibilité,Note\n"
        + filteredAndSortedProducts.map(product => 
            `"${product.name}","${product.reference}","${product.price}","${product.brand || ''}","${product.category || ''}","${product.availability || ''}","${product.rating || ''}"`
          ).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `pieces_compatibles_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  }, [filteredAndSortedProducts, isExporting]);

  // Gestionnaires de sélection avec cascade automatique
  const handleModelSelect = (modelId: string, model?: Model) => {
    setSelectedModel(model || null);
    // Reset des sélections suivantes
    setSelectedType(null);
    setSelectedYear(null);
    
    // Lancement automatique de la recherche si requis
    if (model) {
      handleSearch(model.modele_id.toString(), '', '');
    }
  };

  const handleTypeSelect = (typeId: string, type?: VehicleType) => {
    setSelectedType(type || null);
    // Reset de l'année
    setSelectedYear(null);
    
    // Lancement automatique de la recherche
    if (type && selectedModel) {
      handleSearch(selectedModel.modele_id.toString(), type.type_id.toString(), '');
    }
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    
    // Lancement automatique de la recherche
    if (selectedModel && selectedType) {
      handleSearch(
        selectedModel.modele_id.toString(), 
        selectedType.type_id.toString(), 
        year.toString()
      );
    }
  };

  const handleSearch = (modelId?: string, typeId?: string, year?: string) => {
    const formData = new FormData();
    
    const finalModelId = modelId || (selectedModel ? selectedModel.modele_id.toString() : '');
    const finalTypeId = typeId || (selectedType ? selectedType.type_id.toString() : '');
    const finalYear = year || (selectedYear ? selectedYear.toString() : '');
    
    if (finalModelId) formData.append('modelId', finalModelId);
    if (finalTypeId) formData.append('typeId', finalTypeId);
    if (finalYear) formData.append('year', finalYear);
    
    submit(formData, { method: 'get' });
  };

  const handleReset = () => {
    setSelectedModel(null);
    setSelectedType(null);
    setSelectedYear(null);
    submit(new FormData(), { method: 'get' });
  };

  // Calcul du nombre d'étapes complétées
  const completedSteps = [selectedModel, selectedType, selectedYear].filter(Boolean).length;
  const totalSteps = 3;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Search className="h-8 w-8 text-blue-600" />
              Recherche avancée de véhicule
            </h1>
            <p className="text-gray-600 mt-1 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Trouvez les pièces compatibles avec votre véhicule - {stats?.totalProducts?.toLocaleString() || 0} pièces disponibles
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {favorites.length > 0 && (
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 flex items-center gap-2 ${
                  showFavorites 
                    ? 'bg-rose-50 text-rose-700 border-rose-300' 
                    : 'text-gray-600 hover:text-gray-900 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Heart className={`h-4 w-4 ${favorites.length > 0 ? 'fill-current' : ''}`} />
                Favoris ({favorites.length})
              </button>
            )}
            
            {filteredAndSortedProducts.length > 0 && (
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-info bg-info/10 border border-blue-300 rounded-lg hover:bg-info/20 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                    Export...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Exporter
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={handleSaveSearch}
              disabled={isSaving || !(selectedModel || selectedType || selectedYear)}
              className="px-4 py-2 text-sm font-medium text-success bg-success/10 border border-green-300 rounded-lg hover:bg-success/20 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Sauvegarder
                </>
              )}
            </button>
            
            {(selectedModel || selectedType || selectedYear) && (
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Réinitialiser
              </button>
            )}
          </div>
        </div>
        
        {/* Indicateur de progression */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progression de la sélection</span>
            <span>{completedSteps}/{totalSteps} étapes</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-primary/5 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats?.totalBrands?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-600">Marques</div>
          </div>
          <div className="bg-success/5 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats?.totalModels?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-600">Modèles</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-600">
              {stats?.totalTypes?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-600">Motorisations</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats?.totalProducts?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-600">Pièces</div>
          </div>
        </div>

        {/* Formulaire de recherche avec cascade */}
        <div className="space-y-6">
          {/* Étape 1: Sélection du modèle */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              1. Sélectionner le modèle de véhicule
            </label>
            <ModelSelector
              value={selectedModel ? selectedModel.modele_id.toString() : ''}
              onValueChange={handleModelSelect}
              placeholder="Rechercher par marque et modèle..."
              searchPlaceholder="Ex: Volkswagen Golf, BMW Série 3..."
              className="w-full"
              autoLoadOnMount={false}
            />
            {selectedModel && (
              <div className="flex items-center text-sm text-green-600">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Modèle sélectionné: {selectedModel.auto_marque?.marque_name} {selectedModel.modele_name}
              </div>
            )}
          </div>
          
          {/* Étape 2: Sélection du type */}
          {selectedModel && (
            <div className="space-y-2 animate-fadeIn">
              <label className="block text-sm font-medium text-gray-700">
                2. Sélectionner la motorisation
              </label>
              <TypeSelector
                modelId={selectedModel.modele_id}
                value={selectedType ? selectedType.type_id.toString() : ''}
                onValueChange={handleTypeSelect}
                placeholder="Sélectionner la motorisation..."
                className="w-full"
              />
              {selectedType && (
                <div className="flex items-center text-sm text-green-600">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  Motorisation sélectionnée: {selectedType.type_name} ({selectedType.type_engine_code || 'N/A'})
                </div>
              )}
            </div>
          )}
          
          {/* Étape 3: Sélection de l'année */}
          {selectedType && (
            <div className="space-y-2 animate-fadeIn">
              <label className="block text-sm font-medium text-gray-700">
                3. Sélectionner l'année de production
              </label>
              <YearSelector
                typeId={selectedType.type_id}
                onSelect={handleYearSelect}
                className="w-full"
              />
              {selectedYear && (
                <div className="flex items-center text-sm text-green-600">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  Année sélectionnée: {selectedYear}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Résumé de la sélection */}
        {(selectedModel || selectedType || selectedYear) && (
          <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Récapitulatif de votre sélection :</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedModel && (
                <div className="bg-white p-3 rounded border">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Véhicule</div>
                  <div className="font-medium text-gray-900">
                    {selectedModel.auto_marque?.marque_name} {selectedModel.modele_name}
                  </div>
                </div>
              )}
              {selectedType && (
                <div className="bg-white p-3 rounded border">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Motorisation</div>
                  <div className="font-medium text-gray-900">{selectedType.type_name}</div>
                  <div className="text-sm text-gray-600">Code: {selectedType.type_engine_code || 'N/A'}</div>
                </div>
              )}
              {selectedYear && (
                <div className="bg-white p-3 rounded border">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Année</div>
                  <div className="font-medium text-gray-900">{selectedYear}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Résultats de recherche */}
        {filteredAndSortedProducts.length > 0 && (
          <div className="mt-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  {filteredAndSortedProducts.length.toLocaleString()} pièces 
                  {filterCategory || showFavorites ? 'filtrées' : 'compatibles'}
                </h2>
                {compatibleProducts.length !== filteredAndSortedProducts.length && (
                  <span className="text-sm text-gray-500">
                    sur {compatibleProducts.length.toLocaleString()} au total
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                {/* Filtre par catégorie */}
                {categories.length > 0 && (
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Toutes les catégories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                )}
                
                {/* Tri */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'price' | 'rating' | 'name')}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="price">Prix croissant</option>
                  <option value="rating">Mieux notés</option>
                  <option value="name">Nom A-Z</option>
                </select>
                
                {/* Bouton favoris */}
                {favorites.length > 0 && (
                  <button
                    onClick={() => setShowFavorites(!showFavorites)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all duration-200 flex items-center gap-2 ${
                      showFavorites 
                        ? 'bg-rose-50 text-rose-700 border-rose-300' 
                        : 'text-gray-600 hover:text-gray-900 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${favorites.length > 0 ? 'fill-current' : ''}`} />
                    {showFavorites ? 'Tous' : 'Favoris'}
                  </button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedProducts.map((product) => (
                <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-blue-300 transition-all duration-200 group">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors">{product.name}</h3>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => toggleFavorite(product.id)}
                        className={`p-1 rounded-full transition-all duration-200 ${
                          favorites.includes(product.id)
                            ? 'text-rose-600 hover:text-rose-700'
                            : 'text-gray-400 hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${favorites.includes(product.id) ? 'fill-current' : ''}`} />
                      </button>
                      <span className="text-lg font-bold text-blue-600">{product.price}€</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <span className="font-medium">Référence:</span> 
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">{product.reference}</code>
                    </p>
                    {product.brand && (
                      <p><span className="font-medium">Marque:</span> <span className="text-blue-600 font-medium">{product.brand}</span></p>
                    )}
                    {product.category && (
                      <p className="flex items-center gap-2">
                        <span className="font-medium">Catégorie:</span> 
                        <Badge variant="info">{product.category}</Badge>
                      </p>
                    )}
                    {product.rating && (
                      <p className="flex items-center gap-2">
                        <span className="font-medium">Note:</span>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < (product.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-xs">({product.rating || 0}/5)</span>
                        </div>
                      </p>
                    )}
                  </div>
                  
                  {product.description && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-3">{product.description}</p>
                  )}
                  
                  <div className="mt-4 flex gap-2">
                    <Button className="flex-1  py-2 px-3 rounded-lg text-sm   flex items-center justify-center gap-2" variant="blue">
                      <ShoppingCart className="h-4 w-4" />
                      Ajouter au panier
                    </Button>
                    <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      Détails
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message si pas de résultats */}
        {searchParams.modelId && compatibleProducts.length === 0 && (
          <div className="mt-8 text-center py-12 bg-gray-50 rounded-lg">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune pièce trouvée</h3>
            <p className="text-gray-600 mb-6">
              Aucune pièce compatible n'a été trouvée pour les critères sélectionnés.
            </p>
            <button
              onClick={() => handleSearch()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg"
            >
              Relancer la recherche
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
