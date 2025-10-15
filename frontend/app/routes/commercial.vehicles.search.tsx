/**
 * 🔍 RECHERCHE VÉHICULES AVANCÉE
 * 
 * Interface de recherche multicritères pour véhicules
 * Route: /commercial/vehicles/search
 */

import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, Link } from "@remix-run/react";
import { Car, Filter, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { requireUser } from "../auth/unified.server";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

interface VehicleSearchData {
  user: any;
  brands: Array<{
    id: number;
    name: string;
    code: string;
    logo?: string;
  }>;
  searchResults: Array<{
    type_id: number;
    type_name: string;
    type_carburant: string;
    type_puissance_cv: number;
    type_code_moteur: string;
    modele: {
      modele_id: number;
      modele_name: string;
      marque: {
        marque_id: number;
        marque_name: string;
        marque_logo?: string;
      };
    };
  }>;
  totalResults: number;
  currentFilters: {
    brandId?: string;
    modelId?: string;
    fuelType?: string;
    engineCode?: string;
    year?: string;
  };
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
  const searchParams = url.searchParams;
  const baseUrl = process.env.API_URL || "http://localhost:3000";

  // Récupérer les filtres de recherche
  const filters = {
    brandId: searchParams.get('brandId') || '',
    modelId: searchParams.get('modelId') || '',
    fuelType: searchParams.get('fuelType') || '',
    engineCode: searchParams.get('engineCode') || '',
    year: searchParams.get('year') || '',
    limit: '50',
    offset: '0'
  };

  try {
    // Récupérer les marques pour le filtre
    const brandsResponse = await fetch(`${baseUrl}/api/catalog/vehicles/brands`);
    let brands = [];
    
    if (brandsResponse.ok) {
      const brandsData = await brandsResponse.json();
      if (brandsData.success) {
        brands = brandsData.data;
      }
    }

    // Recherche de véhicules si des critères sont spécifiés
    let searchResults = [];
    let totalResults = 0;
    let error: string | undefined = undefined;

    const hasSearchCriteria = filters.brandId || filters.modelId || filters.fuelType || filters.engineCode || filters.year;
    
    if (hasSearchCriteria) {
      const searchQuery = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) searchQuery.append(key, value);
      });

      const searchResponse = await fetch(`${baseUrl}/api/catalog/vehicles/search?${searchQuery}`);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.success) {
          searchResults = searchData.data || [];
          totalResults = searchData.meta?.total || searchResults.length;
        } else {
          error = searchData.error;
        }
      } else {
        error = 'Erreur lors de la recherche';
      }
    }

    return json<VehicleSearchData>({
      user,
      brands,
      searchResults,
      totalResults,
      currentFilters: filters,
      error
    });
  } catch (err) {
    console.error('Erreur loader recherche véhicules:', err);
    return json<VehicleSearchData>({
      user,
      brands: [],
      searchResults: [],
      totalResults: 0,
      currentFilters: filters,
      error: 'Erreur serveur'
    });
  }
}

export default function VehiclesSearch() {
  const { brands, searchResults, totalResults, currentFilters, error } = useLoaderData<typeof loader>();
  
  const [filters, setFilters] = useState({
    brandId: currentFilters.brandId || '',
    modelId: currentFilters.modelId || '',
    fuelType: currentFilters.fuelType || '',
    engineCode: currentFilters.engineCode || '',
    year: currentFilters.year || ''
  });

  // Réinitialiser les filtres
  const clearFilters = () => {
    setFilters({
      brandId: '',
      modelId: '',
      fuelType: '',
      engineCode: '',
      year: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');
  const hasResults = searchResults.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔍 Recherche Véhicules</h1>
          <p className="text-gray-600 mt-1">
            Recherche multicritères dans la base véhicules
          </p>
        </div>
        <div className="text-sm text-gray-500">
          <Link to="../vehicles" className="text-blue-600 hover:underline">
            ← Retour véhicules
          </Link>
        </div>
      </div>

      {/* Formulaire de recherche */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Critères de recherche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="get" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Marque */}
              <div className="space-y-2">
                <label htmlFor="brandId" className="text-sm font-medium text-gray-700">
                  Marque
                </label>
                <Select
                  name="brandId"
                  value={filters.brandId}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, brandId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une marque" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Toutes les marques</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id.toString()}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type de carburant */}
              <div className="space-y-2">
                <label htmlFor="fuelType" className="text-sm font-medium text-gray-700">
                  Carburant
                </label>
                <Select
                  name="fuelType"
                  value={filters.fuelType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, fuelType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type de carburant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tous carburants</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="essence">Essence</SelectItem>
                    <SelectItem value="electrique">Électrique</SelectItem>
                    <SelectItem value="hybride">Hybride</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Code moteur */}
              <div className="space-y-2">
                <label htmlFor="engineCode" className="text-sm font-medium text-gray-700">
                  Code moteur
                </label>
                <Input
                  name="engineCode"
                  placeholder="Ex: DV6TED4"
                  value={filters.engineCode}
                  onChange={(e) => setFilters(prev => ({ ...prev, engineCode: e.target.value }))}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <Button type="submit" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Rechercher
              </Button>
              
              {hasActiveFilters && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={clearFilters}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Réinitialiser
                </Button>
              )}
              
              {hasResults && (
                <span className="text-sm text-gray-600">
                  {totalResults} véhicule{totalResults > 1 ? 's' : ''} trouvé{totalResults > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Messages d'erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {/* Résultats de recherche */}
      {hasResults ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Résultats de recherche ({totalResults})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {searchResults.map((vehicle, index) => (
                <div 
                  key={`${vehicle.type_id}-${index}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    {vehicle.modele?.marque?.marque_logo && (
                      <img 
                        src={vehicle.modele.marque.marque_logo} 
                        alt={vehicle.modele.marque.marque_name}
                        className="w-8 h-8 object-contain"
                      />
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">
                        {vehicle.modele?.marque?.marque_name} {vehicle.modele?.modele_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {vehicle.type_name}
                      </div>
                      {vehicle.type_code_moteur && (
                        <div className="text-xs text-gray-500">
                          Code moteur: {vehicle.type_code_moteur}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right text-sm">
                    <div className="font-medium capitalize">
                      {vehicle.type_carburant}
                    </div>
                    {vehicle.type_puissance_cv && (
                      <div className="text-gray-500">
                        {vehicle.type_puissance_cv} ch
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : hasActiveFilters && !error ? (
        <Card>
          <CardContent className="text-center py-8">
            <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun véhicule trouvé
            </h3>
            <p className="text-gray-600">
              Essayez de modifier vos critères de recherche
            </p>
          </CardContent>
        </Card>
      ) : !hasActiveFilters ? (
        <Card>
          <CardContent className="text-center py-8">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Recherche véhicules
            </h3>
            <p className="text-gray-600">
              Sélectionnez des critères pour commencer votre recherche
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Navigation */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Actions disponibles
            </h3>
            <p className="text-gray-600">
              Explorez les autres fonctionnalités véhicules
            </p>
          </div>
          <div className="flex space-x-3">
            <Link to="../vehicles/compatibility">
              <Button variant="outline" size="sm">
                Compatibilité pièces
              </Button>
            </Link>
            <Link to="../vehicles/brands">
              <Button variant="outline" size="sm">
                Catalogue marques
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
