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
 * 7. Newsletter moderne
 * 8. CTA Contact compact
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Headphones,
  Package,
  Phone,
  Search,
  Shield,
  Star,
  Truck,
  Users,
  Zap,
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
import { SITE_CONFIG } from "../config/site";

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
    // Charger les données en parallèle : gammes, équipementiers, articles de blog, catalogue et marques
    const [topGammesResult, equipementiersResult, blogArticlesResult, catalogResult, brandsResult] = await Promise.allSettled([
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/gammes/featured?limit=26`).then(res => res.json()),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/catalog/equipementiers`).then(res => res.json()),
      fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/blog/advice?limit=6`).then(res => res.json()),
      hierarchyApi.getHomepageData().catch(() => ({ families: [] })),
      brandApi.getAllBrandsWithLogos().catch(() => [])
    ]);

    // Mapper les données de la nouvelle API vers l'ancien format
    const rawTopGammes = topGammesResult.status === 'fulfilled' ? topGammesResult.value : [];
    const topGammesData = {
      data: Array.isArray(rawTopGammes) 
        ? rawTopGammes.map((gamme: any) => ({
            pg_id: gamme.id,
            pg_name: gamme.name,
            pg_alias: gamme.alias || gamme.name.toLowerCase().replace(/\s+/g, '-'),
            pg_img: gamme.image,
          }))
        : [],
      stats: { total_top_gammes: Array.isArray(rawTopGammes) ? rawTopGammes.length : 0 },
      success: true,
    };
    
    const equipementiersData = equipementiersResult.status === 'fulfilled' ? equipementiersResult.value : null;
    const blogArticlesData = blogArticlesResult.status === 'fulfilled' ? blogArticlesResult.value : null;
    const catalogData = catalogResult.status === 'fulfilled' ? catalogResult.value : { families: [] };
    const brandsData = brandsResult.status === 'fulfilled' ? brandsResult.value : [];

    return json({
      topGammesData,
      equipementiersData,
      blogArticlesData,
      catalogData,
      brandsData,
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Loader error:', error);
    return json({
      topGammesData: { data: [], stats: { total_top_gammes: 0 }, success: false },
      equipementiersData: null,
      blogArticlesData: null,
      catalogData: { families: [] },
      brandsData: [],
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

export default function TestHomepageModern() {
  // Charger les données depuis le loader (SSR)
  const { topGammesData, equipementiersData, blogArticlesData, catalogData, brandsData } = useLoaderData<typeof loader>();
  
  // État pour les données du catalogue (maintenant initialisé depuis SSR)
  const [families, setFamilies] = useState<FamilyWithGammes[]>(catalogData?.families || []);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string | number>>(new Set());
  
  // État pour les marques (maintenant initialisé depuis SSR)
  const [brands, setBrands] = useState<Array<{ id: number; name: string; slug: string; logo: string | undefined }>>(brandsData || []);
  const [loadingBrands, setLoadingBrands] = useState(false);

  // Charger les données du catalogue (maintenant uniquement pour refresh si nécessaire)
  useEffect(() => {
    if (catalogData?.families && catalogData.families.length > 0) {
      setFamilies(catalogData.families);
      setLoadingCatalog(false);
    }
  }, [catalogData]);

  // Charger les marques (maintenant uniquement pour refresh si nécessaire)
  useEffect(() => {
    if (brandsData && brandsData.length > 0) {
      setBrands(brandsData);
      setLoadingBrands(false);
    }
  }, [brandsData]);

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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchReference, setSearchReference] = useState("");

  // Smooth scroll behavior
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  // Show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

      {/* 📞 TopBar + Navbar pour cette page de test */}
      <TopBar 
        config={{
          tagline: SITE_CONFIG.tagline,
          phone: SITE_CONFIG.contact.phone.display,
          email: SITE_CONFIG.contact.email,
          showQuickLinks: true,
        }}
        user={null}
      />
      <NavbarModern logo="/logo.svg" />
      
      {/* 🎯 HERO SECTION - Version radicale focalisée conversion */}
      <section 
        id="main-content"
        className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900 text-white py-16 md:py-24"
        aria-label="Section principale"
        role="banner"
      >
        {/* Effet mesh gradient animé en arrière-plan - simplifié */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20" aria-hidden="true"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e510_1px,transparent_1px),linear-gradient(to_bottom,#4f46e510_1px,transparent_1px)] bg-[size:4rem_4rem]" aria-hidden="true"></div>
        
        {/* Formes décoratives - réduites */}
        <div className="absolute top-10 right-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" aria-hidden="true"></div>
        <div className="absolute bottom-10 left-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" aria-hidden="true"></div>
        
        <div className="relative container mx-auto px-4 max-w-5xl">
          
          {/* Titre ultra-simple et direct */}
          <div className="text-center mb-10 animate-in fade-in duration-700">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">
              <span className="bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
                Pièces auto{" "}
              </span>
              <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                pas cher
              </span>
            </h1>
            <p className="text-base md:text-lg text-blue-100/80 max-w-2xl mx-auto">
              50 000 pièces en stock • 120 marques • Livraison 24-48h
            </p>
          </div>

          {/* 🚗 SÉLECTEUR DE VÉHICULE GÉANT - FOCUS ABSOLU */}
          <div className="max-w-3xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            <VehicleSelectorTest />
          </div>

          {/* Section Recherche Alternative */}
          <div className="text-center space-y-6 animate-in fade-in duration-1000 delay-500 mt-12">
            {/* Titre de section élégant */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-20 bg-gradient-to-r from-transparent to-white/20"></div>
              <h2 className="text-lg font-semibold text-white tracking-wide">
                Recherche alternative
              </h2>
              <div className="h-px w-20 bg-gradient-to-l from-transparent to-white/20"></div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3 max-w-4xl mx-auto">
              {/* Badge 1 : Type de pièce (Vert) */}
              <button
                onClick={() => {
                  const catalogueSection = document.querySelector('#catalogue');
                  if (catalogueSection) {
                    catalogueSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="group relative inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-sm font-semibold text-white shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all duration-300 hover:scale-105 border border-green-400/30"
              >
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Package className="w-5 h-5" />
                </div>
                <span className="tracking-wide">Type de pièce</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 rounded-full transition-colors"></div>
              </button>
              
              {/* Badge 2 : Constructeur (Bleu) */}
              <button
                onClick={() => {
                  const marquesSection = document.querySelector('#toutes-les-marques');
                  if (marquesSection) {
                    marquesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="group relative inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 border border-blue-400/30"
              >
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Award className="w-5 h-5" />
                </div>
                <span className="tracking-wide">Constructeur</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 rounded-full transition-colors"></div>
              </button>
              
              {/* Badge 3 : Référence (Orange) */}
              <button
                onClick={() => setShowSearchBar(true)}
                className="group relative inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full text-sm font-semibold text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all duration-300 hover:scale-105 border border-orange-400/30"
              >
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Search className="w-5 h-5" />
                </div>
                <span className="tracking-wide">Référence</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 rounded-full transition-colors"></div>
              </button>
            </div>
            
            {/* Trust minimal - ultra-discret */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-blue-200/60 pt-4">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                Pièces neuves certifiées
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-400" />
                Livraison express 24-48h
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-purple-400" />
                Aide d'experts gratuite
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Modal de recherche par référence */}
      {showSearchBar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-in slide-in-from-top-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Recherche par référence</h3>
                  <p className="text-sm text-gray-600">Entrez une référence OEM ou commerciale</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSearchBar(false);
                  setSearchReference("");
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-500 rotate-90" />
              </button>
            </div>

            {/* Formulaire */}
            <div className="p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchReference.trim()) {
                    window.location.href = `/search?q=${encodeURIComponent(searchReference)}`;
                  }
                }}
                className="space-y-4"
              >
                <div className="relative">
                  <input
                    type="text"
                    value={searchReference}
                    onChange={(e) => setSearchReference(e.target.value)}
                    placeholder="Ex: 7701208265, KTBWP8841, 04C115561H..."
                    className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors"
                    autoFocus
                  />
                  {searchReference && (
                    <button
                      type="button"
                      onClick={() => setSearchReference("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400 rotate-45" />
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!searchReference.trim()}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Rechercher
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSearchBar(false);
                      setSearchReference("");
                    }}
                    className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </form>

              {/* Aide */}
              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <p className="text-sm text-orange-900 font-medium mb-2">💡 Exemples de références :</p>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• Référence OEM constructeur : <code className="font-mono bg-white px-2 py-0.5 rounded">7701208265</code></li>
                  <li>• Référence commerciale : <code className="font-mono bg-white px-2 py-0.5 rounded">KTBWP8841</code></li>
                  <li>• Référence VAG : <code className="font-mono bg-white px-2 py-0.5 rounded">04C115561H</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <section 
        id="pourquoi-automecanik" 
        className="py-20 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30"
        aria-label="Nos engagements"
      >
        <div className="container mx-auto px-4 max-w-7xl">
          {/* En-tête */}
          <div className="text-center mb-16 animate-in fade-in duration-700">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              Pourquoi choisir <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Automecanik</span> ?
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Des services et garanties pour votre équipement automobile
            </p>
          </div>

          {/* Métriques clés en vedette */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {[
              { value: "50 000", label: "Pièces en stock", icon: Package, color: "blue" },
              { value: "120", label: "Marques disponibles", icon: Award, color: "indigo" },
              { value: "24-48h", label: "Livraison express", icon: Truck, color: "purple" },
              { value: "100%", label: "Paiement sécurisé", icon: Shield, color: "green" },
            ].map((metric, idx) => (
              <Card 
                key={idx}
                className="text-center p-6 border-2 border-gray-200/50 hover:border-blue-300 hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <metric.icon className={`w-10 h-10 mx-auto mb-3 text-${metric.color}-600`} />
                <div className="text-3xl font-bold text-gray-900 mb-1">{metric.value}</div>
                <div className="text-sm text-gray-600">{metric.label}</div>
              </Card>
            ))}
          </div>

          {/* USPs + Engagements en grille hybride */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Colonne gauche - 4 USPs */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Nos engagements</h3>
              
              {[
                {
                  icon: CheckCircle2,
                  title: "Pièces neuves certifiées",
                  description: "Toutes nos pièces sont neuves, d'origine ou équivalentes, avec garantie constructeur.",
                  color: "green",
                },
                {
                  icon: Truck,
                  title: "Livraison express 24-48h",
                  description: "Expédition rapide partout en France avec suivi en temps réel de votre commande.",
                  color: "blue",
                },
                {
                  icon: Shield,
                  title: "Paiement 100% sécurisé",
                  description: "Transactions protégées par cryptage SSL et certification Paybox.",
                  color: "purple",
                },
                {
                  icon: Users,
                  title: "Support expert gratuit",
                  description: "Notre équipe de spécialistes vous conseille pour choisir la bonne pièce.",
                  color: "indigo",
                },
              ].map((usp, idx) => (
                <Card 
                  key={idx}
                  className="p-6 border-l-4 hover:shadow-lg transition-all duration-300 bg-white/80 backdrop-blur-sm animate-in fade-in slide-in-from-left"
                  style={{ 
                    borderLeftColor: `rgb(var(--${usp.color}-600))`,
                    animationDelay: `${idx * 100}ms` 
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-${usp.color}-100 flex-shrink-0`}>
                      <usp.icon className={`w-6 h-6 text-${usp.color}-600`} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg mb-2">{usp.title}</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">{usp.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Colonne droite - Nos engagements */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Nos engagements</h3>
              
              {[
                {
                  icon: Truck,
                  title: "Livraison rapide",
                  description: "Expédition sous 24h pour les pièces en stock. Livraison en France métropolitaine.",
                  color: "from-blue-500 to-blue-600",
                  iconColor: "text-blue-600",
                },
                {
                  icon: Shield,
                  title: "Pièces garanties",
                  description: "Toutes nos pièces sont garanties constructeur. Conformité et qualité assurées.",
                  color: "from-green-500 to-green-600",
                  iconColor: "text-green-600",
                },
                {
                  icon: Headphones,
                  title: "Support technique",
                  description: "Notre équipe vous accompagne pour identifier la bonne référence pour votre véhicule.",
                  color: "from-purple-500 to-purple-600",
                  iconColor: "text-purple-600",
                },
              ].map((engagement, idx) => {
                const IconComponent = engagement.icon;
                return (
                  <Card 
                    key={idx}
                    className="p-6 border-2 border-gray-200/50 hover:border-blue-300 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-blue-50/20 backdrop-blur-sm animate-in fade-in slide-in-from-right"
                    style={{ animationDelay: `${idx * 150}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${engagement.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 mb-2">{engagement.title}</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {engagement.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* CTA final */}
          <div className="text-center pt-8 animate-in fade-in duration-700 delay-500">
            <p className="text-gray-600 mb-4">Trouvez la pièce qu'il vous faut</p>
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8"
            >
              Trouver ma pièce maintenant
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* �📂 CATALOGUE COMPLET - Version compacte SEO optimisée */}
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

      {/* 🎨 MARQUES & CONSTRUCTEURS AUTOMOBILES - Section SEO optimisée */}
      <section 
        id="toutes-les-marques" 
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

          {/* FAQ MODERNE - Version compacte avec Schema.org */}
          <div 
            className="max-w-4xl mx-auto mt-12 pt-8 border-t border-gray-200"
            role="region"
            aria-labelledby="faq-title"
          >
            {/* Schema.org FAQPage structured data */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  "mainEntity": [
                    {
                      "@type": "Question",
                      "name": "Comment trouver les pièces compatibles avec mon véhicule ?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Utilisez notre sélecteur de véhicule en renseignant votre immatriculation, marque et modèle, ou recherchez par numéro VIN. Notre système affiche automatiquement uniquement les pièces 100% compatibles avec votre véhicule."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Quelle est la différence entre une pièce d'origine et une pièce équivalente ?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Les pièces d'origine sont fabriquées par le constructeur automobile avec garantie constructeur officielle, qualité OEM certifiée et compatibilité parfaite. Les pièces équivalentes premium offrent une qualité équivalente certifiée, respectent les normes constructeurs, sont proposées à des prix plus avantageux (-30% en moyenne) et incluent une garantie fabricant."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Quels sont vos délais de livraison ?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Expédition sous 24h ouvrées pour les pièces en stock. Livraison express 24-48h disponible en France métropolitaine. Suivi en temps réel de votre colis avec numéro de tracking. Livraison gratuite pour toute commande supérieure à 150€ HT avec emballage sécurisé et assurance incluse."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Couvrez-vous toutes les marques automobiles ?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Nous proposons plus de 50 marques et 50 000 références de pièces dans notre catalogue, incluant les marques françaises (Renault, Peugeot, Citroën, DS, Dacia, Alpine), allemandes (VW, BMW, Mercedes, Audi, Opel, Porsche, Smart), asiatiques (Toyota, Honda, Nissan, Mazda, Hyundai, Kia, Suzuki) et bien d'autres. Notre catalogue couvre les marques premium, généralistes, utilitaires et véhicules électriques."
                      }
                    }
                  ]
                })
              }}
            />

            <div className="mb-6">
              <h2 id="faq-title" className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Questions fréquentes
              </h2>
              <p className="text-sm text-gray-600">
                Tout ce que vous devez savoir sur nos pièces et services
              </p>
            </div>
            
            <Accordion type="single" collapsible className="w-full space-y-4">
              {/* Question 1 - Recherche pièces avec icône 🔍 */}
              <AccordionItem value="q1" className="group bg-gradient-to-br from-white to-blue-50/30 border-2 border-gray-200 rounded-2xl px-6 py-2 hover:border-blue-400 hover:shadow-lg transition-all duration-300">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-blue-600 py-4">
                  <span className="flex items-center gap-4">
                    <span className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Search className="w-6 h-6" />
                    </span>
                    <span className="flex-1">Comment trouver les pièces compatibles avec mon véhicule ?</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-5 pl-16 pr-4">
                  <p className="mb-4 text-gray-800">
                    <strong className="text-blue-600">3 méthodes simples et rapides</strong> pour garantir la compatibilité :
                  </p>
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
                      <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">1</span>
                      <div>
                        <strong className="text-gray-900 block mb-1.5">🎯 Par logo de marque</strong>
                        <p className="text-xs text-gray-600 leading-relaxed">Cliquez sur le logo → Sélectionnez modèle, année et motorisation. Simple et intuitif pour tous types de véhicules.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-gray-200 hover:border-green-300 transition-colors">
                      <span className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center font-bold">2</span>
                      <div>
                        <strong className="text-gray-900 block mb-1.5">✅ Par numéro VIN (recommandé)</strong>
                        <p className="text-xs text-gray-600 leading-relaxed">Saisissez votre numéro de châssis pour une <strong className="text-green-600">compatibilité garantie à 100%</strong>. La méthode la plus fiable.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-gray-200 hover:border-purple-300 transition-colors">
                      <span className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-bold">3</span>
                      <div>
                        <strong className="text-gray-900 block mb-1.5">🔍 Par référence OEM</strong>
                        <p className="text-xs text-gray-600 leading-relaxed">Entrez la référence constructeur de votre pièce actuelle. Idéal pour remplacer une pièce existante.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
                      <span className="text-xl flex-shrink-0">💡</span>
                      <span><strong>Besoin d'aide ?</strong> Notre équipe d'experts vous accompagne dans votre recherche pour vous garantir la pièce parfaitement adaptée.</span>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Question 2 - Qualité pièces avec icône 🛡️ */}
              <AccordionItem value="q2" className="group bg-gradient-to-br from-white to-green-50/30 border-2 border-gray-200 rounded-2xl px-6 py-2 hover:border-green-400 hover:shadow-lg transition-all duration-300">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-green-600 py-4">
                  <span className="flex items-center gap-4">
                    <span className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Shield className="w-6 h-6" />
                    </span>
                    <span className="flex-1">Quelle est la qualité des pièces proposées ?</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-5 pl-16 pr-4">
                  <p className="mb-4 text-gray-800">
                    Nous proposons <strong className="text-green-600">2 gammes de qualité premium</strong> selon vos besoins et budget :
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                          <Award className="w-6 h-6 text-white" />
                        </div>
                        <strong className="text-gray-900 text-base">Pièces d'origine</strong>
                      </div>
                      <ul className="space-y-2 text-xs text-gray-700">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>Garantie constructeur officielle</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>Qualité OEM certifiée à 100%</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>Compatibilité parfaite garantie</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>Traçabilité complète des pièces</span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-5 rounded-xl border-2 border-green-200 hover:border-green-400 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                          <Star className="w-6 h-6 text-white" />
                        </div>
                        <strong className="text-gray-900 text-base">Équivalents premium</strong>
                      </div>
                      <ul className="space-y-2 text-xs text-gray-700">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Qualité équivalente certifiée</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Respect normes constructeurs</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Prix plus avantageux (-30% moy.)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Garantie fabricant incluse</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                    <p className="text-xs text-gray-800 font-medium flex items-start gap-2 leading-relaxed">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Notre engagement qualité :</strong> Toutes nos pièces sont rigoureusement sélectionnées et testées pour garantir 
                        <strong className="text-blue-600"> fiabilité, sécurité et conformité aux standards européens</strong>.
                      </span>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Question 3 - Délais livraison avec icône ⏱️ */}
              <AccordionItem value="q3" className="group bg-gradient-to-br from-white to-orange-50/30 border-2 border-gray-200 rounded-2xl px-6 py-2 hover:border-orange-400 hover:shadow-lg transition-all duration-300">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-orange-600 py-4">
                  <span className="flex items-center gap-4">
                    <span className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Clock className="w-6 h-6" />
                    </span>
                    <span className="flex-1">Quels sont vos délais de livraison ?</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-5 pl-16 pr-4">
                  <p className="mb-4 text-gray-800">
                    <strong className="text-orange-600">Livraison rapide partout en France</strong> pour minimiser vos temps d'immobilisation :
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-5 rounded-xl border-2 border-green-200 hover:border-green-400 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-white" />
                        </div>
                        <strong className="text-gray-900 text-base">Livraison Standard</strong>
                      </div>
                      <p className="text-gray-700 mb-2">
                        <strong className="text-green-600 text-lg">24-48h</strong> pour les pièces en stock
                      </p>
                      <p className="text-xs text-gray-600">Idéal pour les commandes non urgentes. Suivi colis inclus.</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-5 rounded-xl border-2 border-orange-300 hover:border-orange-500 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                          <Zap className="w-6 h-6 text-white" />
                        </div>
                        <strong className="text-gray-900 text-base">Livraison Express</strong>
                      </div>
                      <p className="text-gray-700 mb-2">
                        <strong className="text-orange-600 text-lg">Livraison J+1</strong> avant 12h
                      </p>
                      <p className="text-xs text-gray-600">Pour les urgences. Commande avant 15h = livraison le lendemain.</p>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                    <div className="flex items-start gap-3">
                      <Truck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-gray-700 leading-relaxed">
                        <p className="font-semibold text-gray-900 mb-1">📍 Livraison gratuite</p>
                        <p>Pour toute commande supérieure à <strong className="text-blue-600">150€ HT</strong>. Emballage sécurisé et assurance incluse.</p>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Question 4 - Couverture marques avec icône 👥 */}
              <AccordionItem value="q4" className="group bg-gradient-to-br from-white to-purple-50/30 border-2 border-gray-200 rounded-2xl px-6 py-2 hover:border-purple-400 hover:shadow-lg transition-all duration-300">
                <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-purple-600 py-4">
                  <span className="flex items-center gap-4">
                    <span className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Users className="w-6 h-6" />
                    </span>
                    <span className="flex-1">Couvrez-vous toutes les marques automobiles ?</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 text-sm leading-relaxed pb-5 pl-16 pr-4">
                  <p className="mb-4 text-gray-800">
                    <strong className="text-purple-600">Plus de 50 marques</strong> et <strong className="text-purple-600">50 000 références</strong> de pièces disponibles dans notre catalogue :
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-colors">
                      <div className="text-center mb-3">
                        <div className="inline-flex w-12 h-12 bg-blue-100 rounded-xl items-center justify-center text-2xl mb-2">
                          🇫🇷
                        </div>
                        <strong className="text-gray-900 block text-sm">Marques françaises</strong>
                      </div>
                      <p className="text-xs text-gray-600 text-center leading-relaxed">
                        Renault • Peugeot • Citroën • DS Automobiles • Dacia • Alpine
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border-2 border-red-200 hover:border-red-400 transition-colors">
                      <div className="text-center mb-3">
                        <div className="inline-flex w-12 h-12 bg-red-100 rounded-xl items-center justify-center text-2xl mb-2">
                          🇩🇪
                        </div>
                        <strong className="text-gray-900 block text-sm">Marques allemandes</strong>
                      </div>
                      <p className="text-xs text-gray-600 text-center leading-relaxed">
                        VW • BMW • Mercedes • Audi • Opel • Porsche • Smart
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border-2 border-green-200 hover:border-green-400 transition-colors">
                      <div className="text-center mb-3">
                        <div className="inline-flex w-12 h-12 bg-green-100 rounded-xl items-center justify-center text-2xl mb-2">
                          🌏
                        </div>
                        <strong className="text-gray-900 block text-sm">Marques asiatiques</strong>
                      </div>
                      <p className="text-xs text-gray-600 text-center leading-relaxed">
                        Toyota • Honda • Nissan • Mazda • Hyundai • Kia • Suzuki
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                    <p className="text-xs text-purple-900 flex items-start gap-2 leading-relaxed font-medium">
                      <span className="text-xl flex-shrink-0">🔧</span>
                      <span>
                        <strong>Catalogue exhaustif :</strong> Marques premium, généralistes, utilitaires et véhicules électriques. 
                        Du City car au SUV, toutes motorisations confondues.
                      </span>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* CTA STRATÉGIQUE - Après FAQ */}
            <div className="mt-16 pt-12 border-t border-gray-200">
              <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 md:p-12 text-center text-white shadow-2xl relative overflow-hidden">
                {/* Pattern de fond décoratif */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
                </div>
                
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
                    <span className="text-xl">💬</span>
                    <span className="text-sm font-medium">Besoin d'assistance personnalisée</span>
                  </div>
                  
                  <h3 className="text-3xl md:text-4xl font-bold mb-4">
                    Vous ne trouvez pas votre réponse ?
                  </h3>
                  <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
                    Notre équipe d'experts est là pour vous accompagner dans votre recherche de pièces et répondre à toutes vos questions.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <Link 
                      to="/contact" 
                      className="group inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                    >
                      <Phone className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                      <span>Contacter un expert</span>
                    </Link>
                    
                    <Link 
                      to="/catalogue" 
                      className="group inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/20 hover:scale-105 transition-all duration-300"
                    >
                      <span>Explorer le catalogue</span>
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                  
                  <div className="mt-8 flex items-center justify-center gap-8 text-sm text-blue-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-300" />
                      <span>Réponse sous 24h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-300" />
                      <span>Conseil gratuit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-300" />
                      <span>Experts disponibles</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ⭐ GAMMES TOP - Composant réel intégré */}
      <TopGammes topGammesData={topGammesData} />

      {/* 🏭 ÉQUIPEMENTIERS - Composant réel intégré */}
      <EquipementiersCarousel equipementiersData={equipementiersData} />

      {/* 🤝 PARTENAIRES & CERTIFICATIONS - Position 7 */}
      <section 
        id="partenaires-certifications" 
        className="py-20 bg-gradient-to-br from-white via-slate-50 to-gray-100"
        aria-label="Nos partenaires et certifications"
      >
        <div className="container mx-auto px-4 max-w-7xl">
          {/* En-tête */}
          <div className="text-center mb-16 animate-in fade-in duration-700">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              Partenaires & <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Certifications</span>
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Des partenariats de confiance avec les leaders du secteur automobile
            </p>
          </div>

          {/* Certifications principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 max-w-5xl mx-auto">
            {[
              {
                icon: Shield,
                title: "Paiement sécurisé",
                subtitle: "Paybox certifié",
                color: "blue",
                badge: "🔒",
              },
              {
                icon: Award,
                title: "Qualité ISO",
                subtitle: "Normes ISO 9001",
                color: "green",
                badge: "✓",
              },
              {
                icon: CheckCircle2,
                title: "SSL Premium",
                subtitle: "Données cryptées",
                color: "purple",
                badge: "🔐",
              },
              {
                icon: Star,
                title: "Service client",
                subtitle: "Support expert 6j/7",
                color: "amber",
                badge: "⭐",
              },
            ].map((cert, idx) => (
              <Card 
                key={idx}
                className="text-center p-6 border-2 border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 bg-white animate-in fade-in zoom-in"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="text-3xl mb-3">{cert.badge}</div>
                <cert.icon className={`w-10 h-10 mx-auto mb-3 text-${cert.color}-600`} />
                <h3 className="font-bold text-gray-900 text-base mb-1">{cert.title}</h3>
                <p className="text-xs text-gray-500">{cert.subtitle}</p>
              </Card>
            ))}
          </div>

          {/* Trust badges finaux */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>Paiement sécurisé Paybox</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              <span>Données SSL cryptées</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-500" />
              <span>Certifié ISO 9001</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span>Note 4.8/5 (1,234 avis)</span>
            </div>
          </div>
        </div>
      </section>

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

      {/* � BLOG - Position 10 - Derniers articles */}
      <section 
        id="blog-articles" 
        className="py-20 bg-white"
        aria-label="Derniers articles du blog"
      >
        <div className="container mx-auto px-4 max-w-7xl">
          {/* En-tête */}
          <div className="text-center mb-16 animate-in fade-in duration-700">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              Conseils & <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Actualités</span>
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Retrouvez nos guides, tutoriels et actualités pour entretenir votre véhicule
            </p>
          </div>

          {/* Grid d'articles - Données réelles depuis l'API */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {blogArticlesData?.data?.articles?.slice(0, 3).map((article: any, idx: number) => (
              <Card 
                key={article.id}
                className="group overflow-hidden border-2 border-gray-200 hover:border-blue-400 hover:shadow-2xl transition-all duration-300 bg-white animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Image réelle de l'article */}
                <div className="relative w-full h-56 overflow-hidden">
                  {article.featuredImage ? (
                    <>
                      <img 
                        src={article.featuredImage}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                      {/* Overlay gradient sur hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </>
                  ) : (
                    /* Fallback si pas d'image */
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex items-center justify-center">
                      <div className="text-6xl opacity-20">📰</div>
                    </div>
                  )}
                  
                  {/* Badge lecture */}
                  <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg z-10">
                    {article.readingTime || 5} min de lecture
                  </div>
                </div>

                <CardContent className="p-6">
                  {/* Titre */}
                  <h3 className="font-bold text-gray-900 text-xl mb-3 line-clamp-2 min-h-[3.5rem] group-hover:text-blue-600 transition-colors">
                    {article.title}
                  </h3>

                  {/* Extrait */}
                  <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3">
                    {article.excerpt || "Découvrez nos conseils d'experts pour l'entretien de votre véhicule."}
                  </p>

                  {/* Meta info */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pt-4 border-t border-gray-100">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {article.readingTime || 5} min
                    </span>
                    {article.viewsCount && (
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {article.viewsCount} vues
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <Link 
                    to={`/blog/conseils/${article.slug}`}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm group/link"
                  >
                    <span>Lire l'article</span>
                    <ChevronRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </CardContent>
              </Card>
            )) || (
              // Fallback si pas d'articles
              <div className="col-span-3 text-center py-12">
                <p className="text-gray-500">Chargement des articles...</p>
              </div>
            )}
          </div>

          {/* CTA voir tous les articles */}
          <div className="text-center animate-in fade-in duration-700 delay-300">
            <Button 
              asChild
              size="lg" 
              variant="outline"
              className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-8"
            >
              <Link to="/blog">
                Voir tous les articles
                <ChevronRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 📧 NEWSLETTER - Moderne et épuré avec RGPD */}
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

            <form onSubmit={handleNewsletterSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Votre adresse email"
                  className="flex-1 px-6 py-4 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg transition-all"
                  required
                  disabled={isSubmittingNewsletter}
                  aria-label="Adresse email pour la newsletter"
                  pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
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
              </div>

              {/* Checkbox RGPD */}
              <label className="flex items-start gap-3 text-left text-sm text-blue-100 cursor-pointer hover:text-white transition-colors max-w-xl mx-auto">
                <input 
                  type="checkbox" 
                  required 
                  className="mt-0.5 w-4 h-4 rounded border-2 border-white/30 bg-white/10 checked:bg-white checked:border-white focus:ring-2 focus:ring-white/50 cursor-pointer"
                  aria-label="Consentement RGPD"
                />
                <span>
                  J'accepte de recevoir les offres et actualités d'Automecanik par email. 
                  Vous pouvez vous désinscrire à tout moment. 
                  <Link to="/politique-confidentialite" className="underline hover:text-white font-medium ml-1">
                    Politique de confidentialité
                  </Link>
                </span>
              </label>
            </form>

            {newsletterSuccess && (
              <div className="mt-6 bg-green-500/20 border border-green-400/50 rounded-lg px-4 py-3 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <CheckCircle2 className="w-5 h-5 text-green-300" />
                <span className="text-green-100 font-medium">Merci ! Vous êtes inscrit à notre newsletter. Vérifiez votre boîte de réception.</span>
              </div>
            )}

            <p className="text-sm text-blue-200 mt-6 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" aria-hidden="true" />
              Vos données sont protégées et ne seront jamais partagées
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
                        <span><strong>Carousel Shadcn UI</strong> vrai carousel (pas fake scroll) pour les marques</span>
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

      {/* 🔝 SCROLL TO TOP BUTTON */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-4 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-110 animate-in fade-in slide-in-from-bottom-4"
          aria-label="Retour en haut de page"
        >
          <ChevronRight className="w-6 h-6 -rotate-90" />
        </button>
      )}

      {/* ====================================
       * 🔧 MODAL COMPARATEUR - COMMENTÉ
       * Code complet conservé pour développement futur
       * Décommenter et réactiver les états + handlers ci-dessus
       * ==================================== 
      {showComparator && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={closeComparator}
        >
          ... Modal content ...
        </div>
      )}
      */}
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
