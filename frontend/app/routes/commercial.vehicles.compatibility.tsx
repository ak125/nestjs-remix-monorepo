/**
 * 🔧 COMPATIBILITÉ PIÈCES/VÉHICULES
 * 
 * Interface pour vérifier la compatibilité entre pièces et véhicules
 * Route: /commercial/vehicles/compatibility
 */

import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, Link } from "@remix-run/react";
import { ArrowRight, Car, Cog, Search } from "lucide-react";
import { useState } from "react";
import { requireUser } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

interface CompatibilityData {
  user: any;
  compatibilityResult?: {
    piece: {
      piece_id: string;
      piece_title: string;
      piece_ref: string;
      piece_marque: string;
      piece_gamme: string;
    };
    compatibleBrands: Array<{
      id: number;
      name: string;
      logo?: string;
      code: string;
    }>;
  };
  partsByVehicle?: Array<{
    piece_id: string;
    piece_title: string;
    piece_ref: string;
    piece_marque: string;
    piece_gamme: string;
    piece_price_public: number;
    piece_stock: number;
  }>;
  vehicleInfo?: {
    brandId: string;
    modelId: string;
    typeId?: string;
  };
  searchMode: 'piece-to-vehicle' | 'vehicle-to-parts' | null;
  error?: string;
}

export async function loader({ context, request }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });
  
  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect('/unauthorized');
  }

  const url = new URL(request.url);
  const pieceId = url.searchParams.get('pieceId');
  const brandId = url.searchParams.get('brandId');
  const modelId = url.searchParams.get('modelId');
  const typeId = url.searchParams.get('typeId');
  
  const baseUrl = process.env.API_URL || "http://localhost:3000";

  try {
    let compatibilityResult;
    let partsByVehicle;
    let vehicleInfo;
    let searchMode: 'piece-to-vehicle' | 'vehicle-to-parts' | null = null;
    let error: string | undefined = undefined;

    // Mode 1: Recherche des véhicules compatibles avec une pièce
    if (pieceId) {
      searchMode = 'piece-to-vehicle';
      const response = await fetch(`${baseUrl}/api/catalog/vehicles/compatibility/${pieceId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          compatibilityResult = data.data;
        } else {
          error = data.error;
        }
      } else {
        error = 'Erreur lors de la recherche de compatibilité';
      }
    }

    // Mode 2: Recherche des pièces pour un véhicule
    if (brandId && modelId) {
      searchMode = 'vehicle-to-parts';
      vehicleInfo = { brandId, modelId, typeId };
      
      const searchQuery = new URLSearchParams();
      searchQuery.append('brandId', brandId);
      searchQuery.append('modelId', modelId);
      if (typeId) searchQuery.append('typeId', typeId);
      searchQuery.append('limit', '50');

      const response = await fetch(`${baseUrl}/api/catalog/vehicles/parts/by-vehicle?${searchQuery}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          partsByVehicle = data.data;
        } else {
          error = data.error;
        }
      } else {
        error = 'Erreur lors de la recherche de pièces';
      }
    }

    return json<CompatibilityData>({
      user,
      compatibilityResult,
      partsByVehicle,
      vehicleInfo,
      searchMode,
      error
    });
  } catch (err) {
    console.error('Erreur loader compatibilité:', err);
    return json<CompatibilityData>({
      user,
      searchMode: null,
      error: 'Erreur serveur'
    });
  }
}

