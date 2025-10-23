import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Shield, Clock, Phone, Users, ShoppingCart, Award, TrendingUp, Package, Zap } from 'lucide-react';
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
    { title: "Vente pièces détachées auto neuves & à prix pas cher | AutoMecanik" },
    { name: "description", content: "Votre fournisseur de pièces détachées automobile neuves et d'origine pour toutes les marques & modèles. Livraison rapide, garantie constructeur, prix compétitifs." },
    { name: "keywords", content: "pieces detachees, pieces auto, pieces de rechange, pieces voiture, pieces automobile, pieces pas cher, renault, peugeot, citroen, audi, bmw, mercedes, ford, volkswagen" },
    { name: "robots", content: "index, follow" },
    { name: "author", content: "AutoMecanik" },
    // Open Graph
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://www.automecanik.com/" },
    { property: "og:title", content: "AutoMecanik - Pièces détachées auto à prix pas cher" },
    { property: "og:description", content: "Découvrez notre vaste catalogue de pièces automobiles neuves pour toutes marques" },
    { property: "og:image", content: "https://www.automecanik.com/assets/img/og-image.jpg" },
    // Twitter
    { property: "twitter:card", content: "summary_large_image" },
    { property: "twitter:title", content: "AutoMecanik - Pièces détachées auto à prix pas cher" },
    { property: "twitter:description", content: "Découvrez notre vaste catalogue de pièces automobiles neuves pour toutes marques" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const selectedBrand = url.searchParams.get('marque');
    const selectedModel = url.searchParams.get('modele'); 
    const selectedYear = url.searchParams.get('annee');

    const apiUrl = process.env.API_URL || 'http://localhost:3000';

    const [homepageDataResult, brandsResult, hierarchyResult, topGammesResult, equipementiersResult] = await Promise.allSettled([
      fetch(`${apiUrl}/api/catalog/pieces-gammes/homepage`).then(res => res.json()),
      enhancedVehicleApi.getBrands(),
      fetch(`${apiUrl}/api/catalog/hierarchy/homepage`).then(res => res.json()),
      fetch(`${apiUrl}/api/catalog/gammes/top`).then(res => res.json()),
      fetch(`${apiUrl}/api/catalog/equipementiers`).then(res => res.json())
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
        totalProducts: homepageData.data?.stats?.total_gammes || 50000,
        totalBrands: 120,
        totalModels: 5000,
        totalOrders: 25000,
        customerSatisfaction: 4.8,
        formatted: {
          brands: '120+',
          pieces: `${Math.floor((homepageData.data?.stats?.total_gammes || 50000) / 1000)}K+`,
          models: '5K+'
        }
      },
      categories: homepageData.data?.all_gammes || [],
      featuredCategories: homepageData.data?.featured_gammes || [],
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
        totalProducts: 50000,
        totalBrands: 120,
        totalModels: 5000,
        totalOrders: 25000,
        customerSatisfaction: 4.8,
        formatted: { brands: '120+', pieces: '50K+', models: '5K+' }
      },
      categories: [],
      featuredCategories: [],
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

export default function IndexV3() {
  const { stats, hierarchyData, topGammesData, equipementiersData, brands } = useLoaderData<typeof loader>();

  const handleVehicleSelected = (selection: {
    brand: any;
    model: any;
    type: any;
    year: number;
  }) => {
    console.log('🚗 Sélection reçue via VehicleSelectorV2:', selection);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      
      {/* ================================
          HERO SECTION - Version hybride optimale
          ================================ */}
      <section className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white py-16 md:py-24 overflow-hidden">
        {/* Background pattern overlay */}
        <div className="absolute inset-0 bg-black/10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzEgMCA2IDIuNjkgNiA2cy0yLjY5IDYtNiA2LTYtMi42OS02LTYgMi42OS02IDYtNk0yMCA0MGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTYiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
        
        <div className="relative container mx-auto px-4">
          {/* Hero Title & Subtitle */}
          <div className="text-center max-w-4xl mx-auto mb-10">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent animate-fade-in">
              Trouvez vos pièces auto parfaites
            </h1>
            <p className="text-lg md:text-2xl text-blue-100 mb-6 font-light">
              Plus de {stats.totalProducts?.toLocaleString('fr-FR') || '50 000'} pièces en stock
              <span className="mx-2">•</span>
              Livraison express
              <span className="mx-2">•</span>
              Garantie constructeur
            </p>
            
            {/* Barre de recherche produits */}
            <div className="max-w-2xl mx-auto mb-8">
              <ProductSearch variant="hero" showSubtext />
            </div>
          </div>

          {/* Sélecteur de véhicule V2 - Card design moderne */}
          <div className="max-w-5xl mx-auto mb-10">
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

          {/* Liens marques populaires avec logos */}
          <div className="max-w-5xl mx-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/20">
              <h3 className="text-center text-base md:text-lg font-semibold text-gray-800 mb-5 flex items-center justify-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Accès rapide par constructeur automobile
              </h3>
              <div className="flex flex-wrap justify-center gap-3">
                {brands.filter(b => b.isFavorite).slice(0, 12).map((brand) => (
                  <Link
                    key={brand.id}
                    to={`/constructeurs/${brand.code}-${brand.id}`}
                    className="group relative inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-xl transition-all duration-300 border border-blue-200 hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-700 transition-colors">
                      {brand.name}
                    </span>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-5 pt-4 border-t border-gray-200">
                <Link
                  to="/constructeurs"
                  className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 font-semibold transition-colors group"
                >
                  Voir tous les {brands.length} constructeurs disponibles
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Statistiques animées */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-12 max-w-4xl mx-auto">
            <StatCard 
              icon={<Package className="w-8 h-8" />}
              value={stats.formatted.pieces}
              label="Pièces en stock"
              color="yellow"
            />
            <StatCard 
              icon={<ShoppingCart className="w-8 h-8" />}
              value={`${stats.totalBrands}+`}
              label="Marques référencées"
              color="green"
            />
            <StatCard 
              icon={<TrendingUp className="w-8 h-8" />}
              value={`${Math.floor(stats.totalOrders / 1000)}K`}
              label="Commandes livrées"
              color="purple"
            />
            <StatCard 
              icon={<Award className="w-8 h-8" />}
              value={`${stats.customerSatisfaction}/5`}
              label="Satisfaction client"
              color="orange"
            />
          </div>
        </div>
      </section>

      {/* ================================
          CATALOGUE - Hiérarchie par familles
          ================================ */}
      <section className="py-16 md:py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Catalogue organisé par familles techniques
            </h2>
            <p className="text-lg text-gray-600">
              Découvrez nos pièces automobiles classées par système mécanique. 
              Navigation intuitive pour trouver rapidement la pièce qu'il vous faut.
            </p>
          </div>
          
          <FamilyGammeHierarchy hierarchyData={hierarchyData} />
        </div>
      </section>

      {/* ================================
          GAMMES TOP - Produits populaires
          ================================ */}
      <TopGammes topGammesData={topGammesData} />

      {/* ================================
          AVANTAGES - Pourquoi nous choisir
          ================================ */}
      <section className="py-16 md:py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Pourquoi choisir AutoMecanik ?
            </h2>
            <p className="text-lg text-gray-600">
              La vente de pièces automobiles en ligne révolutionne l'industrie. 
              Découvrez nos avantages exclusifs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Shield className="h-12 w-12" />}
              title="Qualité garantie"
              description="Toutes nos pièces sont neuves, d'origine constructeur ou équipementier, avec garantie fabricant incluse."
              color="blue"
            />
            <FeatureCard
              icon={<Zap className="h-12 w-12" />}
              title="Livraison rapide"
              description="Expédition sous 24h pour les pièces en stock. Livraison express partout en France."
              color="green"
            />
            <FeatureCard
              icon={<Award className="h-12 w-12" />}
              title="Prix compétitifs"
              description="Les meilleurs prix du marché grâce à notre plateforme en ligne sans intermédiaire."
              color="orange"
            />
            <FeatureCard
              icon={<Clock className="h-12 w-12" />}
              title="Service 24/7"
              description="Commandez à tout moment, notre plateforme est disponible jour et nuit."
              color="purple"
            />
            <FeatureCard
              icon={<Users className="h-12 w-12" />}
              title="Support expert"
              description="Nos mécaniciens vous conseillent pour choisir la bonne pièce adaptée à votre véhicule."
              color="indigo"
            />
            <FeatureCard
              icon={<ShoppingCart className="h-12 w-12" />}
              title="Paiement sécurisé"
              description="Transactions 100% sécurisées avec cryptage SSL. Plusieurs modes de paiement disponibles."
              color="teal"
            />
          </div>
        </div>
      </section>

      {/* ================================
          À PROPOS - Notre histoire
          ================================ */}
      <AboutSection />

      {/* ================================
          ÉQUIPEMENTIERS - Nos partenaires
          ================================ */}
      <EquipementiersCarousel equipementiersData={equipementiersData} />

      {/* ================================
          TÉMOIGNAGES CLIENTS
          ================================ */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE0YzMuMzEgMCA2IDIuNjkgNiA2cy0yLjY5IDYtNiA2LTYtMi42OS02LTYgMi42OS02IDYtNiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ce que disent nos clients
            </h2>
            <p className="text-xl text-blue-100">
              Plus de 15 000 clients nous font confiance
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <TestimonialCard
              quote="Excellent service et qualité des pièces. Je recommande AutoMecanik ! Livraison rapide et produits conformes à la description."
              author="Jean D."
              location="Paris"
            />
            <TestimonialCard
              quote="Très satisfait de mon achat. Les pièces sont d'origine et parfaitement compatibles avec mon véhicule. Le service client m'a aidé à choisir."
              author="Marie L."
              location="Lyon"
            />
            <TestimonialCard
              quote="Des prix imbattables ! J'ai économisé plus de 200€ par rapport à ma concession. La qualité est identique et la garantie constructeur est incluse."
              author="Pierre M."
              location="Marseille"
            />
            <TestimonialCard
              quote="Site très pratique avec une recherche intuitive. J'ai trouvé mes pièces en 2 minutes grâce au système de recherche par type mine."
              author="Sophie B."
              location="Toulouse"
            />
            <TestimonialCard
              quote="Service client au top ! Ils m'ont aidé à identifier la bonne pièce rapidement et ont répondu à toutes mes questions."
              author="Thomas R."
              location="Bordeaux"
            />
            <TestimonialCard
              quote="Garage professionnel, je commande régulièrement chez AutoMecanik. Fiabilité, qualité et rapidité sont toujours au rendez-vous."
              author="Garage Dupont"
              location="Lille"
            />
          </div>
        </div>
      </section>

      {/* ================================
          CTA - Call to action
          ================================ */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Prêt à découvrir nos produits ?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Explorez notre vaste gamme de pièces automobiles et profitez de nos promotions exclusives. 
            Plus de {stats.totalProducts.toLocaleString('fr-FR')} références en stock pour toutes les marques !
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all">
              <Link to="/pieces/catalogue">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Explorer le catalogue
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-blue-600 text-blue-600 hover:bg-info/20 px-8 py-6 text-lg">
              <Link to="#newsletter">
                Recevoir les offres exclusives
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ================================
          NEWSLETTER - Inscription
          ================================ */}
      <section id="newsletter" className="py-16 md:py-20 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              📧 Inscrivez-vous à notre newsletter
            </h2>
            <p className="text-lg text-gray-300 mb-2">
              Recevez en avant-première nos promotions, nouveautés et conseils d'experts
            </p>
            <p className="text-sm text-gray-400 mb-8">
              ✓ Offres exclusives · ✓ Guides pratiques · ✓ Conseils d'entretien
            </p>
            
            <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto mb-4">
              <input 
                type="email" 
                placeholder="votre@email.com" 
                className="flex-1 px-6 py-4 rounded-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <Button type="submit" size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all">
                S'inscrire
              </Button>
            </form>
            
            <p className="text-sm text-gray-400">
              🔒 Vos données sont protégées. Vous pouvez vous désabonner à tout moment.
            </p>
          </div>
        </div>
      </section>

      {/* ================================
          CONTACT - Une question ?
          ================================ */}
      <section className="py-16 bg-white border-t border-gray-200">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Une question ? Besoin d'aide ?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Nos experts sont là pour vous accompagner dans votre recherche
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link to="/contact">
                <Phone className="mr-2 h-5 w-5" />
                01 48 49 78 69
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/contact">
                Nous contacter
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ================================
// COMPOSANTS UTILITAIRES
// ================================

function StatCard({ icon, value, label, color }: { 
  icon: React.ReactNode; 
  value: string; 
  label: string; 
  color: 'yellow' | 'green' | 'purple' | 'orange' 
}) {
  const colorClasses = {
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400'
  };

  return (
    <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all duration-300 border border-white/20">
      <div className={`flex justify-center mb-2 ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-blue-100">{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'text-primary bg-primary/10 group-hover:bg-info/20',
    green: 'text-success bg-success/10 group-hover:bg-success/20',
    orange: 'text-orange-600 bg-orange-50 group-hover:bg-orange-100',
    purple: 'text-purple-600 bg-purple-50 group-hover:bg-purple-100',
    indigo: 'text-indigo-600 bg-indigo-50 group-hover:bg-indigo-100',
    teal: 'text-teal-600 bg-teal-50 group-hover:bg-teal-100',
  };

  return (
    <Card className="text-center hover:shadow-2xl transition-all duration-300 border-2 hover:border-blue-200 group">
      <CardHeader>
        <div className={`mx-auto mb-4 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${colorClasses[color]}`}>
          {icon}
        </div>
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function TestimonialCard({ quote, author, location }: {
  quote: string;
  author: string;
  location: string;
}) {
  return (
    <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
      <div className="text-4xl text-blue-300 mb-3">"</div>
      <p className="text-white/90 italic mb-4 leading-relaxed">{quote}</p>
      <footer className="font-semibold text-blue-200">
        — {author}, <span className="text-white/70">{location}</span>
      </footer>
    </div>
  );
}
