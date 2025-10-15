import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { 
  Shield, Clock, Phone, Users, ShoppingCart, Package, Zap, 
  Search, ChevronDown, Star, ArrowRight, Filter, Mail, Rocket
} from 'lucide-react';
import { useState, useEffect } from 'react';

// Import des sections
import { 
  WhyChooseUs, FeaturedProducts, EcommerceFuture, 
  ProductComparison, TestimonialsSection 
} from '../components/homepage/sections-part2';
import { 
  PartnersAndCertifications, MainCTA, BlogSection, 
  FAQSection, NewsletterSection 
} from '../components/homepage/sections-part3';
import { 
  TeamSection, ContactSection, Footer, 
  LiveChatButton, SignupPopup 
} from '../components/homepage/sections-part4';

// ================================
// META & SEO
// ================================
export const meta: MetaFunction = () => {
  return [
    { title: "Vente pièces détachées auto neuves & à prix pas cher | AutoMecanik - Votre route vers la qualité" },
    { name: "description", content: "AutoMecanik : Le leader des pièces automobiles en ligne. Plus de 50 000 pièces en stock, livraison express, garantie constructeur. Qualité, rapidité et expertise pour tous vos besoins auto." },
    { name: "keywords", content: "pieces auto, pieces detachees, freinage, filtration, distribution, amortisseurs, qualite, livraison rapide, garantie constructeur, prix competitifs" },
    { name: "robots", content: "index, follow" },
    { name: "author", content: "AutoMecanik" },
    // Open Graph
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://www.automecanik.com/" },
    { property: "og:title", content: "AutoMecanik - Votre route vers des pièces auto de qualité" },
    { property: "og:description", content: "Commerce électronique de pièces automobiles : Qualité, Rapidité, Expertise" },
    { property: "og:image", content: "https://www.automecanik.com/assets/img/og-hero-car.jpg" },
    // Twitter
    { property: "twitter:card", content: "summary_large_image" },
    { property: "twitter:title", content: "AutoMecanik - Pièces auto de qualité" },
  ];
};

// ================================
// LOADER - Récupération des données
// ================================
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';

    const [
      productsResult,
      categoriesResult,
      brandsResult,
      testimonialsResult,
      blogResult,
      offersResult
    ] = await Promise.allSettled([
      fetch(`${apiUrl}/api/catalog/pieces-gammes/featured`).then(res => res.json()),
      fetch(`${apiUrl}/api/catalog/hierarchy/homepage`).then(res => res.json()),
      fetch(`${apiUrl}/api/catalog/brands/popular`).then(res => res.json()),
      fetch(`${apiUrl}/api/testimonials/recent`).then(res => res.json()),
      fetch(`${apiUrl}/api/blog/latest?limit=3`).then(res => res.json()),
      fetch(`${apiUrl}/api/promotions/current`).then(res => res.json()),
    ]);

    const featuredProducts = productsResult.status === 'fulfilled' ? productsResult.value : [];
    const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
    const brands = brandsResult.status === 'fulfilled' ? brandsResult.value : [];
    const testimonials = testimonialsResult.status === 'fulfilled' ? testimonialsResult.value : [];
    const blogPosts = blogResult.status === 'fulfilled' ? blogResult.value : [];
    const currentOffers = offersResult.status === 'fulfilled' ? offersResult.value : [];

    return json({
      featuredProducts,
      categories,
      brands,
      testimonials,
      blogPosts,
      currentOffers,
      stats: {
        totalProducts: 50000,
        totalBrands: 120,
        totalOrders: 25000,
        customerSatisfaction: 4.8,
        yearsExperience: 10
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Loader error:', error);
    return json({
      featuredProducts: [],
      categories: [],
      brands: [],
      testimonials: [],
      blogPosts: [],
      currentOffers: [],
      stats: {
        totalProducts: 50000,
        totalBrands: 120,
        totalOrders: 25000,
        customerSatisfaction: 4.8,
        yearsExperience: 10
      },
      timestamp: new Date().toISOString()
    });
  }
}

// ================================
// COMPOSANT PRINCIPAL
// ================================
export default function HomepageV3() {
  const data = useLoaderData<typeof loader>();
  const [isScrolled, setIsScrolled] = useState(false);
  const [countdown, setCountdown] = useState({ hours: 23, minutes: 59, seconds: 59 });

  // Gestion du scroll pour navbar sticky
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Countdown timer pour offre limitée
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ================================
          NAVBAR MODERNE AVEC MEGA MENU
          ================================ */}
      <Navbar isScrolled={isScrolled} />

      {/* ================================
          HERO SECTION - Slogan + Image dynamique
          ================================ */}
      <HeroSection countdown={countdown} />

      {/* ================================
          BARRE DE RECHERCHE AVANCÉE
          ================================ */}
      <AdvancedSearchBar />

      {/* ================================
          OFFRES SPÉCIALES / PROMOTIONS (Bannière Flash)
          ================================ */}
      <FlashOfferBanner offers={data.currentOffers} countdown={countdown} />

      {/* ================================
          FEATURE SECTION - Pourquoi AutoMecanik
          ================================ */}
      <WhyChooseUs stats={data.stats} />

      {/* ================================
          NOUVEAUTÉS / PRODUITS VEDETTES (Carrousel)
          ================================ */}
      <FeaturedProducts products={data.featuredProducts} />

      {/* ================================
          FEATURES LIST - Commerce électronique
          ================================ */}
      <EcommerceFuture />

      {/* ================================
          COMPARAISON DE PRODUITS (Tableau interactif)
          ================================ */}
      <ProductComparison />

      {/* ================================
          TÉMOIGNAGES (Diaporama vidéo)
          ================================ */}
      <TestimonialsSection testimonials={data.testimonials} />

      {/* ================================
          PARTENAIRES & CERTIFICATIONS
          ================================ */}
      <PartnersAndCertifications brands={data.brands} />

      {/* ================================
          CTA PRINCIPAL
          ================================ */}
      <MainCTA />

      {/* ================================
          BLOG / ARTICLES DE CONSEILS
          ================================ */}
      <BlogSection posts={data.blogPosts} />

      {/* ================================
          FAQ SECTION (Accordéon)
          ================================ */}
      <FAQSection />

      {/* ================================
          NEWSLETTER (avec offre 10%)
          ================================ */}
      <NewsletterSection />

      {/* ================================
          ÉQUIPE & CULTURE D'ENTREPRISE
          ================================ */}
      <TeamSection />

      {/* ================================
          CONTACT & LOCALISATION
          ================================ */}
      <ContactSection />

      {/* ================================
          FOOTER COMPLET
          ================================ */}
      <Footer />

      {/* ================================
          CHAT EN DIRECT (Bouton flottant)
          ================================ */}
      <LiveChatButton />

      {/* ================================
          POP-UP D'INSCRIPTION (avec offre)
          ================================ */}
      <SignupPopup />
    </div>
  );
}