export default function VehiclesCompatibility() {
  const { compatibilityResult, partsByVehicle, vehicleInfo, searchMode, error } = useLoaderData<typeof loader>();
  
  const [pieceSearch, setPieceSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState({
    brandId: vehicleInfo?.brandId || '',
    modelId: vehicleInfo?.modelId || '',
    typeId: vehicleInfo?.typeId || ''
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔧 Compatibilité Pièces/Véhicules</h1>
          <p className="text-gray-600 mt-1">
            Vérifiez la compatibilité entre pièces et véhicules
          </p>
        </div>
        <div className="text-sm text-gray-500">
          <Link to="../vehicles" className="text-blue-600 hover:underline">
            ← Retour véhicules
          </Link>
        </div>
      </div>

      {/* Formulaires de recherche */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recherche pièce → véhicules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cog className="h-5 w-5" />
              Pièce → Véhicules compatibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="get" className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pieceId" className="text-sm font-medium text-gray-700">
                  ID de la pièce
                </label>
                <Input
                  name="pieceId"
                  placeholder="Ex: 12345"
                  value={pieceSearch}
                  onChange={(e) => setPieceSearch(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full flex items-center gap-2">
                <Search className="h-4 w-4" />
                Chercher véhicules compatibles
              </Button>
            </Form>
          </CardContent>
        </Card>

        {/* Recherche véhicule → pièces */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Véhicule → Pièces disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="get" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label htmlFor="brandId" className="text-sm font-medium text-gray-700">
                    ID Marque
                  </label>
                  <Input
                    name="brandId"
                    placeholder="Ex: 1"
                    value={vehicleSearch.brandId}
                    onChange={(e) => setVehicleSearch(prev => ({ ...prev, brandId: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="modelId" className="text-sm font-medium text-gray-700">
                    ID Modèle
                  </label>
                  <Input
                    name="modelId"
                    placeholder="Ex: 1"
                    value={vehicleSearch.modelId}
                    onChange={(e) => setVehicleSearch(prev => ({ ...prev, modelId: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="typeId" className="text-sm font-medium text-gray-700">
                  ID Type (optionnel)
                </label>
                <Input
                  name="typeId"
                  placeholder="Ex: 1"
                  value={vehicleSearch.typeId}
                  onChange={(e) => setVehicleSearch(prev => ({ ...prev, typeId: e.target.value }))}
                />
              </div>
              <Button type="submit" className="w-full flex items-center gap-2">
                <Search className="h-4 w-4" />
                Chercher pièces disponibles
              </Button>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Messages d'erreur */}
      {error && (
        <Alert intent="error"><strong>Erreur :</strong> {error}</Alert>
      )}

      {/* Résultats - Pièce vers véhicules */}
      {searchMode === 'piece-to-vehicle' && compatibilityResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Véhicules compatibles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Informations de la pièce */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">
                Pièce analysée
              </h3>
              <div className="text-sm space-y-1">
                <div><strong>ID:</strong> {compatibilityResult.piece.piece_id}</div>
                <div><strong>Nom:</strong> {compatibilityResult.piece.piece_title}</div>
                <div><strong>Référence:</strong> {compatibilityResult.piece.piece_ref}</div>
                <div><strong>Marque:</strong> {compatibilityResult.piece.piece_marque}</div>
                <div>
                  <strong>Gamme:</strong> 
                  <Badge variant="secondary" className="ml-2">
                    {compatibilityResult.piece.piece_gamme}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Marques compatibles */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Marques automobiles compatibles ({compatibilityResult.compatibleBrands.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {compatibilityResult.compatibleBrands.map((brand) => (
                  <div key={brand.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    {brand.logo && (
                      <img 
                        src={brand.logo} 
                        alt={brand.name}
                        className="w-8 h-8 object-contain"
                      />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{brand.name}</div>
                      <div className="text-sm text-gray-500">Code: {brand.code}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résultats - Véhicule vers pièces */}
      {searchMode === 'vehicle-to-parts' && partsByVehicle && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Pièces disponibles pour ce véhicule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info véhicule */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">
                Véhicule analysé
              </h3>
              <div className="text-sm">
                <strong>Marque ID:</strong> {vehicleInfo?.brandId} | 
                <strong> Modèle ID:</strong> {vehicleInfo?.modelId}
                {vehicleInfo?.typeId && (
                  <span> | <strong>Type ID:</strong> {vehicleInfo.typeId}</span>
                )}
              </div>
            </div>

            {/* Liste des pièces */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Pièces disponibles ({partsByVehicle.length})
              </h4>
              <div className="space-y-3">
                {partsByVehicle.map((part, index) => (
                  <div key={`${part.piece_id}-${index}`} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {part.piece_title}
                      </div>
                      <div className="text-sm text-gray-600">
                        Réf: {part.piece_ref} | Marque: {part.piece_marque}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                          {part.piece_gamme}
                        </Badge>
                        <span className={`text-xs ${part.piece_stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Stock: {part.piece_stock}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-blue-600">
                        {part.piece_price_public}€
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions si aucune recherche */}
      {!searchMode && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="flex items-center justify-center space-x-4 mb-6">
              <Cog className="h-12 w-12 text-gray-300" />
              <ArrowRight className="h-8 w-8 text-gray-400" />
              <Car className="h-12 w-12 text-gray-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Vérification de compatibilité
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Utilisez l'un des formulaires ci-dessus pour vérifier la compatibilité 
              entre pièces et véhicules dans les deux sens.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Outils connexes
            </h3>
            <p className="text-gray-600">
              Explorez les autres fonctionnalités du système
            </p>
          </div>
          <div className="flex space-x-3">
            <Link to="../vehicles/search">
              <Button variant="outline" size="sm">
                Recherche véhicules
              </Button>
            </Link>
            <Link to="../products">
              <Button variant="outline" size="sm">
                Catalogue produits
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
