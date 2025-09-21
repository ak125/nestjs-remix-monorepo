// 📁 frontend/app/routes/_index.optimized.tsx
// 🎯 VERSION OPTIMISÉE V2 - Page d'accueil avec sélecteur de véhicule amélioré

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useSearchParams, useLoaderData, useNavigate } from "@remix-run/react";
import { Shield, Clock, Phone, Users, ShoppingCart, Award } from 'lucide-react';
import { AboutSection } from "../components/home/AboutSection";
import DatabaseFamilyProductCatalog from "../components/home/DatabaseFamilyProductCatalog";
import { EquipementiersCarousel } from "../components/home/EquipementiersCarousel";
import FamilyGammeBentoEnhanced from "../components/home/FamilyGammeBentoEnhanced";
import FamilyGammeHierarchy from "../components/home/FamilyGammeHierarchy";
import { TopGammes } from "../components/home/TopGammes";
import VehicleSelector from "../components/home/VehicleSelector";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

// 🚀 Services API améliorés (utilise Enhanced Vehicle Service)
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

    // 🏠 Chargement optimisé avec toutes les APIs nécessaires
    const [homepageDataResult, brandsResult, hierarchyResult, topGammesResult, equipementiersResult] = await Promise.allSettled([
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/pieces-gammes/homepage`).then(res => res.json()),
      enhancedVehicleApi.getBrands(),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/hierarchy/homepage`).then(res => res.json()),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/gammes/top`).then(res => res.json()),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/equipementiers`).then(res => res.json())
    ]);

    // 📈 Extraction sécurisée des résultats avec nouvelle API pieces-gammes
    const homepageData = homepageDataResult.status === 'fulfilled' ? homepageDataResult.value : {
      data: {
        featured_gammes: [],
        all_gammes: [],
        stats: { total_gammes: 0, featured_count: 0, displayed_count: 0 }
      },
      success: false
    };

    const rawBrands = brandsResult.status === 'fulfilled' ? brandsResult.value : [];
    const hierarchyData = hierarchyResult.status === 'fulfilled' ? hierarchyResult.value : null;
    const topGammesData = topGammesResult.status === 'fulfilled' ? topGammesResult.value : null;
    const equipementiersData = equipementiersResult.status === 'fulfilled' ? equipementiersResult.value : null;

    // Transformation des données des marques pour le carousel
    const brands = rawBrands.map(brand => ({
      id: brand.marque_id,
      code: brand.marque_name.toLowerCase().replace(/\s+/g, '-'),
      name: brand.marque_name,
      logo: brand.marque_logo ? `/upload/logos/marques/${brand.marque_logo}` : '/upload/logos/marques/default.webp',
      isActive: true,
      isFavorite: brand.is_featured || false,
      displayOrder: brand.marque_id
    }));

    console.log('📊 Hierarchy data loaded in loader:', hierarchyData);
    console.log('🌟 TopGammes data loaded:', topGammesData?.stats);
    console.log('🏭 Equipementiers data loaded:', equipementiersData?.stats);
    console.log('🚗 Brands transformed:', brands.length, 'brands with logos');

    // 🎯 Structure optimisée pour la page d'accueil avec nouvelle API
    const pageData = {
      // Marques pour le carousel (marques transformées)
      brands,
      
      // Données de hiérarchie pour le catalogue
      hierarchyData,
      
      // Statistiques enrichies depuis pieces-gammes API
      stats: {
        totalProducts: homepageData.data?.stats?.total_gammes || 0,
        totalBrands: 120, // À récupérer depuis vehicleBrands.length
        totalModels: 5000,
        totalOrders: 25000,
        customerSatisfaction: 4.8,
        formatted: {
          brands: '120+',
          pieces: `${Math.floor((homepageData.data?.stats?.total_gammes || 0) / 1000)}K+`,
          models: '5K+'
        }
      },
      
      // Catégories de produits avec vraies données depuis pieces-gammes API
      categories: homepageData.data?.all_gammes || [],
      featuredCategories: homepageData.data?.featured_gammes || [],
      quickAccess: [], // Pas encore implémenté dans la nouvelle API
      
      // Nouvelles données pour les composants supplémentaires
      topGammesData,
      equipementiersData,
      
      // États du sélecteur
      selectedBrand,
      selectedModel,  
      selectedYear,
      
      // Métadonnées
      success: homepageData.success,
      timestamp: new Date().toISOString()
    };

    console.log(`🏠 Homepage data loaded: ${pageData.categories.length} gammes, ${pageData.brands.length} marques`);
    console.log(`🌟 TopGammes: ${topGammesData?.stats?.total_top_gammes || 0}, 🏭 Equipementiers: ${equipementiersData?.stats?.total_equipementiers || 0}`);

    return json(pageData);
  } catch (error) {
    console.error('Loader error:', error);
    // 🛡️ Fallback data gracieux
    return json({
      brands: [],
      hierarchyData: null,
      stats: {
        totalProducts: 50000,
        totalBrands: 120,
        totalOrders: 25000,
        customerSatisfaction: 4.8
      },
      categories: [],
      topGammesData: null,
      equipementiersData: null,
      selectedBrand: null,
      selectedModel: null,
      selectedYear: null,
      timestamp: new Date().toISOString()
    });
  }
}

