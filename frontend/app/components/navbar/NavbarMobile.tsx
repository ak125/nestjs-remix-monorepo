/**
 * 📱 NavbarMobile Component
 *
 * Menu mobile slide-in avec burger menu.
 * Résout le problème P0: 50% des utilisateurs (mobile) ne peuvent pas naviguer.
 *
 * ✅ Migré vers Sheet (Radix) pour:
 * - Scroll lock automatique
 * - Focus trap automatique
 * - Fermeture Escape automatique
 * - Animations cohérentes
 *
 * Features:
 * - ✅ Burger menu (3 lignes) accessible sur mobile
 * - ✅ Slide-in depuis la gauche avec Sheet
 * - ✅ Navigation complète (même items que desktop)
 * - ✅ Fermeture: clic overlay, Escape, ou clic lien
 * - ✅ Responsive: visible uniquement < 768px
 */

import { Link } from "@remix-run/react";
import {
  X,
  Home,
  Package,
  ShoppingBag,
  BookOpen,
  HelpCircle,
  LayoutDashboard,
  Settings,
  LogIn,
  UserPlus,
  LogOut,
  Search,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetClose, SheetTrigger } from "../ui/sheet";

interface NavbarMobileProps {
  user?: {
    firstName?: string;
    lastName?: string;
    level?: number;
  } | null;
  onSearchClick?: () => void;
}

export function NavbarMobile({ user, onSearchClick }: NavbarMobileProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 🔗 Navigation items
  const dashboardLink = user
    ? (user.level ?? 0) >= 7
      ? "/admin"
      : (user.level ?? 0) >= 3
        ? "/dashboard"
        : "/account/dashboard"
    : "/login";

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* 🍔 Burger Button - Visible uniquement sur mobile */}
      <SheetTrigger asChild>
        <button
          className="md:hidden flex flex-col items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] p-2.5 hover:bg-primary/90 rounded-lg transition-colors"
          aria-label="Menu"
        >
          <span className="w-6 h-0.5 bg-white transition-transform" />
          <span className="w-6 h-0.5 bg-white transition-transform" />
          <span className="w-6 h-0.5 bg-white transition-transform" />
        </button>
      </SheetTrigger>

      {/* 📱 Menu Slide-in */}
      <SheetContent
        side="left"
        className="w-[280px] p-0 flex flex-col md:hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            <h2 className="font-semibold">Menu</h2>
          </div>
          <SheetClose asChild>
            <button
              className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-primary/90 rounded-lg transition-colors"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
          </SheetClose>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b bg-gray-50">
            <p className="text-sm font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {(user.level ?? 0) >= 7
                ? "Administrateur"
                : (user.level ?? 0) >= 3
                  ? "Commercial"
                  : "Client"}
            </p>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {/* Quick Search Button */}
            <li>
              <SheetClose asChild>
                <button
                  onClick={() => onSearchClick?.()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-info/20 transition-colors text-gray-700 border border-gray-200"
                >
                  <Search className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Recherche rapide</span>
                </button>
              </SheetClose>
            </li>

            {/* Dashboard */}
            {user && (
              <li>
                <SheetClose asChild>
                  <Link
                    to={dashboardLink}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                  >
                    <LayoutDashboard className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Dashboard</span>
                  </Link>
                </SheetClose>
              </li>
            )}

            {/* Catalogue avec accordéon catégories */}
            <li>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="catalogue" className="border-none">
                  <AccordionTrigger className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 hover:no-underline [&>svg]:size-0 [&>svg]:overflow-hidden">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span className="font-medium flex-1 text-left">
                      Catalogue
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                  </AccordionTrigger>
                  <AccordionContent className="pl-10 space-y-1 pb-2">
                    <SheetClose asChild>
                      <Link
                        to="/#famille-systeme-de-freinage"
                        className="block py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                      >
                        Freinage
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/#famille-systeme-de-filtration"
                        className="block py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                      >
                        Filtration
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/#famille-courroie-galet-poulie-et-chaine"
                        className="block py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                      >
                        Distribution
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/#famille-embrayage"
                        className="block py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                      >
                        Embrayage
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/#famille-amortisseur-et-suspension"
                        className="block py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                      >
                        Suspension
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/#catalogue"
                        className="block py-2 text-sm font-medium text-blue-600 hover:underline"
                      >
                        Voir toutes les catégories
                      </Link>
                    </SheetClose>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </li>

            {/* Marques */}
            <li>
              <SheetClose asChild>
                <Link
                  to="/marques"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  <ShoppingBag className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Marques</span>
                </Link>
              </SheetClose>
            </li>

            {/* Blog */}
            <li>
              <SheetClose asChild>
                <Link
                  to="/blog-pieces-auto"
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
              </SheetClose>
            </li>

            {/* Aide & Support */}
            <li>
              <SheetClose asChild>
                <Link
                  to="/support"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  <HelpCircle className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Aide & Support</span>
                </Link>
              </SheetClose>
            </li>

            {/* Admin section (si niveau >= 7) */}
            {user && (user.level ?? 0) >= 7 && (
              <>
                <li className="pt-2 border-t mt-2">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                    Administration
                  </p>
                </li>
                <li>
                  <SheetClose asChild>
                    <Link
                      to="/admin"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/5 transition-colors text-red-600"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      <span className="font-medium">Dashboard Admin</span>
                    </Link>
                  </SheetClose>
                </li>
                <li>
                  <SheetClose asChild>
                    <Link
                      to="/admin/users"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/5 transition-colors text-red-600"
                    >
                      <Settings className="h-5 w-5" />
                      <span className="font-medium">Utilisateurs</span>
                    </Link>
                  </SheetClose>
                </li>
                <li>
                  <SheetClose asChild>
                    <Link
                      to="/admin/orders"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/5 transition-colors text-red-600"
                    >
                      <Package className="h-5 w-5" />
                      <span className="font-medium">Commandes</span>
                    </Link>
                  </SheetClose>
                </li>

                {/* Super Admin links (niveau >= 9) */}
                {(user.level ?? 0) >= 9 && (
                  <>
                    <li>
                      <SheetClose asChild>
                        <Link
                          to="/admin/staff"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/5 transition-colors text-red-600"
                        >
                          <Settings className="h-5 w-5" />
                          <span className="font-medium">Staff</span>
                        </Link>
                      </SheetClose>
                    </li>
                    <li>
                      <SheetClose asChild>
                        <Link
                          to="/admin/suppliers"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/5 transition-colors text-red-600"
                        >
                          <ShoppingBag className="h-5 w-5" />
                          <span className="font-medium">Fournisseurs</span>
                        </Link>
                      </SheetClose>
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
              <SheetClose asChild>
                <Button
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg"
                  variant="red"
                  type="submit"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </Button>
              </SheetClose>
            </form>
          ) : (
            <div className="space-y-2">
              <SheetClose asChild>
                <Link
                  to="/login"
                  rel="nofollow"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium"
                >
                  <LogIn className="h-4 w-4" />
                  Connexion
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  to="/register"
                  rel="nofollow"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-blue-600 text-blue-600 rounded-lg hover:bg-info/20 transition-colors font-medium"
                >
                  <UserPlus className="h-4 w-4" />
                  Inscription
                </Link>
              </SheetClose>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
