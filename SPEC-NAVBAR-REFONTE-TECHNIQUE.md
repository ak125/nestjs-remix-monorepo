# 🔧 SPÉCIFICATIONS TECHNIQUES - REFONTE NAVBAR

## 📋 Vue d'ensemble

**Document**: Spécifications techniques complètes  
**Date**: 14 Octobre 2025  
**Version**: 2.0 ⚠️ **MISE À JOUR avec éléments PHP legacy**  
**Objectif**: Refonte complète de la navbar avec approche modulaire + fonctionnalités métier auto

---

## � NOUVEAUTÉS VERSION 2.0

### Éléments récupérés de l'ancien PHP
1. ✅ **TopBar** avec téléphone et état connexion
2. ✅ **Sidebar Panier** (remplace dropdown)
3. ✅ **Gestion des consignes** (métier auto)
4. ✅ **Marque + Référence** partout
5. ✅ **Mega menu dynamique** (DB)

### Priorités d'implémentation
- 🔴 **P0**: TopBar, Consignes, Marque/Référence
- 🟡 **P1**: Sidebar Panier, Navigation statique
- 🟢 **P2**: Mega menu DB (avec cache)

---

## �🎯 ARCHITECTURE CIBLE

### Structure des composants

```
frontend/app/components/navbar/
├── index.ts                      # Export principal
├── Navbar.tsx                    # Composant racine orchestrateur
├── TopBar.tsx                    # ✅ NOUVEAU: Top bar avec contact/connexion
├── NavbarPublic.tsx             # Variante publique
├── NavbarAdmin.tsx              # Variante admin
├── NavbarCommercial.tsx         # Variante commercial
├── NavbarMobile.tsx             # Version mobile (drawer)
├── NavbarSearch.tsx             # Barre de recherche intégrée
├── NavbarUser.tsx               # Menu utilisateur (dropdown)
├── CartSidebar.tsx              # ✅ NOUVEAU: Sidebar panier (remplace dropdown)
├── CartItem.tsx                 # ✅ NOUVEAU: Item panier réutilisable
├── NavbarNotifications.tsx      # Menu notifications (dropdown)
├── NavbarMegaMenu.tsx          # Mega menu catalogue
├── NavbarLogo.tsx              # Logo responsive
└── hooks/
    ├── useNavbarState.ts        # État global navbar
    ├── useNavbarScroll.ts       # Gestion scroll
    ├── useNavbarBreakpoints.ts  # Breakpoints responsive
    └── useCart.ts               # ✅ NOUVEAU: Hook panier avec consignes
```

---

## 🏗️ COMPOSANT PRINCIPAL: Navbar.tsx

### Interface TypeScript

```typescript
import { User } from '~/types/user';

export type NavbarVariant = 'public' | 'admin' | 'commercial';

export interface NavbarConfig {
  variant: NavbarVariant;
  showSearch?: boolean;
  showCart?: boolean;
  showNotifications?: boolean;
  showTopBar?: boolean;        // ✅ NOUVEAU: Afficher top bar
  sticky?: boolean;
  transparent?: boolean;
  className?: string;
}

export interface NavbarProps extends NavbarConfig {
  user?: User | null;
  logo?: string;
  topBarConfig?: TopBarConfig;  // ✅ NOUVEAU: Config top bar
  onMobileMenuToggle?: (isOpen: boolean) => void;
}

// ✅ NOUVEAU: Configuration TopBar
export interface TopBarConfig {
  tagline?: string;              // Ex: "Pièces auto à prix pas cher"
  phone?: {
    display: string;             // Ex: "01 23 45 67 89"
    href: string;                // Ex: "+33123456789"
  };
  showUserGreeting?: boolean;    // Afficher "M. Jean Dupont"
  showLoginLinks?: boolean;      // Afficher "Entrer | S'inscrire"
}

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  level?: number; // Niveau minimum requis
  children?: NavItem[];
  megaMenu?: boolean;
}

// ✅ NOUVEAU: Interface CartItem avec consignes
export interface CartItem {
  id: number;
  name: string;
  brand: string;                 // ✅ NOUVEAU: Marque (ex: BOSCH)
  reference: string;             // ✅ NOUVEAU: Référence (ex: 0123456789)
  image: string;
  quantity: number;
  price: number;                 // Prix unitaire TTC
  consigne?: number;             // ✅ NOUVEAU: Consigne TTC (batteries, etc.)
  hasImage?: boolean;
}

// ✅ NOUVEAU: Totaux panier avec consignes
export interface CartTotals {
  subtotal: number;              // Somme des prix × quantités
  consigneTotal: number;         // ✅ NOUVEAU: Somme des consignes
  total: number;                 // subtotal + consigneTotal
  itemCount: number;             // Nombre total d'articles
}
```

### Implémentation

```typescript
import { useEffect, useState } from 'react';
import { useLocation } from '@remix-run/react';
import { cn } from '~/lib/utils';
import { useOptionalUser } from '~/root';
import { useNavbarState } from './hooks/useNavbarState';
import { useNavbarScroll } from './hooks/useNavbarScroll';
import NavbarPublic from './NavbarPublic';
import NavbarAdmin from './NavbarAdmin';
import NavbarCommercial from './NavbarCommercial';
import NavbarMobile from './NavbarMobile';

export function Navbar({
  variant = 'public',
  showSearch = true,
  showCart = true,
  showNotifications = true,
  sticky = true,
  transparent = false,
  logo,
  className,
  onMobileMenuToggle,
}: NavbarProps) {
  const user = useOptionalUser();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const { isScrolled } = useNavbarScroll({ threshold: 10 });
  const navbarState = useNavbarState();

  // Auto-detect variant basé sur le user level
  const effectiveVariant = variant === 'public' && user
    ? user.level >= 7
      ? 'admin'
      : user.level >= 3
      ? 'commercial'
      : 'public'
    : variant;

  // Fermer mobile menu sur navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleMobileToggle = (isOpen: boolean) => {
    setMobileMenuOpen(isOpen);
    onMobileMenuToggle?.(isOpen);
  };

  const commonProps = {
    user,
    logo,
    showSearch,
    showCart,
    showNotifications,
    onMobileMenuToggle: handleMobileToggle,
  };

  const navbarClasses = cn(
    'navbar transition-all duration-300',
    sticky && 'sticky top-0 z-50',
    transparent && !isScrolled && 'bg-transparent',
    isScrolled && 'shadow-md bg-white',
    className
  );

  return (
    <>
      {/* ✅ NOUVEAU: TopBar (optionnel) */}
      {showTopBar && topBarConfig && (
        <TopBar 
          config={topBarConfig}
          user={user}
        />
      )}

      <nav className={navbarClasses} role="navigation" aria-label="Navigation principale">
        {effectiveVariant === 'admin' && <NavbarAdmin {...commonProps} />}
        {effectiveVariant === 'commercial' && <NavbarCommercial {...commonProps} />}
        {effectiveVariant === 'public' && <NavbarPublic {...commonProps} />}
      </nav>

      <NavbarMobile
        isOpen={mobileMenuOpen}
        onClose={() => handleMobileToggle(false)}
        variant={effectiveVariant}
        {...commonProps}
      />
    </>
  );
}
```

