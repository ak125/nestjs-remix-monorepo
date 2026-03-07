import { Link, useNavigate } from "@remix-run/react";
import {
  Bell,
  BookOpen,
  ChevronRight,
  Menu,
  Package,
  Phone,
  ScanLine,
  Search,
  Shield,
  ShoppingCart,
  Truck,
  User,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useOptionalUser, useRootCart } from "~/hooks/useRootData";
import { SITE_CONFIG } from "../config/site";
import { CartSidebarSimple } from "./navbar/CartSidebarSimple";
import { UserDropdownMenu } from "./navbar/UserDropdownMenu";
import { Badge } from "./ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

/** Scroll-to helper for homepage anchor links */
function scrollToSection(e: React.MouseEvent, sectionId: string) {
  const isHomepage = window.location.pathname === "/";
  const section = document.getElementById(sectionId);
  if (isHomepage && section) {
    e.preventDefault();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export const Navbar = memo(function Navbar() {
  const user = useOptionalUser();
  const navigate = useNavigate();

  const cartData = useRootCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const summary = useMemo(
    () => cartData?.summary ?? { total_items: 0, subtotal: 0 },
    [cartData?.summary],
  );

  const [isScrolled, setIsScrolled] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const progressBarRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number>();
  const navRef = useRef<HTMLElement>(null);

  // Scroll detection + progress bar
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;

      setIsScrolled((prev) => {
        const next = y > 10;
        return prev === next ? prev : next;
      });
      setIsCompact((prev) => {
        const next = y > 100;
        return prev === next ? prev : next;
      });

      if (progressBarRef.current && y > 10) {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          if (progressBarRef.current) {
            const max =
              document.documentElement.scrollHeight - window.innerHeight;
            progressBarRef.current.style.width = `${Math.min((y / max) * 100, 100)}%`;
          }
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track navbar height via CSS variable
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        document.documentElement.style.setProperty(
          "--navbar-height",
          `${Math.round(entry.contentRect.height)}px`,
        );
      }
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const query = searchQuery.trim();
      if (query) {
        setSearchQuery("");
        navigate(`/search?q=${encodeURIComponent(query)}`);
      }
    },
    [searchQuery, navigate],
  );

  return (
    <>
      {/* ===== NAVBAR ===== */}
      <nav
        ref={navRef}
        className={`sticky top-0 z-50 bg-v9-navy text-white transition-all duration-300 ${
          isScrolled ? "shadow-lg shadow-black/20" : "shadow-md shadow-black/10"
        }`}
        aria-label="Navigation principale"
      >
        <div
          className={`flex flex-wrap lg:flex-nowrap justify-between items-center gap-2.5 lg:gap-6 px-4 lg:px-8 transition-all duration-300 ${
            isCompact ? "py-2.5" : "py-2.5 lg:py-4"
          }`}
        >
          {/* MOBILE: Hamburger + Logo centré + Cart */}
          <div className="lg:hidden flex items-center justify-between w-full">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-none cursor-pointer"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link
              to="/"
              prefetch="intent"
              className="no-style no-visited"
              aria-label="Retour à l'accueil"
            >
              <span className="font-v9-heading font-extrabold text-base tracking-tight select-none">
                <span className="text-white">AUTO</span>
                <span className="text-cta">MECANIK</span>
              </span>
            </Link>

            <button
              onClick={toggleCart}
              className="relative min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-none cursor-pointer"
              aria-label="Panier"
              aria-expanded={isCartOpen}
            >
              <ShoppingCart className="w-5 h-5" />
              {summary.total_items > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-cta rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                  {summary.total_items > 99 ? "99+" : summary.total_items}
                </span>
              )}
            </button>
          </div>

          {/* MOBILE: Search full-width */}
          <form
            onSubmit={handleSearch}
            className="lg:hidden w-full pb-2 relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              type="search"
              name="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une pièce..."
              aria-label="Rechercher une pièce auto"
              className="w-full py-2 pl-9 pr-8 bg-white/10 border border-white/10 rounded-xl text-sm text-white outline-none placeholder:text-white/35 transition-all focus:bg-white/15 focus:border-white/25"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-all"
              >
                <X className="w-3 h-3 text-white/40" />
              </button>
            )}
          </form>

          {/* DESKTOP: Logo */}
          <Link
            to="/"
            prefetch="intent"
            className="no-style no-visited flex-shrink-0 group hidden lg:block"
            aria-label="Retour à l'accueil"
          >
            <span
              className={`font-v9-heading font-extrabold tracking-tight select-none transition-all duration-300 ${
                isCompact ? "text-base" : "text-lg"
              }`}
            >
              <span className="text-white">AUTO</span>
              <span className="text-cta">MECANIK</span>
            </span>
          </Link>

          {/* DESKTOP NAV LINKS */}
          <div className="hidden lg:flex items-center gap-1 min-w-0 flex-shrink">
            <Link
              to="/#catalogue"
              onClick={(e) => scrollToSection(e, "catalogue")}
              className="no-style no-visited relative group px-3.5 py-2 text-[13px] font-medium text-white/50 hover:text-white transition-all rounded-lg hover:bg-white/[0.06] flex items-center gap-1.5"
            >
              Catalogue pièces auto
              <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-cta-light group-hover:translate-x-0.5 transition-all" />
              <span className="absolute bottom-0 left-3 right-3 h-[1.5px] bg-gradient-to-r from-cta to-cta-light scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </Link>

            <Link
              to="/#toutes-les-marques"
              onClick={(e) => scrollToSection(e, "toutes-les-marques")}
              className="no-style no-visited relative group px-3.5 py-2 text-[13px] font-medium text-white/50 hover:text-white transition-all rounded-lg hover:bg-white/[0.06] flex items-center gap-1.5"
            >
              Marques &amp; Constructeurs
              <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-cta-light group-hover:translate-x-0.5 transition-all" />
              <span className="absolute bottom-0 left-3 right-3 h-[1.5px] bg-gradient-to-r from-cta to-cta-light scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </Link>

            <Link
              to="/blog-pieces-auto"
              className="no-style no-visited relative group px-3.5 py-2 text-[13px] font-medium text-white/50 hover:text-white transition-all rounded-lg hover:bg-white/[0.06]"
            >
              Blog
              <span className="absolute bottom-0 left-3 right-3 h-[1.5px] bg-gradient-to-r from-cta to-cta-light scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </Link>

            <Link
              to="/diagnostic-auto"
              className="no-style no-visited relative px-5 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-cta to-cta-hover ring-1 ring-cta-light/30 shadow-lg shadow-cta/30 hover:shadow-xl hover:shadow-cta/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <ScanLine className="w-4 h-4 text-white relative group-hover:scale-110 transition-transform" />
              <span className="relative">Diagnostic</span>
              <span className="relative text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-md">
                GRATUIT
              </span>
            </Link>
          </div>

          {/* DESKTOP SEARCH — between nav links and actions */}
          <form
            onSubmit={handleSearch}
            className="hidden lg:flex flex-1 max-w-xs xl:max-w-sm relative group/search"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within/search:text-white/60 transition-colors pointer-events-none" />
            <input
              type="search"
              name="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Rechercher une pièce auto"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchQuery("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Rechercher une pièce..."
              className="w-full py-2.5 pl-10 pr-4 bg-white/10 border border-white/10 rounded-xl text-sm text-white outline-none placeholder:text-white/35 transition-all focus:bg-white/15 focus:border-white/25 focus:shadow-lg focus:shadow-black/10 hover:bg-white/[0.12]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-all"
              >
                <X className="w-3 h-3 text-white/40" />
              </button>
            )}
          </form>

          {/* DESKTOP: User actions */}
          <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
            {/* Cart */}
            <button
              onClick={toggleCart}
              className="relative flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
              aria-label="Panier"
              aria-expanded={isCartOpen}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Panier</span>
              {summary.total_items > 0 && (
                <Badge
                  variant="destructive"
                  className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-cta text-white shadow-sm"
                >
                  {summary.total_items > 99 ? "99+" : summary.total_items}
                </Badge>
              )}
            </button>

            {/* Notifications — logged in only */}
            {user && (
              <Link
                to="/notifications"
                className="no-style no-visited relative min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-all"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4 text-white/60 hover:text-white transition-colors" />
              </Link>
            )}

            {/* User menu */}
            {user ? (
              <UserDropdownMenu user={user} />
            ) : (
              <>
                <Link
                  to="/login"
                  rel="nofollow"
                  className="no-style no-visited flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
                  aria-label="Connexion"
                >
                  <User className="w-4 h-4" />
                  <span>Compte</span>
                </Link>
                <Link
                  to="/register"
                  rel="nofollow"
                  className="no-style no-visited flex px-5 py-2.5 text-sm font-bold text-white bg-cta hover:bg-cta-hover rounded-lg transition-all hover:shadow-lg active:scale-95"
                >
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile menu drawer */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent
          side="left"
          className="bg-v9-navy border-white/10 text-white p-0 w-[85vw] sm:max-w-sm"
        >
          <SheetHeader className="p-4 border-b border-white/10">
            <SheetTitle className="text-white font-v9-heading font-extrabold tracking-tight text-left">
              <span className="text-white">AUTO</span>
              <span className="text-cta">MECANIK</span>
            </SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col py-2" aria-label="Menu mobile">
            <Link
              to="/#catalogue"
              onClick={() => setIsMenuOpen(false)}
              className="no-style no-visited flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Package className="w-4 h-4" />
              Catalogue pièces auto
            </Link>
            <Link
              to="/#toutes-les-marques"
              onClick={() => setIsMenuOpen(false)}
              className="no-style no-visited flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Search className="w-4 h-4" />
              Marques &amp; Constructeurs
            </Link>
            <Link
              to="/blog-pieces-auto"
              onClick={() => setIsMenuOpen(false)}
              className="no-style no-visited flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Blog
            </Link>
            <Link
              to="/diagnostic-auto"
              onClick={() => setIsMenuOpen(false)}
              className="no-style no-visited flex items-center gap-3 px-4 py-3 text-sm font-medium text-cta hover:text-cta-light hover:bg-white/[0.06] transition-colors"
            >
              <ScanLine className="w-4 h-4" />
              Diagnostic
              <span className="text-[10px] font-bold bg-cta/20 text-cta px-1.5 py-0.5 rounded-md ml-auto">
                GRATUIT
              </span>
            </Link>

            <div className="border-t border-white/10 my-2" />

            {user ? (
              <>
                <Link
                  to="/account/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="no-style no-visited flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <User className="w-4 h-4" />
                  Mon compte
                </Link>
                <Link
                  to="/notifications"
                  onClick={() => setIsMenuOpen(false)}
                  className="no-style no-visited flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  Notifications
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  rel="nofollow"
                  onClick={() => setIsMenuOpen(false)}
                  className="no-style no-visited flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <User className="w-4 h-4" />
                  Connexion
                </Link>
                <Link
                  to="/register"
                  rel="nofollow"
                  onClick={() => setIsMenuOpen(false)}
                  className="no-style no-visited flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <User className="w-4 h-4" />
                  Inscription
                </Link>
              </>
            )}

            <div className="border-t border-white/10 my-2" />

            <a
              href={`tel:${SITE_CONFIG.contact.phone.raw}`}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Phone className="w-4 h-4" />
              {SITE_CONFIG.contact.phone.display}
            </a>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Cart Sidebar (portail, hors du flex) */}
      <CartSidebarSimple isOpen={isCartOpen} onClose={closeCart} />

      {/* ===== TRUST STRIP (all viewports) ===== */}
      <div className="bg-gradient-to-b from-v9-navy to-v9-navy-light border-b border-white/[0.06]">
        <div className="flex items-center justify-center gap-3 lg:gap-6 py-2.5 lg:py-2 px-4 lg:px-8 text-[11px] lg:text-xs font-semibold overflow-x-auto scrollbar-hide">
          <span className="flex items-center gap-1.5 text-emerald-300 whitespace-nowrap">
            <Truck className="w-3 h-3" />
            Livraison gratuite dès 150€
          </span>
          <span className="text-white/15" aria-hidden="true">
            ·
          </span>
          <span className="flex items-center gap-1.5 text-emerald-300 whitespace-nowrap">
            <Shield className="w-3 h-3" />
            Garantie 2 ans
          </span>
          <span className="text-white/15" aria-hidden="true">
            ·
          </span>
          <span className="text-white/40 whitespace-nowrap">Retours 30j</span>
          <span className="text-white/15 hidden lg:inline">·</span>
          <a
            href={`tel:${SITE_CONFIG.contact.phone.raw}`}
            className="hidden lg:flex items-center gap-1.5 text-white/40 hover:text-white transition-colors whitespace-nowrap"
          >
            <Phone className="w-3 h-3" />
            {SITE_CONFIG.contact.phone.display}
          </a>
        </div>
      </div>

      {/* ===== Progress bar ===== */}
      {isScrolled && (
        <div
          ref={progressBarRef}
          aria-hidden="true"
          className="sticky z-40 h-0.5 bg-cta transition-[width] ease-out"
          style={{ top: "var(--navbar-height, 64px)", width: "0%" }}
        />
      )}
    </>
  );
});
