/**
 * 🎯 HEADER - Composant header principal unifié
 * 
 * Header moderne et responsive avec :
 * ✅ Backend API integration
 * ✅ Composants existants réutilisés
 * ✅ Design responsive
 * ✅ Thèmes dynamiques
 * ✅ Configuration par contexte
 */

import { Link, useFetcher } from "@remix-run/react";
import { 
  Search, 
  User, 
  Menu, 
  X, 
  ChevronDown,
  Phone,
  Mail,
  Facebook,
  Twitter,
  Instagram,
  Linkedin
} from "lucide-react";
import { useState, useEffect } from "react";

// Imports des modules
import { useOptionalUser } from "../../root";
import { CartIcon } from "../cart/CartIcon";
import { SearchBar } from "../search/SearchBar";

interface HeaderData {
  title: string;
  logo: {
    url: string;
    alt: string;
    link?: string;
  };
  navigation: Array<{
    label: string;
    href: string;
    icon?: string;
    children?: Array<{
      label: string;
      href: string;
    }>;
  }>;
  userStats?: {
    total: number;
    active: number;
  };
  topBar?: {
    show: boolean;
    content: {
      phone?: string;
      email?: string;
      social?: Array<{
        platform: string;
        url: string;
        icon: string;
      }>;
    };
  };
  quickSearch?: {
    enabled: boolean;
    placeholder: string;
  };
}

interface HeaderProps {
  context?: 'admin' | 'commercial' | 'public';
  onMobileMenuToggle?: () => void;
  className?: string;
  staticData?: HeaderData;
  data?: HeaderData; // Support pour les données passées directement
}

