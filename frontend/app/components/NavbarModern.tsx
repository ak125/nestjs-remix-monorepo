/**
 * 🎨 NAVBAR MODERNE - Design Ultra Premium v2
 * 
 * ✨ Améliorations Design Expert :
 * - Glassmorphism avancé avec effet frosted glass
 * - Animations spring fluides avec Framer Motion style
 * - Micro-interactions sophistiquées
 * - Gradient backgrounds premium
 * - Ombre et profondeur optimisées
 * - Typographie premium avec variantes
 * - Layout adaptatif ultra-réactif
 * - Hover effects avec parallax
 * - Dark mode ready
 */

import { Link, useLocation, useNavigate } from "@remix-run/react";
import { Bell, BookOpen, ChevronRight, Search, ShoppingCart, X, Phone, Truck } from 'lucide-react';
import { useEffect, useRef, useState } from "react";

import { SITE_CONFIG } from "../config/site";
import { useCart } from "../hooks/useCart";
import { useOptionalUser } from "../root";
import { CartSidebar } from "./navbar/CartSidebar";
import { NavbarMobile } from "./navbar/NavbarMobile";
import { UserDropdownMenu } from "./navbar/UserDropdownMenu";
import { Badge } from "./ui/badge";

export const NavbarModern = ({ logo: _logo }: { logo: string }) => {
  const user = useOptionalUser();
  const _location = useLocation();
  const navigate = useNavigate();
  const { summary } = useCart();
  
  // Cart sidebar state (local state for UI control)
  const [isCartOpen, setIsCartOpen] = useState(false);
  const toggleCart = () => setIsCartOpen(prev => !prev);
  const closeCart = () => setIsCartOpen(false);
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  // Ref pour la progress bar - optimisation performance
  const progressBarRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number>();
  
  // Role-based permissions
  const _isAdmin = user && (user.level ?? 0) >= 7;
  const _isSuperAdmin = user && (user.level ?? 0) >= 9;
  
  // Détection du scroll pour effet intelligent + progress bar optimisée
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      setIsScrolled(currentScrollY > 10);
      
      // Navbar compacte après 100px
      setIsCompact(currentScrollY > 100);
      
      setLastScrollY(currentScrollY);
      
      // Optimisation progress bar avec requestAnimationFrame
      if (progressBarRef.current && currentScrollY > 10) {
        // Annuler l'animation précédente si elle existe
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
        }
        
        // Planifier la mise à jour de la progress bar
        rafIdRef.current = requestAnimationFrame(() => {
          if (progressBarRef.current) {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercentage = Math.min((currentScrollY / scrollHeight) * 100, 100);
            progressBarRef.current.style.width = `${scrollPercentage}%`;
          }
        });
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Nettoyer le requestAnimationFrame au démontage
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [lastScrollY]);

  // Raccourci clavier Cmd/Ctrl+K pour ouvrir la recherche
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Échap pour fermer
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery("");
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // Gestion de la recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const query = searchQuery.trim();
    if (query) {
      const url = `/search?q=${encodeURIComponent(query)}`;
      // Réinitialiser immédiatement l'état local
      const _currentQuery = query; // Sauvegarder avant reset
      setSearchQuery("");
      setShowSearch(false);
      // Navigation après reset
      navigate(url);
    }
  };
  
  return (
    <>
      <nav 
        className={`sticky top-0 z-50 px-4 lg:px-8 bg-gradient-to-r from-white/80 via-white/85 to-white/80 backdrop-blur-2xl text-slate-800 flex justify-between items-center transition-all duration-500 ease-out border-b ${
          isCompact ? 'py-2.5' : 'py-4'
        } ${
          isScrolled 
            ? 'shadow-2xl shadow-blue-500/15 border-blue-200/40' 
            : 'shadow-lg shadow-slate-200/30 border-blue-100/20'
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
            className="flex items-center gap-3 group relative flex-shrink-0 cursor-pointer"
            aria-label="Retour à l'accueil"
          >
            <div className="relative pointer-events-none">
              {/* Glow background animé */}
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-400/20 via-indigo-400/20 to-blue-400/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500" />
              
              {/* Logo WebP avec srcset pour haute résolution */}
              <img
                src="/logo-navbar.webp"
                srcSet="/logo-navbar.webp 1x, /logo-navbar@2x.webp 2x"
                alt="Automecanik - Pièces auto à prix pas cher"
                className={`relative transition-all duration-300 group-hover:scale-105 group-hover:drop-shadow-2xl ${
                  isCompact ? 'h-8' : 'h-12'
                } w-auto`}
                loading="eager"
              />
            </div>
          </Link>
          
          {/* Navigation Desktop avec effets premium */}
          <div className="hidden lg:flex items-center gap-1 border-l border-gradient-to-b from-slate-300/50 to-transparent ml-4 pl-8">
            {/* Catalogue pièces auto - Link avec scroll intelligent pour SEO */}
            <Link
              to="/#catalogue"
              onClick={(e) => {
                e.preventDefault();
                const catalogueSection = document.getElementById('catalogue');
                if (catalogueSection) {
                  const offset = 100;
                  const elementPosition = catalogueSection.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - offset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                } else {
                  navigate('/pieces');
                }
              }}
              className="relative group px-4 py-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-all duration-300 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 flex items-center gap-2"
            >
              <span className="relative z-10">Catalogue pièces auto</span>
              <ChevronRight className="w-4 h-4 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-500" />
              {/* Animated underline */}
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </Link>

            {/* Marques & Constructeurs - Link avec scroll intelligent pour SEO */}
            <Link
              to="/#toutes-les-marques"
              onClick={(e) => {
                e.preventDefault();
                const marquesSection = document.getElementById('toutes-les-marques');
                if (marquesSection) {
                  const offset = 100;
                  const elementPosition = marquesSection.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - offset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                } else {
                  navigate('/constructeurs');
                }
              }}
              className="relative group px-4 py-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-all duration-300 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 flex items-center gap-2"
            >
              <span className="relative z-10">Marques & Constructeurs</span>
              <ChevronRight className="w-4 h-4 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-500" />
              {/* Animated underline */}
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </Link>

            <Link
              to="/blog-pieces-auto"
              className="relative group px-4 py-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-all duration-300 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 transition-all duration-300 group-hover:scale-110 group-hover:text-blue-500" />
              <span>Blog</span>
              {/* Animated underline */}
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </Link>
          </div>
        </div>

        {/* CENTRE : Recherche - Section centrale du navbar */}
        <div className="hidden lg:flex flex-1 justify-center px-4 max-w-2xl">
          {/* Recherche intégrée - Desktop avec design premium amélioré */}
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              className="w-full max-w-md flex items-center gap-3 px-6 py-2.5 text-sm text-slate-500 bg-white/80 backdrop-blur-sm hover:bg-white rounded-2xl transition-all duration-300 group border border-slate-200/80 hover:border-blue-400/80 shadow-sm hover:shadow-lg hover:shadow-blue-500/10"
              aria-label="Rechercher"
            >
              <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-all duration-300 group-hover:scale-110" />
              <span className="text-slate-500 group-hover:text-blue-700 font-medium flex-1 text-left">Rechercher une pièce...</span>
              <kbd className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-300/80 rounded-lg shadow-sm group-hover:border-blue-400/80 group-hover:shadow transition-all">
                <span className="text-slate-400">⌘</span>
                <span className="text-slate-600">K</span>
              </kbd>
            </button>
          ) : (
            <form 
              onSubmit={handleSearch}
              className="w-full max-w-md hidden lg:flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div className="relative group flex-1">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 rounded-2xl opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-all duration-300 z-10" />
                <input
                  type="text"
                  name="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch(e as any);
                    }
                  }}
                  placeholder="Filtre à huile, alternateur, plaquettes..."
                  className="w-full pl-12 pr-24 py-3 text-sm border-2 border-slate-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white shadow-lg transition-all duration-300 hover:border-blue-300/80 placeholder:text-slate-400"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSearch(e);
                    }}
                    className="absolute right-12 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    OK
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 rounded-lg transition-all duration-200 hover:scale-110"
                  aria-label="Fermer la recherche"
                >
                  <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                </button>
              </div>
            </form>
          )}
        </div>

        {/* DROITE : Actions utilisateur */}
        <div className="flex items-center gap-2">
          {/* 🚚 Livraison gratuite - Desktop avec animation */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 rounded-xl border border-green-200/60 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 group">
            <div className="relative">
              <Truck className="w-4 h-4 text-green-600 group-hover:translate-x-0.5 transition-transform" />
              <div className="absolute -inset-1 bg-green-400/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xs font-bold text-green-700 tracking-wide">LIVRAISON GRATUITE</span>
          </div>

          {/* 📞 Téléphone cliquable - Desktop minimaliste avec icône uniquement */}
          <a 
            href={`tel:${SITE_CONFIG.contact.phone.raw}`}
            className="hidden lg:flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 rounded-xl border border-blue-200/60 hover:border-blue-400/80 transition-all duration-300 group shadow-sm hover:shadow-md hover:scale-110 active:scale-95"
            aria-label={`Appeler ${SITE_CONFIG.contact.phone.display}`}
            title={`Appeler ${SITE_CONFIG.contact.phone.display}`}
          >
            <div className="relative">
              <Phone className="w-4 h-4 text-blue-600 group-hover:rotate-12 transition-all duration-300" />
              <div className="absolute -inset-1 bg-blue-400/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>

          {/* Recherche - Mobile avec design amélioré */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="lg:hidden p-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl transition-all duration-300 group border border-transparent hover:border-blue-200"
            aria-label="Rechercher"
          >
            <Search className="w-5 h-5 text-slate-700 group-hover:text-blue-600 transition-colors group-hover:scale-110" />
          </button>

          {/* Panier avec animation premium */}
          <button
            onClick={toggleCart}
            className="relative p-2.5 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 rounded-xl transition-all duration-300 group hover:shadow-lg hover:scale-110 active:scale-95 border border-transparent hover:border-blue-200"
            aria-label="Panier"
          >
            <ShoppingCart className="w-5 h-5 text-slate-700 group-hover:text-blue-600 transition-all duration-300 group-hover:scale-110" />
            {summary.total_items > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/40 animate-in zoom-in-50 duration-300 ring-2 ring-white"
              >
                {summary.total_items}
              </Badge>
            )}
            {/* Pulse effect sur le badge */}
            {summary.total_items > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] bg-blue-500 rounded-full animate-ping opacity-30" />
            )}
          </button>

          {/* Notifications premium avec compteur */}
          {user && (
            <Link
              to="/notifications"
              className="relative p-2.5 hover:bg-gradient-to-br hover:from-orange-50 hover:to-red-50 rounded-xl transition-all duration-300 group hover:shadow-lg hover:scale-110 active:scale-95 border border-transparent hover:border-orange-200"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-slate-700 group-hover:text-orange-600 transition-all duration-300 group-hover:rotate-12" />
              {/* Dot indicator animé pour nouvelles notifs */}
              <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 ring-2 ring-white"></span>
              </span>
            </Link>
          )}

          {/* Menu utilisateur - Épuré, juste l'icône */}
          {user ? (
            <UserDropdownMenu user={user} />
          ) : (
            <div className="hidden md:flex items-center gap-2 ml-2">
              <Link
                to="/login"
                rel="nofollow"
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-normal"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                rel="nofollow"
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
        <CartSidebar isOpen={isCartOpen} onClose={closeCart} />
      </nav>

      {/* Barre de recherche mobile - Plein écran avec design premium */}
      {showSearch && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white animate-in fade-in slide-in-from-top duration-300">
          {/* Header avec gradient */}
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <form onSubmit={handleSearch} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                }}
                className="p-2 hover:bg-white/80 rounded-xl transition-all duration-200 hover:scale-110"
                aria-label="Fermer"
              >
                <X className="w-6 h-6 text-slate-700" />
              </button>
              <div className="relative flex-1">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-2xl opacity-0 blur group-hover:opacity-50 transition-opacity" />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 z-10" />
                <input
                  type="text"
                  name="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch(e as any);
                    }
                  }}
                  placeholder="Filtre à huile, référence OEM..."
                  className="w-full pl-12 pr-20 py-4 text-base border-2 border-blue-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-lg font-medium placeholder:text-slate-400 placeholder:font-normal"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSearch(e);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    OK
                  </button>
                )}
              </div>
            </form>
          </div>
          
          {/* Suggestions et astuces */}
          <div className="p-6 space-y-4">
            {/* Astuce premium */}
            <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <span className="text-xl">💡</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Recherche intelligente</p>
                <p className="text-xs text-slate-600">
                  Recherchez par référence OEM, marque, modèle ou type de pièce pour des résultats précis
                </p>
              </div>
            </div>
            
            {/* Exemples de recherche */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Exemples populaires</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "🔧", text: "Filtre à huile" },
                  { icon: "⚡", text: "Alternateur" },
                  { icon: "🔩", text: "Plaquettes de frein" },
                  { icon: "💨", text: "Filtre à air" },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSearchQuery(item.text);
                      handleSearch(new Event('submit') as any);
                    }}
                    className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Progress bar au scroll optimisée avec useRef + requestAnimationFrame */}
      {isScrolled && (
        <div 
          ref={progressBarRef}
          className="sticky top-[73px] z-40 h-1 bg-semantic-info shadow-lg shadow-blue-500/20 animate-in slide-in-from-top duration-500 transition-[width] ease-out" 
          style={{ width: '0%' }}
        />
      )}
    </>
  );
};
