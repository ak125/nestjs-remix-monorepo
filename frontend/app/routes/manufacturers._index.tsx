/**
 * 🏭 LISTE DES MANUFACTURIERS
 * 
 * Page publique listant toutes les marques automobiles
 * Route: /manufacturers
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Search, Car, ArrowRight } from "lucide-react";
import { useState } from "react";
import { BrandLogoClient } from "../components/BrandLogoClient";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";

interface Brand {
  marque_id: number;
  marque_name: string;
  models_count?: number;
}

interface LoaderData {
  brands: Brand[];
  total: number;
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = process.env.API_URL || "http://localhost:3000";

  try {
    // Récupérer toutes les marques
    const brandsResponse = await fetch(`${baseUrl}/api/vehicles/brands`, {
      headers: { 'internal-call': 'true' }
    });

    if (!brandsResponse.ok) {
      throw new Error(`API Error: ${brandsResponse.status}`);
    }

    const brandsData = await brandsResponse.json();
    const brands: Brand[] = brandsData.data?.map((brand: any) => ({
      marque_id: brand.marque_id,
      marque_name: brand.marque_name,
      models_count: brand.models_count || 0
    })) || [];

    return json({
      brands: brands.sort((a, b) => a.marque_name.localeCompare(b.marque_name)),
      total: brands.length
    } as LoaderData);

  } catch (error) {
    console.error("Erreur chargement marques:", error);
    return json({
      brands: [],
      total: 0,
      error: "Impossible de charger les marques"
    } as LoaderData);
  }
}

export default function ManufacturersIndex() {
  const { brands, total, error } = useLoaderData<typeof loader>();
  const [searchTerm, setSearchTerm] = useState("");

  // Filtrage côté client
  const filteredBrands = brands.filter(brand =>
    brand.marque_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <Car className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Marques Automobiles
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Découvrez notre catalogue complet de {total} marques automobiles 
          et explorez leurs modèles et spécifications techniques.
        </p>
      </div>

      {/* Barre de recherche */}
      <div className="max-w-md mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Rechercher une marque..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 max-w-2xl mx-auto">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{total}</div>
            <div className="text-gray-600">Marques disponibles</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {filteredBrands.length}
            </div>
            <div className="text-gray-600">Résultats affichés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {brands.reduce((sum, brand) => sum + (brand.models_count || 0), 0)}
            </div>
            <div className="text-gray-600">Modèles au total</div>
          </CardContent>
        </Card>
      </div>

      {/* Grille des marques */}
      {filteredBrands.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredBrands.map((brand) => (
            <Link 
              key={brand.marque_id} 
              to={`/manufacturers/${brand.marque_id}`}
              className="block"
            >
              <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group">
                <CardContent className="p-6 text-center">
                  {/* Logo de la marque */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 relative">
                      <BrandLogoClient 
                        logoPath={null} // L'API ne retourne pas logoPath pour l'instant
                        brandName={brand.marque_name}
                      />
                    </div>
                  </div>
                  
                  {/* Nom de la marque */}
                  <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {brand.marque_name}
                  </h3>
                  
                  {/* Nombre de modèles */}
                  <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
                    <Car className="h-4 w-4 mr-1" />
                    <span>{brand.models_count || 0} modèles</span>
                  </div>
                  
                  {/* Bouton d'action */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      size="sm" 
                      className="w-full"
                      variant="outline"
                    >
                      <span>Explorer</span>
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            Aucune marque trouvée
          </h3>
          <p className="text-gray-500">
            {searchTerm 
              ? `Aucune marque ne correspond à "${searchTerm}"`
              : "Aucune marque disponible pour le moment"
            }
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center justify-center space-x-2 text-sm text-gray-500">
          <span>Explorez nos marques et découvrez leurs spécifications</span>
        </div>
      </div>
    </div>
  );
}
