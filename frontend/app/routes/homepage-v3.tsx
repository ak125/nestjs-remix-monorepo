import  { type MetaFunction, type LoaderFunctionArgs , json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { 
  Menu, X, Search, ShoppingCart, User, ChevronDown,
  Phone, Mail, Clock
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  HeroSection,
  FlashBanner,
  WhyChooseUs,
  FeaturedProducts,
  EcommerceFuture,
  ProductComparison,
  Testimonials,
  Partners,
  MainCTA,
  BlogSection,
  FAQSection,
  Newsletter,
  Team,
  Contact,
  Footer,
  LiveChat,
  PopupSignup
} from "../components/homepage-v3";

export const meta: MetaFunction = () => {
  return [
    { title: "Vente pièces détachées auto neuves & à prix pas cher | AutoMecanik" },
    { name: "description", content: "Votre fournisseur de pièces détachées automobile neuves et d'origine pour toutes les marques & modèles. Livraison rapide, garantie constructeur, prix compétitifs." },
    { name: "keywords", content: "pieces detachees, pieces auto, pieces de rechange, pieces voiture, pieces automobile, pieces pas cher, renault, peugeot, citroen, audi, bmw, mercedes, ford, volkswagen" },
    { name: "robots", content: "index, follow" },
    { name: "author", content: "AutoMecanik" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://www.automecanik.com/" },
    { property: "og:title", content: "AutoMecanik - Pièces détachées auto à prix pas cher" },
    { property: "og:description", content: "Découvrez notre vaste catalogue de pièces automobiles neuves pour toutes marques" },
    { property: "og:image", content: "https://www.automecanik.com/assets/img/og-image.jpg" },
    { property: "twitter:card", content: "summary_large_image" },
    { property: "twitter:title", content: "AutoMecanik - Pièces détachées auto à prix pas cher" },
    { property: "twitter:description", content: "Découvrez notre vaste catalogue de pièces automobiles neuves pour toutes marques" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Données pour la homepage
  const stats = {
    products: 50000,
    customers: 15000,
    brands: 120,
    delivery: 48
  };

  const featuredProducts = [
    { 
      id: 1, 
      name: "Kit de distribution complet", 
      price: 89.99, 
      originalPrice: 119.99,
      brand: "BOSCH", 
      promo: 25,
      rating: 4.8,
      reviews: 145,
      stock: 12,
      image: "/images/products/kit-distribution.jpg",
      badges: ["PROMO", "STOCK LIMITÉ"]
    },
    { 
      id: 2, 
      name: "Plaquettes de frein avant", 
      price: 45.99, 
      originalPrice: 59.99,
      brand: "VALEO", 
      promo: 23,
      rating: 4.6,
      reviews: 89,
      stock: 25,
      image: "/images/products/plaquettes-frein.jpg",
      badges: ["PROMO"]
    },
    { 
      id: 3, 
      name: "Filtre à huile premium", 
      price: 12.99, 
      brand: "MANN", 
      promo: 0,
      rating: 4.9,
      reviews: 234,
      stock: 150,
      image: "/images/products/filtre-huile.jpg",
      badges: ["NOUVEAU"]
    },
  ];

  const testimonials = [
    {
      id: 1,
      name: "Jean D.",
      location: "Paris",
      rating: 5,
      comment: "Excellent service et qualité des pièces. Je recommande AutoMecanik ! Livraison rapide et produits conformes à la description.",
      date: "2025-10-10",
      verified: true,
      ratings: { quality: 5, service: 5, delivery: 5 }
    },
    {
      id: 2,
      name: "Marie L.",
      location: "Lyon",
      rating: 5,
      comment: "Très satisfait de mon achat. Les pièces sont d'origine et parfaitement compatibles avec mon véhicule.",
      date: "2025-10-08",
      verified: true,
      ratings: { quality: 5, service: 4, delivery: 5 }
    },
    {
      id: 3,
      name: "Pierre M.",
      location: "Marseille",
      rating: 5,
      comment: "Des prix imbattables ! J'ai économisé plus de 200€ par rapport à ma concession.",
      date: "2025-10-05",
      verified: true,
      ratings: { quality: 5, service: 5, delivery: 4 }
    },
  ];

  return json({ 
    stats, 
    featuredProducts, 
    testimonials,
    timestamp: new Date().toISOString() 
  });
}

export default function HomepageV3() {
  const { stats, featuredProducts, testimonials } = useLoaderData<typeof loader>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Afficher le popup après 5 secondes
    const timer = setTimeout(() => {
      setShowPopup(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Top Bar */}
      <div className="bg-gray-900 text-white py-2 hidden md:block">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-6">
              <a href="tel:+33148497869" className="flex items-center space-x-2 hover:text-orange-500 transition">
                <Phone className="h-4 w-4" />
                <span>01 48 49 78 69</span>
              </a>
              <a href="mailto:contact@automecanik.com" className="flex items-center space-x-2 hover:text-orange-500 transition">
                <Mail className="h-4 w-4" />
                <span>contact@automecanik.com</span>
              </a>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Lun-Ven : 9h-18h</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/connexion" className="hover:text-orange-500 transition">Connexion</a>
              <span className="text-gray-600">|</span>
              <a href="/inscription" className="hover:text-orange-500 transition">Inscription</a>
            </div>
          </div>
        </div>
      </div>

      {/* Navbar */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-lg' : 'bg-gray-900'
      }`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="text-2xl font-bold text-orange-500">
              AutoMecanik
            </a>

            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center space-x-8">
              <a href="/" className={`${scrolled ? 'text-gray-700' : 'text-white'} hover:text-orange-500 transition`}>
                Accueil
              </a>
              <div className="relative group">
                <button className={`flex items-center space-x-1 ${scrolled ? 'text-gray-700' : 'text-white'} hover:text-orange-500 transition`}>
                  <span>Catégories</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {/* Mega Menu */}
                <div className="absolute top-full left-0 w-screen max-w-4xl bg-white shadow-2xl rounded-b-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 mt-2">
                  <div className="grid grid-cols-3 gap-6 p-6">
                    <div>
                      <h3 className="font-bold text-gray-900 mb-3">Freinage</h3>
                      <ul className="space-y-2">
                        <li><a href="/pieces/plaquettes-de-frein" className="text-gray-600 hover:text-orange-500">Plaquettes de frein</a></li>
                        <li><a href="/pieces/disques-de-frein" className="text-gray-600 hover:text-orange-500">Disques de frein</a></li>
                        <li><a href="/pieces/kit-de-frein" className="text-gray-600 hover:text-orange-500">Kits complets</a></li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-3">Filtration</h3>
                      <ul className="space-y-2">
                        <li><a href="/pieces/filtre-a-huile" className="text-gray-600 hover:text-orange-500">Filtres à huile</a></li>
                        <li><a href="/pieces/filtre-a-air" className="text-gray-600 hover:text-orange-500">Filtres à air</a></li>
                        <li><a href="/pieces/filtre-habitacle" className="text-gray-600 hover:text-orange-500">Filtres habitacle</a></li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-3">Distribution</h3>
                      <ul className="space-y-2">
                        <li><a href="/pieces/kit-distribution" className="text-gray-600 hover:text-orange-500">Kits de distribution</a></li>
                        <li><a href="/pieces/courroie" className="text-gray-600 hover:text-orange-500">Courroies</a></li>
                        <li><a href="/pieces/pompe-a-eau" className="text-gray-600 hover:text-orange-500">Pompes à eau</a></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <a href="/about" className={`${scrolled ? 'text-gray-700' : 'text-white'} hover:text-orange-500 transition`}>
                À propos
              </a>
              <a href="/blog" className={`${scrolled ? 'text-gray-700' : 'text-white'} hover:text-orange-500 transition`}>
                Blog
              </a>
              <a href="/contact" className={`${scrolled ? 'text-gray-700' : 'text-white'} hover:text-orange-500 transition`}>
                Contact
              </a>
            </div>

            {/* Icons */}
            <div className="flex items-center space-x-4">
              <button className="p-2 hover:bg-gray-100 rounded-full transition">
                <Search className={`h-5 w-5 ${scrolled ? 'text-gray-700' : 'text-white'}`} />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition relative">
                <ShoppingCart className={`h-5 w-5 ${scrolled ? 'text-gray-700' : 'text-white'}`} />
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  0
                </span>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition">
                <User className={`h-5 w-5 ${scrolled ? 'text-gray-700' : 'text-white'}`} />
              </button>
              
              {/* Mobile Menu Button */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2"
              >
                {isMenuOpen ? (
                  <X className={`h-6 w-6 ${scrolled ? 'text-gray-700' : 'text-white'}`} />
                ) : (
                  <Menu className={`h-6 w-6 ${scrolled ? 'text-gray-700' : 'text-white'}`} />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="lg:hidden py-4 border-t">
              <div className="space-y-4">
                <a href="/" className="block text-gray-700 hover:text-orange-500">Accueil</a>
                <a href="/categories" className="block text-gray-700 hover:text-orange-500">Catégories</a>
                <a href="/about" className="block text-gray-700 hover:text-orange-500">À propos</a>
                <a href="/blog" className="block text-gray-700 hover:text-orange-500">Blog</a>
                <a href="/contact" className="block text-gray-700 hover:text-orange-500">Contact</a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <HeroSection stats={stats} />
        <FlashBanner />
        <WhyChooseUs />
        <FeaturedProducts products={featuredProducts} />
        <EcommerceFuture />
        <ProductComparison />
        <Testimonials testimonials={testimonials} />
        <Partners />
        <MainCTA />
        <BlogSection />
        <FAQSection />
        <Newsletter />
        <Team />
        <Contact />
      </main>

      <Footer />
      <LiveChat />
      {showPopup && <PopupSignup onClose={() => setShowPopup(false)} />}
    </div>
  );
}