---

## 📞 TOPBAR (NOUVEAU - Inspiré du PHP)

### Interface et Configuration

```typescript
// frontend/app/components/navbar/TopBar.tsx

import { Link } from '@remix-run/react';
import { Phone, Mail } from 'lucide-react';
import { User } from '~/types/user';

interface TopBarProps {
  config: TopBarConfig;
  user?: User | null;
}

export function TopBar({ config, user }: TopBarProps) {
  const { tagline, phone, showUserGreeting, showLoginLinks } = config;

  return (
    <div className="bg-gray-100 border-b hidden lg:block">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-2 text-sm">
          {/* Left side - Tagline */}
          {tagline && (
            <span className="text-gray-600 font-medium">
              {tagline}
            </span>
          )}

          {/* Right side - Contact + Auth */}
          <div className="flex items-center gap-4">
            {/* Phone */}
            {phone && (
              <>
                <a
                  href={`tel:${phone.href}`}
                  className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Phone className="w-4 h-4 mr-1.5" />
                  <span>{phone.display}</span>
                </a>
                <span className="text-gray-300">|</span>
              </>
            )}

            {/* User greeting or login links */}
            {user && showUserGreeting ? (
              <Link
                to="/account"
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                {user.civilite && `${user.civilite} `}
                {user.firstName} {user.lastName}
              </Link>
            ) : showLoginLinks ? (
              <>
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Entrer
                </Link>
                <span className="text-gray-300">|</span>
                <Link
                  to="/register"
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  S'inscrire
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Exemple d'utilisation

```typescript
// Dans root.tsx ou layout
<Navbar
  showTopBar={true}
  topBarConfig={{
    tagline: "Pièces auto à prix pas cher",
    phone: {
      display: "01 23 45 67 89",
      href: "+33123456789"
    },
    showUserGreeting: true,
    showLoginLinks: true
  }}
  user={user}
/>
```

### Configuration par environnement

```typescript
// frontend/app/config/topbar.ts

export const topBarConfig: TopBarConfig = {
  production: {
    tagline: "Pièces auto à prix pas cher",
    phone: {
      display: "01 23 45 67 89",
      href: "+33123456789"
    },
    showUserGreeting: true,
    showLoginLinks: true,
  },
  development: {
    tagline: "DEV - Pièces auto",
    phone: {
      display: "01 00 00 00 00",
      href: "+33100000000"
    },
    showUserGreeting: true,
    showLoginLinks: true,
  }
};
```

---

## 🌐 NAVBAR PUBLIC

### Configuration navigation

```typescript
// frontend/app/components/navbar/config/navigation.ts

import { 
  Home, 
  Package, 
  Tag, 
  BookOpen, 
  HelpCircle,
  Wrench
} from 'lucide-react';

export const publicNavigation: NavItem[] = [
  {
    label: 'Accueil',
    href: '/',
    icon: Home,
  },
  {
    label: 'Catalogue',
    href: '/catalogue',
    icon: Package,
    megaMenu: true,
    children: [
      {
        label: 'Toutes les pièces',
        href: '/catalogue',
      },
      {
        label: 'Pièces moteur',
        href: '/catalogue/moteur',
        children: [
          { label: 'Filtres', href: '/catalogue/moteur/filtres' },
          { label: 'Bougies', href: '/catalogue/moteur/bougies' },
          { label: 'Courroies', href: '/catalogue/moteur/courroies' },
        ],
      },
      {
        label: 'Freinage',
        href: '/catalogue/freinage',
        children: [
          { label: 'Plaquettes', href: '/catalogue/freinage/plaquettes' },
          { label: 'Disques', href: '/catalogue/freinage/disques' },
          { label: 'Liquides', href: '/catalogue/freinage/liquides' },
        ],
      },
      {
        label: 'Suspension',
        href: '/catalogue/suspension',
      },
      {
        label: 'Électrique',
        href: '/catalogue/electrique',
      },
    ],
  },
  {
    label: 'Marques',
    href: '/marques',
    icon: Tag,
  },
  {
    label: 'Blog',
    href: '/blog',
    icon: BookOpen,
    badge: 'Nouveau',
  },
  {
    label: 'Aide',
    href: '/aide',
    icon: HelpCircle,
  },
];
```

### Implémentation NavbarPublic

```typescript
import { Link } from '@remix-run/react';
import { ShoppingCart, User, Menu } from 'lucide-react';
import { Button } from '~/components/ui/button';
import NavbarLogo from './NavbarLogo';
import NavbarSearch from './NavbarSearch';
import NavbarCart from './NavbarCart';
import NavbarMegaMenu from './NavbarMegaMenu';
import { publicNavigation } from './config/navigation';

interface NavbarPublicProps {
  user?: User | null;
  logo?: string;
  showSearch: boolean;
  showCart: boolean;
  onMobileMenuToggle: (isOpen: boolean) => void;
}

