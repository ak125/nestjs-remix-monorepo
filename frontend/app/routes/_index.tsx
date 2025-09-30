import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useSearchParams, useLoaderData, useNavigate } from "@remix-run/react";
import { Shield, Clock, Phone, Users, ShoppingCart, Award, Car } from 'lucide-react';
import { AboutSection } from "../components/home/AboutSection";
import { EquipementiersCarousel } from "../components/home/EquipementiersCarousel";
import FamilyGammeHierarchy from "../components/home/FamilyGammeHierarchy";
import { TopGammes } from "../components/home/TopGammes";
import { SearchBarEnhancedHomepage } from "../components/search/SearchBarEnhancedHomepage";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";
import { enhancedVehicleApi } from "../services/api/enhanced-vehicle.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Pièces Auto - Leader des pièces automobiles | Trouvez vos pièces auto en ligne" },
    { name: "description", content: "Découvrez notre large gamme de pièces automobiles de qualité. Livraison rapide, prix compétitifs et service client expert." },
    { name: "keywords", content: "pièces auto, pièces automobiles, pièces détachées, auto, voiture, mécanique" },
    { property: "og:title", content: "Pièces Auto - Leader des pièces automobiles" },
    { property: "og:description", content: "Votre spécialiste en pièces automobiles de qualité" },
    { property: "og:type", content: "website" },
    { name: "robots", content: "index, follow" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const selectedBrand = url.searchParams.get('marque');
    const selectedModel = url.searchParams.get('modele'); 
    const selectedYear = url.searchParams.get('annee');

    const [brandsResult, hierarchyResult, topGammesResult, equipementiersResult] = await Promise.allSettled([
      enhancedVehicleApi.getBrands(),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/hierarchy/homepage`).then(res => res.json()),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/gammes/top`).then(res => res.json()),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/equipementiers`).then(res => res.json())
    ]);

    const rawBrands = brandsResult.status === 'fulfilled' ? brandsResult.value : [];
    const hierarchyData = hierarchyResult.status === 'fulfilled' ? hierarchyResult.value : null;
    const topGammesData = topGammesResult.status === 'fulfilled' ? topGammesResult.value : null;
    const equipementiersData = equipementiersResult.status === 'fulfilled' ? equipementiersResult.value : null;

    const brands = rawBrands.map(brand => ({
      id: brand.marque_id,
      code: brand.marque_name.toLowerCase().replace(/\s+/g, '-'),
      name: brand.marque_name,
      logo: brand.marque_logo ? `/upload/logos/marques/${brand.marque_logo}` : '/upload/logos/marques/default.webp',
      isActive: true,
      isFavorite: brand.is_featured || false,
      displayOrder: brand.marque_id
    }));

    return json({
      brands,
      hierarchyData,
      stats: {
        totalProducts: hierarchyData?.stats?.total_gammes || 0,
        totalBrands: 120,
        totalModels: 5000,
        totalOrders: 25000,
        customerSatisfaction: 4.8,
        formatted: {
          brands: '120+',
          pieces: `${Math.floor((hierarchyData?.stats?.total_gammes || 0) / 1000)}K+`,
          models: '5K+'
        }
      },
      categories: hierarchyData?.families || [],
      featuredCategories: topGammesData?.data?.gammes || [],
      quickAccess: [],
      topGammesData,
      equipementiersData,
      selectedBrand,
      selectedModel,  
      selectedYear,
      success: hierarchyData?.success || false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Loader error:', error);
    return json({
      brands: [],
      hierarchyData: null,
      stats: {
        totalProducts: 0,
        totalBrands: 0,
        totalModels: 0,
        totalOrders: 0,
        customerSatisfaction: 0,
        formatted: {
          brands: '0',
          pieces: '0',
          models: '0'
        }
      },
      categories: [],
      featuredCategories: [],
      quickAccess: [],
      topGammesData: null,
      equipementiersData: null,
      selectedBrand: null,
      selectedModel: null,
      selectedYear: null,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

export default function IndexOptimized() {
  const { brands, stats, hierarchyData, topGammesData, equipementiersData } = useLoaderData<typeof loader>();
  const [_searchParams] = useSearchParams();
  const navigate = useNavigate();

  const handleVehicleSelected = (selection: {
    brand?: any;
    model?: any;
    type?: any;
    year?: number;
  }) => {
    // Navigation uniquement si tous les éléments sont sélectionnés
    if (selection.brand && selection.model && selection.type) {
      const brandSlug = `${selection.brand.marque_alias}-${selection.brand.marque_id}`;
      const modelSlug = `${selection.model.modele_alias}-${selection.model.modele_id}`;
      
      // Gérer les types sans alias en créant un slug automatique
      let typeAlias = selection.type.type_alias;
      if (!typeAlias && selection.type.type_liter && selection.type.type_fuel) {
        const liter = (parseInt(selection.type.type_liter) / 100).toFixed(1).replace('.', '-');
        const fuel = selection.type.type_fuel.toLowerCase();
        typeAlias = `${liter}-${fuel}`;
      }
      
      const typeSlug = `${typeAlias || 'type'}-${selection.type.type_id}.html`;
      
      const url = `/constructeurs/${brandSlug}/${modelSlug}/${typeSlug}`;
      
      // Délai de 1.5 secondes pour laisser l'utilisateur voir la sélection complète
      setTimeout(() => {
        navigate(url);
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section avec sélecteur hybride */}
      <section className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white py-20">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              Trouvez vos pièces auto parfaites
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Plus de {stats.totalProducts?.toLocaleString() || '50 000'} pièces en stock - Livraison express
            </p>
            
            {/* Barre de recherche Enhanced Premium */}
            <div className="max-w-3xl mx-auto mb-8">
              <SearchBarEnhancedHomepage 
                placeholder="Recherchez des pièces auto par référence, marque ou catégorie..."
                className="mb-3"
                autoFocus={false}
              />
              <p className="text-sm text-blue-200 mt-3 flex items-center justify-center gap-2">
                <span className="inline-block w-1 h-1 bg-blue-300 rounded-full"></span>
                Ou sélectionnez votre véhicule ci-dessous pour un catalogue personnalisé
                <span className="inline-block w-1 h-1 bg-blue-300 rounded-full"></span>
              </p>
            </div>
          </div>

          {/* Sélecteur de véhicule hybride */}
          <div className="max-w-4xl mx-auto">
            <VehicleSelectorV2 
              mode="full"
              context="homepage"
              showVinSearch={false}
              onVehicleSelect={handleVehicleSelected}
              redirectOnSelect={true}
              redirectTo="vehicle-page"
              variant="card"
              className="bg-white/95 backdrop-blur-sm"
            />
          </div>

          {/* Logos des constructeurs populaires */}
          <div className="max-w-6xl mx-auto mt-12">
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold text-white mb-2">
                Marques automobiles populaires
              </h3>
              <p className="text-blue-200">
                Cliquez sur une marque pour accéder directement à son catalogue
              </p>
            </div>
            
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
              {brands?.filter(brand => brand.isFavorite || brand.isActive)
                .slice(0, 16)
                .map(brand => (
                <Link
                  key={brand.id}
                  to={`/constructeurs/${brand.code}-${brand.id}`}
                  className="group flex flex-col items-center p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 hover:scale-105"
                  title={`Pièces ${brand.name}`}
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 mb-2 bg-white rounded-lg p-2 flex items-center justify-center group-hover:shadow-lg transition-shadow">
                    <img
                      src={brand.logo}
                      alt={`Logo ${brand.name}`}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/upload/logos/marques/default.webp';
                      }}
                    />
                  </div>
                  <span className="text-xs md:text-sm font-medium text-white text-center group-hover:text-blue-100 transition-colors">
                    {brand.name}
                  </span>
                </Link>
              ))}
            </div>
            
            {/* Lien vers tous les constructeurs */}
            <div className="text-center mt-8">
              <Link
                to="/constructeurs"
                className="inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-lg border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300"
              >
                <Car className="w-5 h-5 mr-2" />
                Voir tous les constructeurs
              </Link>
            </div>
          </div>

          {/* Statistiques en temps réel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">{stats.totalProducts?.toLocaleString() || '50K'}</div>
              <div className="text-blue-100">Pièces en stock</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">{stats.totalBrands || '120'}+</div>
              <div className="text-blue-100">Marques référencées</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">{(stats as any).totalOrders?.toLocaleString() || '25K'}</div>
              <div className="text-blue-100">Commandes livrées</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">{(stats as any).customerSatisfaction || '4.8'}/5</div>
              <div className="text-blue-100">Satisfaction client</div>
            </div>
          </div>
        </div>
      </section>

      {/* Catalogue de produits par familles */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-800">
              Catalogue par familles
            </h2>
            <p className="text-gray-600 mt-4">
              Découvrez nos pièces automobiles organisées par familles techniques. Cliquez sur une famille pour explorer tous les produits disponibles.
            </p>
          </div>
          
          <FamilyGammeHierarchy hierarchyData={hierarchyData} />
        </div>
      </section>

      {/* Section gammes TOP */}
      <TopGammes topGammesData={topGammesData} />

      {/* Section À propos */}
      <AboutSection />

      {/* Section Équipementiers */}
      <EquipementiersCarousel equipementiersData={equipementiersData} />

      {/* Section avantages */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
            Pourquoi nous choisir ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Qualité garantie</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Toutes nos pièces sont certifiées et bénéficient d'une garantie constructeur
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Clock className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Livraison rapide</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Expédition sous 24h et livraison express disponible
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Support expert</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Nos mécaniciens vous conseillent pour choisir la bonne pièce
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Award className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Prix compétitifs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Les meilleurs prix du marché avec notre garantie du prix le plus bas
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Section contact et CTA */}
      <section className="py-16 bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Une question ? Besoin d'aide ?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Nos experts sont là pour vous accompagner dans votre recherche
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
              <Link to="/contact">
                <Phone className="mr-2 h-5 w-5" />
                Nous contacter
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-900">
              <Link to="/pieces/catalogue">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Catalogue pièces détachées
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}