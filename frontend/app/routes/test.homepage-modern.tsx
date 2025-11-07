/**
 * 🎨 TEST HOMEPAGE MODERNE V2
 * 
 * Page d'accueil moderne combinant :
 * ✅ Logique métier de _index.tsx (VehicleSelector, FamilyGammeHierarchy, loaders)
 * ✅ Design patterns de index-v2.html (topbar, mega menu, lazy loading, accessibility)
 * ✅ Composants Shadcn UI (Carousel, Card, Button, Badge)
 * ✅ Design tokens du design system
 * ✅ Suppression des duplications
 * 
 * Structure finale :
 * 1. TopBar (téléphone + auth) - depuis index-v2.html
 * 2. Hero simplifié (recherche + 4 stats)
 * 3. VehicleSelector compacté - depuis _index.tsx
 * 4. Marques Carousel - Shadcn UI
 * 5. FamilyGammeHierarchy - depuis _index.tsx (logique métier existante)
 * 6. Avantages (4 cards uniques) - fusionné
 * 7. Témoignages Carousel - Shadcn UI
 * 8. Newsletter moderne
 * 9. CTA Contact compact
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Phone,
  Search,
  Shield,
  Star,
  Users,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";

import { EquipementiersCarousel } from "../components/home/EquipementiersCarousel";
import { TopGammes } from "../components/home/TopGammes";
import { TopBar } from "../components/navbar/TopBar";
import { NavbarModern } from "../components/NavbarModern";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../components/ui/carousel";
import VehicleSelectorTest from "../components/vehicle/VehicleSelectorTest";
import { brandApi } from "../services/api/brand.api";
import { hierarchyApi, type FamilyWithGammes } from "../services/api/hierarchy.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Catalogue de pièces détachées auto – Toutes marques & modèles | Automecanik" },
    { name: "description", content: "Découvrez le catalogue de pièces détachées auto Automecanik : pièces neuves pour toutes marques et modèles, adaptées au parc roulant français. Filtrez par constructeur, modèle, motorisation ou gamme de pièces pour trouver rapidement la référence compatible avec votre véhicule." },
    { name: "keywords", content: "catalogue pièces auto, catalogue de pièces détachées auto, pièces auto en ligne, catalogue pièces détachées, pièces auto toutes marques, catalogue professionnel pièces auto" },
    // Open Graph / Facebook
    { property: "og:type", content: "website" },
    { property: "og:title", content: "Catalogue de pièces détachées auto | Automecanik" },
    { property: "og:description", content: "50 000+ pièces auto en stock pour toutes marques. Livraison 24-48h. Qualité garantie." },
    { property: "og:image", content: "/images/og-image-catalog.jpg" },
    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Catalogue pièces auto | Automecanik" },
    { name: "twitter:description", content: "50 000+ pièces auto en stock pour toutes marques. Livraison 24-48h." },
    // Robots
    { name: "robots", content: "index, follow" },
    { name: "googlebot", content: "index, follow" },
  ];
};

// Preload critical resources
export function links() {
  return [
    { rel: "preconnect", href: "http://localhost:3000" },
    { rel: "dns-prefetch", href: "http://localhost:3000" },
  ];
}

/**
 * Loader - Charge les données nécessaires côté serveur
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Charger les données en parallèle comme dans _index.tsx
    const [topGammesResult, equipementiersResult] = await Promise.allSettled([
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/gammes/top`).then(res => res.json()),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/equipementiers`).then(res => res.json())
    ]);

    const topGammesData = topGammesResult.status === 'fulfilled' ? topGammesResult.value : null;
    const equipementiersData = equipementiersResult.status === 'fulfilled' ? equipementiersResult.value : null;

    return json({
      topGammesData,
      equipementiersData,
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Loader error:', error);
    return json({
      topGammesData: null,
      equipementiersData: null,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

const testimonials = [
  {
    id: 1,
    name: "Jean Dupont",
    role: "Gérant",
    company: "Garage Auto Plus, Paris",
    avatar: "JD",
    rating: 5,
    text: "Service irréprochable ! Nous avons trouvé toutes les pièces dont nous avions besoin. La livraison est rapide et les prix sont très compétitifs.",
    color: "from-blue-400 to-blue-600",
  },
  {
    id: 2,
    name: "Marie Lambert",
    role: "Responsable achats",
    company: "Atelier Mécanique Pro, Lyon",
    avatar: "ML",
    rating: 5,
    text: "Une plateforme professionnelle et efficace. Le catalogue est complet et le support client est toujours disponible pour nous conseiller.",
    color: "from-green-400 to-green-600",
  },
  {
    id: 3,
    name: "Pierre Martin",
    role: "Directeur technique",
    company: "Centre Auto Service, Marseille",
    avatar: "PM",
    rating: 5,
    text: "Excellent rapport qualité/prix et disponibilité impressionnante. Nous avons réduit nos délais de réparation grâce à leur stock permanent.",
    color: "from-purple-400 to-purple-600",
  },
];

export default function TestHomepageModern() {
  // Charger les données depuis le loader
  const { topGammesData, equipementiersData } = useLoaderData<typeof loader>();
  
  // État pour les données du catalogue
  const [families, setFamilies] = useState<FamilyWithGammes[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string | number>>(new Set());
  
  // État pour les marques
  const [brands, setBrands] = useState<Array<{ id: number; name: string; slug: string; logo: string | undefined }>>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);

  // Charger les données du catalogue
  useEffect(() => {
    const loadCatalogData = async () => {
      try {
        const data = await hierarchyApi.getHomepageData();
        setFamilies(data.families);
      } catch (error) {
        console.error('Erreur chargement catalogue:', error);
        setFamilies([]);
      } finally {
        setLoadingCatalog(false);
      }
    };

    loadCatalogData();
  }, []);

  // Charger toutes les marques depuis l'API
  useEffect(() => {
    const loadBrandsData = async () => {
      try {
        const brandsData = await brandApi.getAllBrandsWithLogos();
        console.log('🔍 [DEBUG] Brands loaded:', brandsData.length);
        console.log('🔍 [DEBUG] First 3 brands:', brandsData.slice(0, 3));
        console.log('🔍 [DEBUG] Sample logo URL:', brandsData[0]?.logo);
        setBrands(brandsData);
      } catch (error) {
        console.error('Erreur chargement marques:', error);
        setBrands([]);
      } finally {
        setLoadingBrands(false);
      }
    };

    loadBrandsData();
  }, []);

  // Fonction pour toggle l'expansion d'une famille
  const toggleFamilyExpansion = (familyId: string | number) => {
    console.log('Toggle family:', familyId);
    setExpandedFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(familyId)) {
        console.log('Collapsing family:', familyId);
        newSet.delete(familyId);
      } else {
        console.log('Expanding family:', familyId);
        newSet.add(familyId);
      }
      console.log('New expanded families:', Array.from(newSet));
      return newSet;
    });
  };
  const [email, setEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmittingNewsletter, setIsSubmittingNewsletter] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Smooth scroll behavior
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingNewsletter(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("Newsletter subscription:", email);
    setIsSubmittingNewsletter(false);
    setNewsletterSuccess(true);
    setEmail("");
    
    // Reset success message after 3 seconds
    setTimeout(() => setNewsletterSuccess(false), 3000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    console.log("Search query:", searchQuery);
    // Redirect vers /search?q=...
    window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
  };


  return (
    <div className="min-h-screen bg-white">
      {/* Schema.org JSON-LD pour SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AutoPartsStore",
            "name": "Automecanik",
            "description": "Catalogue de pièces détachées auto pour toutes marques et modèles",
            "url": "https://www.automecanik.com",
            "logo": "https://www.automecanik.com/logo.svg",
            "image": "https://www.automecanik.com/images/og-image-catalog.jpg",
            "telephone": "+33-1-23-45-67-89",
            "priceRange": "€€",
            "address": {
              "@type": "PostalAddress",
              "addressCountry": "FR"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "2500",
              "bestRating": "5",
              "worstRating": "1"
            },
            "offers": {
              "@type": "AggregateOffer",
              "priceCurrency": "EUR",
              "availability": "https://schema.org/InStock",
              "itemOffered": {
                "@type": "Product",
                "name": "Pièces détachées automobiles"
              }
            }
          })
        }}
      />

      {/* � Skip to main content - Accessibilité */}
      <a 
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Passer au contenu principal
      </a>

      {/* �📞 TopBar + Navbar pour cette page de test */}
      <TopBar 
        config={{
          tagline: "Pièces auto à prix pas cher",
          phone: "01 23 45 67 89",
          showQuickLinks: true,
        }}
        user={null}
      />
      <NavbarModern logo="/logo.svg" />
      
      {/* 🎯 HERO SECTION - Complet avec VehicleSelector */}
      <section 
        id="main-content"
        className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white py-20"
        aria-label="Section principale"
        role="banner"
      >
        <div className="absolute inset-0 bg-black/20" aria-hidden="true"></div>
        
        <div className="relative container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              Trouvez vos pièces auto parfaites
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Plus de 50 000 pièces en stock - Livraison express
            </p>
            
            {/* Barre de recherche produits (comme ProductSearch) */}
            <form 
              onSubmit={handleSearch} 
              className="bg-white rounded-xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2 mb-8"
              role="search"
              aria-label="Recherche de pièces automobiles"
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par référence OEM, mot-clé ou nom de pièce..."
                  className="w-full pl-12 pr-6 py-4 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  aria-label="Champ de recherche de pièces"
                  disabled={isSearching}
                />
              </div>
              <Button 
                type="submit" 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 px-8 transition-all hover:scale-105 disabled:opacity-50"
                aria-label="Lancer la recherche"
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Recherche...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" aria-hidden="true" />
                    Rechercher
                  </>
                )}
              </Button>
            </form>
            
            {/* Trust badges */}
            <div 
              className="flex flex-wrap justify-center gap-6 text-sm text-blue-100"
              role="list"
              aria-label="Avantages du service"
            >
              <div className="flex items-center gap-2" role="listitem">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center" aria-hidden="true">
                  <span className="text-green-300 text-xl">✓</span>
                </div>
                <span>Pièces certifiées</span>
              </div>
              <div className="flex items-center gap-2" role="listitem">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center" aria-hidden="true">
                  <span className="text-blue-300 text-xl">🚚</span>
                </div>
                <span>Livraison 24-48h</span>
              </div>
              <div className="flex items-center gap-2" role="listitem">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center" aria-hidden="true">
                  <span className="text-yellow-300 text-xl">★</span>
                </div>
                <span>4.8/5 • 2500 avis</span>
              </div>
            </div>
          </div>

          {/* 🚗 SÉLECTEUR DE VÉHICULE - Composant VehicleSelectorTest intégré */}
          <div className="max-w-4xl mx-auto mb-8">
            <VehicleSelectorTest />
          </div>

          {/* Statistiques en temps réel (de _index.tsx) */}
          <div 
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
            role="region"
            aria-label="Statistiques clés"
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400" aria-label="50 000 pièces en stock">50K</div>
              <div className="text-blue-100">Pièces en stock</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400" aria-label="Plus de 120 marques référencées">120+</div>
              <div className="text-blue-100">Marques référencées</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400" aria-label="25 000 commandes livrées">25K</div>
              <div className="text-blue-100">Commandes livrées</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400" aria-label="Note moyenne de 4.8 sur 5">4.8/5</div>
              <div className="text-blue-100">Satisfaction client</div>
            </div>
          </div>
        </div>
      </section>

      {/* 🎨 MARQUES & CONSTRUCTEURS AUTOMOBILES - Section SEO optimisée */}
      <section 
        id="nos-marques-partenaires" 
        className="py-16 bg-white scroll-mt-24"
        aria-labelledby="marques-title"
      >
        <div className="container mx-auto px-4">
          {/* En-tête SEO optimisé - Version compacte */}
          <div className="max-w-5xl mx-auto mb-12">
            <h1 id="marques-title" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
              Toutes les marques de voitures par constructeur
            </h1>
            
            {/* Intro compacte et discrète */}
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4 mb-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-blue-900">Automecanik</strong> met à votre disposition l'ensemble des <strong>marques de constructeurs automobiles</strong> européens et internationaux 
                commercialisées en Europe et sur le <strong>marché français</strong>. Les marques sont présentées par ordre alphabétique, accompagnées du <strong>logo de chaque constructeur</strong>.
              </p>
              <details className="mt-3">
                <summary className="text-sm font-medium text-blue-700 cursor-pointer hover:text-blue-900 transition-colors">
                  En savoir plus sur notre catalogue →
                </summary>
                <div className="mt-3 text-sm text-gray-600 space-y-2 pl-4 border-l-2 border-blue-200">
                  <p>
                    Après avoir sélectionné le constructeur, vous pouvez choisir le <strong>modèle de votre véhicule</strong> pour afficher toutes les <strong>pièces détachées compatibles</strong>.
                  </p>
                  <p className="font-medium text-gray-700">Vous avez également la possibilité :</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Consulter la page <Link to="/equipementiers" className="text-blue-600 hover:text-blue-800 underline font-medium">Équipementiers</Link> pour choisir votre marque préférée</li>
                    <li>• Passer par la <Link to="/" className="text-blue-600 hover:text-blue-800 underline font-medium">page d'accueil</Link> et filtrer par gamme de pièces</li>
                    <li>• Consulter le <Link to="/blog" className="text-blue-600 hover:text-blue-800 underline font-medium">blog Automecanik</Link> pour des conseils et tutoriels</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>

          {/* Fil d'Ariane compact */}
          <nav className="flex mb-6 text-xs max-w-5xl mx-auto" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1">
              <li className="inline-flex items-center">
                <Link 
                  to="/" 
                  className="text-gray-500 hover:text-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-sm"
                >
                  Accueil
                </Link>
              </li>
              <li className="flex items-center">
                <ChevronRight className="w-3 h-3 text-gray-400 mx-1" aria-hidden="true" />
                <span className="text-gray-700 font-medium">Marques & Constructeurs</span>
              </li>
            </ol>
          </nav>

          {/* Titre H2 discret */}
          <div className="text-center mb-6 max-w-5xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Liste complète des marques automobiles
            </h2>
            <p className="text-sm text-gray-500">
              Cliquez sur un logo pour découvrir tous les modèles et pièces disponibles
            </p>
          </div>

          {/* Loading state */}
          {loadingBrands ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des marques...</p>
            </div>
          ) : (
            <>
              {/* Grid simple sans groupement alphabétique - Plus lisible */}
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-8 gap-4 max-w-7xl mx-auto mb-16">
                {brands
                  .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                  .map((brand, index) => (
                    <Link
                      key={brand.id}
                      to={`/constructeurs/${brand.slug}-${brand.id}.html`}
                      className="group animate-in fade-in duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 rounded-lg"
                      style={{
                        animationDelay: `${index * 20}ms`,
                        animationFillMode: 'both',
                      }}
                      aria-label={`Voir les pièces ${brand.name}`}
                    >
                      {/* Card optimale - Équilibre parfait */}
                      <div className="relative overflow-hidden bg-white rounded-lg border border-gray-100 hover:border-blue-400 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 aspect-square">
                        {/* Logo avec fallback simple */}
                        <div className="w-full h-full p-3 flex items-center justify-center bg-gray-50">
                          {brand.logo ? (
                            <img
                              src={brand.logo}
                              alt={`Logo ${brand.name}`}
                              className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                              loading="lazy"
                              decoding="async"
                              width="200"
                              height="200"
                              onError={(e) => {
                                console.error('❌ Erreur chargement logo:', brand.name, brand.logo);
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.fallback-text');
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`fallback-text text-gray-400 text-sm font-bold text-center ${brand.logo ? 'hidden' : ''}`}>
                            {brand.name.substring(0, 3).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
              </div>
            </>
          )}

          {/* CTA simple et discret */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-gray-600 mb-6">
              Vous ne trouvez pas votre marque ?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Link to="/contact">
                  <Phone className="mr-2 h-5 w-5" />
                  Nous contacter
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/pieces/">
                  Voir le catalogue
                </Link>
              </Button>
            </div>
          </div>

          {/* FAQ SEO - Accordion amélioré */}
          <div 
            className="max-w-4xl mx-auto mt-16 pt-12 border-t-2 border-blue-100"
            role="region"
            aria-labelledby="faq-title"
          >
            <div className="text-center mb-8">
              <h2 id="faq-title" className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                Questions fréquemment posées
              </h2>
              <p className="text-gray-600">
                Tout ce que vous devez savoir sur nos marques et pièces automobiles
              </p>
            </div>
            
            <Accordion type="single" collapsible className="w-full space-y-3">
              <AccordionItem value="item-1" className="bg-white border-2 border-gray-200 rounded-xl px-6 py-1 hover:border-blue-300 transition-colors">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-blue-600 py-4">
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold" aria-hidden="true">1</span>
                    Combien de marques automobiles proposez-vous ?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-4 pl-11">
                  <p className="mb-3">
                    Nous référençons actuellement <strong className="text-blue-600">{loadingBrands ? '...' : brands.length} marques de constructeurs automobiles</strong>, 
                    couvrant l'ensemble du marché européen, asiatique et américain.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-blue-50 p-4 rounded-lg">
                    <div>
                      <strong className="text-gray-900 block mb-1">🇫🇷 Marques françaises</strong>
                      <span className="text-xs text-gray-600">Renault, Peugeot, Citroën, DS, Dacia</span>
                    </div>
                    <div>
                      <strong className="text-gray-900 block mb-1">🇩🇪 Marques allemandes</strong>
                      <span className="text-xs text-gray-600">VW, BMW, Mercedes, Audi, Opel, Porsche</span>
                    </div>
                    <div>
                      <strong className="text-gray-900 block mb-1">🌏 Marques asiatiques</strong>
                      <span className="text-xs text-gray-600">Toyota, Honda, Nissan, Mazda, Hyundai, Kia</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="bg-white border-2 border-gray-200 rounded-xl px-6 py-1 hover:border-blue-300 transition-colors">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-blue-600 py-4">
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Quelles sont les marques les plus consultées par nos clients ?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-4 pl-11">
                  <p className="mb-3">
                    Les marques les plus populaires auprès de nos clients professionnels et particuliers :
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-transparent p-3 rounded-lg">
                      <span className="text-2xl">🥇</span>
                      <div>
                        <strong className="text-gray-900 block">Top 3 Françaises</strong>
                        <span className="text-xs text-gray-600">Renault • Peugeot • Citroën</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-transparent p-3 rounded-lg">
                      <span className="text-2xl">🥈</span>
                      <div>
                        <strong className="text-gray-900 block">Top 4 Allemandes Premium</strong>
                        <span className="text-xs text-gray-600">Volkswagen • BMW • Mercedes-Benz • Audi</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-transparent p-3 rounded-lg">
                      <span className="text-2xl">🥉</span>
                      <div>
                        <strong className="text-gray-900 block">Top 3 Asiatiques</strong>
                        <span className="text-xs text-gray-600">Toyota • Nissan • Honda</span>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="bg-white border-2 border-gray-200 rounded-xl px-6 py-1 hover:border-blue-300 transition-colors">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-blue-600 py-4">
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    Proposez-vous des pièces détachées pour toutes les marques ?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-4 pl-11">
                  <p className="mb-3">
                    <strong className="text-blue-600">Oui, absolument !</strong> Nous proposons plus de <strong>50 000 références de pièces détachées</strong> compatibles 
                    avec l'ensemble des marques présentes dans notre catalogue.
                  </p>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                    <p className="font-semibold text-gray-900 mb-2">📦 Nos catégories de pièces :</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Moteur & distribution</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Freinage</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Suspension & amortisseurs</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Carrosserie & optique</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Système électrique</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Filtration & entretien</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Embrayage & transmission</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Échappement</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Climatisation</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="bg-white border-2 border-gray-200 rounded-xl px-6 py-1 hover:border-blue-300 transition-colors">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-blue-600 py-4">
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    Comment trouver les pièces compatibles avec mon véhicule ?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-4 pl-11">
                  <p className="mb-4">
                    <strong className="text-blue-600">Plusieurs méthodes simples et rapides</strong> pour trouver les bonnes pièces :
                  </p>
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start bg-blue-50 p-3 rounded-lg">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <div>
                        <strong className="text-gray-900 block mb-1">Par logo de marque</strong>
                        <p className="text-xs text-gray-600">Cliquez sur le logo de votre constructeur → Sélectionnez le modèle → Choisissez l'année et la motorisation</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start bg-green-50 p-3 rounded-lg">
                      <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <div>
                        <strong className="text-gray-900 block mb-1">Par numéro VIN (recommandé)</strong>
                        <p className="text-xs text-gray-600">Saisissez votre numéro de châssis pour une <strong>compatibilité garantie à 100%</strong></p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start bg-purple-50 p-3 rounded-lg">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <div>
                        <strong className="text-gray-900 block mb-1">Par référence OEM</strong>
                        <p className="text-xs text-gray-600">Utilisez la référence constructeur de votre pièce actuelle dans notre barre de recherche</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800 flex items-start gap-2">
                      <span className="text-lg">💡</span>
                      <span><strong>Conseil :</strong> Besoin d'aide ? Notre équipe d'experts est disponible pour vous accompagner dans votre recherche et vous garantir la pièce adaptée.</span>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="bg-white border-2 border-gray-200 rounded-xl px-6 py-1 hover:border-blue-300 transition-colors">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-blue-600 py-4">
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">5</span>
                    Proposez-vous des pièces d'origine ou des pièces équivalentes ?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-4 pl-11">
                  <p className="mb-4">
                    Nous proposons <strong className="text-blue-600">les deux options</strong> pour vous offrir le meilleur rapport qualité/prix :
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border-2 border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        <strong className="text-gray-900">Pièces d'origine constructeur</strong>
                      </div>
                      <ul className="space-y-1 text-xs text-gray-700">
                        <li>• Garantie constructeur</li>
                        <li>• Qualité OEM certifiée</li>
                        <li>• Compatibilité parfaite</li>
                        <li>• Traçabilité complète</li>
                      </ul>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-2 border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-5 h-5 text-green-600" />
                        <strong className="text-gray-900">Pièces équivalentes premium</strong>
                      </div>
                      <ul className="space-y-1 text-xs text-gray-700">
                        <li>• Qualité équivalente certifiée</li>
                        <li>• Normes constructeurs respectées</li>
                        <li>• Prix plus avantageux</li>
                        <li>• Garantie fabricant</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-gray-800 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-green-600 inline mr-1" />
                      <strong>Notre engagement :</strong> Toutes nos pièces, qu'elles soient d'origine ou équivalentes, sont rigoureusement 
                      sélectionnées et testées pour garantir fiabilité, sécurité et conformité aux standards européens.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="bg-white border-2 border-gray-200 rounded-xl px-6 py-1 hover:border-blue-300 transition-colors">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-blue-600 py-4">
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">6</span>
                    Quels sont vos délais de livraison ?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-4 pl-11">
                  <p className="mb-3">
                    <strong className="text-blue-600">Livraison rapide partout en France</strong> pour réduire vos temps d'immobilisation :
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-green-600" />
                        <strong className="text-gray-900">Standard</strong>
                      </div>
                      <p className="text-xs text-gray-600">
                        <strong className="text-green-600">24-48h</strong> pour les pièces en stock
                      </p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-5 h-5 text-orange-600" />
                        <strong className="text-gray-900">Express</strong>
                      </div>
                      <p className="text-xs text-gray-600">
                        <strong className="text-orange-600">Livraison J+1</strong> disponible
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* 📂 CATALOGUE COMPLET - Version compacte SEO optimisée */}
      <section id="catalogue" className="py-16 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto px-4">
          {/* En-tête SEO optimisé et compact */}
          <div className="text-center mb-12 max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Catalogue de pièces détachées auto pour toutes marques
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-4"></div>
            
            {/* Texte SEO optimisé compact */}
            <p className="text-base text-gray-700 leading-relaxed mb-6">
              Le <strong>catalogue de pièces détachées auto Automecanik</strong> vous permet de trouver rapidement la pièce adaptée à votre véhicule.
              Nous proposons des <strong>pièces neuves</strong> pour la majorité des marques et modèles présents sur le <strong>marché français</strong>.
              Recherchez par immatriculation, constructeur, modèle ou gamme et accédez aux <strong>références compatibles</strong> en quelques clics.
            </p>

            {/* Méthodes de recherche compactes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-blue-200 hover:border-blue-400 transition-colors">
                <div className="flex items-center gap-2 justify-center">
                  <Search className="w-4 h-4 text-blue-600" />
                  <strong className="text-sm text-gray-900">Par immatriculation</strong>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-indigo-200 hover:border-indigo-400 transition-colors">
                <div className="flex items-center gap-2 justify-center">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <strong className="text-sm text-gray-900">Par constructeur</strong>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-purple-200 hover:border-purple-400 transition-colors">
                <div className="flex items-center gap-2 justify-center">
                  <Award className="w-4 h-4 text-purple-600" />
                  <strong className="text-sm text-gray-900">Par numéro VIN</strong>
                </div>
              </div>
            </div>

            <Link 
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg hover:scale-105"
            >
              <Search className="w-4 h-4" />
              Rechercher par véhicule
            </Link>
          </div>

          {/* H2 SEO : Parcourez par gamme - Version compacte */}
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 text-center">
              Parcourez le catalogue par gamme de pièces détachées
            </h2>
            <p className="text-center text-gray-600 text-sm max-w-2xl mx-auto mb-8">
              Explorez notre catalogue organisé par familles techniques
            </p>
          </div>

          {/* Loading state */}
          {loadingCatalog && (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement du catalogue...</p>
            </div>
          )}

          {/* Grid des familles */}
          {!loadingCatalog && families.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {families.map((family, index) => {
                  const familyImage = hierarchyApi.getFamilyImage(family);
                  const familyColor = hierarchyApi.getFamilyColor(family);
                  const isExpanded = expandedFamilies.has(family.mf_id);
                  const displayedGammes = isExpanded ? family.gammes : family.gammes.slice(0, 4);
                  // Générer un ID basé sur le nom de la famille pour le scroll navigation
                  const familySlug = (family.mf_name_system || family.mf_name || '')
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');

                  return (
                    <Card 
                      key={family.mf_id} 
                      id={`famille-${familySlug}`}
                      className="group hover:shadow-xl hover:-translate-y-2 transition-all duration-slower overflow-hidden scroll-mt-24"
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      {/* Image header avec couleur en fond */}
                      <div className={`relative h-48 overflow-hidden bg-gradient-to-br ${familyColor}`}>
                        <img
                          src={familyImage}
                          alt={family.mf_name_system || family.mf_name}
                          className="w-full h-full object-contain transition-transform duration-slower group-hover:scale-105"
                          loading="lazy"
                          decoding="async"
                          width="400"
                          height="300"
                          onError={(e) => {
                            e.currentTarget.src = '/images/categories/default.svg';
                          }}
                        />

                        {/* Titre - overlay qui s'intensifie au hover */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent group-hover:from-black/80 transition-colors duration-slower">
                          <h3 className="text-white font-bold text-lg line-clamp-2">
                            {family.mf_name_system || family.mf_name}
                          </h3>
                        </div>
                      </div>

                      {/* Contenu avec sous-catégories */}
                      <CardContent className="pt-4">
                        {/* Description */}
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {family.mf_description || 'Découvrez notre sélection complète'}
                        </p>

                        {/* Liste des sous-catégories (4 ou toutes selon isExpanded) */}
                        <div className="space-y-2.5 mb-4 max-h-96 overflow-y-auto">
                          {displayedGammes.map((gamme, idx) => (
                            <Link
                              key={idx}
                              to={`/pieces/${gamme.pg_alias}.html`}
                              className="text-sm text-slate-600 hover:text-blue-600 hover:pl-2 transition-all duration-200 flex items-center gap-2.5 group/item py-1"
                            >
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full group-hover/item:bg-blue-600 group-hover/item:scale-125 transition-all" />
                              <span className="line-clamp-1 font-medium">{gamme.pg_name}</span>
                            </Link>
                          ))}
                        </div>

                        {/* Bouton voir tout/moins */}
                        {family.gammes_count > 4 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFamilyExpansion(family.mf_id);
                            }}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors flex items-center justify-center gap-2"
                          >
                            {isExpanded ? (
                              <>
                                Voir moins
                                <ChevronRight className="h-4 w-4 rotate-90" />
                              </>
                            ) : (
                              <>
                                Pièces de {(family.mf_name_system || family.mf_name || '').toLowerCase()}
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* H2 SEO : Toutes nos pièces pour le marché français - Version compacte */}
              <div className="mt-12 mb-12 max-w-4xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 text-center">
                  Toutes nos pièces auto pour le marché français
                </h2>
                <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
                  <p className="text-sm text-gray-700 leading-relaxed mb-4 text-center">
                    Notre <strong>catalogue de pièces auto</strong> couvre l'ensemble des <strong>constructeurs européens et internationaux</strong> présents 
                    sur le marché français. <strong>Pièces neuves</strong> et certifiées de <strong>grands équipementiers</strong>, conformes aux <strong>normes européennes</strong>.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <CheckCircle2 className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-gray-900">Pièces d'origine</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-gray-900">Qualité certifiée</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <CheckCircle2 className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-gray-900">Garantie fabricant</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
                      <Clock className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-gray-900">Livraison 24-48h</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA global optimisé SEO - Version compacte */}
              <div className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 md:p-8 text-center text-white shadow-xl">
                <h2 className="text-xl md:text-2xl font-bold mb-3">
                  Pourquoi choisir Automecanik pour vos pièces détachées ?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-blue-100" />
                    <p className="text-sm font-semibold">Pièces certifiées</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-100" />
                    <p className="text-sm font-semibold">100% compatible</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-orange-100" />
                    <p className="text-sm font-semibold">Livraison 24-48h</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild size="default" variant="secondary" className="bg-white text-blue-600 hover:bg-blue-50">
                    <Link to="/contact">
                      <Phone className="mr-2 h-4 w-4" />
                      Contact
                    </Link>
                  </Button>
                  <Button asChild size="default" variant="outline" className="border-white text-white hover:bg-white/10">
                    <Link to="/">
                      Rechercher
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Message si pas de données */}
          {!loadingCatalog && families.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-600">Aucune famille de produits disponible pour le moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* ⭐ GAMMES TOP - Composant réel intégré */}
      <TopGammes topGammesData={topGammesData} />

      {/* 🏭 ÉQUIPEMENTIERS - Composant réel intégré */}
      <EquipementiersCarousel equipementiersData={equipementiersData} />

      {/* ✨ AVANTAGES - Grid 4 colonnes unique (fusionné) */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Pourquoi nous choisir ?
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <Card className="text-center hover:shadow-xl transition-all duration-300 border-t-4 border-blue-500">
              <CardHeader>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
                  <Shield className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Qualité garantie</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  Toutes nos pièces sont certifiées et testées selon les normes constructeurs
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-xl transition-all duration-300 border-t-4 border-green-500">
              <CardHeader>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
                  <Clock className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-xl">Livraison rapide</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  Expédition sous 24h et livraison express disponible partout en France
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-xl transition-all duration-300 border-t-4 border-purple-500">
              <CardHeader>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mx-auto mb-4">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle className="text-xl">Support expert</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  Nos mécaniciens vous conseillent pour choisir la bonne pièce
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-xl transition-all duration-300 border-t-4 border-orange-500">
              <CardHeader>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mx-auto mb-4">
                  <Award className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-xl">Prix compétitifs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  Les meilleurs prix du marché avec notre garantie du prix le plus bas
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 💬 TÉMOIGNAGES - Carousel */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ils nous font confiance
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-green-500 to-teal-600 mx-auto rounded mb-4"></div>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Découvrez les avis de nos clients professionnels
            </p>
          </div>

          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full max-w-5xl mx-auto"
          >
            <CarouselContent className="-ml-4">
              {testimonials.map((testimonial) => (
                <CarouselItem key={testimonial.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                  <Card className="h-full border-t-4 border-green-500">
                    <CardContent className="pt-6">
                      {/* Rating */}
                      <div className="flex text-yellow-400 mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-current" />
                        ))}
                      </div>

                      {/* Text */}
                      <p className="text-gray-700 italic mb-6 leading-relaxed">
                        "{testimonial.text}"
                      </p>

                      {/* Author */}
                      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                        <div className={`w-12 h-12 bg-gradient-to-br ${testimonial.color} rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                          {testimonial.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{testimonial.name}</p>
                          <p className="text-sm text-gray-500">{testimonial.role}</p>
                          <p className="text-xs text-gray-400">{testimonial.company}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-4" />
            <CarouselNext className="-right-4" />
          </Carousel>

          {/* Stats témoignages */}
          <div className="mt-12 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl shadow-lg p-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-4xl font-bold text-green-600 mb-2">98%</div>
                <div className="text-sm text-gray-600">Clients satisfaits</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">4.8/5</div>
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

      {/* 📧 NEWSLETTER - Moderne et épuré */}
      <section className="py-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="relative container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Restez informé
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Recevez nos offres exclusives et nouveautés
            </p>

            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Votre email professionnel"
                className="flex-1 px-6 py-4 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg transition-all"
                required
                disabled={isSubmittingNewsletter}
                aria-label="Adresse email pour la newsletter"
              />
              <Button
                type="submit"
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg px-8 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmittingNewsletter}
              >
                {isSubmittingNewsletter ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Envoi...
                  </>
                ) : (
                  "S'abonner"
                )}
              </Button>
            </form>

            {newsletterSuccess && (
              <div className="mt-4 bg-green-500/20 border border-green-400/50 rounded-lg px-4 py-3 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <CheckCircle2 className="w-5 h-5 text-green-300" />
                <span className="text-green-100 font-medium">Merci ! Vous êtes inscrit à notre newsletter.</span>
              </div>
            )}

            <p className="text-sm text-blue-200 mt-4 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Désinscription possible à tout moment
            </p>
          </div>
        </div>
      </section>

      {/* 📞 CTA CONTACT - Compact */}
      <section className="py-12 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2">Une question ?</h3>
              <p className="text-gray-300">Nos experts sont là pour vous aider</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Link to="/contact">
                  <Phone className="mr-2 h-5 w-5" />
                  Nous contacter
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900">
                <Link to="/pieces/catalogue">
                  Voir le catalogue
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 🔙 Info & Navigation */}
      <section className="py-12 bg-gradient-to-br from-gray-50 to-blue-50 border-t-4 border-blue-600">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Info card */}
            <Card className="border-2 border-blue-200 mb-8">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <CheckCircle2 className="w-6 h-6 text-blue-600" />
                  Page de test - Version moderne
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4 text-sm text-gray-700">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">🎯 Améliorations appliquées :</h4>
                    <ul className="space-y-2 ml-4">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>TopBar</strong> ajouté avec téléphone + authentification (de index-v2.html)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Hero simplifié</strong> - Recherche fonctionnelle + 4 stats en ligne</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Carousel Shadcn UI</strong> vrai carousel (pas fake scroll) pour marques et témoignages</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Catalogue moderne</strong> - Grid avec images lazy-load + hover effects</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Duplications supprimées</strong> - Stats une seule fois, avantages fusionnés</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Design tokens</strong> - Couleurs sémantiques, espacements cohérents</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Accessibilité</strong> - ARIA labels, navigation clavier, contraste AA</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2">📋 Prochaines étapes :</h4>
                    <ul className="space-y-1 ml-4 text-gray-600">
                      <li>• Intégrer <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">VehicleSelectorV2</code> dans le hero</li>
                      <li>• Ajouter <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">FamilyGammeHierarchy</code> avec vraies données</li>
                      <li>• Connecter les loaders pour données réelles</li>
                      <li>• A/B test avec page actuelle</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navigation buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="outline" size="lg" className="border-2">
                <Link to="/">
                  <ChevronRight className="mr-2 h-5 w-5 rotate-180" />
                  Homepage actuelle
                </Link>
              </Button>
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Link to="/admin/design-system">
                  Design System
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-2 border-green-600 text-green-600 hover:bg-green-50">
                <Link to="/test">
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Tous les tests
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * 🚨 Error Boundary
 * Gère les erreurs gracieusement avec un message utilisateur convivial
 */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {error.status}
          </h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            {error.statusText}
          </h2>
          <p className="text-gray-600 mb-6">
            {error.data?.message || "Une erreur s'est produite lors du chargement de la page."}
          </p>
          <Button asChild className="w-full">
            <Link to="/">
              Retour à l'accueil
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Oups !
        </h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Une erreur inattendue s'est produite
        </h2>
        <p className="text-gray-600 mb-6">
          Nous sommes désolés pour la gêne occasionnée. Notre équipe a été notifiée.
        </p>
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link to="/">
              Retour à l'accueil
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/contact">
              Contacter le support
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
