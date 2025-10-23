import { useState } from 'react';
import { ModelSelector, type Model } from '../components/forms/ModelSelector';
import { TypeSelector, type VehicleType } from '../components/forms/TypeSelector';
import { YearSelector } from '../components/forms/YearSelector';

export default function VehicleSelectorsDemo() {
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const handleModelSelect = (modelId: string, model?: Model) => {
    console.log('Model selected:', modelId, model);
    setSelectedModel(model || null);
    // Reset cascade
    setSelectedType(null);
    setSelectedYear(null);
  };

  const handleTypeSelect = (typeId: string, type?: VehicleType) => {
    console.log('Type selected:', typeId, type);
    setSelectedType(type || null);
    // Reset year
    setSelectedYear(null);
  };

  const handleYearSelect = (year: number) => {
    console.log('Year selected:', year);
    setSelectedYear(year);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">🚗 Test des Composants Véhicules</h1>
      
      <div className="space-y-8">
        {/* Model Selector */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">1. Sélection du Modèle</h2>
          <ModelSelector
            value={selectedModel ? selectedModel.modele_id.toString() : ''}
            onValueChange={handleModelSelect}
            placeholder="Rechercher un modèle..."
            className="w-full"
          />
          {selectedModel && (
            <Alert intent="success"><strong>Sélectionné:</strong> {selectedModel.modele_ful_name || selectedModel.modele_name}</Alert>
          )}
        </div>

        {/* Type Selector */}
        {selectedModel && (
          <div className="bg-white p-6 rounded-lg shadow animate-fadeIn">
            <h2 className="text-xl font-semibold mb-4">2. Sélection du Type / Motorisation</h2>
            <TypeSelector
              modelId={selectedModel.modele_id}
              value={selectedType ? selectedType.type_id.toString() : ''}
              onValueChange={handleTypeSelect}
              placeholder="Sélectionner la motorisation..."
              className="w-full"
            />
            {selectedType && (
              <div className="mt-3 p-3 bg-green-50 rounded">
                <strong>Sélectionné:</strong> {selectedType.type_name}
                <br />
                <span className="text-sm text-gray-600">
                  Carburant: {selectedType.type_fuel} | 
                  Puissance: {selectedType.type_power_ps}PS ({selectedType.type_power_kw}kW)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Year Selector */}
        {selectedType && (
          <div className="bg-white p-6 rounded-lg shadow animate-fadeIn">
            <h2 className="text-xl font-semibold mb-4">3. Sélection de l'Année</h2>
            <YearSelector
              typeId={selectedType.type_id}
              onSelect={handleYearSelect}
              className="w-full"
            />
            {selectedYear && (
              <Alert intent="success"><strong>Sélectionné:</strong> {selectedYear}</Alert>
            )}
          </div>
        )}

        {/* Summary */}
        {(selectedModel || selectedType || selectedYear) && (
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">📋 Résumé de la Sélection</h3>
            <div className="space-y-2">
              {selectedModel && (
                <p><span className="font-medium">Véhicule:</span> {selectedModel.modele_ful_name}</p>
              )}
              {selectedType && (
                <p><span className="font-medium">Motorisation:</span> {selectedType.type_name} ({selectedType.type_fuel})</p>
              )}
              {selectedYear && (
                <p><span className="font-medium">Année:</span> {selectedYear}</p>
              )}
            </div>
            
            {selectedModel && selectedType && selectedYear && (
              <div className="mt-4 p-4 bg-success/10 border border-green-300 rounded">
                <p className="text-green-800 font-medium">
                  ✅ Sélection complète ! Vous pouvez maintenant rechercher des pièces compatibles.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Debug Info */}
      <div className="mt-12 bg-gray-50 p-4 rounded text-sm">
        <h4 className="font-medium mb-2">🐛 Debug Info:</h4>
        <pre className="text-xs">
          {JSON.stringify({ selectedModel, selectedType, selectedYear }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