export default function IndexOptimized() {
  const { stats, hierarchyData, topGammesData, equipementiersData } = useLoaderData<typeof loader>();
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
            
            {/* 🔍 SearchBar inspirée du code proposé */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher par référence, marque, modèle..."
                  className="w-full px-6 py-4 text-lg text-gray-900 bg-white rounded-lg shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300 pr-32"
                />
                <button className="absolute right-2 top-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  Rechercher
                </button>
              </div>
              <p className="text-sm text-blue-200 mt-2">
                Ou sélectionnez votre véhicule ci-dessous pour un catalogue personnalisé
              </p>
            </div>
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

      {/* ⚡ Section Accès rapide inspirée du code proposé */}
      <section className="py-12 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">
            Accès rapide
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
            <Link to="/catalog/freinage" className="group">
              <Card className="text-center hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                <CardContent className="p-4">
                  <div className="text-3xl mb-2">🛑</div>
                  <p className="font-medium text-sm">Freinage</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/catalog/moteur" className="group">
              <Card className="text-center hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                <CardContent className="p-4">
                  <div className="text-3xl mb-2">⚙️</div>
                  <p className="font-medium text-sm">Moteur</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/catalog/filtration" className="group">
              <Card className="text-center hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                <CardContent className="p-4">
                  <div className="text-3xl mb-2">🔧</div>
                  <p className="font-medium text-sm">Filtration</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/catalog/eclairage" className="group">
              <Card className="text-center hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                <CardContent className="p-4">
                  <div className="text-3xl mb-2">💡</div>
                  <p className="font-medium text-sm">Éclairage</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/catalog/suspension" className="group">
              <Card className="text-center hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                <CardContent className="p-4">
                  <div className="text-3xl mb-2">🚗</div>
                  <p className="font-medium text-sm">Suspension</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/catalog/carrosserie" className="group">
              <Card className="text-center hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                <CardContent className="p-4">
                  <div className="text-3xl mb-2">🔨</div>
                  <p className="font-medium text-sm">Carrosserie</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* 🛒 Catalogue de produits par familles */}
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
          
          {/* 🏗️ Catalogue simple reproduisant la logique PHP */}
          <FamilyGammeHierarchy hierarchyData={hierarchyData} />
          
          {/* � Autres designs (masqués) */}
          <div className="hidden">
            <FamilyGammeBentoEnhanced />
          </div>
          
          {/* 📋 Ancien composant pour comparaison (masqué) */}
          <div className="hidden">
            <div className="mb-8 text-center">
              <h3 className="text-xl font-semibold text-gray-700">
                📋 Ancien affichage (familles converties en gammes)
              </h3>
            </div>
            <DatabaseFamilyProductCatalog />
          </div>
        </div>
      </section>

      {/* 🌟 Section gammes TOP - Section 4 PHP */}
      <TopGammes topGammesData={topGammesData} />

      {/* 📋 Section À propos - Section 5 PHP */}
      <AboutSection />

      {/* 🏭 Section Équipementiers - Section 6 PHP */}
      <EquipementiersCarousel equipementiersData={equipementiersData} />

      {/* 🛍️ Section Catalogue de pièces */}
      <section className="py-16 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
        <div className="container mx-auto px-4">
          <div className="text-center text-white mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Catalogue complet de pièces détachées
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Plus de 50,000 pièces automobiles disponibles. Recherche avancée par catégorie, marque et véhicule.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
            {/* Catégories principales */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20">
              <div className="text-center">
                <div className="bg-red-500/20 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🛑</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Freinage</h3>
                <p className="text-blue-100 text-sm">8,743 pièces</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20">
              <div className="text-center">
                <div className="bg-blue-500/20 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚙️</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Moteur</h3>
                <p className="text-blue-100 text-sm">12,456 pièces</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20">
              <div className="text-center">
                <div className="bg-green-500/20 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔧</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Suspension</h3>
                <p className="text-blue-100 text-sm">6,521 pièces</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20">
              <div className="text-center">
                <div className="bg-yellow-500/20 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Électrique</h3>
                <p className="text-blue-100 text-sm">4,892 pièces</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20">
              <div className="text-center">
                <div className="bg-orange-500/20 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🚗</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Carrosserie</h3>
                <p className="text-blue-100 text-sm">9,876 pièces</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20">
              <div className="text-center">
                <div className="bg-purple-500/20 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🛠️</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Accessoires</h3>
                <p className="text-blue-100 text-sm">3,214 pièces</p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
              <Link to="/pieces/catalogue">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Explorer le catalogue complet
              </Link>
            </Button>
          </div>
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