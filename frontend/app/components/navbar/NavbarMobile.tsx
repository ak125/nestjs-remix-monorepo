/**
 * 📱 NavbarMobile Component - PHASE 2
 * 
 * Menu mobile slide-in avec burger menu.
 * Résout le problème P0: 50% des utilisateurs (mobile) ne peuvent pas naviguer.
 * 
 * Features:
 * - ✅ Burger menu (3 lignes) accessible sur mobile
 * - ✅ Slide-in depuis la gauche avec overlay
 * - ✅ Navigation complète (même items que desktop)
 * - ✅ Scroll lock quand ouvert
 * - ✅ Fermeture: clic overlay, Escape, ou clic lien
 * - ✅ Responsive: visible uniquement < 768px
 * 
 * @example
 * ```tsx
 * <NavbarMobile user={user} />
 * ```
 */

import { Link } from '@remix-run/react';
import { Button } from '~/components/ui/button';
import { 
  X, 
  Home, 
  Package, 
  ShoppingBag, 
  BookOpen, 
  HelpCircle, 
  LifeBuoy,
  LayoutDashboard,
  Settings,
  LogIn,
  UserPlus,
  LogOut,
  Search
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

interface NavbarMobileProps {
  user?: {
    firstName?: string;
    lastName?: string;
    level?: number;
  } | null;
  onSearchClick?: () => void; // 🆕 PHASE 9: Callback pour ouvrir la recherche
}

export function NavbarMobile({ user, onSearchClick }: NavbarMobileProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 🔒 Lock scroll quand menu ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ⌨️ Fermeture avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  // 🔗 Navigation items
  const dashboardLink = user 
    ? (user.level ?? 0) >= 7 
      ? "/admin" 
      : (user.level ?? 0) >= 3 
        ? "/dashboard" 
        : "/account/dashboard"
    : "/login";

  return (
    <>
      {/* 🍔 Burger Button - Visible uniquement sur mobile */}
      <button
        onClick={toggleMenu}
        className="md:hidden flex flex-col gap-1.5 p-2 hover:bg-blue-700 rounded transition-colors"
        aria-label="Menu"
        aria-expanded={isOpen}
      >
        <span className="w-6 h-0.5 bg-white transition-transform" />
        <span className="w-6 h-0.5 bg-white transition-transform" />
        <span className="w-6 h-0.5 bg-white transition-transform" />
      </button>

      {/* 🌑 Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* 📱 Menu Slide-in */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-[280px] bg-white shadow-2xl z-50",
          "transform transition-transform duration-300 ease-in-out",
          "flex flex-col",
          "md:hidden", // Masquer sur desktop
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            <h2 className="font-semibold">Menu</h2>
          </div>
          <button
            onClick={closeMenu}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b bg-gray-50">
            <p className="text-sm font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {(user.level ?? 0) >= 7 ? 'Administrateur' : 
               (user.level ?? 0) >= 3 ? 'Commercial' : 
               'Client'}
            </p>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {/* 🆕 PHASE 9: Quick Search Button */}
            <li>
              <button
                onClick={() => {
                  closeMenu();
                  onSearchClick?.();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-info/20 transition-colors text-gray-700 border border-gray-200"
              >
                <Search className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Recherche rapide</span>
              </button>
            </li>

            {/* Dashboard */}
            {user && (
              <li>
                <Link
                  to={dashboardLink}
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  <LayoutDashboard className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Dashboard</span>
                </Link>
              </li>
            )}

            {/* Catalogue */}
            <li>
              <Link
                to="/catalogue"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
              >
                <Package className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Catalogue</span>
              </Link>
            </li>

            {/* Marques */}
            <li>
              <Link
                to="/marques"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
              >
                <ShoppingBag className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Marques</span>
              </Link>
            </li>

            {/* Blog */}
            <li>
              <Link
                to="/blog"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
              >
                <BookOpen className="h-5 w-5 text-blue-600" />
                <div className="flex items-center gap-2">
                  <span className="font-medium">Blog</span>
                  <span className="bg-success text-success-foreground text-xs px-1.5 py-0.5 rounded-full font-semibold">
                    Nouveau
                  </span>
                </div>
              </Link>
            </li>

            {/* Support */}
            <li>
              <Link
                to="/support"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
              >
                <LifeBuoy className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Support</span>
              </Link>
            </li>

            {/* Aide */}
            <li>
              <Link
                to="/aide"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
              >
                <HelpCircle className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Aide</span>
              </Link>
            </li>

            {/* 🆕 PHASE 7: Admin section (si niveau >= 7) */}
            {user && (user.level ?? 0) >= 7 && (
              <>
                <li className="pt-2 border-t mt-2">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                    Administration
                  </p>
                </li>
                <li>
                  <Link
                    to="/admin"
                    onClick={closeMenu}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-red-600"
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="font-medium">Dashboard Admin</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/users"
                    onClick={closeMenu}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-red-600"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="font-medium">Utilisateurs</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/orders"
                    onClick={closeMenu}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-red-600"
                  >
                    <Package className="h-5 w-5" />
                    <span className="font-medium">Commandes</span>
                  </Link>
                </li>
                
                {/* Super Admin links (niveau >= 9) */}
                {(user.level ?? 0) >= 9 && (
                  <>
                    <li>
                      <Link
                        to="/admin/staff"
                        onClick={closeMenu}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-red-600"
                      >
                        <Settings className="h-5 w-5" />
                        <span className="font-medium">Staff</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/admin/suppliers"
                        onClick={closeMenu}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-red-600"
                      >
                        <ShoppingBag className="h-5 w-5" />
                        <span className="font-medium">Fournisseurs</span>
                      </Link>
                    </li>
                  </>
                )}
              </>
            )}
          </ul>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-gray-50">
          {user ? (
            <form method="POST" action="/auth/logout">
              <Button className="w-full flex items-center justify-center gap-2 px-4 py-2.5  rounded-lg" variant="red" type="submit">
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </Button>
            </form>
          ) : (
            <div className="space-y-2">
              <Link
                to="/login"
                onClick={closeMenu}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium"
              >
                <LogIn className="h-4 w-4" />
                Connexion
              </Link>
              <Link
                to="/register"
                onClick={closeMenu}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-blue-600 text-blue-600 rounded-lg hover:bg-info/20 transition-colors font-medium"
              >
                <UserPlus className="h-4 w-4" />
                Inscription
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
