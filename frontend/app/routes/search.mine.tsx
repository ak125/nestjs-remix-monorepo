/**
 * 🔍 RECHERCHE PAR CODE MINE - VERSION OPTIMISÉE
 * 
 * Interface Remix pour rechercher des véhicules par code mine
 * Route: /search/mine
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, Link } from "@remix-run/react";
import { Search, Car, AlertCircle, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { VehicleCard } from "~/components/vehicles/VehicleCard";

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
  const mineCode = url.searchParams.get('code')?.trim();
  
  if (!mineCode) {
    return json<LoaderData>({ searchTerm: '' });
  }
  
  try {
    // ✅ URL corrigée pour correspondre à notre API backend
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/vehicles/search/mine/${encodeURIComponent(mineCode)}`, {
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
          searchTerm: mineCode,
          error: "Aucun véhicule trouvé pour ce code mine" 
        });
      }
      
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    const result = await response.json();
    
    // La réponse de notre API est un VehicleResponseDto
    if (result.data && result.data.length > 0) {
      return json<LoaderData>({ 
        vehicle: result.data[0], // Premier résultat
        searchTerm: mineCode 
      });
    } else {
      return json<LoaderData>({ 
        searchTerm: mineCode,
        error: "Aucun véhicule trouvé pour ce code mine" 
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    return json<LoaderData>({ 
      searchTerm: mineCode,
      error: "Erreur lors de la recherche. Veuillez réessayer." 
    });
  }
}

export default function SearchMinePage() {
  const { vehicle, searchTerm = '', error } = useLoaderData<typeof loader>();
  const [mineCode, setMineCode] = useState(searchTerm);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Car className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Recherche par code mine
          </h1>
        </div>
        <p className="text-gray-600">
          Saisissez un code mine pour identifier précisément un véhicule et ses caractéristiques techniques.
        </p>
      </div>
      
      {/* Formulaire de recherche */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Code mine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="get" className="space-y-4">
            <div className="flex gap-4">
              <Input
                type="text"
                name="code"
                value={mineCode}
                onChange={(e) => setMineCode(e.target.value.toUpperCase())}
                placeholder="Exemple: M10RENAAG0D001"
                className="flex-1 font-mono uppercase"
                pattern="[A-Z0-9]{5,20}"
                maxLength={20}
                required
              />
              <Button
                type="submit"
                className="px-8"
                disabled={!mineCode.trim()}
              >
                <Search className="h-4 w-4 mr-2" />
                Rechercher
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Le code mine est un identifiant unique alphanumérique de 10 à 15 caractères
            </p>
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
                <div className="font-medium">Code mine non trouvé</div>
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
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
                <li>• Vérifiez l'orthographe du code mine</li>
                <li>• Assurez-vous que le code est complet</li>
                <li>• Essayez une recherche par marque et modèle</li>
                <li>• Contactez notre support pour assistance</li>
              </ul>
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Link
                to="/commercial/vehicles/search"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Recherche avancée
              </Link>
              <Link
                to="/support"
                className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700"
              >
                Contacter le support
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exemples de codes mine */}
      {!searchTerm && (
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="text-lg">Qu'est-ce qu'un code mine ?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Le code mine est un identifiant unique permettant d'identifier précisément 
              un véhicule et ses caractéristiques techniques. Il se trouve sur la carte grise 
              du véhicule dans la case J.1.
            </p>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Exemples de codes mine :</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <code className="bg-white px-3 py-2 rounded border">M10RENAAG0D001</code>
                <code className="bg-white px-3 py-2 rounded border">VP1BMWAA11A001</code>
                <code className="bg-white px-3 py-2 rounded border">VFCCITROEN2020</code>
                <code className="bg-white px-3 py-2 rounded border">VF7PEUGEOT3008</code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
