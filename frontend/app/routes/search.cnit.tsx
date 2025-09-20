/**
 * 🔍 RECHERCHE PAR CODE CNIT - VERSION OPTIMISÉE
 * 
 * Interface Remix pour rechercher des véhicules par code CNIT
 * Route: /search/cnit
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, Link } from "@remix-run/react";
import { useState } from "react";
import { Search, Car, AlertCircle, ArrowRight, Info } from "lucide-react";
import { VehicleCard } from "../components/vehicles/VehicleCard";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

interface LoaderData {
  vehicle?: {
    tnc_code: string;
    tnc_cnit: string;
    auto_type: {
      type_id: string;
      type_name: string;
      type_fuel: string;
      type_power_ps: string;
      type_power_kw: string;
      type_year_from: string;
      type_year_to?: string;
      type_engine?: string;
      type_liter?: string;
      type_body?: string;
      auto_modele: {
        modele_id: number;
        modele_name: string;
        modele_alias: string;
        auto_marque: {
          marque_id: number;
          marque_name: string;
          marque_logo?: string;
        };
      };
    };
  };
  searchTerm?: string;
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const cnitCode = url.searchParams.get('code')?.trim();
  
  if (!cnitCode) {
    return json<LoaderData>({ searchTerm: '' });
  }
  
  try {
    // ✅ URL corrigée pour correspondre à notre API backend
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/vehicles/search/cnit/${encodeURIComponent(cnitCode)}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      
      if (response.status === 404) {
        return json<LoaderData>({ 
          searchTerm: cnitCode,
          error: "Aucun véhicule trouvé pour ce code CNIT" 
        });
      }
      
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    const result = await response.json();
    
    // La réponse de notre API est un VehicleResponseDto
    if (result.data && result.data.length > 0) {
      return json<LoaderData>({ 
        vehicle: result.data[0], // Premier résultat
        searchTerm: cnitCode 
      });
    } else {
      return json<LoaderData>({ 
        searchTerm: cnitCode,
        error: "Aucun véhicule trouvé pour ce code CNIT" 
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    return json<LoaderData>({ 
      searchTerm: cnitCode,
      error: "Erreur lors de la recherche. Veuillez réessayer." 
    });
  }
}

export default function SearchCnitPage() {
  const { vehicle, searchTerm = '', error } = useLoaderData<typeof loader>();
  const [cnitCode, setCnitCode] = useState(searchTerm);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Car className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Recherche par code CNIT
          </h1>
        </div>
        <p className="text-gray-600">
          Le code CNIT (Code National d'Identification du Type) permet d'identifier 
          précisément une version de véhicule homologué en France.
        </p>
      </div>
      
      {/* Formulaire de recherche */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Code CNIT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="get" className="space-y-4">
            <div className="flex gap-4">
              <Input
                type="text"
                name="code"
                value={cnitCode}
                onChange={(e) => setCnitCode(e.target.value.toUpperCase())}
                placeholder="Exemple: ABC123DEF456"
                className="flex-1 font-mono uppercase"
                pattern="[A-Z0-9]{8,15}"
                maxLength={15}
                required
              />
              <Button
                type="submit"
                className="px-8 bg-green-600 hover:bg-green-700"
                disabled={!cnitCode.trim()}
              >
                <Search className="h-4 w-4 mr-2" />
                Rechercher
              </Button>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Le code CNIT se trouve sur la carte grise du véhicule dans la case K.
                Il est composé de lettres et de chiffres (généralement 8 à 12 caractères).
              </p>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Message d'erreur */}
      {error && (
        <Card className="mb-8 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <div>
                <div className="font-medium">Code CNIT non trouvé</div>
                <div className="text-sm text-red-600">{error}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résultat */}
      {vehicle && (
        <div className="space-y-6">
          <VehicleCard vehicle={vehicle} showDetails={true} />
          
          {/* Actions */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Actions disponibles</h3>
                  <p className="text-sm text-gray-600">
                    Que souhaitez-vous faire avec ce véhicule ?
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    to={`/vehicles/catalog/${vehicle.auto_type?.type_id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Voir les pièces compatibles
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/commercial/vehicles/compatibility?typeId=${vehicle.auto_type?.type_id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Vérifier compatibilité
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aide et suggestions */}
      {!vehicle && !error && searchTerm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Aucun résultat trouvé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-gray-600">
              <p className="mb-3">Suggestions :</p>
              <ul className="space-y-2 text-sm">
                <li>• Vérifiez l'orthographe du code CNIT</li>
                <li>• Assurez-vous que le code est complet</li>
                <li>• Essayez la recherche par code mine</li>
                <li>• Contactez notre support pour assistance</li>
              </ul>
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Link
                to="/search/mine"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Recherche par code mine
              </Link>
              <Link
                to="/commercial/vehicles/search"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Recherche avancée
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informations sur le CNIT */}
      {!searchTerm && (
        <Card className="bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg">Qu'est-ce qu'un code CNIT ?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Le Code National d'Identification du Type (CNIT) est un identifiant unique 
              attribué par les services de l'État français pour chaque version de véhicule 
              homologué. Il se trouve sur la carte grise dans la case K.
            </p>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Exemples de codes CNIT :</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <code className="bg-white px-3 py-2 rounded border">ABC123DEF456</code>
                <code className="bg-white px-3 py-2 rounded border">XYZ789ABC123</code>
                <code className="bg-white px-3 py-2 rounded border">DEF456GHI789</code>
                <code className="bg-white px-3 py-2 rounded border">GHI123JKL456</code>
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Différence avec le code mine :</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• <strong>Code mine (J.1)</strong> : Identifiant constructeur (plus technique)</li>
                <li>• <strong>Code CNIT (K)</strong> : Identifiant officiel français (homologation)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
