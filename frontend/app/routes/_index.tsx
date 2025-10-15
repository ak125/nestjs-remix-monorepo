import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useSearchParams, useLoaderData } from "@remix-run/react";
import { Shield, Clock, Phone, Users, ShoppingCart, Award } from 'lucide-react';
import { AboutSection } from "../components/home/AboutSection";
import { EquipementiersCarousel } from "../components/home/EquipementiersCarousel";
import FamilyGammeHierarchy from "../components/home/FamilyGammeHierarchy";
import { TopGammes } from "../components/home/TopGammes";
import { ProductSearch } from "../components/search/ProductSearch";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";
import { enhancedVehicleApi } from "../services/api/enhanced-vehicle.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Pièces Auto B2B - Plus de 50 000 pièces automobiles en stock | Livraison Express" },
    { name: "description", content: "Plateforme B2B leader pour les pièces automobiles. Plus de 50 000 références en stock, 120+ marques, livraison express 24h. Prix professionnels compétitifs et support expert." },
    { name: "keywords", content: "pièces auto b2b, pièces automobiles professionnelles, pièces détachées garage, catalogue pièces auto, distributeur pièces automobiles, pièces auto en ligne, équipementier automobile, pièces origine, pièces adaptables" },
    
    // Open Graph / Facebook
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://piecesauto.fr" },
    { property: "og:title", content: "Pièces Auto B2B - Leader des pièces automobiles professionnelles" },
    { property: "og:description", content: "50 000+ pièces en stock, 120+ marques, livraison express 24h. La plateforme B2B de référence pour les professionnels de l'automobile." },
    { property: "og:image", content: "https://piecesauto.fr/og-image.jpg" },
    { property: "og:locale", content: "fr_FR" },
    { property: "og:site_name", content: "Pièces Auto B2B" },
    
    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:url", content: "https://piecesauto.fr" },
    { name: "twitter:title", content: "Pièces Auto B2B - Plus de 50 000 pièces en stock" },
    { name: "twitter:description", content: "Plateforme B2B pour professionnels. Livraison express 24h, prix compétitifs, support expert." },
    { name: "twitter:image", content: "https://piecesauto.fr/twitter-image.jpg" },
    
    // SEO avancé
    { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
    { name: "googlebot", content: "index, follow" },
    { name: "author", content: "Pièces Auto B2B" },
    { name: "language", content: "fr" },
    { name: "revisit-after", content: "7 days" },
    { httpEquiv: "content-language", content: "fr" },
    
    // Mobile
    { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
    { name: "theme-color", content: "#2563eb" },
    { name: "apple-mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    
    // Liens canoniques et alternates
    { tagName: "link", rel: "canonical", href: "https://piecesauto.fr" },
    { tagName: "link", rel: "alternate", hrefLang: "fr", href: "https://piecesauto.fr" },
    { tagName: "link", rel: "alternate", hrefLang: "x-default", href: "https://piecesauto.fr" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const selectedBrand = url.searchParams.get('marque');
    const selectedModel = url.searchParams.get('modele'); 
    const selectedYear = url.searchParams.get('annee');

    const [homepageDataResult, brandsResult, hierarchyResult, topGammesResult, equipementiersResult] = await Promise.allSettled([
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/pieces-gammes/homepage`).then(res => res.json()),
      enhancedVehicleApi.getBrands(),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/hierarchy/homepage`).then(res => res.json()),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/gammes/top`).then(res => res.json()),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/equipementiers`).then(res => res.json())
    ]);

    const homepageData = homepageDataResult.status === 'fulfilled' ? homepageDataResult.value : {
      data: { featured_gammes: [], all_gammes: [], stats: { total_gammes: 0, featured_count: 0, displayed_count: 0 } },
      success: false
    };

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
        totalProducts: homepageData.data?.stats?.total_gammes || 0,
        totalBrands: 120,
        totalModels: 5000,
        totalOrders: 25000,
        customerSatisfaction: 4.8,
        formatted: {
          brands: '120+',
          pieces: `${Math.floor((homepageData.data?.stats?.total_gammes || 0) / 1000)}K+`,
          models: '5K+'
        }
      },
      categories: homepageData.data?.all_gammes || [],
      featuredCategories: homepageData.data?.featured_gammes || [],
      quickAccess: [],
      topGammesData,
      equipementiersData,
      selectedBrand,
      selectedModel,  
      selectedYear,
      success: homepageData.success,
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
  const { stats, hierarchyData, topGammesData, equipementiersData, brands } = useLoaderData<typeof loader>();
  const [_searchParams] = useSearchParams();

  const handleVehicleSelected = (selection: {
    brand: any;
    model: any;
    type: any;
    year: number;
  }) => {
    console.log('🚗 Sélection reçue via VehicleSelectorV2:', selection);
    // La navigation est gérée automatiquement par VehicleSelectorV2 avec redirectOnSelect={true}
  };

  // Données structurées JSON-LD pour le SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    "name": "Pièces Auto B2B",
    "description": "Plateforme B2B leader pour les pièces automobiles professionnelles",
    "url": "https://piecesauto.fr",
    "logo": "https://piecesauto.fr/logo.png",
    "image": "https://piecesauto.fr/og-image.jpg",
    "telephone": "+33-1-23-45-67-89",
    "email": "contact@piecesauto.fr",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Avenue des Pièces Auto",
      "addressLocality": "Paris",
      "postalCode": "75001",
      "addressCountry": "FR"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "48.8566",
      "longitude": "2.3522"
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "09:00",
        "closes": "18:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Saturday",
        "opens": "09:00",
        "closes": "12:00"
      }
    ],
    "priceRange": "€€",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "2500",
      "bestRating": "5",
      "worstRating": "1"
    },
    "sameAs": [
      "https://www.facebook.com/piecesautob2b",
      "https://twitter.com/piecesautob2b",
      "https://www.linkedin.com/company/piecesautob2b",
      "https://www.instagram.com/piecesautob2b"
    ],
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://piecesauto.fr/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* JSON-LD pour le SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
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
            
            {/* Barre de recherche produits avec dropdown de résultats */}
            <ProductSearch variant="hero" showSubtext />
          </div>

          {/* Sélecteur de véhicule V2 moderne */}
          <div className="max-w-4xl mx-auto">
            <VehicleSelectorV2 
              mode="full"
              variant="card"
              context="homepage"
              showVinSearch={true}
              redirectOnSelect={true}
              redirectTo="vehicle-page"
              onVehicleSelect={handleVehicleSelected}
            />
          </div>

          {/* Liens marques populaires */}
          <div className="max-w-4xl mx-auto mt-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg">
              <h3 className="text-center text-lg font-semibold text-gray-800 mb-4">
                🏭 Accès rapide par constructeur
              </h3>
              <div className="flex flex-wrap justify-center gap-3">
                {brands.filter(b => b.isFavorite).slice(0, 12).map((brand) => (
                  <Link
                    key={brand.id}
                    to={`/constructeurs/${brand.code}-${brand.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300 hover:shadow-md group"
                  >
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                      {brand.name}
                    </span>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-4">
                <Link
                  to="/constructeurs"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Voir tous les constructeurs
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
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
      <section id="about">
        <AboutSection />
      </section>

      {/* Section Équipementiers */}
      <EquipementiersCarousel equipementiersData={equipementiersData} />

      {/* Section avantages */}
      <section id="advantages" className="py-16 bg-white">
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

      {/* Section Témoignages clients */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Ils nous font confiance
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Découvrez les avis de nos clients professionnels qui utilisent notre plateforme B2B quotidiennement
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Témoignage 1 */}
            <Card className="bg-white hover:shadow-xl transition-shadow duration-300 border-t-4 border-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 italic mb-4 leading-relaxed">
                  "Service irréprochable ! Nous avons trouvé toutes les pièces dont nous avions besoin pour notre garage. La livraison est rapide et les prix sont compétitifs."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    JD
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Jean Dupont</p>
                    <p className="text-sm text-gray-500">Garage Auto Plus, Paris</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Témoignage 2 */}
            <Card className="bg-white hover:shadow-xl transition-shadow duration-300 border-t-4 border-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 italic mb-4 leading-relaxed">
                  "Une plateforme professionnelle et efficace. Le catalogue est complet et le support client est toujours disponible pour nous conseiller. Je recommande vivement !"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    ML
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Marie Lambert</p>
                    <p className="text-sm text-gray-500">Atelier Mécanique Pro, Lyon</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Témoignage 3 */}
            <Card className="bg-white hover:shadow-xl transition-shadow duration-300 border-t-4 border-purple-500">
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 italic mb-4 leading-relaxed">
                  "Excellent rapport qualité/prix et disponibilité impressionnante. Nous avons réduit nos délais de réparation grâce à leur stock permanent et leurs livraisons express."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    PM
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Pierre Martin</p>
                    <p className="text-sm text-gray-500">Centre Auto Service, Marseille</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statistiques de satisfaction */}
          <div className="mt-12 bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">98%</div>
                <div className="text-sm text-gray-600">Clients satisfaits</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-green-600 mb-2">4.8/5</div>
                <div className="text-sm text-gray-600">Note moyenne</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-purple-600 mb-2">2 500+</div>
                <div className="text-sm text-gray-600">Avis vérifiés</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-orange-600 mb-2">24h</div>
                <div className="text-sm text-gray-600">Livraison moyenne</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Restez informé de nos nouveautés
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Inscrivez-vous à notre newsletter et recevez en avant-première nos offres exclusives, nouveaux produits et conseils d'experts
            </p>
            
            <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
              <input
                type="email"
                placeholder="Votre adresse email professionnelle"
                className="flex-1 px-6 py-4 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg"
                required
              />
              <Button 
                type="submit"
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 px-8"
              >
                S'abonner
              </Button>
            </form>
            
            <p className="text-sm text-blue-200 mt-4">
              🔒 Vos données sont protégées. Désinscription possible à tout moment.
            </p>
            
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-100">Offres exclusives B2B</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-100">Conseils techniques</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-100">Nouveaux produits</span>
              </div>
            </div>
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