/**
 * 🚗 EXEMPLE D'UTILISATION DU MODEL SELECTOR
 * 
 * Page de démonstration du composant ModelSelector
 * Route: /commercial/vehicles/model-selector-demo
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireUser } from "../auth/unified.server";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ModelSelector, type VehicleModel } from "../components/vehicles/ModelSelector";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  return json({ user });
}

export default function ModelSelectorDemo() {
  const { user: _user } = useLoaderData<typeof loader>();
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<VehicleModel | undefined>();
  const [brandId, setBrandId] = useState<number | undefined>(1); // BMW par défaut

  const handleModelChange = (modelId: string, model?: VehicleModel) => {
    setSelectedModelId(modelId);
    setSelectedModel(model);
    console.log("Modèle sélectionné:", { modelId, model });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🚗 Démo ModelSelector
              </h1>
              <p className="text-gray-600 mt-1">
                Test du composant de sélection de modèles automobile
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  ID Marque (optionnel)
                </label>
                <input
                  type="number"
                  value={brandId || ""}
                  onChange={(e) => setBrandId(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Ex: 1 pour BMW"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Laissez vide pour tous les modèles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sélecteur de modèle */}
        <Card>
          <CardHeader>
            <CardTitle>Sélecteur de Modèle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ModelSelector
                value={selectedModelId}
                onValueChange={handleModelChange}
                brandId={brandId}
                placeholder="Choisir un modèle de véhicule..."
                searchPlaceholder="Rechercher par nom de modèle..."
                className="max-w-md"
                allowClear={true}
                autoLoadOnMount={true}
              />

              {/* Informations sur la sélection */}
              {selectedModel && (
                <div className="mt-4 p-4 bg-primary/5 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">
                    Modèle sélectionné :
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>ID:</strong> {selectedModel.modele_id}</p>
                    <p><strong>Nom:</strong> {selectedModel.modele_name}</p>
                    {selectedModel.modele_alias && (
                      <p><strong>Alias:</strong> {selectedModel.modele_alias}</p>
                    )}
                    {selectedModel.modele_ful_name && (
                      <p><strong>Nom complet:</strong> {selectedModel.modele_ful_name}</p>
                    )}
                    <p><strong>ID Marque:</strong> {selectedModel.modele_marque_id}</p>
                    {selectedModel.auto_marque && (
                      <p><strong>Marque:</strong> {selectedModel.auto_marque.marque_name}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Valeur JSON */}
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Valeur actuelle (JSON) :</h4>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                  {JSON.stringify({ selectedModelId, selectedModel }, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Tapez pour rechercher un modèle par nom</p>
              <p>• Utilisez les flèches ↑↓ pour naviguer dans la liste</p>
              <p>• Appuyez sur Entrée pour sélectionner</p>
              <p>• Cliquez sur ✕ pour effacer la sélection</p>
              <p>• Changez l'ID de marque pour filtrer par marque</p>
              <p>• L'API utilisée : <code>/api/vehicles/forms/models</code></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
