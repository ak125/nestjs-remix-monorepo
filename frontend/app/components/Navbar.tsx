import { Link, useLocation } from "@remix-run/react";
import { Bell, BookOpen, Search, Shield, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from "react";

import { useCart } from "../hooks/useCart";
import { useOptionalUser } from "../root";
import { GlobalSearch } from "./layout/GlobalSearch";
import { CartSidebar } from "./navbar/CartSidebar";
import { NavbarMobile } from "./navbar/NavbarMobile";
import { UserDropdownMenu } from "./navbar/UserDropdownMenu";
import { Badge } from "./ui/badge";

export const Navbar = ({ logo }: { logo: string }) => {
  const user = useOptionalUser();
  const location = useLocation();
  const { summary, isOpen, toggleCart, closeCart } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // 🆕 PHASE 7: Role-based permissions
  const isAdmin = user && (user.level ?? 0) >= 7;
  const isSuperAdmin = user && (user.level ?? 0) >= 9;
  
  // 🆕 Détection du scroll pour effet sticky
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 🆕 Raccourci clavier global Cmd+K / Ctrl+K pour ouvrir la recherche
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 🆕 Smooth scroll vers les sections
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    // Seulement si on est sur la page d'accueil
    if (location.pathname === '/') {
      e.preventDefault();
      const element = document.getElementById(sectionId);
      if (element) {
        const offset = 80; // Hauteur du navbar
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
    <nav 
      className={`px-3 py-2 bg-primary text-primary-foreground flex justify-between items-center sticky top-0 z-50 transition-shadow duration-300 ${
        isScrolled ? 'shadow-lg' : ''
      }`} 
      aria-label="Navigation principale"
    >
      {/* GAUCHE : Logo + Navigation Desktop */}
      <div className="flex items-center gap-4">
        {/* 🆕 PHASE 2: Burger Menu Mobile (< 768px) */}
        <NavbarMobile user={user} />
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <img 
            src={logo}
            alt="Logo Automecanik"
            className="w-auto h-12 hover:opacity-80 transition-opacity"
          />
          
          {/* 🆕 PHASE 7: Badge rôle admin */}
          {isAdmin && (
            <Badge variant="secondary" className="bg-primary/95 text-blue-100 border border-blue-400 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {isSuperAdmin ? "Super Admin" : "Admin"}
            </Badge>
          )}
        </Link>
        
        {/* 🖥️ Navigation Desktop (>= 768px) */}
        <div className="hidden md:flex gap-6">
          <Link to="/catalogue" className="hover:text-blue-200 transition-colors text-sm font-medium">
            Catalogue
          </Link>
          <Link to="/marques" className="hover:text-blue-200 transition-colors text-sm font-medium">
            Marques
          </Link>
          {/* Liens avec smooth scroll pour la page d'accueil */}
          {location.pathname === '/' && (
            <>
              <a 
                href="#about" 
                onClick={(e) => scrollToSection(e, 'about')}
                className="hover:text-blue-200 transition-colors text-sm font-medium cursor-pointer"
              >
                À propos
              </a>
              <a 
                href="#advantages" 
                onClick={(e) => scrollToSection(e, 'advantages')}
                className="hover:text-blue-200 transition-colors text-sm font-medium cursor-pointer"
              >
                Avantages
              </a>
            </>
          )}
          <Link 
            to="/blog" 
            className="hover:text-blue-200 transition-colors text-sm font-medium flex items-center gap-1.5"
          >
            <BookOpen className="w-4 h-4" />
            Blog
            <span className="bg-success text-success-foreground text-xs px-1.5 py-0.5 rounded-full font-semibold">
              Nouveau
            </span>
          </Link>
        </div>
      </div>
      
      {/* DROITE : Actions Utilisateur */}
      <div className='flex gap-3 items-center'>
        {/* 🆕 Bouton Recherche Globale (Cmd+K) - Version Desktop */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white transition-all duration-200 group"
          aria-label="Recherche globale"
          title="Recherche (Cmd+K)"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm font-medium">Rechercher</span>
          <kbd className="hidden lg:inline-flex ml-1 px-2 py-0.5 text-[11px] font-semibold text-blue-800 bg-white rounded border border-white/40 shadow-sm group-hover:shadow">
            ⌘K
          </kbd>
        </button>

        {/* Version mobile: icône simple */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="md:hidden hover:text-blue-200 transition-colors p-1.5 hover:bg-white/10 rounded-md"
          aria-label="Recherche"
          title="Recherche (Cmd+K)"
        >
          <Search size={20} />
        </button>

        {/* 🆕 PHASE 1: Panier avec badge */}
        <button
          onClick={toggleCart}
          className="hover:text-blue-200 transition-colors relative p-1"
          aria-label="Panier"
          title="Panier"
        >
          <ShoppingCart size={20} />
          {summary.total_items > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
            >
              {summary.total_items}
            </Badge>
          )}
        </button>

        {/* Notifications - Seulement si connecté */}
        {user && (
          <Link 
            to='/notifications' 
            className="hover:text-blue-200 transition-colors p-1 hidden md:block relative"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={20} />
          </Link>
        )}

        {/* Menu utilisateur avec Dropdown (si connecté) */}
        {user ? (
          <UserDropdownMenu user={user} showName={false} />
        ) : (
          <div className="flex gap-2 text-sm">
            <Link className='hover:text-blue-200 transition-colors px-2' to='/login'>
              Connexion
            </Link>
            <span className="hidden md:inline">|</span>
            <Link className='hover:text-blue-200 transition-colors px-2 hidden md:inline' to='/register'>
              Inscription
            </Link>
          </div>
        )}
      </div>

      {/* 🆕 PHASE 1 POC: CartSidebar Component */}
      <CartSidebar isOpen={isOpen} onClose={closeCart} />

      {/* 🆕 GlobalSearch Modal avec Cmd+K */}
      <GlobalSearch 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)}
        placeholder="Rechercher produits, commandes, utilisateurs..."
      />
    </nav>
  );
};