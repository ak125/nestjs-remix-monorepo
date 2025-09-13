// 📁 frontend/app/routes/_index.optimized.tsx
// 🎯 VERSION OPTIMISÉE V2 - Page d'accueil avec sélecteur de véhicule amélioré

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useSearchParams, useLoaderData, useNavigate } from "@remix-run/react";
import { Shield, Clock, Phone, Users, ShoppingCart, Award } from 'lucide-react';
import { BrandCarousel } from "../components/home/BrandCarousel";
import { ProductCatalog } from "../components/home/ProductCatalog";
import VehicleSelector from "../components/home/VehicleSelector";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

// 🚀 Services API améliorés (utilise Enhanced Vehicle Service)
import { enhancedProductApi } from "../services/api/enhanced-product.api";
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

// 🔧 Loader optimisé utilisant les services Enhanced
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const selectedBrand = url.searchParams.get('marque');
    const selectedModel = url.searchParams.get('modele'); 
    const selectedYear = url.searchParams.get('annee');

    // 📊 Chargement parallèle pour de meilleures performances
    const [brandsResult, statsResult, productsResult] = await Promise.allSettled([
      enhancedVehicleApi.getBrands(),
      enhancedProductApi.getStats(),
      enhancedProductApi.getCategories()
    ]);

    // 📈 Extraction sécurisée des résultats
    const brands = brandsResult.status === 'fulfilled' ? brandsResult.value : [];
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : {
      totalProducts: 50000,
      totalBrands: 120,
      totalOrders: 25000,
      customerSatisfaction: 4.8
    };
    const categories = productsResult.status === 'fulfilled' ? productsResult.value : [];

    return json({
      brands,
      stats,
      categories,
      selectedBrand,
      selectedModel,
      selectedYear,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Loader error:', error);
    // 🛡️ Fallback data gracieux
    return json({
      brands: [],
      stats: {
        totalProducts: 50000,
        totalBrands: 120,
        totalOrders: 25000,
        customerSatisfaction: 4.8
      },
      categories: [],
      selectedBrand: null,
      selectedModel: null,
      selectedYear: null,
      timestamp: new Date().toISOString()
    });
  }
}

export default function IndexOptimized() {
  const { brands, stats, categories } = useLoaderData<typeof loader>();
  const [_searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 🚗 Gestion sélection véhicule avec navigation automatique
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
      console.log('🎯 Navigation automatique vers:', url);
      
      // Délai de 1.5 secondes pour laisser l'utilisateur voir la sélection complète
      setTimeout(() => {
        navigate(url);
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 🎯 Hero Section avec sélecteur hybride */}
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
          </div>

          {/* 🚗 Sélecteur de véhicule hybride avec cascade intelligente */}
          <div className="max-w-4xl mx-auto">
            <VehicleSelector 
              onVehicleSelected={handleVehicleSelected} 
              showMineSearch={true}
            />
          </div>

          {/* 📊 Statistiques en temps réel */}
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

      {/* 🎠 Carousel des marques populaires */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
            Marques populaires
          </h2>
                    <BrandCarousel brands={brands as any} />
        </div>
      </section>

      {/* 🛒 Catalogue de produits par catégorie */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
            Explorez nos catégories
          </h2>
          <ProductCatalog categories={categories} />
        </div>
      </section>

      {/* 🌟 Section avantages */}
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

      {/* 📞 Section contact et CTA */}
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
              <Link to="/catalogue">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Voir le catalogue
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}