/**
 * 🚗 EXEMPLE D'UTILISATION DU YEAR SELECTOR
 * 
 * Page de démonstration du composant YearSelector avec sélection en cascade
 * Route: /commercial/vehicles/year-selector-demo
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Alert } from '~/components/ui/alert';
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireUser } from "../auth/unified.server";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ModelSelector, type VehicleModel } from "../components/vehicles/ModelSelector";
import { TypeSelector, type VehicleType } from "../components/vehicles/TypeSelector";
import { YearSelector } from "../components/vehicles/YearSelector";
import { YearSelector as YearSelectorSimple } from "../components/vehicles/YearSelectorSimple";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  return json({ user });
}

export default function YearSelectorDemo() {
  const { user: _user } = useLoaderData<typeof loader>();
  
  // États pour la sélection en cascade - Version optimisée
  const [selectedModelId1, setSelectedModelId1] = useState<string>("");
  const [selectedModel1, setSelectedModel1] = useState<VehicleModel | undefined>();
  const [selectedTypeId1, setSelectedTypeId1] = useState<string>("");
  const [selectedType1, setSelectedType1] = useState<VehicleType | undefined>();
  const [selectedYear1, setSelectedYear1] = useState<number | null>(null);
  
  // États pour la sélection en cascade - Version simple
  const [selectedModelId2, setSelectedModelId2] = useState<string>("");
  const [selectedModel2, setSelectedModel2] = useState<VehicleModel | undefined>();
  const [selectedTypeId2, setSelectedTypeId2] = useState<string>("");
  const [selectedType2, setSelectedType2] = useState<VehicleType | undefined>();
  const [selectedYear2, setSelectedYear2] = useState<number | null>(null);
  
  // Configuration
  const [brandId] = useState<number | undefined>(113); // MINI par défaut pour avoir des données

  // Gestionnaires - Version optimisée
  const handleModelChange1 = (modelId: string, model?: VehicleModel) => {
    setSelectedModelId1(modelId);
    setSelectedModel1(model);
    // Reset des sélections dépendantes
    setSelectedTypeId1("");
    setSelectedType1(undefined);
    setSelectedYear1(null);
  };

  const handleTypeChange1 = (typeId: string, type?: VehicleType) => {
    setSelectedTypeId1(typeId);
    setSelectedType1(type);
    // Reset de l'année
    setSelectedYear1(null);
  };

  // Gestionnaires - Version simple
  const handleModelChange2 = (modelId: string, model?: VehicleModel) => {
    setSelectedModelId2(modelId);
    setSelectedModel2(model);
    // Reset des sélections dépendantes
    setSelectedTypeId2("");
    setSelectedType2(undefined);
    setSelectedYear2(null);
  };

  const handleTypeChange2 = (typeId: string, type?: VehicleType) => {
    setSelectedTypeId2(typeId);
    setSelectedType2(type);
    // Reset de l'année
    setSelectedYear2(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🚗 Démo YearSelector
              </h1>
              <p className="text-gray-600 mt-1">
                Test du composant de sélection d'années avec cascade complète
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Comparaison des deux versions */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Version Optimisée */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">
                  🚀 Version Optimisée (YearSelector)
                </CardTitle>
                <div className="text-sm text-gray-600">
                  <p><strong>Améliorations :</strong></p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Interface plus riche et accessible</li>
                    <li>Gestion des états de chargement améliorée</li>
                    <li>Affichage du nombre d'éléments par décennie</li>
                    <li>Indication claire de l'année sélectionnée</li>
                    <li>Gestion des cas d'erreur</li>
                    <li>TypeScript complet avec types exportés</li>
                  </ul>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ModelSelector
                  value={selectedModelId1}
                  onValueChange={handleModelChange1}
                  brandId={brandId}
                  placeholder="Sélectionner un modèle MINI..."
                />

                <TypeSelector
                  value={selectedTypeId1}
                  onValueChange={handleTypeChange1}
                  modelId={selectedModel1?.modele_id}
                  placeholder="Sélectionner un type..."
                  showDetails={false} // Masquer les détails pour économiser l'espace
                />

                <YearSelector
                  typeId={selectedType1?.type_id}
                  onSelect={(year) => setSelectedYear1(year)}
                  placeholder="Année de production"
                  showDecades={true}
                />

                {/* Résultat final */}
                {selectedYear1 && selectedType1 && selectedModel1 && (
<Alert className="p-4  rounded-lg" variant="success">
                    <h4 className="font-semibold text-green-800 mb-3">
                      🎯 Véhicule sélectionné :
                    </h4>
                    <div className="text-sm text-green-700 space-y-1">
                      <p><strong>Marque :</strong> {selectedModel1.auto_marque?.marque_name}</p>
                      <p><strong>Modèle :</strong> {selectedModel1.modele_name}</p>
                      <p><strong>Type :</strong> {selectedType1.type_name}</p>
                      <p><strong>Carburant :</strong> {selectedType1.type_fuel}</p>
                      <p><strong>Puissance :</strong> {selectedType1.type_power_ps}cv</p>
                      <p><strong>Année :</strong> {selectedYear1}</p>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Version Simple (Votre code) */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-700">
                  📝 Votre Approche (YearSelectorSimple)
                </CardTitle>
                <div className="text-sm text-gray-600">
                  <p><strong>Votre code original :</strong></p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Interface simple et efficace</li>
                    <li>Code minimaliste et lisible</li>
                    <li>Groupement par décennies</li>
                    <li>Compatible avec votre logique existante</li>
                    <li>Facilement maintenable</li>
                    <li>Performance optimale</li>
                  </ul>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ModelSelector
                  value={selectedModelId2}
                  onValueChange={handleModelChange2}
                  brandId={brandId}
                  placeholder="Sélectionner un modèle MINI..."
                />

                <TypeSelector
                  value={selectedTypeId2}
                  onValueChange={handleTypeChange2}
                  modelId={selectedModel2?.modele_id}
                  placeholder="Sélectionner un type..."
                  showDetails={false}
                />

                <YearSelectorSimple
                  typeId={selectedType2?.type_id}
                  onSelect={(year) => setSelectedYear2(year)}
                />

                {/* Résultat final */}
                {selectedYear2 && selectedType2 && selectedModel2 && (
<Alert className="p-4  rounded-lg" variant="info">
                    <h4 className="font-semibold text-blue-800 mb-3">
                      🎯 Véhicule sélectionné :
                    </h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <p><strong>Marque :</strong> {selectedModel2.auto_marque?.marque_name}</p>
                      <p><strong>Modèle :</strong> {selectedModel2.modele_name}</p>
                      <p><strong>Type :</strong> {selectedType2.type_name}</p>
                      <p><strong>Carburant :</strong> {selectedType2.type_fuel}</p>
                      <p><strong>Puissance :</strong> {selectedType2.type_power_ps}cv</p>
                      <p><strong>Année :</strong> {selectedYear2}</p>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Instructions d'utilisation */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>📋 Instructions d'utilisation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-700 mb-2">Version Optimisée :</h4>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`<YearSelector
  typeId={selectedType?.type_id}
  onSelect={(year) => setSelectedYear(year)}
  placeholder="Année de production"
  showDecades={true}
  disabled={false}
/>`}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold text-blue-700 mb-2">Votre Approche :</h4>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`<YearSelectorSimple
  typeId={selectedType?.type_id}
  onSelect={(year) => setSelectedYear(year)}
  className="mb-4"
/>`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flux de données */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>🔄 Flux de données en cascade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Le YearSelector suit le même pattern que les autres composants :
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between text-sm font-mono">
                  <span className="text-blue-600">ModelSelector</span>
                  <span>→</span>
                  <span className="text-green-600">TypeSelector</span>
                  <span>→</span>
                  <span className="text-purple-600">YearSelector</span>
                  <span>→</span>
                  <span className="text-orange-600">Véhicule Final</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <strong>API :</strong> <code>/api/vehicles/forms/models</code><br/>
                  <strong>Filtrage :</strong> Par brandId<br/>
                  <strong>Résultat :</strong> Liste des modèles
                </div>
                <div>
                  <strong>API :</strong> <code>/api/vehicles/forms/types</code><br/>
                  <strong>Filtrage :</strong> Par modelId<br/>
                  <strong>Résultat :</strong> Liste des types
                </div>
                <div>
                  <strong>API :</strong> <code>/api/vehicles/forms/years</code><br/>
                  <strong>Filtrage :</strong> Par typeId<br/>
                  <strong>Résultat :</strong> Années disponibles
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
