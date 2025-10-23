/**
 * 🚗 MARQUES VÉHICULES COMMERCIALES
 * 
 * Page listant toutes les marques afunction BrandLogo({ brand }: { brand: Brand }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { preloadImage, isImageCached } = useImagePreloader();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Construction de l'URL du logo en utilisant la fonction utilitaire optimisée
  const logoUrl = getBrandLogoUrl(brand.marque_name);isponibles
 * Route: /commercial/vehicles/brands
 */

import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ArrowLeft, Car, Search } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { requireUser } from "../auth/unified.server";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useImagePreloader } from "../hooks/useImagePreloader";

interface Brand {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  marque_logo: string;
  marque_sort: number;
}

interface LoaderData {
  brands: Brand[];
  totalBrands: number;
  error?: string;
}

export async function loader({ context, request }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });
  
  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect('/unauthorized');
  }

  const baseUrl = process.env.API_URL || "http://localhost:3000";
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';

  try {
    // Récupérer les marques
    const brandsResponse = await fetch(`${baseUrl}/api/vehicles/brands?search=${encodeURIComponent(search)}&limit=100`, {
      headers: { 'internal-call': 'true' }
    });
    
    if (!brandsResponse.ok) {
      throw new Error(`API Error: ${brandsResponse.status}`);
    }

    const brandsData = await brandsResponse.json();
    const brands: Brand[] = brandsData.data?.map((brand: any) => ({
      marque_id: brand.marque_id,
      marque_name: brand.marque_name,
      marque_alias: brand.marque_alias,
      marque_logo: brand.marque_logo,
      marque_sort: brand.marque_sort || 999
    })) || [];

    // Trier par nom de marque
    brands.sort((a, b) => a.marque_name.localeCompare(b.marque_name));

    return json({ 
      brands, 
      totalBrands: brands.length 
    } as LoaderData);

  } catch (error) {
    console.error("Erreur chargement marques:", error);
    return json({ 
      brands: [], 
      totalBrands: 0,
      error: "Impossible de charger les marques de véhicules" 
    } as LoaderData);
  }
}

function BrandLogo({ brand }: { brand: Brand }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { preloadImage, isImageCached, getBrandLogoUrl } = useImagePreloader();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Construction de l'URL du logo en utilisant le hook optimisé
  const logoUrl = getBrandLogoUrl(brand.marque_name);

  // Fallback avec initiales optimisées
  const getInitials = (name: string): string => {
    const words = name.split(' ').filter(word => word.length > 0);
    if (words.length === 1) {
      // Une seule lettre pour les noms courts
      return words[0][0].toUpperCase();
    }
    // Deux premières lettres des deux premiers mots
    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  };

  const initials = getInitials(brand.marque_name);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
  }, []);

  // Préchargement de l'image si pas encore en cache
  useEffect(() => {
    if (mounted && !isImageCached(logoUrl)) {
      preloadImage(logoUrl).catch(() => {
        // Ignore les erreurs de préchargement
      });
    }
  }, [mounted, logoUrl, preloadImage, isImageCached]);

  // Rendu côté serveur ou avant hydratation - afficher le fallback
  if (!mounted) {
    return (
      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-600 font-bold text-xl">
          {initials}
        </span>
      </div>
    );
  }

  // Si l'image a échoué, afficher le fallback
  if (imageError) {
    return (
      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-600 font-bold text-xl">
          {initials}
        </span>
      </div>
    );
  }

  // Affichage progressif : fallback pendant chargement, puis image
  return (
    <div className="w-16 h-16 relative">
      {/* Fallback pendant le chargement */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-gray-600 font-bold text-xl">
            {initials}
          </span>
        </div>
      )}
      
      {/* Image réelle avec transition fluide */}
      <img
        src={logoUrl}
        alt={`Logo ${brand.marque_name}`}
        className={`w-16 h-16 object-contain border rounded-lg p-1 transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export default function CommercialVehiclesBrands() {
  const { brands, totalBrands, error } = useLoaderData<typeof loader>();
  const [mounted, setMounted] = useState(false);
  const { preloadVisibleBrands, getCacheStats } = useImagePreloader();

  useEffect(() => {
    setMounted(true);
    console.log('🚀 Page montée côté client');
    
    // Précharger les logos des marques visibles
    if (brands && brands.length > 0) {
      preloadVisibleBrands(brands);
      
      // Log des statistiques de cache après un délai
      setTimeout(() => {
        const stats = getCacheStats();
        console.log('📊 Cache des logos:', stats);
      }, 2000);
    }
  }, [brands, preloadVisibleBrands, getCacheStats]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                <Link to="/dashboard" className="hover:text-gray-900">Commercial</Link>
                <span>/</span>
                <Link to="/commercial/vehicles" className="hover:text-gray-900">Véhicules</Link>
                <span>/</span>
                <span className="text-gray-900">Marques</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Marques Automobiles
              </h1>
              <p className="text-gray-600 mt-1">
                {totalBrands} marque{totalBrands > 1 ? 's' : ''} disponible{totalBrands > 1 ? 's' : ''}
                {mounted && <span className="text-green-600 ml-2">● Client hydraté</span>}
              </p>
            </div>
            
            <Button variant="outline" asChild>
              <Link to="/commercial/vehicles" className="flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Retour</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        {/* Barre de recherche */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Rechercher une marque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form method="get" className="flex gap-4">
              <Input
                name="search"
                placeholder="Nom de marque (ex: BMW, Audi, Mercedes...)"
                className="flex-1"
              />
              <Button type="submit">
                <Search className="h-4 w-4 mr-2" />
                Rechercher
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Message d'erreur */}
        {error && (
          <Alert intent="error"><strong>Erreur :</strong> {error}</Alert>
        )}

        {/* Grille des marques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {brands.map((brand) => (
            <Card key={brand.marque_id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link to={`/commercial/vehicles/brands/${brand.marque_id}/models`}>
                <CardContent className="p-6 text-center">
                  {/* Logo de la marque */}
                  <div className="flex justify-center mb-4">
                    <BrandLogo brand={brand} />
                  </div>
                  
                  {/* Nom de la marque */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {brand.marque_name}
                  </h3>
                  
                  {/* Alias */}
                  <p className="text-sm text-gray-500 mb-4">
                    {brand.marque_alias}
                  </p>
                  
                  {/* Bouton d'action */}
                  <Button variant="outline" size="sm" className="w-full">
                    Voir les modèles
                  </Button>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>

        {/* Message si aucune marque */}
        {brands.length === 0 && !error && (
          <Card>
            <CardContent className="text-center py-12">
              <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune marque trouvée</h3>
              <p className="text-gray-500">
                Essayez de modifier vos critères de recherche
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