export default function NavbarPublic({
  user,
  logo,
  showSearch,
  showCart,
  onMobileMenuToggle,
}: NavbarPublicProps) {
  return (
    <div className="container mx-auto px-4">
      <div className="flex items-center justify-between h-16">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => onMobileMenuToggle(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-6 h-6" />
          </Button>

          <NavbarLogo logo={logo} href="/" />
        </div>

        {/* Center section - Navigation */}
        <nav className="hidden lg:flex items-center space-x-1">
          {publicNavigation.map((item) => (
            item.megaMenu ? (
              <NavbarMegaMenu key={item.href} item={item} />
            ) : (
              <Link
                key={item.href}
                to={item.href}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors relative"
              >
                {item.icon && <item.icon className="w-4 h-4 inline mr-2" />}
                {item.label}
                {item.badge && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {showSearch && (
            <div className="hidden md:block w-64">
              <NavbarSearch />
            </div>
          )}

          {showCart && <NavbarCart />}

          {user ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/account/dashboard">
                <User className="w-4 h-4 mr-2" />
                {user.firstName}
              </Link>
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Connexion</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Inscription</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 👨‍💼 NAVBAR ADMIN

### Configuration navigation admin

```typescript
// frontend/app/components/navbar/config/navigation-admin.ts

import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  FileText,
  Settings,
  BarChart3,
  CreditCard,
  Truck,
  UserCog,
} from 'lucide-react';

export const adminNavigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Commandes',
    href: '/admin/orders',
    icon: ShoppingCart,
    children: [
      { label: 'Toutes les commandes', href: '/admin/orders' },
      { label: 'En attente', href: '/admin/orders?status=pending' },
      { label: 'Expédiées', href: '/admin/orders?status=shipped' },
    ],
  },
  {
    label: 'Utilisateurs',
    href: '/admin/users',
    icon: Users,
    children: [
      { label: 'Tous les utilisateurs', href: '/admin/users' },
      { label: 'Revendeurs', href: '/admin/users?level=5' },
      { label: 'Staff', href: '/admin/staff', level: 9 },
    ],
  },
  {
    label: 'Produits',
    href: '/admin/products',
    icon: Package,
    children: [
      { label: 'Catalogue', href: '/admin/products' },
      { label: 'Stock', href: '/admin/stock' },
      { label: 'Gammes auto', href: '/admin/products/automotive' },
    ],
  },
  {
    label: 'Rapports',
    href: '/admin/reports',
    icon: BarChart3,
  },
  {
    label: 'Paiements',
    href: '/admin/payments',
    icon: CreditCard,
    level: 9, // Super-admin uniquement
  },
  {
    label: 'Fournisseurs',
    href: '/admin/suppliers',
    icon: Truck,
    level: 9,
  },
  {
    label: 'Configuration',
    href: '/admin/config',
    icon: Settings,
    level: 9,
  },
];
```

### Implémentation NavbarAdmin

```typescript
import { Link } from '@remix-run/react';
import { Bell, Search, User, Menu } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Badge } from '~/components/ui/badge';
import NavbarLogo from './NavbarLogo';
import NavbarNotifications from './NavbarNotifications';
import { adminNavigation } from './config/navigation-admin';
import { checkUserLevel } from './config/permissions';

interface NavbarAdminProps {
  user?: User | null;
  logo?: string;
  showNotifications: boolean;
  onMobileMenuToggle: (isOpen: boolean) => void;
}

export default function NavbarAdmin({
  user,
  logo,
  showNotifications,
  onMobileMenuToggle,
}: NavbarAdminProps) {
  // Filtrer navigation selon niveau
  const visibleNavigation = adminNavigation.filter(
    (item) => !item.level || checkUserLevel(user, item.level)
  );

  return (
    <div className="bg-blue-900 text-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Left */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-blue-800"
              onClick={() => onMobileMenuToggle(true)}
            >
              <Menu className="w-6 h-6" />
            </Button>

            <NavbarLogo 
              logo={logo} 
              href="/admin" 
              className="text-white"
            />

            <Badge variant="secondary" className="hidden md:inline-flex">
              Admin (Niveau {user?.level})
            </Badge>
          </div>

          {/* Center - Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {visibleNavigation.map((item) => (
              item.children ? (
                <DropdownMenu key={item.href}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="text-white hover:bg-blue-800"
                    >
                      {item.icon && <item.icon className="w-4 h-4 mr-2" />}
                      {item.label}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {item.children
                      .filter((child) => !child.level || checkUserLevel(user, child.level))
                      .map((child) => (
                        <DropdownMenuItem key={child.href} asChild>
                          <Link to={child.href}>{child.label}</Link>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  key={item.href}
                  variant="ghost"
                  className="text-white hover:bg-blue-800"
                  asChild
                >
                  <Link to={item.href}>
                    {item.icon && <item.icon className="w-4 h-4 mr-2" />}
                    {item.label}
                  </Link>
                </Button>
              )
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-blue-800"
            >
              <Search className="w-5 h-5" />
            </Button>

            {showNotifications && <NavbarNotifications />}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-blue-800"
                >
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account/dashboard">Mon compte</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account/settings">Paramètres</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form method="POST" action="/auth/logout">
                    <button type="submit" className="w-full text-left">
                      Déconnexion
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 📱 NAVBAR MOBILE

### Implémentation avec Drawer

```typescript
import { Link, useLocation } from '@remix-run/react';
import { X, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { publicNavigation } from './config/navigation';
import { adminNavigation } from './config/navigation-admin';
import { checkUserLevel } from './config/permissions';

interface NavbarMobileProps {
  isOpen: boolean;
  onClose: () => void;
  variant: 'public' | 'admin' | 'commercial';
  user?: User | null;
  logo?: string;
}

export default function NavbarMobile({
  isOpen,
  onClose,
  variant,
  user,
  logo,
}: NavbarMobileProps) {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const navigation = variant === 'admin' 
    ? adminNavigation.filter(item => !item.level || checkUserLevel(user, item.level))
    : publicNavigation;

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href]
    );
  };

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle>
            {variant === 'admin' ? 'Menu Admin' : 'Menu'}
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col p-4 space-y-2">
          {navigation.map((item) => (
            <div key={item.href}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      {item.icon && <item.icon className="w-5 h-5 mr-3" />}
                      {item.label}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        expandedItems.includes(item.href) ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                  {expandedItems.includes(item.href) && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={onClose}
                          className={`block px-4 py-2 text-sm hover:bg-gray-100 rounded-lg ${
                            isActive(child.href) ? 'bg-blue-50 text-blue-600' : ''
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center px-4 py-3 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors ${
                    isActive(item.href) ? 'bg-blue-50 text-blue-600' : ''
                  }`}
                >
                  {item.icon && <item.icon className="w-5 h-5 mr-3" />}
                  {item.label}
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* User section */}
        {user && (
          <div className="absolute bottom-0 left-0 right-0 border-t p-4 bg-gray-50">
            <div className="flex items-center mb-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            <form method="POST" action="/auth/logout">
              <Button type="submit" variant="outline" className="w-full">
                Déconnexion
              </Button>
            </form>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

---

## 🔍 NAVBAR SEARCH

### Implémentation avec Combobox

```typescript
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@remix-run/react';
import { Search, X } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '~/components/ui/command';
import { useDebounce } from '~/hooks/useDebounce';

interface SearchResult {
  type: 'product' | 'category' | 'brand';
  id: string;
  label: string;
  url: string;
  image?: string;
}

export default function NavbarSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  // Recherche API
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        setResults(data.results || []);
        setLoading(false);
      })
      .catch(() => {
        setResults([]);
        setLoading(false);
      });
  }, [debouncedQuery]);

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Rechercher..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg z-50">
          <Command>
            <CommandList>
              {loading && (
                <div className="py-6 text-center text-sm text-gray-500">
                  Recherche en cours...
                </div>
              )}

              {!loading && results.length === 0 && (
                <CommandEmpty>Aucun résultat trouvé</CommandEmpty>
              )}

              {!loading && results.length > 0 && (
                <>
                  {['product', 'category', 'brand'].map((type) => {
                    const items = results.filter((r) => r.type === type);
                    if (items.length === 0) return null;

                    return (
                      <CommandGroup
                        key={type}
                        heading={
                          type === 'product'
                            ? 'Produits'
                            : type === 'category'
                            ? 'Catégories'
                            : 'Marques'
                        }
                      >
                        {items.map((result) => (
                          <CommandItem
                            key={result.id}
                            onSelect={() => handleSelect(result)}
                            className="cursor-pointer"
                          >
                            {result.image && (
                              <img
                                src={result.image}
                                alt={result.label}
                                className="w-8 h-8 object-cover rounded mr-2"
                              />
                            )}
                            {result.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    );
                  })}
                </>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
```

---

## 🛒 CART SIDEBAR (NOUVEAU - Remplace dropdown)

### Pourquoi un Sidebar au lieu d'un Dropdown ?

**Avantages:**
- ✅ **Plus d'espace** : Affichage complet des infos (marque, référence, consigne)
- ✅ **Meilleure UX mobile** : Occupe tout l'écran
- ✅ **Pas de fermeture accidentelle** : Contrôle total de la fermeture
- ✅ **Images plus grandes** : Meilleure visibilité produits
- ✅ **Pattern professionnel** : Utilisé par Nike, Apple Store, etc.

### Implémentation avec Sheet (Sidebar)

```typescript
// frontend/app/components/navbar/CartSidebar.tsx

import { Link } from '@remix-run/react';
import { ShoppingCart, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { Badge } from '~/components/ui/badge';
import { useCart } from '~/hooks/useCart';
import { CartItem as CartItemComponent } from './CartItem';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartSidebar({ isOpen, onClose }: CartSidebarProps) {
  const { cart, totals } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[400px] p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">
              Mon Panier {totals.itemCount > 0 && `(${totals.itemCount})`}
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex flex-col h-[calc(100vh-80px)]">
          {cart.length === 0 ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 mb-6">Votre panier est vide</p>
              <Button onClick={onClose} variant="outline">
                Continuer mes achats
              </Button>
            </div>
          ) : (
            <>
              {/* Cart items */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {cart.map((item) => (
                  <CartItemComponent key={item.id} item={item} />
                ))}
              </div>

              {/* Footer with totals */}
              <div className="border-t px-6 py-4 space-y-4 bg-gray-50">
                {/* Subtotal */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Sous Total TTC</span>
                  <span className="font-semibold">
                    {totals.subtotal.toFixed(2)} €
                  </span>
                </div>

                {/* Consigne (si applicable) ✅ NOUVEAU */}
                {totals.consigneTotal > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Consigne TTC</span>
                    <span className="font-semibold">
                      {totals.consigneTotal.toFixed(2)} €
                    </span>
                  </div>
                )}

                {/* Separator */}
                {totals.consigneTotal > 0 && (
                  <div className="border-t pt-2" />
                )}

                {/* Total */}
                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold">Total TTC</span>
                  <span className="font-bold text-blue-600">
                    {totals.total.toFixed(2)} €
                  </span>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onClose}
                  >
                    Continuer mes achats
                  </Button>
                  <Button className="w-full" asChild>
                    <Link to="/panier">Valider ma commande</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Trigger button for navbar
export function CartSidebarTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const { totals } = useCart();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(true)}
        aria-label="Ouvrir le panier"
      >
        <ShoppingCart className="w-5 h-5" />
        {totals.itemCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
          >
            {totals.itemCount}
          </Badge>
        )}
      </Button>

      <CartSidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
```

### CartItem Component (Réutilisable)

```typescript
// frontend/app/components/navbar/CartItem.tsx

import { Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useCart } from '~/hooks/useCart';
import type { CartItem } from '~/types/cart';

interface CartItemProps {
  item: CartItem;
}

export function CartItem({ item }: CartItemProps) {
  const { removeItem } = useCart();

  return (
    <div className="flex gap-3">
      {/* Image */}
      <div className="flex-shrink-0">
        <img
          src={item.image || '/images/no-image.png'}
          alt={item.name}
          className="w-20 h-20 object-cover rounded border"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Nom produit */}
        <p className="text-sm font-semibold line-clamp-2 mb-1">
          {item.name}
        </p>

        {/* ✅ NOUVEAU: Marque */}
        <p className="text-xs text-gray-600 mb-0.5">
          {item.brand}
        </p>

        {/* ✅ NOUVEAU: Référence */}
        <p className="text-xs text-gray-500 mb-2">
          Réf: {item.reference}
        </p>

        {/* Prix */}
        <div className="text-sm">
          <span className="font-medium">
            {item.quantity} × {item.price.toFixed(2)} €
          </span>

          {/* ✅ NOUVEAU: Consigne (si applicable) */}
          {item.consigne && item.consigne > 0 && (
            <p className="text-xs text-gray-500 italic mt-1">
              + Consigne de {item.consigne.toFixed(2)} € TTC
            </p>
          )}
        </div>
      </div>

      {/* Remove button */}
      <div className="flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={() => removeItem(item.id)}
          aria-label="Retirer du panier"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

---

## 🔔 NAVBAR NOTIFICATIONS

### Implémentation

```typescript
import { Link } from '@remix-run/react';
import { Bell } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Badge } from '~/components/ui/badge';
import { useNotifications } from '~/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function NavbarNotifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-white hover:bg-blue-800">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="px-4 py-2 border-b flex items-center justify-between">
          <h3 className="font-semibold">Notifications ({unreadCount})</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            Aucune notification
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex flex-col items-start p-3 cursor-pointer"
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start gap-2 w-full">
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />

        <div className="p-2">
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/notifications">Voir toutes les notifications</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 📐 MEGA MENU

### Implémentation

```typescript
import { useState } from 'react';
import { Link } from '@remix-run/react';
import { ChevronDown } from 'lucide-react';
import { NavItem } from './Navbar';

interface NavbarMegaMenuProps {
  item: NavItem;
}

export default function NavbarMegaMenu({ item }: NavbarMegaMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors">
        {item.icon && <item.icon className="w-4 h-4 mr-2" />}
        {item.label}
        <ChevronDown className="w-4 h-4 ml-1" />
      </button>

      {isOpen && item.children && (
        <div className="absolute top-full left-0 mt-2 w-screen max-w-screen-lg bg-white border rounded-lg shadow-xl z-50">
          <div className="grid grid-cols-4 gap-4 p-6">
            {item.children.map((child) => (
              <div key={child.href}>
                <Link
                  to={child.href}
                  className="block font-semibold text-gray-900 hover:text-blue-600 mb-2"
                >
                  {child.label}
                </Link>
                {child.children && (
                  <ul className="space-y-1">
                    {child.children.map((subChild) => (
                      <li key={subChild.href}>
                        <Link
                          to={subChild.href}
                          className="block text-sm text-gray-600 hover:text-blue-600"
                        >
                          {subChild.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="border-t p-4 bg-gray-50">
            <Link
              to={item.href}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Voir toutes les catégories →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 🎨 HOOKS PERSONNALISÉS

### useCart (NOUVEAU - Avec support consignes)

```typescript
// frontend/app/hooks/useCart.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, CartTotals } from '~/types/cart';

interface CartState {
  cart: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (itemId: number) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  clearCart: () => void;
  totals: CartTotals;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addItem: (item) => {
        const { cart } = get();
        const existingItem = cart.find((i) => i.id === item.id);

        if (existingItem) {
          // Update quantity
          set({
            cart: cart.map((i) =>
              i.id === item.id
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          });
        } else {
          // Add new item
          set({ cart: [...cart, item] });
        }

        // Recalculate totals
        get().calculateTotals();
      },

      removeItem: (itemId) => {
        set({ cart: get().cart.filter((i) => i.id !== itemId) });
        get().calculateTotals();
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }

        set({
          cart: get().cart.map((i) =>
            i.id === itemId ? { ...i, quantity } : i
          ),
        });
        get().calculateTotals();
      },

      clearCart: () => {
        set({ cart: [], totals: { subtotal: 0, consigneTotal: 0, total: 0, itemCount: 0 } });
      },

      // ✅ NOUVEAU: Calcul avec consignes
      calculateTotals: () => {
        const { cart } = get();
        
        const subtotal = cart.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        // ✅ Calcul des consignes
        const consigneTotal = cart.reduce(
          (sum, item) => sum + (item.consigne || 0) * item.quantity,
          0
        );

        const total = subtotal + consigneTotal;

        const itemCount = cart.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        set({
          totals: {
            subtotal,
            consigneTotal,
            total,
            itemCount,
          },
        });
      },

      totals: {
        subtotal: 0,
        consigneTotal: 0,
        total: 0,
        itemCount: 0,
      },
    }),
    {
      name: 'cart-storage',
      // Initialiser les totals après chargement
      onRehydrateStorage: () => (state) => {
        state?.calculateTotals();
      },
    }
  )
);

// Hook helper pour afficher le panier
export function useCartDisplay() {
  const { cart, totals } = useCart();

  return {
    cart,
    totals,
    isEmpty: cart.length === 0,
    hasConsignes: totals.consigneTotal > 0,
  };
}
```

### Exemple d'utilisation du hook

```typescript
// Dans un composant
const CartExample = () => {
  const { addItem, cart, totals } = useCart();

  const handleAddToCart = () => {
    addItem({
      id: 123,
      name: "Filtre à huile",
      brand: "MANN-FILTER",      // ✅ Marque
      reference: "W712/73",       // ✅ Référence
      image: "/images/filtre.jpg",
      quantity: 1,
      price: 45.00,
      consigne: 7.50,             // ✅ Consigne (optionnel)
    });
  };

  return (
    <div>
      <p>Articles: {totals.itemCount}</p>
      <p>Sous-total: {totals.subtotal.toFixed(2)} €</p>
      {totals.consigneTotal > 0 && (
        <p>Consignes: {totals.consigneTotal.toFixed(2)} €</p>
      )}
      <p>Total: {totals.total.toFixed(2)} €</p>
    </div>
  );
};
```

### useNavbarScroll

```typescript
// frontend/app/components/navbar/hooks/useNavbarScroll.ts

import { useEffect, useState } from 'react';

interface UseNavbarScrollOptions {
  threshold?: number;
}

export function useNavbarScroll({ threshold = 10 }: UseNavbarScrollOptions = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setIsScrolled(currentScrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return { isScrolled, scrollY };
}
```

### useNavbarBreakpoints

```typescript
// frontend/app/components/navbar/hooks/useNavbarBreakpoints.ts

import { useEffect, useState } from 'react';

export function useNavbarBreakpoints() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      setIsDesktop(width >= 1024);
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);

    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return { isMobile, isTablet, isDesktop };
}
```

---

## 🔐 PERMISSIONS

### Configuration

```typescript
// frontend/app/components/navbar/config/permissions.ts

export const USER_LEVELS = {
  PUBLIC: 0,
  REGISTERED: 1,
  PRO: 3,
  COMMERCIAL: 5,
  ADMIN: 7,
  SUPER_ADMIN: 9,
} as const;

export type UserLevel = typeof USER_LEVELS[keyof typeof USER_LEVELS];

export function checkUserLevel(user: User | null | undefined, requiredLevel: number): boolean {
  if (!user) return false;
  return (user.level ?? 0) >= requiredLevel;
}

export function getUserRole(user: User | null | undefined): string {
  if (!user) return 'guest';
  const level = user.level ?? 0;
  
  if (level >= USER_LEVELS.SUPER_ADMIN) return 'super-admin';
  if (level >= USER_LEVELS.ADMIN) return 'admin';
  if (level >= USER_LEVELS.COMMERCIAL) return 'commercial';
  if (level >= USER_LEVELS.PRO) return 'pro';
  if (level >= USER_LEVELS.REGISTERED) return 'user';
  
  return 'guest';
}

// ✅ NOUVEAU: Constantes pour civilités
export const USER_CIVILITES = {
  M: 'M.',
  MME: 'Mme',
  MLLE: 'Mlle',
} as const;

export type UserCivilite = typeof USER_CIVILITES[keyof typeof USER_CIVILITES];

// Helper pour afficher nom complet
export function getFullName(user: User): string {
  const parts = [];
  
  if (user.civilite) {
    parts.push(user.civilite);
  }
  
  if (user.firstName) {
    parts.push(user.firstName);
  }
  
  if (user.lastName) {
    parts.push(user.lastName);
  }
  
  return parts.join(' ');
}
```

---

## 🎨 STYLES

### Tailwind Config

```typescript
// tailwind.config.ts additions

module.exports = {
  theme: {
    extend: {
      zIndex: {
        navbar: '50',
        mobileMenu: '60',
        dropdown: '70',
      },
      height: {
        navbar: '4rem', // 64px
        'navbar-mobile': '3.5rem', // 56px
      },
      boxShadow: {
        navbar: '0 2px 4px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
};
```

---

## 🗄️ API BACKEND - MEGA MENU DYNAMIQUE (Phase 2)

### Endpoint Navigation Catalogue

```typescript
// backend/src/modules/navigation/navigation.controller.ts

import { Controller, Get } from '@nestjs/common';
import { NavigationService } from './navigation.service';

@Controller('api/navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('catalog')
  async getCatalog() {
    return this.navigationService.getCatalogNavigation();
  }
}
```

### Service avec Cache

```typescript
// backend/src/modules/navigation/navigation.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

interface CatalogFamily {
  id: number;
  name: string;
  sort: number;
  gammes: CatalogGamme[];
}

interface CatalogGamme {
  id: number;
  name: string;
  alias: string;
  url: string;
  sort: number;
}

@Injectable()
export class NavigationService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly db: DatabaseService,
  ) {}

  async getCatalogNavigation(): Promise<CatalogFamily[]> {
    // ✅ Vérifier le cache (1 heure)
    const cached = await this.cacheManager.get<CatalogFamily[]>('catalog-navigation');
    if (cached) {
      return cached;
    }

    // ✅ Requête DB (similaire au PHP)
    const families = await this.db.query(`
      SELECT DISTINCT 
        MF_ID as id, 
        IF(MF_NAME_SYSTEM IS NULL, MF_NAME, MF_NAME_SYSTEM) AS name,
        MF_SORT as sort
      FROM CATALOG_FAMILY 
      WHERE MF_DISPLAY = 1
      ORDER BY MF_SORT
    `);

    // ✅ Pour chaque famille, récupérer les gammes
    for (const family of families) {
      family.gammes = await this.db.query(`
        SELECT DISTINCT 
          PG_ID as id,
          PG_NAME as name,
          PG_ALIAS as alias,
          MC_SORT as sort
        FROM PIECES_GAMME 
        JOIN CATALOG_GAMME ON MC_PG_ID = PG_ID
        WHERE PG_DISPLAY = 1 
          AND PG_LEVEL = 1 
          AND MC_MF_ID = ?
        ORDER BY MC_SORT
      `, [family.id]);

      // ✅ Générer URL pour chaque gamme
      family.gammes = family.gammes.map(gamme => ({
        ...gamme,
        url: `/pieces/${gamme.alias}-${gamme.id}.html`,
      }));
    }

    // ✅ Mettre en cache (1 heure)
    await this.cacheManager.set('catalog-navigation', families, 3600);

    return families;
  }

  // ✅ Méthode pour invalider le cache
  async invalidateCatalogCache(): Promise<void> {
    await this.cacheManager.del('catalog-navigation');
  }
}
```

### Frontend Loader (Remix)

```typescript
// frontend/app/routes/_index.tsx ou layout

export async function loader({ context }: LoaderFunctionArgs) {
  try {
    // ✅ Appel API avec cache
    const catalogNavigation = await fetch(
      `${process.env.API_URL}/api/navigation/catalog`,
      {
        headers: {
          'Cache-Control': 'public, max-age=3600', // 1h
        },
      }
    ).then(res => res.json());

    return json({
      catalogNavigation,
    });
  } catch (error) {
    // ✅ Fallback vers navigation statique
    console.error('Failed to load catalog navigation:', error);
    return json({
      catalogNavigation: defaultNavigation,
    });
  }
}
```

### Utilisation dans MegaMenu

```typescript
// frontend/app/components/navbar/NavbarMegaMenu.tsx

interface NavbarMegaMenuProps {
  families: CatalogFamily[];
}

export function NavbarMegaMenu({ families }: NavbarMegaMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="flex items-center px-4 py-2 text-sm font-medium">
        Catalogue
        <ChevronDown className="w-4 h-4 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-screen max-w-4xl bg-white border rounded-lg shadow-xl z-50">
          <div className="grid grid-cols-4 gap-6 p-6">
            {families.map((family) => (
              <div key={family.id}>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {family.name}
                </h3>
                <ul className="space-y-1">
                  {family.gammes.map((gamme) => (
                    <li key={gamme.id}>
                      <Link
                        to={gamme.url}
                        className="text-sm text-gray-600 hover:text-blue-600"
                      >
                        {gamme.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Configuration Cache Redis (Production)

```typescript
// backend/src/app.module.ts

import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      ttl: 3600, // 1 heure par défaut
    }),
    // ... autres modules
  ],
})
export class AppModule {}
```

---

## ⚙️ API BACKEND - CONFIGURATION TOPBAR (Phase 0)

### Endpoint Settings TopBar

```typescript
// backend/src/modules/settings/settings.controller.ts

import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SettingsService } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('topbar')
  async getTopBarConfig() {
    return this.settingsService.getTopBarConfig();
  }

  @Put('topbar')
  @UseGuards(AdminGuard)
  async updateTopBarConfig(@Body() config: TopBarConfig) {
    return this.settingsService.updateTopBarConfig(config);
  }
}
```

### Service avec Supabase

```typescript
// backend/src/modules/settings/settings.service.ts

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface TopBarConfig {
  enabled: boolean;
  phone: string;
  tagline: string;
  showAuth: boolean;
}

@Injectable()
export class SettingsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getTopBarConfig(): Promise<TopBarConfig> {
    const { data, error } = await this.supabase.client
      .from('settings')
      .select('*')
      .eq('key', 'topbar')
      .single();

    if (error || !data) {
      // ✅ Valeurs par défaut
      return {
        enabled: true,
        phone: '+33 1 23 45 67 89',
        tagline: 'Livraison gratuite dès 150€',
        showAuth: true,
      };
    }

    return data.value as TopBarConfig;
  }

  async updateTopBarConfig(config: TopBarConfig): Promise<TopBarConfig> {
    const { data, error } = await this.supabase.client
      .from('settings')
      .upsert({
        key: 'topbar',
        value: config,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update TopBar config: ${error.message}`);
    }

    return data.value as TopBarConfig;
  }
}
```

### Migration Supabase (SQL)

```sql
-- backend/supabase/migrations/20250114_create_settings_table.sql

CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ✅ Index pour recherche rapide
CREATE INDEX idx_settings_key ON settings(key);

-- ✅ Valeurs initiales TopBar
INSERT INTO settings (key, value) VALUES (
  'topbar',
  '{
    "enabled": true,
    "phone": "+33 1 23 45 67 89",
    "tagline": "Livraison gratuite dès 150€",
    "showAuth": true
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ✅ RLS (Row Level Security)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ✅ Tout le monde peut lire
CREATE POLICY "Everyone can read settings"
  ON settings FOR SELECT
  USING (true);

-- ✅ Seuls les admins peuvent modifier
CREATE POLICY "Only admins can update settings"
  ON settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
```

### Frontend Loader avec Cache

```typescript
// frontend/app/root.tsx

export async function loader({ request, context }: LoaderFunctionArgs) {
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { request, response: context.response }
  );

  // ✅ Récupérer config TopBar (cache navigateur 5min)
  const topBarConfig = await fetch(
    `${process.env.API_URL}/api/settings/topbar`,
    {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5min
      },
    }
  ).then(res => res.json());

  return json({
    topBarConfig,
    // ... autres données
  });
}
```

### Page Admin pour Modifier TopBar

```typescript
// frontend/app/routes/admin.settings.topbar.tsx

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const config = {
    enabled: formData.get('enabled') === 'true',
    phone: formData.get('phone') as string,
    tagline: formData.get('tagline') as string,
    showAuth: formData.get('showAuth') === 'true',
  };

  const response = await fetch(
    `${process.env.API_URL}/api/settings/topbar`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update TopBar config');
  }

  return redirect('/admin/settings');
}

export default function AdminTopBarSettings() {
  const { topBarConfig } = useLoaderData<typeof loader>();

  return (
    <Form method="post" className="space-y-6">
      <div className="flex items-center space-x-2">
        <Switch name="enabled" defaultChecked={topBarConfig.enabled} />
        <Label>Activer la TopBar</Label>
      </div>

      <div>
        <Label htmlFor="phone">Téléphone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={topBarConfig.phone}
          placeholder="+33 1 23 45 67 89"
        />
      </div>

      <div>
        <Label htmlFor="tagline">Phrase d'accroche</Label>
        <Input
          id="tagline"
          name="tagline"
          defaultValue={topBarConfig.tagline}
          placeholder="Livraison gratuite dès 150€"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch name="showAuth" defaultChecked={topBarConfig.showAuth} />
        <Label>Afficher authentification</Label>
      </div>

      <Button type="submit">Sauvegarder</Button>
    </Form>
  );
}
```

---

## ✅ CHECKLIST IMPLÉMENTATION

### Phase 0 : Configuration Backend + Types (3h) - ⭐ PRIORITÉ P0
- [ ] **Backend Settings API**
  - [ ] `backend/src/modules/settings/settings.controller.ts` (GET/PUT topbar)
  - [ ] `backend/src/modules/settings/settings.service.ts` (Supabase)
  - [ ] Migration Supabase `CREATE TABLE settings`
  - [ ] RLS policies (read all, update admins only)
- [ ] **Frontend Types**
  - [ ] `types/navbar.ts` (NavbarVariant, NavbarConfig)
  - [ ] `types/cart.ts` (CartItem avec brand/reference/consigne, CartTotals)
  - [ ] `types/topbar.ts` (TopBarConfig)
- [ ] **Config Files**
  - [ ] `config/navigation.ts` (navigation statique)
  - [ ] `config/permissions.ts` (USER_LEVELS, USER_CIVILITES, getFullName)

### Phase 1 : Hooks & État Global (4h) - ⭐ PRIORITÉ P0
- [ ] **Hooks UI**
  - [ ] `hooks/useNavbarScroll.ts` (hide on scroll down)
  - [ ] `hooks/useNavbarBreakpoints.ts` (responsive breakpoints)
- [ ] **Hooks Métier**
  - [ ] `hooks/useCart.ts` (Zustand + persist + consignes séparées)
  - [ ] `hooks/useTopBar.ts` (fetch config depuis API)
- [ ] **Tests Hooks**
  - [ ] Test `useCart` : calcul consignes, add/remove items
  - [ ] Test `permissions.ts` : getFullName avec civilité

### Phase 2 : TopBar Configurable (3h) - ⭐ PRIORITÉ P0
- [ ] **Composant TopBar**
  - [ ] `navbar/TopBar.tsx` (phone + tagline + auth display)
  - [ ] Style responsive (masqué mobile si besoin)
  - [ ] Loader Remix avec cache 5min
- [ ] **Page Admin Settings**
  - [ ] `routes/admin.settings.topbar.tsx` (formulaire édition)
  - [ ] Action Remix (PUT API /settings/topbar)
  - [ ] Validation FormData

### Phase 3 : Panier avec Consignes (5h) - ⭐ PRIORITÉ P0
- [ ] **Composants Panier**
  - [ ] `navbar/CartSidebar.tsx` (Sheet 400px au lieu de dropdown)
  - [ ] `navbar/CartItem.tsx` (affichage brand + reference + consigne)
  - [ ] Affichage totaux : Sous-total / Consignes / Total TTC
- [ ] **Logique Métier Auto**
  - [ ] Calcul `consigneTotal` séparé du `subtotal`
  - [ ] Persist dans localStorage via Zustand
  - [ ] Tests edge cases (consigne = 0, undefined)

### Phase 4 : Navbar Orchestrator (6h) - PRIORITÉ P1
- [ ] **Composants Coeur**
  - [ ] `navbar/Navbar.tsx` (orchestrateur + TopBar conditionnel)
  - [ ] `navbar/NavbarPublic.tsx` (logo + nav + actions)
  - [ ] `navbar/NavbarAdmin.tsx` (dashboard links)
  - [ ] `navbar/NavbarLogo.tsx` (responsive sizing)
- [ ] **Navigation Desktop**
  - [ ] `navbar/NavbarNav.tsx` (liens desktop)
  - [ ] `navbar/NavbarActions.tsx` (search, cart, profile icons)
- [ ] **Navigation Mobile**
  - [ ] `navbar/NavbarMobile.tsx` (Sheet drawer avec burger menu)

### Phase 5 : Features Recherche & Profil (4h) - PRIORITÉ P1
- [ ] **Recherche**
  - [ ] `navbar/NavbarSearch.tsx` (Dialog + autocomplete)
  - [ ] Intégration API recherche produits
  - [ ] Keyboard shortcuts (Cmd+K)
- [ ] **Profil Utilisateur**
  - [ ] `navbar/NavbarProfile.tsx` (Dropdown avec getFullName)
  - [ ] Menu contextuel selon rôle (admin/commercial/client)
  - [ ] Liens Mon compte, Commandes, Déconnexion

### Phase 6 : MegaMenu Dynamique DB (6h) - PRIORITÉ P2
- [ ] **Backend Navigation API**
  - [ ] `backend/src/modules/navigation/navigation.controller.ts`
  - [ ] `backend/src/modules/navigation/navigation.service.ts`
  - [ ] Requêtes SQL `CATALOG_FAMILY` + `CATALOG_GAMME`
  - [ ] Cache Redis (prod) ou Memory (dev, TTL 1h)
  - [ ] Endpoint invalidation cache
- [ ] **Frontend MegaMenu**
  - [ ] `navbar/NavbarMegaMenu.tsx` (grid 4 colonnes, hover)
  - [ ] Loader Remix avec cache 1h
  - [ ] Fallback vers navigation statique si API fail
  - [ ] Animations framer-motion

### Phase 7 : Tests Complets (5h) - PRIORITÉ P1
- [ ] **Tests Unitaires**
  - [ ] `useCart` : consignes, totaux, persistence
  - [ ] `permissions.ts` : checkUserLevel, getFullName
  - [ ] Calculs edge cases (consigne 0, null, undefined)
- [ ] **Tests Composants (RTL)**
  - [ ] `CartSidebar` : affichage consignes, totaux séparés
  - [ ] `CartItem` : brand + reference + consigne display
  - [ ] `TopBar` : phone link (tel:), tagline, auth buttons
- [ ] **Tests E2E (Playwright)**
  - [ ] Mobile menu : ouvrir/fermer drawer
  - [ ] Panier : ajouter produit avec consigne, voir totaux
  - [ ] MegaMenu : hover, navigation vers gamme
- [ ] **Tests Accessibilité**
  - [ ] WCAG AA compliance (axe-core)
  - [ ] Keyboard navigation (Tab, Enter, Esc)
  - [ ] Screen reader labels (aria-label)
  - [ ] Touch targets 44x44px minimum

### Phase 8 : Polish & Documentation (2h) - PRIORITÉ P2
- [ ] **Storybook Stories**
  - [ ] `TopBar` : variants enabled/disabled
  - [ ] `CartSidebar` : empty, with items, with consignes
  - [ ] `MegaMenu` : tous les niveaux famille/gamme
- [ ] **Documentation Technique**
  - [ ] Guide d'utilisation (ajout route, permissions)
  - [ ] API documentation (endpoints, types TypeScript)
  - [ ] Guide consignes (logique métier auto)
  - [ ] Troubleshooting (cache, RLS, API fails)

### Phase 9 : Intégration & Déploiement (2h) - PRIORITÉ P1
- [ ] **Intégration root.tsx**
  - [ ] Remplacer ancien Navbar par nouveau
  - [ ] Tester toutes les routes (public, admin, commercial)
  - [ ] Vérifier permissions selon rôles
- [ ] **Tests Production**
  - [ ] Lighthouse score mobile > 90
  - [ ] Layout shift < 0.1
  - [ ] First Paint < 1s
  - [ ] Cache Redis fonctionnel

---

## 📊 MÉTRIQUES DE SUCCÈS

### Performance
- [ ] First Paint < 1s
- [ ] Interactive < 2s
- [ ] No layout shift
- [ ] Mobile score > 90

### Accessibilité
- [ ] WCAG AA compliance
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Touch targets 44x44px

### UX
- [ ] Mobile menu functional
- [ ] Search responsive
- [ ] Cart updates real-time
- [ ] Notifications work

---

## 📊 RÉCAPITULATIF PRIORISATION

### ⭐ P0 - CRITIQUE (15h) - Semaine 1
**Features héritées du PHP legacy, bloquantes pour UX métier :**
- ✅ Settings API (TopBar configurable depuis admin)
- ✅ TopBar component (phone cliquable + tagline personnalisable)
- ✅ CartSidebar avec consignes (remplacement dropdown)
- ✅ CartItem avec brand + reference (traçabilité pièces auto)
- ✅ useCart hook avec calcul consignes séparé du prix

**Justification** : Ces features sont issues du PHP legacy et répondent à des besoins métier spécifiques de l'industrie automobile (consignes légales, traçabilité des références, contact direct).

### 🔶 P1 - IMPORTANT (17h) - Semaine 2
**Features UX essentielles pour navigation moderne :**
- Navbar orchestrator (variants public/admin/commercial)
- Mobile menu responsive (Sheet drawer)
- Search avec autocomplete
- Profil utilisateur contextuel (getFullName avec civilité)
- Tests unitaires et composants
- Intégration + déploiement

**Justification** : Sans mobile menu et search, 50%+ des utilisateurs ont une UX dégradée. Tests obligatoires avant mise en production.

### 🔷 P2 - AMÉLIORATION (8h) - Semaine 3
**Features nice-to-have pour administration avancée :**
- MegaMenu dynamique (API + cache Redis)
- Documentation Storybook complète
- Troubleshooting guide

**Justification** : Navigation statique suffit en attendant. MegaMenu DB améliore l'admin mais pas bloquant pour les utilisateurs finaux.

**TOTAL : 40h** (vs 62h planifiées initialement)  
**Gain** : -22h grâce à priorisation stricte P0/P1/P2

---

## 📋 DÉPENDANCES NPM À INSTALLER

```bash
# Phase 0 - Backend
npm install --workspace=backend cache-manager cache-manager-redis-store

# Phase 1 - Frontend UI
npm install --workspace=frontend @radix-ui/react-dropdown-menu
npm install --workspace=frontend @radix-ui/react-dialog
npm install --workspace=frontend @radix-ui/react-navigation-menu
npm install --workspace=frontend framer-motion
npm install --workspace=frontend date-fns

# Phase 1 - État global
npm install --workspace=frontend zustand

# Phase 7 - Tests
npm install --workspace=frontend -D @testing-library/react
npm install --workspace=frontend -D @testing-library/user-event
npm install --workspace=frontend -D @playwright/test
npm install --workspace=frontend -D @axe-core/playwright
```

---

## 🔗 LIENS UTILES

- **Audit complet** : `AUDIT-NAVBAR-COMPLET-2025-10-14.md`
- **Plan d'action** : `PLAN-ACTION-NAVBAR-REFONTE.md`
- **Analyse PHP legacy** : `ANALYSE-NAVBAR-PHP-LEGACY.md`
- **Quick start** : `NAVBAR-QUICK-START.md`
- **Index documentation** : `INDEX-DOCUMENTATION-NAVBAR.md`

---

**Document créé le**: 14 Janvier 2025  
**Dernière mise à jour**: 14 Janvier 2025  
**Version**: 2.0 (avec features PHP legacy)  
**Statut**: ✅ Prêt pour implémentation (specs complètes)
