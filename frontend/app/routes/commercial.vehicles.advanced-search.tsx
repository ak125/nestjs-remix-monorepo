import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSubmit } from '@remix-run/react';
import { useState } from 'react';
import { ModelSelector, type Model } from '../components/forms/ModelSelector';
import { TypeSelector, type VehicleType } from '../components/forms/TypeSelector';
import { YearSelector } from '../components/forms/YearSelector';

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

  // Recherche de produits compatibles si des critères sont fournis
  if (modelId || typeId || year) {
    // Simuler quelques produits pour l'exemple
    compatibleProducts = [
      {
        id: '1',
        name: 'Filtre à huile premium',
        reference: 'FO-2024-001',
        price: 24.99,
        brand: 'AutoParts Pro',
        category: 'Filtration',
        description: 'Filtre à huile haute performance pour moteurs essence et diesel'
      },
      {
        id: '2',
        name: 'Plaquettes de frein avant',
        reference: 'BR-2024-045',
        price: 89.99,
        brand: 'SafeBrake',
        category: 'Freinage',
        description: 'Plaquettes de frein céramiques longue durée'
      }
    ];
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
            <h1 className="text-2xl font-bold text-gray-900">Recherche avancée de véhicule</h1>
            <p className="text-gray-600 mt-1">
              Trouvez les pièces compatibles avec votre véhicule
            </p>
          </div>
          
          {(selectedModel || selectedType || selectedYear) && (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Réinitialiser
            </button>
          )}
        </div>
        
        {/* Indicateur de progression */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progression de la sélection</span>
            <span>{completedSteps}/{totalSteps} étapes</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats?.totalBrands?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-600">Marques</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
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
        {compatibleProducts.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {compatibleProducts.length.toLocaleString()} pièces compatibles trouvées
              </h2>
              
              <div className="flex space-x-2">
                <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                  Filtrer
                </button>
                <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                  Trier
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {compatibleProducts.map((product) => (
                <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                    <span className="text-lg font-bold text-blue-600 ml-2">{product.price}€</span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><span className="font-medium">Référence:</span> {product.reference}</p>
                    {product.brand && (
                      <p><span className="font-medium">Marque:</span> {product.brand}</p>
                    )}
                    {product.category && (
                      <p><span className="font-medium">Catégorie:</span> {product.category}</p>
                    )}
                  </div>
                  
                  {product.description && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-3">{product.description}</p>
                  )}
                  
                  <div className="mt-4 flex space-x-2">
                    <button className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700">
                      Ajouter au panier
                    </button>
                    <button className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
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
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Relancer la recherche
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