// ================================
// NAVBAR COMPONENT
// ================================
function Navbar({ isScrolled }: any) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white shadow-lg' : 'bg-white/95 backdrop-blur-sm'
    }`}>
      {/* Top bar - Contact rapide */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-2">
        <div className="container mx-auto px-4 flex justify-between items-center text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              01 48 49 78 69
            </span>
            <span className="hidden md:flex items-center gap-2">
              <Mail className="w-4 h-4" />
              contact@automecanik.com
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/compte" className="hover:text-blue-200 transition-colors">
              Mon Compte
            </Link>
            <span>|</span>
            <Link to="/aide" className="hover:text-blue-200 transition-colors">
              Aide
            </Link>
          </div>
        </div>
      </div>

      {/* Main navbar */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              AutoMecanik
            </span>
          </Link>

          {/* Menu desktop */}
          <div className="hidden lg:flex items-center gap-8">
            <Link to="/" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Accueil
            </Link>
            
            {/* Menu déroulant Catégories */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Catégories
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 mt-2 w-screen max-w-4xl bg-white shadow-2xl rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 p-6">
                <div className="grid grid-cols-3 gap-6">
                  <CategoryMegaMenuItem title="Système de filtration" icon={<Filter />} items={['Filtre à huile', 'Filtre à air', 'Filtre à carburant']} />
                  <CategoryMegaMenuItem title="Système de freinage" icon={<Shield />} items={['Plaquettes de frein', 'Disques de frein', 'Tambours']} />
                  <CategoryMegaMenuItem title="Distribution" icon={<Zap />} items={['Kit de distribution', 'Courroies', 'Pompe à eau']} />
                </div>
              </div>
            </div>

            <Link to="/a-propos" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              À propos
            </Link>
            <Link to="/blog" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Blog
            </Link>
            <Link to="/contact" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Contact
            </Link>
          </div>

          {/* Icônes actions */}
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Search className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                0
              </span>
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Users className="w-5 h-5 text-gray-600" />
            </button>

            {/* Mobile menu button */}
            <button 
              className="lg:hidden p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <div className="w-6 h-0.5 bg-gray-600 mb-1"></div>
              <div className="w-6 h-0.5 bg-gray-600 mb-1"></div>
              <div className="w-6 h-0.5 bg-gray-600"></div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t">
          <div className="container mx-auto px-4 py-4 space-y-3">
            <Link to="/" className="block py-2 text-gray-700 hover:text-blue-600">Accueil</Link>
            <Link to="/categories" className="block py-2 text-gray-700 hover:text-blue-600">Catégories</Link>
            <Link to="/a-propos" className="block py-2 text-gray-700 hover:text-blue-600">À propos</Link>
            <Link to="/blog" className="block py-2 text-gray-700 hover:text-blue-600">Blog</Link>
            <Link to="/contact" className="block py-2 text-gray-700 hover:text-blue-600">Contact</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function CategoryMegaMenuItem({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
        <div className="text-blue-600">{icon}</div>
        {title}
      </div>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx}>
            <Link to={`/pieces/${item.toLowerCase().replace(/\s+/g, '-')}`} className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
              {item}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ================================
// HERO SECTION
// ================================
function HeroSection({ countdown }: { countdown: any }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white pt-32 pb-20">
      {/* Background image overlay */}
      <div 
        className="absolute inset-0 opacity-20 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1920')" }}
      />
      
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-transparent animate-pulse-slow" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Slogan principal */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in-up leading-tight">
            Votre route vers des pièces auto<br />
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              de qualité commence ici
            </span>
          </h1>

          <p className="text-xl md:text-2xl mb-8 text-blue-100 animate-fade-in-up animation-delay-200">
            Commerce électronique nouvelle génération : Qualité • Rapidité • Expertise
          </p>

          {/* Mini CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in-up animation-delay-400">
            <Link
              to="/nouveautes"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-full font-semibold text-lg shadow-2xl hover:shadow-orange-500/50 transition-all hover:scale-105"
            >
              <Rocket className="w-5 h-5" />
              Explorer les nouveautés
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/catalogue"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 border-2 border-white/30 rounded-full font-semibold text-lg transition-all"
            >
              Voir le catalogue complet
            </Link>
          </div>

          {/* Compteur offre limitée */}
          <div className="inline-block bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 animate-fade-in-up animation-delay-600">
            <div className="text-sm text-yellow-300 mb-2 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Offre limitée - Se termine dans :
            </div>
            <div className="flex gap-4 justify-center">
              <CountdownUnit value={countdown.hours} label="Heures" />
              <CountdownUnit value={countdown.minutes} label="Minutes" />
              <CountdownUnit value={countdown.seconds} label="Secondes" />
            </div>
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 animate-fade-in-up animation-delay-800">
            <StatBadge icon={<Package />} value="50K+" label="Pièces" />
            <StatBadge icon={<Shield />} value="120+" label="Marques" />
            <StatBadge icon={<Users />} value="25K+" label="Clients" />
            <StatBadge icon={<Star />} value="4.8/5" label="Satisfaction" />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <ChevronDown className="w-8 h-8 text-white/50" />
      </div>
    </section>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-white bg-white/20 rounded-lg px-4 py-2 min-w-[70px]">
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-xs text-blue-200 mt-1">{label}</div>
    </div>
  );
}

function StatBadge({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="text-center bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all">
      <div className="text-blue-300 mb-2 flex justify-center">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-blue-200">{label}</div>
    </div>
  );
}

// ================================
// BARRE DE RECHERCHE AVANCÉE
// ================================
function AdvancedSearchBar() {
  const [searchType, setSearchType] = useState<'reference' | 'vehicle' | 'category'>('reference');

  return (
    <section className="relative -mt-20 z-30">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <button
              onClick={() => setSearchType('reference')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                searchType === 'reference' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Search className="w-5 h-5 inline mr-2" />
              Par référence
            </button>
            <button
              onClick={() => setSearchType('vehicle')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                searchType === 'vehicle' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Package className="w-5 h-5 inline mr-2" />
              Par véhicule
            </button>
            <button
              onClick={() => setSearchType('category')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                searchType === 'category' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-5 h-5 inline mr-2" />
              Par catégorie
            </button>
          </div>

          {/* Formulaire de recherche */}
          <div className="flex gap-4">
            <input
              type="text"
              placeholder={
                searchType === 'reference' ? 'Ex: 7701472155 ou référence constructeur...' :
                searchType === 'vehicle' ? 'Ex: Renault Clio 2015...' :
                'Ex: Filtre à huile, plaquettes de frein...'
              }
              className="flex-1 px-6 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
            />
            <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2">
              <Search className="w-5 h-5" />
              Rechercher
            </button>
          </div>

          {/* Options de filtrage */}
          <div className="mt-4 flex flex-wrap gap-3">
            <FilterChip label="Marque" />
            <FilterChip label="Prix" />
            <FilterChip label="Disponibilité" />
            <FilterChip label="Promotion" />
            <FilterChip label="Note client" />
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <button className="px-4 py-2 bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600 rounded-full text-sm font-medium transition-all border border-gray-200 hover:border-blue-300">
      {label}
      <ChevronDown className="w-3 h-3 inline ml-1" />
    </button>
  );
}

// ================================
// BANNIÈRE FLASH OFFRES
// ================================
function FlashOfferBanner({ _offers, _countdown }: any) {
  return (
    <section className="py-4 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between animate-slide-in-right">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 rounded-full p-3">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-lg">🔥 Offre du jour : 30% de réduction sur les filtres à air !</div>
              <div className="text-sm text-orange-100">Code: FILTRE30 - Valable jusqu'à minuit</div>
            </div>
          </div>
          <Link
            to="/promotions"
            className="px-6 py-3 bg-white text-red-600 rounded-full font-bold hover:bg-gray-100 transition-all hover:scale-105 shadow-lg whitespace-nowrap"
          >
            J'en profite →
          </Link>
        </div>
      </div>
    </section>
  );
}

// Suite dans le prochain message...
