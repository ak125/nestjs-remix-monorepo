/**
 * 🎨 NAVBAR MODERNE - Design Ultra Premium
 * 
 * ✨ Améliorations Design Expert :
 * - Glassmorphism avec backdrop-blur avancé
 * - Micro-interactions fluides et animations subtiles
 * - Hover effects sophistiqués avec scale et glow
 * - Hiérarchie visuelle optimisée
 * - Typographie premium avec espacement parfait
 * - Transitions spring naturelles
 * - Focus states accessibles
 * - Dark mode ready
 */

import { Link, useLocation, useNavigate } from "@remix-run/react";
import { Bell, BookOpen, ChevronRight, Search, Shield, ShoppingCart, X } from 'lucide-react';
import { useEffect, useState } from "react";

import { useCart } from "../hooks/useCart";
import { useOptionalUser } from "../root";
import { CartSidebar } from "./navbar/CartSidebar";
import { NavbarMobile } from "./navbar/NavbarMobile";
import { UserDropdownMenu } from "./navbar/UserDropdownMenu";
import { Badge } from "./ui/badge";

export const NavbarModern = ({ logo }: { logo: string }) => {
  const user = useOptionalUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { summary, isOpen, toggleCart, closeCart } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  // Role-based permissions
  const isAdmin = user && (user.level ?? 0) >= 7;
  const isSuperAdmin = user && (user.level ?? 0) >= 9;
  
  // Détection du scroll pour effet intelligent
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      setIsScrolled(currentScrollY > 10);
      
      // Navbar compacte après 100px
      setIsCompact(currentScrollY > 100);
      
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Gestion de la recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
      setShowSearch(false);
    }
  };

  // Smooth scroll vers les sections
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    if (location.pathname === '/' || location.pathname.includes('homepage-modern')) {
      e.preventDefault();
      const element = document.getElementById(sectionId);
      if (element) {
        const offset = 130; // Hauteur du navbar + topbar
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  };
  
  return (
    <>
      <nav 
        className={`sticky top-0 z-50 px-4 lg:px-6 bg-white/95 backdrop-blur-xl text-slate-800 flex justify-between items-center transition-all duration-500 ease-out border-b ${
          isCompact ? 'py-2' : 'py-3'
        } ${
          isScrolled 
            ? 'shadow-xl shadow-blue-500/10 border-blue-200/50' 
            : 'shadow-sm border-blue-100/30'
        }`} 
        aria-label="Navigation principale"
      >
        {/* GAUCHE : Logo + Navigation Desktop */}
        <div className="flex items-center gap-4 lg:gap-8">
          {/* Burger Menu Mobile avec animation */}
          <div className="lg:hidden">
            <NavbarMobile user={user} />
          </div>
          
          {/* Logo avec effet hover premium - compact au scroll */}
          <Link 
            to="/" 
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <img 
                src={logo}
                alt="Logo Automecanik"
                className={`w-auto transition-all duration-300 group-hover:scale-105 group-hover:drop-shadow-lg ${
                  isCompact ? 'h-9' : 'h-11'
                }`}
              />
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300 -z-10" />
            </div>
            
            {/* Badge rôle admin avec animation et classes simplifiées */}
            {isAdmin && (
              <Badge 
                variant="secondary" 
                className="bg-semantic-info text-semantic-info-contrast border border-blue-200/50 flex items-center gap-1.5 shadow-sm animate-in fade-in slide-in-from-left-2 duration-500"
              >
                <Shield className="w-3 h-3 animate-pulse" />
                <span className="font-semibold text-xs">
                  {isSuperAdmin ? "Super Admin" : "Admin"}
                </span>
              </Badge>
            )}
          </Link>
          
          {/* Navigation Desktop avec effets premium */}
          <div className="hidden lg:flex items-center gap-1 border-l border-slate-200/60 ml-2 pl-6">
            {/* Catalogue pièces auto - Scroll direct vers section */}
            <button
              onClick={() => {
                const catalogueSection = document.getElementById('catalogue');
                if (catalogueSection) {
                  const offset = 100;
                  const elementPosition = catalogueSection.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - offset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                } else {
                  // Fallback : rediriger vers /pieces si la section n'existe pas
                  navigate('/pieces');
                }
              }}
              className="relative group px-3 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-all duration-300 rounded-lg hover:bg-blue-50 flex items-center gap-1.5"
            >
              <span className="relative z-10">Catalogue pièces auto</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              <span className="absolute bottom-1 left-3 right-3 h-0.5 bg-blue-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
            </button>

            {/* Marques & Constructeurs - Scroll direct vers section */}
            <button
              onClick={() => {
                const marquesSection = document.getElementById('nos-marques-partenaires');
                if (marquesSection) {
                  const offset = 100;
                  const elementPosition = marquesSection.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - offset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                } else {
                  // Fallback : rediriger vers /constructeurs si la section n'existe pas
                  navigate('/constructeurs');
                }
              }}
              className="relative group px-3 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-all duration-300 rounded-lg hover:bg-blue-50 flex items-center gap-1.5"
            >
              <span className="relative z-10">Marques & Constructeurs</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              <span className="absolute bottom-1 left-3 right-3 h-0.5 bg-blue-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
            </button>

            <NavAnchor 
              href="#about" 
              label="À propos" 
              onClick={(e) => scrollToSection(e, 'about')} 
            />
            <NavAnchor 
              href="#advantages" 
              label="Avantages" 
              onClick={(e) => scrollToSection(e, 'advantages')} 
            />
            <Link 
              to="/blog"
              className="relative group px-3 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-all duration-300 rounded-lg hover:bg-blue-50/50 flex items-center gap-1.5"
            >
              <BookOpen className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span>Blog</span>
              <Badge 
                variant="secondary" 
                className="ml-1 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200/50 text-xs px-1.5 py-0.5 shadow-sm animate-pulse"
              >
                Nouveau
              </Badge>
              {/* Hover underline effect */}
              <span className="absolute bottom-1 left-3 right-3 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
            </Link>
          </div>
        </div>

        {/* DROITE : Actions utilisateur */}
        <div className="flex items-center gap-2">
          {/* Recherche intégrée - Desktop */}
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              className="hidden lg:flex items-center gap-2 px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all duration-300 group"
              aria-label="Rechercher"
            >
              <Search className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
              <span className="text-slate-500">Rechercher une pièce...</span>
              <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 text-xs font-mono bg-white border border-slate-300 rounded">
                Ctrl K
              </kbd>
            </button>
          ) : (
            <form 
              onSubmit={handleSearch}
              className="hidden lg:flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Référence, nom de pièce..."
                  className="w-64 pl-10 pr-10 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </form>
          )}

          {/* Recherche - Mobile */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="lg:hidden p-2 hover:bg-blue-50 rounded-lg transition-all duration-300"
            aria-label="Rechercher"
          >
            <Search className="w-5 h-5 text-slate-700" />
          </button>

          {/* Panier avec animation sophistiquée et classes simplifiées */}
          <button
            onClick={toggleCart}
            className="relative p-2 hover:bg-blue-50 rounded-lg transition-all duration-300 group hover:shadow-md hover:scale-105 active:scale-95"
            aria-label="Panier"
          >
            <ShoppingCart className="w-5 h-5 text-slate-700 group-hover:text-blue-600 transition-colors" />
            {summary.total_items > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-semantic-info text-semantic-info-contrast shadow-lg shadow-blue-500/30 animate-in zoom-in-50 duration-300 ring-2 ring-white"
              >
                {summary.total_items}
              </Badge>
            )}
          </button>

          {/* Notifications avec indicator et classes simplifiées */}
          {user && (
            <Link
              to="/notifications"
              className="relative p-2 hover:bg-blue-50 rounded-lg transition-all duration-300 group hover:shadow-md hover:scale-105 active:scale-95"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-slate-700 group-hover:text-blue-600 transition-colors group-hover:animate-pulse" />
              {/* Dot indicator pour nouvelles notifs */}
              <span className="absolute top-1 right-1 w-2 h-2 bg-semantic-danger rounded-full animate-pulse ring-2 ring-white" />
            </Link>
          )}

          {/* Menu utilisateur - Épuré, juste l'icône */}
          {user ? (
            <UserDropdownMenu user={user} />
          ) : (
            <div className="hidden md:flex items-center gap-2 ml-2">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-normal"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="relative px-5 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all duration-normal hover:shadow-lg hover:scale-105 active:scale-95 overflow-hidden group"
              >
                {/* Shine effect */}
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-slowest" />
                <span className="relative">Inscription</span>
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar Panier */}
        <CartSidebar isOpen={isOpen} onClose={closeCart} />
      </nav>

      {/* Barre de recherche mobile - Plein écran */}
      {showSearch && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white animate-in fade-in slide-in-from-top duration-300">
          <div className="p-4 border-b border-slate-200">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-700" />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Référence OEM, nom de pièce..."
                  className="w-full pl-11 pr-4 py-3 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </form>
          </div>
          <div className="p-4">
            <p className="text-sm text-slate-500">
              💡 Astuce : Recherchez par référence OEM, marque ou type de pièce
            </p>
          </div>
        </div>
      )}
      
      {/* Progress bar au scroll avec classes simplifiées */}
      {isScrolled && (
        <div className="sticky top-[73px] z-40 h-1 bg-semantic-info shadow-lg shadow-blue-500/20 animate-in slide-in-from-top duration-500" 
             style={{ 
               width: `${Math.min((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100, 100)}%`,
               transition: 'width 0.1s ease-out'
             }} 
        />
      )}
    </>
  );
};

// 🎨 Composant NavAnchor pour les liens internes avec classes simplifiées
const NavAnchor = ({ 
  href, 
  label, 
  onClick 
}: { 
  href: string; 
  label: string; 
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) => (
  <a
    href={href}
    onClick={onClick}
    className="relative group px-3 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-all duration-300 rounded-lg hover:bg-blue-50"
  >
    <span className="relative z-10">{label}</span>
    {/* Hover underline effect */}
    <span className="absolute bottom-1 left-3 right-3 h-0.5 bg-blue-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
  </a>
);
