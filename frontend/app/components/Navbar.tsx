/**
 * 🎨 NAVBAR - Design Ultra Premium v2
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
import {
  Bell,
  BookOpen,
  ChevronRight,
  Search,
  ShoppingCart,
  X,
  Phone,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SITE_CONFIG } from "../config/site";
import { useOptionalUser, useRootCart } from "../root";
import { CartSidebarSimple } from "./navbar/CartSidebarSimple";
import { NavbarMobile } from "./navbar/NavbarMobile";
import { UserDropdownMenu } from "./navbar/UserDropdownMenu";
import { Badge } from "./ui/badge";

/**
 * 🏷️ Quick Category Chip - Pour navigation rapide mobile
 */
function QuickCategoryChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      to={href}
      className="inline-flex items-center px-3 py-2 bg-neutral-100 hover:bg-semantic-info/10 hover:text-semantic-info text-neutral-700 text-sm font-medium rounded-full transition-all whitespace-nowrap active:scale-95"
    >
      {label}
    </Link>
  );
}

export const Navbar = ({ logo: _logo }: { logo: string }) => {
  const user = useOptionalUser();
  const _location = useLocation();
  const _navigate = useNavigate();

  // 🛒 Panier: données depuis root loader + état local pour ouverture
  const cartData = useRootCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const _openCart = useCallback(() => setIsCartOpen(true), []);

  // Résumé du panier depuis les données du root loader
  const summary = cartData?.summary || { total_items: 0, subtotal: 0 };

  const [isScrolled, setIsScrolled] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [_lastScrollY, setLastScrollY] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ref pour la progress bar - optimisation performance
  const progressBarRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number>();
  const navRef = useRef<HTMLElement>(null);

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
            const scrollHeight =
              document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercentage = Math.min(
              (currentScrollY / scrollHeight) * 100,
              100,
            );
            progressBarRef.current.style.width = `${scrollPercentage}%`;
          }
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      // Nettoyer le requestAnimationFrame au démontage
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Setup une seule fois au mount - lastScrollY est lu via closure

  // Track navbar height via CSS variable for sticky children
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        document.documentElement.style.setProperty("--navbar-height", `${h}px`);
      }
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  // Échap pour fermer la recherche
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch]);

  // Focus automatique sur l'input quand la recherche s'ouvre
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      // Petit délai pour s'assurer que l'input est rendu
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [showSearch]);

  // Gestion de la recherche
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const query = searchQuery.trim();
      if (query) {
        // Réinitialiser l'état avant la navigation
        setSearchQuery("");
        setShowSearch(false);
        // Navigation vers la page de recherche
        window.location.href = `/search?q=${encodeURIComponent(query)}`;
      }
    },
    [searchQuery],
  );

  return (
    <>
      <nav
        ref={navRef}
        className={`sticky top-0 z-50 px-4 lg:px-8 bg-gradient-to-r from-white/95 via-white/95 to-white/95 md:from-white/80 md:via-white/85 md:to-white/80 backdrop-blur-none md:backdrop-blur-xl text-neutral-800 flex justify-between items-center transition-all duration-500 ease-out border-b ${
          isCompact ? "py-2.5" : "py-4"
        } ${
          isScrolled
            ? "shadow-2xl shadow-semantic-info/15 border-semantic-info/40"
            : "shadow-lg shadow-neutral-200/30 border-semantic-info/20"
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
            prefetch="intent"
            className="flex items-center gap-3 group relative flex-shrink-0 cursor-pointer"
            aria-label="Retour à l'accueil"
          >
            <div className="relative pointer-events-none">
              {/* Glow background animé */}
              <div className="absolute -inset-2 bg-gradient-to-r from-semantic-info/20 via-secondary-400/20 to-semantic-info/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500" />

              {/* Logo WebP avec srcset pour haute résolution */}
              {/* eslint-disable-next-line react/no-unknown-property */}
              <img
                src="/logo-navbar.webp"
                srcSet="/logo-navbar.webp 1x, /logo-navbar@2x.webp 2x"
                alt="Automecanik - Pièces auto à prix pas cher"
                width={144}
                height={48}
                className={`relative transition-all duration-300 group-hover:scale-105 group-hover:drop-shadow-2xl ${
                  isCompact ? "h-8" : "h-12"
                } w-auto`}
                loading="eager"
                // @ts-expect-error - fetchpriority is a valid HTML attribute but React types it as fetchPriority
                fetchpriority="high"
              />
            </div>
          </Link>

          {/* Navigation Desktop avec effets premium */}
          <div className="hidden lg:flex items-center gap-1 border-l border-gradient-to-b from-neutral-300/50 to-transparent ml-4 pl-8">
            {/* Catalogue pièces auto - Link avec scroll intelligent pour SEO */}
            <Link
              to="/#catalogue"
              onClick={(e) => {
                const isHomepage = window.location.pathname === "/";
                const catalogueSection = document.getElementById("catalogue");

                if (isHomepage && catalogueSection) {
                  e.preventDefault();
                  catalogueSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }
                // Sinon : laisse le lien naviguer vers /#catalogue naturellement
              }}
              className="relative group px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-semantic-info transition-all duration-300 rounded-xl hover:bg-gradient-to-r hover:from-semantic-info/10 hover:to-secondary-500/10 flex items-center gap-2"
            >
              <span className="relative z-10">Catalogue pièces auto</span>
              <ChevronRight className="w-4 h-4 transition-all duration-300 group-hover:translate-x-1 group-hover:text-semantic-info" />
              {/* Animated underline */}
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-semantic-info to-secondary-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </Link>

            {/* Marques & Constructeurs - Link avec scroll intelligent pour SEO */}
            <Link
              to="/#toutes-les-marques"
              onClick={(e) => {
                const isHomepage = window.location.pathname === "/";
                const marquesSection =
                  document.getElementById("toutes-les-marques");

                if (isHomepage && marquesSection) {
                  e.preventDefault();
                  marquesSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }
                // Sinon : laisse le lien naviguer vers /#toutes-les-marques naturellement
              }}
              className="relative group px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-semantic-info transition-all duration-300 rounded-xl hover:bg-gradient-to-r hover:from-semantic-info/10 hover:to-secondary-500/10 flex items-center gap-2"
            >
              <span className="relative z-10">Marques & Constructeurs</span>
              <ChevronRight className="w-4 h-4 transition-all duration-300 group-hover:translate-x-1 group-hover:text-semantic-info" />
              {/* Animated underline */}
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-semantic-info to-secondary-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </Link>

            <Link
              to="/blog-pieces-auto"
              className="relative group px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-semantic-info transition-all duration-300 rounded-xl hover:bg-gradient-to-r hover:from-semantic-info/10 hover:to-secondary-500/10 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 transition-all duration-300 group-hover:scale-110 group-hover:text-semantic-info" />
              <span>Blog</span>
              {/* Animated underline */}
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-semantic-info to-secondary-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </Link>
          </div>
        </div>

        {/* CENTRE : Recherche - Section centrale du navbar */}
        <div className="hidden lg:flex flex-1 justify-center px-4 max-w-2xl">
          {/* Recherche intégrée - Desktop avec design premium simplifié */}
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              className="w-full max-w-md flex items-center gap-3 px-6 py-2.5 text-sm text-neutral-500 bg-white/80 backdrop-blur-sm hover:bg-white rounded-2xl transition-all duration-300 group border border-neutral-200/80 hover:border-semantic-info/80 shadow-sm hover:shadow-lg hover:shadow-semantic-info/10"
              aria-label="Rechercher"
            >
              <Search className="w-4 h-4 text-neutral-400 group-hover:text-semantic-info transition-all duration-300 group-hover:scale-110" />
              <span className="text-neutral-500 group-hover:text-semantic-info font-medium flex-1 text-left">
                Rechercher une pièce...
              </span>
            </button>
          ) : (
            <form
              onSubmit={handleSearch}
              className="w-full max-w-md hidden lg:flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div className="relative group flex-1">
                <div className="absolute inset-0 bg-gradient-to-r from-semantic-info/20 to-secondary-400/20 rounded-2xl opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none" />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-semantic-info transition-all duration-300 z-10" />
                <input
                  type="text"
                  name="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setShowSearch(false);
                      setSearchQuery("");
                    }
                  }}
                  placeholder="Filtre à huile, alternateur, plaquettes..."
                  className="relative z-20 w-full pl-12 pr-24 py-3 text-base md:text-sm border-2 border-neutral-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-semantic-info/50 focus:border-semantic-info bg-white shadow-lg transition-all duration-300 hover:border-semantic-info/80 placeholder:text-neutral-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSearch(e);
                    }}
                    className="absolute right-12 top-1/2 -translate-y-1/2 px-3 py-1 bg-semantic-info hover:bg-semantic-info/90 text-semantic-info-contrast text-xs font-semibold rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 z-30"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-neutral-100 rounded-lg transition-all duration-200 hover:scale-110 z-30"
                  aria-label="Fermer la recherche"
                >
                  <X className="w-4 h-4 text-neutral-400 hover:text-neutral-600" />
                </button>
              </div>
            </form>
          )}
        </div>

        {/* DROITE : Actions utilisateur */}
        <div className="flex items-center gap-2">
          {/* 🚚 Livraison gratuite - Desktop avec animation */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-semantic-success/10 via-semantic-success/5 to-semantic-success/10 rounded-xl border border-semantic-success/20 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 group">
            <div className="relative">
              <Truck className="w-4 h-4 text-semantic-success group-hover:translate-x-0.5 transition-transform" />
              <div className="absolute -inset-1 bg-semantic-success/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xs font-bold text-semantic-success tracking-wide">
              LIVRAISON GRATUITE
            </span>
          </div>

          {/* 📞 Téléphone cliquable - Desktop minimaliste avec icône uniquement */}
          <a
            href={`tel:${SITE_CONFIG.contact.phone.raw}`}
            className="hidden lg:flex items-center justify-center w-10 h-10 bg-gradient-to-br from-semantic-info/10 via-secondary-500/10 to-semantic-info/10 rounded-xl border border-semantic-info/20 hover:border-semantic-info/80 transition-all duration-300 group shadow-sm hover:shadow-md hover:scale-110 active:scale-95"
            aria-label={`Appeler ${SITE_CONFIG.contact.phone.display}`}
            title={`Appeler ${SITE_CONFIG.contact.phone.display}`}
          >
            <div className="relative">
              <Phone className="w-4 h-4 text-semantic-info group-hover:rotate-12 transition-all duration-300" />
              <div className="absolute -inset-1 bg-semantic-info/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>

          {/* Recherche - Mobile avec design amélioré */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gradient-to-r hover:from-semantic-info/10 hover:to-secondary-500/10 rounded-xl transition-all duration-300 group border border-transparent hover:border-semantic-info/20"
            aria-label="Rechercher"
          >
            <Search className="w-5 h-5 text-neutral-700 group-hover:text-semantic-info transition-colors group-hover:scale-110" />
          </button>

          {/* Panier avec animation premium */}
          <button
            onClick={toggleCart}
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gradient-to-br hover:from-semantic-info/10 hover:to-secondary-500/10 rounded-xl transition-all duration-300 group hover:shadow-lg hover:scale-110 active:scale-95 border border-transparent hover:border-semantic-info/20"
            aria-label="Panier"
          >
            <ShoppingCart className="w-5 h-5 text-neutral-700 group-hover:text-semantic-info transition-all duration-300 group-hover:scale-110" />
            {summary.total_items > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold bg-gradient-to-br from-semantic-info to-secondary-600 text-semantic-info-contrast shadow-lg shadow-semantic-info/40 animate-in zoom-in-50 duration-300 ring-2 ring-white"
              >
                {summary.total_items}
              </Badge>
            )}
            {/* Pulse effect sur le badge - optimisé pour LCP (pas d'animate-ping) */}
            {summary.total_items > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] bg-semantic-info rounded-full opacity-20" />
            )}
          </button>

          {/* 🔔 Notifications - User only */}
          {user && (
            <Link
              to="/notifications"
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gradient-to-br hover:from-semantic-warning/10 hover:to-semantic-danger/10 rounded-xl transition-all duration-300 group hover:shadow-lg hover:scale-110 active:scale-95 border border-transparent hover:border-semantic-warning/20"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-neutral-700 group-hover:text-semantic-warning transition-all duration-300 group-hover:rotate-12" />
              {/* Dot indicator pour nouvelles notifs - optimisé pour LCP (pas d'animate-ping) */}
              <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
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
                className="px-4 py-2 text-sm font-semibold text-neutral-700 hover:text-semantic-info hover:bg-semantic-info/10 rounded-lg transition-all duration-normal"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                rel="nofollow"
                className="relative px-5 py-2 text-sm font-semibold bg-semantic-action text-semantic-action-contrast hover:bg-semantic-action/90 rounded-lg transition-all duration-normal hover:shadow-lg hover:scale-105 active:scale-95 overflow-hidden group"
              >
                {/* Shine effect */}
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-slowest" />
                <span className="relative">Inscription</span>
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar Panier - Version simplifiée sans contexte */}
        <CartSidebarSimple isOpen={isCartOpen} onClose={closeCart} />
      </nav>

      {/* 🔍 Barre de recherche mobile STICKY + Quick Categories */}
      <div
        className="header__mobile-search-sticky md:hidden sticky z-40 bg-white border-b shadow-sm"
        style={{ top: "var(--navbar-height, 57px)" }}
      >
        {/* Search Bar - toujours visible */}
        <div className="px-3 py-2">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-500 bg-neutral-50 hover:bg-white rounded-xl transition-all duration-300 group border border-neutral-200/80 hover:border-semantic-info/80"
            aria-label="Rechercher"
          >
            <Search className="w-4 h-4 text-neutral-400 group-hover:text-semantic-info" />
            <span className="text-neutral-500 font-medium flex-1 text-left">
              Rechercher une pièce...
            </span>
          </button>
        </div>

        {/* Quick Categories - scroll horizontal */}
        <div className="relative px-3 pb-2">
          <div
            className="overflow-x-auto scrollbar-hide"
            role="list"
            aria-label="Catégories populaires"
          >
            <div className="flex gap-2 min-w-max">
              <QuickCategoryChip
                href="/#famille-systeme-de-freinage"
                label="Freinage"
              />
              <QuickCategoryChip
                href="/#famille-systeme-de-filtration"
                label="Filtration"
              />
              <QuickCategoryChip
                href="/#famille-courroie-galet-poulie-et-chaine"
                label="Distribution"
              />
              <QuickCategoryChip href="/#famille-embrayage" label="Embrayage" />
              <QuickCategoryChip
                href="/#famille-prechauffage-et-allumage"
                label="Allumage"
              />
              <QuickCategoryChip
                href="/#famille-amortisseur-et-suspension"
                label="Suspension"
              />
            </div>
          </div>
          <div
            className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Barre de recherche mobile - Plein écran avec design premium */}
      {showSearch && (
        <div className="md:hidden fixed inset-0 z-50 bg-white animate-in fade-in slide-in-from-top duration-300">
          {/* Header avec gradient */}
          <div className="p-4 border-b border-neutral-200 bg-gradient-to-r from-semantic-info/10 to-secondary-500/10">
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
                <X className="w-6 h-6 text-neutral-700" />
              </button>
              <div className="relative flex-1">
                <div className="absolute inset-0 bg-gradient-to-r from-semantic-info/20 to-secondary-400/20 rounded-2xl opacity-0 blur group-hover:opacity-50 transition-opacity" />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-semantic-info z-10" />
                <input
                  type="text"
                  name="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch(e as any);
                    }
                  }}
                  placeholder="Filtre à huile, référence OEM..."
                  className="w-full pl-12 pr-20 py-4 text-base border-2 border-semantic-info/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-semantic-info focus:border-semantic-info bg-white shadow-lg font-medium placeholder:text-neutral-400 placeholder:font-normal"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSearch(e);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-semantic-info hover:bg-semantic-info/90 text-semantic-info-contrast text-sm font-semibold rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
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
            <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-semantic-info/10 to-secondary-500/10 rounded-2xl border border-semantic-info/20">
              <div className="flex-shrink-0 w-10 h-10 bg-semantic-info rounded-xl flex items-center justify-center">
                <span className="text-xl">💡</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-700 mb-1">
                  Recherche intelligente
                </p>
                <p className="text-xs text-neutral-600">
                  Recherchez par référence OEM, marque, modèle ou type de pièce
                  pour des résultats précis
                </p>
              </div>
            </div>

            {/* Exemples de recherche */}
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                Exemples populaires
              </p>
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
                      handleSearch(new Event("submit") as any);
                    }}
                    className="flex items-center gap-2 p-3 bg-white border border-neutral-200 rounded-xl hover:border-semantic-info hover:bg-semantic-info/5 transition-all duration-200 group"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium text-neutral-700 group-hover:text-semantic-info">
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar au scroll optimisée avec useRef + requestAnimationFrame */}
      {/* Barre de progression au scroll */}
      {isScrolled && (
        <div
          ref={progressBarRef}
          className="sticky z-40 h-1 bg-semantic-info shadow-lg shadow-semantic-info/20 animate-in slide-in-from-top duration-500 transition-[width] ease-out"
          style={{ top: "var(--navbar-height, 73px)", width: "0%" }}
        />
      )}
    </>
  );
};
