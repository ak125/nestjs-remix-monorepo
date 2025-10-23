/**
 * 🚗 COMPARAISON TYPE SELECTOR
 * 
 * Comparaison entre votre approche et la meilleure approche optimisée
 * Route: /commercial/vehicles/type-selector-comparison
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Alert } from '~/components/ui/alert';
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireUser } from "../auth/unified.server";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ModelSelector, type VehicleModel } from "../components/vehicles/ModelSelector";
import { TypeSelector, type VehicleType } from "../components/vehicles/TypeSelector";
import { TypeSelector as TypeSelectorSimple } from "../components/vehicles/TypeSelectorSimple";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  return json({ user });
}

export default function TypeSelectorComparison() {
  const { user: _user } = useLoaderData<typeof loader>();
  
  // États pour les sélections - Version optimisée (Combobox)
  const [selectedModelId1, setSelectedModelId1] = useState<string>("");
  const [selectedModel1, setSelectedModel1] = useState<VehicleModel | undefined>();
  const [selectedType1, setSelectedType1] = useState<VehicleType | undefined>();
  
  // États pour les sélections - Version simple (Select)
  const [selectedModelId2, setSelectedModelId2] = useState<string>("");
  const [selectedModel2, setSelectedModel2] = useState<VehicleModel | undefined>();
  const [selectedType2, setSelectedType2] = useState<VehicleType | undefined>();
  
  const [brandId] = useState<number | undefined>(113); // MINI par défaut

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🚗 Comparaison TypeSelector
              </h1>
              <p className="text-gray-600 mt-1">
                Comparaison entre votre approche et la meilleure approche optimisée
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Version Optimisée (Combobox) */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">
                  🚀 Version Optimisée (Combobox)
                </CardTitle>
                <div className="text-sm text-gray-600">
                  <p><strong>Avantages :</strong></p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Recherche en temps réel avec debounce</li>
                    <li>Navigation clavier (↑↓, Entrée, Escape)</li>
                    <li>Support de grandes listes (virtualization possible)</li>
                    <li>Affichage des détails enrichi</li>
                    <li>Interface moderne et accessible</li>
                    <li>Auto-complétion intelligente</li>
                  </ul>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ModelSelector
                  value={selectedModelId1}
                  onValueChange={(modelId, model) => {
                    setSelectedModelId1(modelId);
                    setSelectedModel1(model);
                  }}
                  brandId={brandId}
                  placeholder="Sélectionner un modèle MINI..."
                  allowClear={true}
                />

                <TypeSelector
                  value={selectedType1?.type_id?.toString() || ""}
                  onValueChange={(typeId, type) => {
                    setSelectedType1(type);
                  }}
                  modelId={selectedModel1?.modele_id}
                  placeholder="Sélectionner un type..."
                  showDetails={true}
                />

                {selectedType1 && (
<Alert className="p-3  rounded-lg" variant="success">
                    <h4 className="font-semibold text-green-800 mb-2">Résultat :</h4>
                    <div className="text-sm text-green-700">
                      <p><strong>Modèle :</strong> {selectedModel1?.modele_name}</p>
                      <p><strong>Type :</strong> {selectedType1.type_name}</p>
                      <p><strong>Carburant :</strong> {selectedType1.type_fuel}</p>
                      <p><strong>Puissance :</strong> {selectedType1.type_power_ps}cv</p>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Version Simple (Select) */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-700">
                  📝 Votre Approche (Select)
                </CardTitle>
                <div className="text-sm text-gray-600">
                  <p><strong>Caractéristiques :</strong></p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Interface HTML native simple</li>
                    <li>Compatible avec votre code existant</li>
                    <li>Pas de dépendances complexes</li>
                    <li>Fonctionnalité de base suffisante</li>
                    <li>Performance standard</li>
                    <li>Facile à implémenter</li>
                  </ul>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ModelSelector
                  value={selectedModelId2}
                  onValueChange={(modelId, model) => {
                    setSelectedModelId2(modelId);
                    setSelectedModel2(model);
                  }}
                  brandId={brandId}
                  placeholder="Sélectionner un modèle MINI..."
                  allowClear={true}
                />

                <TypeSelectorSimple
                  modelId={selectedModel2?.modele_id}
                  onSelect={(type) => {
                    setSelectedType2(type || undefined);
                  }}
                  placeholder="Sélectionnez un type"
                  showDetails={true}
                />

                {selectedType2 && (
<Alert className="p-3  rounded-lg" variant="info">
                    <h4 className="font-semibold text-blue-800 mb-2">Résultat :</h4>
                    <div className="text-sm text-blue-700">
                      <p><strong>Modèle :</strong> {selectedModel2?.modele_name}</p>
                      <p><strong>Type :</strong> {selectedType2.type_name}</p>
                      <p><strong>Carburant :</strong> {selectedType2.type_fuel}</p>
                      <p><strong>Puissance :</strong> {selectedType2.type_power_ps}cv</p>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recommandations */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>💡 Recommandations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-green-700">Utilisez la Version Optimisée si :</h3>
                <ul className="text-sm space-y-2 text-gray-700">
                  <li>✅ Vous avez beaucoup de données (&gt;100 types)</li>
                  <li>✅ L'expérience utilisateur est prioritaire</li>
                  <li>✅ Vous voulez de la recherche en temps réel</li>
                  <li>✅ Vous développez une nouvelle interface</li>
                  <li>✅ L'accessibilité est importante</li>
                  <li>✅ Vous voulez des fonctionnalités avancées</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-blue-700">Gardez la Version Simple si :</h3>
                <ul className="text-sm space-y-2 text-gray-700">
                  <li>📝 Vous avez peu de données (&lt;50 types)</li>
                  <li>📝 Vous migrez du code legacy</li>
                  <li>📝 La simplicité est prioritaire</li>
                  <li>📝 Vous voulez une solution rapide</li>
                  <li>📝 Le Select HTML natif suffit</li>
                  <li>📝 Vous évitez les dépendances</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Code Examples */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>📋 Codes d'utilisation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-700 mb-2">Version Optimisée :</h4>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`<TypeSelector
  value={selectedTypeId}
  onValueChange={(typeId, type) => {
    setSelectedType(type);
  }}
  modelId={selectedModelId}
  placeholder="Choisir un type..."
  searchPlaceholder="Rechercher..."
  showDetails={true}
  onlyActive={false}
  allowClear={true}
/>`}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold text-blue-700 mb-2">Votre Approche :</h4>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`<TypeSelectorSimple
  modelId={selectedModelId}
  onSelect={(type) => {
    setSelectedType(type);
  }}
  placeholder="Sélectionnez un type"
  showDetails={true}
  disabled={false}
/>`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
