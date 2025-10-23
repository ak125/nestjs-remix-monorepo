/**
 * 🚗 EXEMPLE D'UTILISATION DU TYPE SELECTOR
 * 
 * Page de démonstration du composant TypeSelector
 * Route: /commercial/vehicles/type-selector-demo
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireUser } from "../auth/unified.server";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ModelSelector, type VehicleModel } from "../components/vehicles/ModelSelector";
import { TypeSelector, type VehicleType } from "../components/vehicles/TypeSelector";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  return json({ user });
}

export default function TypeSelectorDemo() {
  const { user: _user } = useLoaderData<typeof loader>();
  
  // États pour les sélections
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<VehicleModel | undefined>();
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<VehicleType | undefined>();
  
  // Configuration
  const [brandId, setBrandId] = useState<number | undefined>(128); // Peugeot par défaut
  const [onlyActive, setOnlyActive] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  // Gestionnaires
  const handleModelChange = (modelId: string, model?: VehicleModel) => {
    setSelectedModelId(modelId);
    setSelectedModel(model);
    
    // Reset du type quand le modèle change
    setSelectedTypeId("");
    setSelectedType(undefined);
    
    console.log("Modèle sélectionné:", { modelId, model });
  };

  const handleTypeChange = (typeId: string, type?: VehicleType) => {
    setSelectedTypeId(typeId);
    setSelectedType(type);
    console.log("Type sélectionné:", { typeId, type });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🚗 Démo TypeSelector
              </h1>
              <p className="text-gray-600 mt-1">
                Test du composant de sélection de types/motorisations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  ID Marque (optionnel)
                </label>
                <input
                  type="number"
                  value={brandId || ""}
                  onChange={(e) => setBrandId(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Ex: 128 pour Peugeot"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Laissez vide pour toutes les marques
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={onlyActive}
                      onChange={(e) => setOnlyActive(e.target.checked)}
                      className="mr-2"
                    />
                    Types actifs uniquement
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showDetails}
                      onChange={(e) => setShowDetails(e.target.checked)}
                      className="mr-2"
                    />
                    Afficher les détails
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sélection en cascade : Modèle puis Type */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sélecteur de modèle */}
          <Card>
            <CardHeader>
              <CardTitle>1. Sélection du Modèle</CardTitle>
            </CardHeader>
            <CardContent>
              <ModelSelector
                value={selectedModelId}
                onValueChange={handleModelChange}
                brandId={brandId}
                placeholder="Choisir un modèle..."
                searchPlaceholder="Rechercher un modèle..."
                allowClear={true}
                autoLoadOnMount={true}
              />

              {selectedModel && (
                <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">
                    Modèle sélectionné :
                  </h4>
                  <div className="text-sm space-y-1">
                    <p><strong>ID:</strong> {selectedModel.modele_id}</p>
                    <p><strong>Nom:</strong> {selectedModel.modele_name}</p>
                    {selectedModel.modele_ful_name && (
                      <p><strong>Nom complet:</strong> {selectedModel.modele_ful_name}</p>
                    )}
                    {selectedModel.auto_marque && (
                      <p><strong>Marque:</strong> {selectedModel.auto_marque.marque_name}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sélecteur de type */}
          <Card>
            <CardHeader>
              <CardTitle>2. Sélection du Type</CardTitle>
            </CardHeader>
            <CardContent>
              <TypeSelector
                value={selectedTypeId}
                onValueChange={handleTypeChange}
                modelId={selectedModel?.modele_id}
                brandId={brandId}
                placeholder="Choisir un type / motorisation..."
                searchPlaceholder="Rechercher un type..."
                allowClear={true}
                autoLoadOnMount={false} // Attendre la sélection du modèle
                onlyActive={onlyActive}
                showDetails={showDetails}
              />
            </CardContent>
          </Card>
        </div>

        {/* Test du TypeSelector sans filtrage de modèle */}
        <Card>
          <CardHeader>
            <CardTitle>TypeSelector sans filtrage (tous types)</CardTitle>
          </CardHeader>
          <CardContent>
            <TypeSelector
              value=""
              onValueChange={(typeId, type) => {
                console.log("Type global sélectionné:", { typeId, type });
              }}
              brandId={brandId}
              placeholder="Rechercher dans tous les types..."
              searchPlaceholder="Tapez pour rechercher..."
              allowClear={true}
              autoLoadOnMount={false}
              onlyActive={onlyActive}
              showDetails={showDetails}
            />
          </CardContent>
        </Card>

        {/* Résultat final */}
        {selectedType && (
          <Card>
            <CardHeader>
              <CardTitle>Résultat Final</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Type sélectionné :</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedType, null, 2)}
                  </pre>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Modèle associé :</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedModel, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• <strong>Sélection en cascade :</strong> Sélectionnez d'abord un modèle, puis un type</p>
              <p>• <strong>Recherche :</strong> Tapez pour rechercher un type par nom ou code moteur</p>
              <p>• <strong>Navigation :</strong> Utilisez les flèches ↑↓ pour naviguer, Entrée pour sélectionner</p>
              <p>• <strong>Filtrage :</strong> Changez l'ID de marque pour filtrer par marque</p>
              <p>• <strong>Types actifs :</strong> Cochez pour voir uniquement les types en production</p>
              <p>• <strong>API utilisée :</strong> <code>/api/vehicles/forms/types</code></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