export function Header({ 
  context = 'public',
  onMobileMenuToggle,
  className = "",
  staticData,
  data: propData
}: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerData, setHeaderData] = useState<HeaderData | null>(propData || staticData || null);
  const [loading, setLoading] = useState(!propData && !staticData);
  
  const fetcher = useFetcher();
  const user = useOptionalUser();

  // 🔌 Connexion aux vraies APIs backend (seulement si pas de données statiques)
  useEffect(() => {
    if (!propData && !staticData) {
      fetcher.load(`/api/layout/header?context=${context}`);
    }
  }, [context, propData, staticData, fetcher]);

  // Mise à jour des données quand l'API répond
  useEffect(() => {
    if (fetcher.data && typeof fetcher.data === 'object' && fetcher.data !== null) {
      const data = fetcher.data as any;
      if (!data.error) {
        setHeaderData(data as HeaderData);
        setLoading(false);
      }
    }
  }, [fetcher.data]);

  // Gestion du menu mobile
  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
    onMobileMenuToggle?.();
  };

  // Données de fallback
  const fallbackData: HeaderData = {
    title: "Pièces Auto",
    logo: {
      url: "/images/logo.png", 
      alt: "Logo Pièces Auto",
      link: "/"
    },
    navigation: [
      { label: "Accueil", href: "/", icon: "home" },
      { label: "Catalogue", href: "/catalogue", icon: "box" },
      { label: "Marques", href: "/marques", icon: "tag" },
      { label: "Aide", href: "/aide", icon: "help" }
    ],
    topBar: {
      show: true,
      content: {
        phone: "+33 1 23 45 67 89",
        email: "contact@pieces-auto.fr",
        social: [
          { platform: "facebook", url: "https://facebook.com", icon: "facebook" },
          { platform: "twitter", url: "https://twitter.com", icon: "twitter" }
        ]
      }
    },
    quickSearch: {
      enabled: true,
      placeholder: "Rechercher une pièce, référence, véhicule..."
    }
  };

  const data = headerData || fallbackData;

  // Rendu des icônes sociales
  const getSocialIcon = (iconName: string) => {
    switch (iconName) {
      case 'facebook': return <Facebook className="w-4 h-4" />;
      case 'twitter': return <Twitter className="w-4 h-4" />;
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'linkedin': return <Linkedin className="w-4 h-4" />;
      default: return null;
    }
  };

  // Header moderne unifié
  return (
    <header className={`header ${className}`}>
      {/* 📞 Top Bar */}
      {data.topBar?.show && (
        <div className="bg-gray-100 border-b">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center py-2 text-sm">
              <div className="flex items-center space-x-4">
                {data.topBar.content.phone && (
                  <a href={`tel:${data.topBar.content.phone}`} className="flex items-center text-gray-600 hover:text-blue-600">
                    <Phone className="w-4 h-4 mr-1" />
                    {data.topBar.content.phone}
                  </a>
                )}
                {data.topBar.content.email && (
                  <a href={`mailto:${data.topBar.content.email}`} className="flex items-center text-gray-600 hover:text-blue-600">
                    <Mail className="w-4 h-4 mr-1" />
                    {data.topBar.content.email}
                  </a>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                {data.topBar.content.social?.map((social) => (
                  <a key={social.platform} href={social.url} target="_blank" rel="noopener noreferrer" 
                     className="text-gray-600 hover:text-blue-600">
                    {getSocialIcon(social.icon)}
                  </a>
                ))}
                {data.userStats && (
                  <span className="text-xs text-gray-500 hidden md:inline">
                    {data.userStats.total.toLocaleString()} utilisateurs
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🏠 Header principal */}
      <div className="bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            
            <Link to={data.logo.link || "/"} className="flex-shrink-0">
              <img src={data.logo.url} alt={data.logo.alt} className="h-12 w-auto hover:opacity-80 transition-opacity" />
            </Link>

            {data.quickSearch?.enabled && (
              <div className="hidden md:flex flex-1 max-w-md mx-8">
                <SearchBar 
                  placeholder={data.quickSearch.placeholder}
                  className="w-full"
                  showSuggestions={true}
                  showHistory={true}
                />
              </div>
            )}

            <nav className="hidden lg:flex items-center space-x-6">
              {data.navigation.map((item, index) => (
                <NavItem key={index} item={item} />
              ))}
            </nav>

            <div className="flex items-center space-x-4">
              <button className="md:hidden p-2 hover:bg-gray-100 rounded-lg" onClick={() => setSearchOpen(!searchOpen)}>
                <Search className="w-5 h-5" />
              </button>

              <div className="relative">
                {user ? (
                  <Link to="/account" className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg">
                    <User className="w-5 h-5" />
                    <span className="hidden md:inline text-sm">{user.firstName}</span>
                  </Link>
                ) : (
                  <Link to="/login" className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg">
                    <User className="w-5 h-5" />
                    <span className="hidden md:inline text-sm">Connexion</span>
                  </Link>
                )}
              </div>

              <CartIcon className="p-2 hover:bg-gray-100 rounded-lg" />

              <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg" onClick={handleMobileMenuToggle}>
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="md:hidden bg-white border-b p-4">
          <SearchBar 
            placeholder={data.quickSearch?.placeholder}
            autoFocus={true}
            onSearch={() => setSearchOpen(false)}
          />
        </div>
      )}

      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b">
          <nav className="container mx-auto px-4 py-4 space-y-2">
            {data.navigation.map((item, index) => (
              <div key={index}>
                <Link to={item.href} className="block py-3 px-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}>
                  {item.label}
                </Link>
                {item.children && (
                  <div className="ml-4 space-y-1">
                    {item.children.map((child, childIndex) => (
                      <Link key={childIndex} to={child.href} 
                            className="block py-2 px-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg"
                            onClick={() => setMobileMenuOpen(false)}>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      )}

      {loading && (
        <div className="bg-blue-50 border-b">
          <div className="container mx-auto px-4 py-2 text-center">
            <span className="text-sm text-blue-600">Chargement...</span>
          </div>
        </div>
      )}
    </header>
  );
}

// Navigation item avec dropdown
function NavItem({ item }: { item: any }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (item.children?.length > 0) {
    return (
      <div className="relative group" onMouseEnter={() => setDropdownOpen(true)} onMouseLeave={() => setDropdownOpen(false)}>
        <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 py-2">
          <span>{item.label}</span>
          <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
        </button>
        
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white shadow-lg rounded-lg border py-2 z-50">
            {item.children.map((child: any, index: number) => (
              <Link key={index} to={child.href} className="block px-4 py-2 text-sm text-gray-700 hover:text-blue-600 hover:bg-gray-50">
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link to={item.href} className="text-gray-700 hover:text-blue-600 py-2">
      {item.label}
    </Link>
  );
}

