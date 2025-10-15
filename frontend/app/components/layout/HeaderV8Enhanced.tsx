/**
 * 🎯 HEADER V8 ENHANCED - Version améliorée avec backend integration
 * 
 * Combine :
 * ✅ Votre structure V8 (topBar + main + secondary)
 * ✅ Nos APIs backend réelles (/api/layout/header)
 * ✅ Composants existants (CartIcon, SearchBar, etc.)
 * ✅ Vraies données Supabase (59,137 utilisateurs)
 * ✅ Navigation responsive et thèmes
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

interface HeaderV8EnhancedProps {
  context?: 'admin' | 'commercial' | 'public';
  theme?: string;
  variant?: 'basic' | 'ecommerce' | 'admin' | 'custom';
  features?: string[];
  showTopBar?: boolean;
  showSecondaryNav?: boolean;
  showSearch?: boolean;
  showCart?: boolean;
  onMobileMenuToggle?: () => void;
  className?: string;
  staticData?: HeaderData; // Pour fallback ou données statiques
}

export function HeaderV8Enhanced({ 
  context = 'public',
  theme = 'default',
  onMobileMenuToggle,
  className = "",
  staticData 
}: HeaderV8EnhancedProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerData, setHeaderData] = useState<HeaderData | null>(staticData || null);
  const [loading, setLoading] = useState(!staticData);
  
  const fetcher = useFetcher();
  const user = useOptionalUser();

  // 🔌 Connexion aux vraies APIs backend
  useEffect(() => {
    if (!staticData) {
      fetcher.load(`/api/layout/header?context=${context}`);
    }
  }, [context, staticData, fetcher]);

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

  // Données de fallback si pas de connexion backend
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

  return (
    <header className={`header header--v8-enhanced ${className} ${theme === 'dark' ? 'dark' : ''}`}>
      {/* 📞 Top Bar - Contact et réseaux sociaux */}
      {data.topBar?.show && (
        <div className="header__top-bar bg-gray-100 border-b">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center py-2 text-sm">
              <div className="flex items-center space-x-4">
                {data.topBar.content.phone && (
                  <a 
                    href={`tel:${data.topBar.content.phone}`} 
                    className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    {data.topBar.content.phone}
                  </a>
                )}
                {data.topBar.content.email && (
                  <a 
                    href={`mailto:${data.topBar.content.email}`} 
                    className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    {data.topBar.content.email}
                  </a>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                {data.topBar.content.social?.map((social) => (
                  <a
                    key={social.platform}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-blue-600 transition-colors"
                    aria-label={social.platform}
                  >
                    {getSocialIcon(social.icon)}
                  </a>
                ))}
                
                {/* Stats utilisateurs si disponibles */}
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
      <div className="header__main bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            
            {/* 🎨 Logo */}
            <Link 
              to={data.logo.link || "/"} 
              className="header__logo flex-shrink-0"
            >
              <img 
                src={data.logo.url} 
                alt={data.logo.alt} 
                className="h-12 w-auto hover:opacity-80 transition-opacity" 
              />
            </Link>

            {/* 🔍 Barre de recherche intégrée (desktop) */}
            {data.quickSearch?.enabled && (
              <div className="header__search hidden md:flex flex-1 max-w-md mx-8">
                <SearchBar 
                  placeholder={data.quickSearch.placeholder}
                  className="w-full"
                  showSuggestions={true}
                  showHistory={true}
                />
              </div>
            )}

            {/* 🧭 Navigation principale (desktop) */}
            <nav className="header__nav hidden lg:flex items-center space-x-6">
              {data.navigation.map((item, index) => (
                <NavItem key={index} item={item} />
              ))}
            </nav>

            {/* ⚡ Actions utilisateur */}
            <div className="header__actions flex items-center space-x-4">
              
              {/* 🔍 Recherche mobile */}
              <button
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label="Rechercher"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* 👤 Menu utilisateur */}
              <div className="relative">
                {user ? (
                  <Link 
                    to="/account" 
                    className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <User className="w-5 h-5" />
                    <span className="hidden md:inline text-sm">
                      {user.firstName}
                    </span>
                  </Link>
                ) : (
                  <Link 
                    to="/login" 
                    className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <User className="w-5 h-5" />
                    <span className="hidden md:inline text-sm">Connexion</span>
                  </Link>
                )}
              </div>

              {/* 🛒 Panier existant */}
              <CartIcon className="p-2 hover:bg-gray-100 rounded-lg transition-colors" />

              {/* 📱 Menu mobile */}
              <button
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={handleMobileMenuToggle}
                aria-label="Menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 Barre de recherche mobile (expandable) */}
      {searchOpen && (
        <div className="header__mobile-search md:hidden bg-white border-b p-4">
          <SearchBar 
            placeholder={data.quickSearch?.placeholder}
            autoFocus={true}
            onSearch={() => setSearchOpen(false)}
          />
        </div>
      )}

      {/* 📱 Menu mobile (sidebar) */}
      {mobileMenuOpen && (
        <div className="header__mobile-menu lg:hidden bg-white border-b">
          <nav className="container mx-auto px-4 py-4 space-y-2">
            {data.navigation.map((item, index) => (
              <div key={index}>
                <Link
                  to={item.href}
                  className="block py-3 px-2 text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <div className="ml-4 space-y-1">
                    {item.children.map((child, childIndex) => (
                      <Link
                        key={childIndex}
                        to={child.href}
                        className="block py-2 px-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
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

      {/* 🏷️ Navigation secondaire (si présente) */}
      {data.navigation.some(item => item.children) && (
        <div className="header__secondary bg-gray-50 border-b hidden lg:block">
          <div className="container mx-auto px-4">
            <nav className="flex items-center space-x-6 py-3">
              {data.navigation
                .filter(item => item.children)
                .flatMap(item => item.children || [])
                .slice(0, 6) // Limite à 6 éléments
                .map((item, index) => (
                  <Link
                    key={index}
                    to={item.href}
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
            </nav>
          </div>
        </div>
      )}

      {/* 📊 Loading state */}
      {loading && (
        <div className="header__loading bg-blue-50 border-b">
          <div className="container mx-auto px-4 py-2 text-center">
            <span className="text-sm text-blue-600">Chargement du header...</span>
          </div>
        </div>
      )}
    </header>
  );
}

// 🧭 Composant pour les items de navigation avec dropdown
function NavItem({ item }: { item: any }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (item.children?.length > 0) {
    return (
      <div 
        className="relative group"
        onMouseEnter={() => setDropdownOpen(true)}
        onMouseLeave={() => setDropdownOpen(false)}
      >
        <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors py-2">
          <span>{item.label}</span>
          <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
        </button>
        
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white shadow-lg rounded-lg border py-2 z-50">
            {item.children.map((child: any, index: number) => (
              <Link
                key={index}
                to={child.href}
                className="block px-4 py-2 text-sm text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link 
      to={item.href} 
      className="text-gray-700 hover:text-blue-600 transition-colors py-2"
    >
      {item.label}
    </Link>
  );
}
