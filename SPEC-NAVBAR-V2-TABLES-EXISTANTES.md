# 🔧 SPÉCIFICATIONS TECHNIQUES V2 - REFONTE NAVBAR (avec tables existantes)

## 📋 Vue d'ensemble

**Document**: Spécifications techniques complètes - Version 2  
**Date**: 14 Octobre 2025  
**Version**: 2.0 (Mise à jour avec analyse PHP legacy)  
**Objectif**: Refonte complète de la navbar avec approche modulaire utilisant les tables existantes

---

## 🎯 CHANGEMENTS MAJEURS V2

### Nouveautés intégrées de l'ancien PHP:
1. ✅ **TopBar** avec téléphone et statut connexion
2. ✅ **CartSidebar** (remplace dropdown) avec consignes
3. ✅ **Marque + Référence** partout
4. ✅ **QuickSearch Sidebar** mobile
5. ✅ **Navigation Blog** (entretien, constructeurs, guide)
6. ✅ **Images produits** avec fallback
7. ✅ **Gestion consignes** (PIECES_PRICE.PRI_CONSIGNE_TTC)

---

## 🗄️ TABLES EXISTANTES À UTILISER

### Tables Produits
```sql
-- Table principale
PIECES (
  PIECE_ID, PIECE_REF, PIECE_REF_CLEAN, PIECE_NAME, 
  PIECE_PM_ID, PIECE_HAS_IMG, PIECE_DISPLAY, PIECE_SORT
)

-- Prix avec consignes
PIECES_PRICE (
  PRI_PIECE_ID, PRI_PM_ID, PRI_VENTE_TTC, 
  PRI_CONSIGNE_TTC,  -- 🔥 CONSIGNE
  PIECE_QTY_SALE
)

-- Marques
PIECES_MARQUE (
  PM_ID, PM_NAME
)

-- Images
PIECES_MEDIA_IMG (
  PMI_PIECE_ID, PMI_FOLDER, PMI_NAME, PMI_DISPLAY
)

-- Gammes (pour mega menu)
PIECES_GAMME (
  PG_ID, PG_NAME, PG_ALIAS, PG_DISPLAY, PG_LEVEL, PG_SORT
)

-- Catalogue (hierarchie)
CATALOG_GAMME (
  MC_PG_ID, MC_MF_ID, MC_SORT
)

-- Familles
CATALOG_FAMILY (
  MF_ID, MF_NAME, MF_NAME_SYSTEM, MF_DISPLAY, MF_SORT
)
```

### Tables Utilisateurs
```sql
-- Utilisateurs
USERS (
  id, firstName, lastName, email, level
  -- Note: Pas de colonne civilite dans la structure actuelle
  -- À ajouter si nécessaire ou utiliser firstName pour stocker civilite
)
```

### Tables Blog (existantes)
```sql
-- Les routes blog existent déjà dans Remix:
/blog/                          -- Index
/blog/entretien/               -- Entretien
/blog/constructeurs/           -- Constructeurs  
/blog/guide/                   -- Guide
```

---

## 🏗️ ARCHITECTURE CIBLE

### Structure des composants (mise à jour)

```
frontend/app/components/navbar/
├── index.ts                      # Export principal
├── Navbar.tsx                    # Composant racine orchestrateur
├── TopBar.tsx                    # 🆕 Barre supérieure
├── NavbarPublic.tsx             # Variante publique
├── NavbarAdmin.tsx              # Variante admin
├── NavbarBlog.tsx               # 🆕 Variante blog
├── NavbarMobile.tsx             # Version mobile (drawer)
├── NavbarSearch.tsx             # Barre de recherche intégrée
├── NavbarUser.tsx               # Menu utilisateur (dropdown)
├── CartSidebar.tsx              # 🆕 Panier latéral (remplace NavbarCart)
├── CartItem.tsx                 # 🆕 Item panier réutilisable
├── QuickSearchSidebar.tsx       # 🆕 Recherche latérale mobile
├── NavbarMegaMenu.tsx          # Mega menu catalogue
└── NavbarLogo.tsx              # Logo responsive

config/
├── navigation.ts                # Navigation publique
├── navigation-admin.ts          # Navigation admin
├── navigation-blog.ts           # 🆕 Navigation blog
├── permissions.ts               # Niveaux + helpers
└── constants.ts                 # Constantes générales

hooks/
├── useNavbarState.ts            # État global navbar
├── useNavbarScroll.ts           # Gestion scroll
├── useCart.ts                   # 🆕 Hook panier avec consignes
└── useNavbarBreakpoints.ts     # Breakpoints responsive
```

---

## 🆕 COMPOSANT: TopBar.tsx

### Interface TypeScript

```typescript
export interface TopBarConfig {
  tagline: string;
  phone: {
    display: string;  // "01 23 45 67 89"
    href: string;     // "+33123456789"
  };
  showUserGreeting: boolean;
}

interface TopBarProps extends TopBarConfig {
  user?: User | null;
  className?: string;
}
```

### Implémentation

```typescript
import { Link } from '@remix-run/react';
import { Phone } from 'lucide-react';
import { useOptionalUser } from '~/root';

export function TopBar({ 
  tagline = "Pièces auto à prix pas cher",
  phone,
  showUserGreeting = true,
  className = ""
}: TopBarProps) {
  const user = useOptionalUser();
  
  return (
    <div className={`bg-gray-100 border-b hidden lg:block ${className}`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-2 text-sm">
          {/* Tagline */}
          <span className="text-gray-600">{tagline}</span>
          
          {/* Contact + User info */}
          <div className="flex items-center gap-2">
            {phone && (
              <>
                <a 
                  href={`tel:${phone.href}`}
                  className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  {phone.display}
                </a>
                <span className="text-gray-300">|</span>
              </>
            )}
            
            {showUserGreeting && user ? (
              <Link 
                to="/account/dashboard" 
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                {user.firstName} {user.lastName}
              </Link>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 🆕 COMPOSANT: CartSidebar.tsx (Remplace NavbarCart)

### Interface avec consignes

```typescript
export interface CartItemData {
  id: number;
  pieceId: number;          // PIECE_ID
  name: string;             // PIECE_NAME
  brand: string;            // PM_NAME
  reference: string;        // PIECE_REF
  image: string;            // PMI_FOLDER/PMI_NAME ou fallback
  quantity: number;         // Quantité panier
  price: number;            // PRI_VENTE_TTC * PIECE_QTY_SALE
  consigne?: number;        // PRI_CONSIGNE_TTC * PIECE_QTY_SALE
}

export interface CartTotals {
  subtotal: number;         // Total produits
  consigneTotal: number;    // Total consignes
  total: number;            // Grand total
}
```

### Implémentation

```typescript
import { Link } from '@remix-run/react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { Button } from '~/components/ui/button';
import { useCart } from '../hooks/useCart';
import { CartItem } from './CartItem';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartSidebar({ isOpen, onClose }: CartSidebarProps) {
  const { cart, totals, isEmpty } = useCart();
  
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-96 flex flex-col">
        <SheetHeader>
          <SheetTitle>Mon Panier</SheetTitle>
        </SheetHeader>
        
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <p className="text-gray-500 mb-4">Votre panier est vide</p>
            <Button onClick={onClose}>Continuer mes achats</Button>
          </div>
        ) : (
          <>
            {/* Liste produits avec scroll */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {cart.map((item) => (
                <CartItem key={item.id} item={item} />
              ))}
            </div>
            
            {/* Totaux */}
            <div className="border-t pt-4 pb-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Sous Total TTC</span>
                <span className="font-semibold">
                  {totals.subtotal.toFixed(2)} €
                </span>
              </div>
              
              {totals.consigneTotal > 0 && (
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Consigne TTC</span>
                  <span>{totals.consigneTotal.toFixed(2)} €</span>
                </div>
              )}
              
              {/* Actions */}
              <div className="pt-2 space-y-2">
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
      </SheetContent>
    </Sheet>
  );
}
```

---

## 🆕 COMPOSANT: CartItem.tsx

```typescript
import { Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { CartItemData } from './CartSidebar';

interface CartItemProps {
  item: CartItemData;
  onRemove?: (id: number) => void;
}

export function CartItem({ item, onRemove }: CartItemProps) {
  return (
    <div className="flex gap-3">
      {/* Image */}
      <div className="flex-shrink-0">
        <img 
          src={item.image || '/upload/articles/no.png'} 
          alt={item.name}
          className="w-20 h-20 object-cover rounded border"
          onError={(e) => {
            e.currentTarget.src = '/upload/articles/no.png';
          }}
        />
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight mb-1">
          {item.name}
        </p>
        <p className="text-xs text-gray-600 mb-0.5">
          {item.brand}
        </p>
        <p className="text-xs text-gray-500 mb-1">
          Réf {item.reference}
        </p>
        <p className="text-sm">
          {item.quantity} × {item.price.toFixed(2)} €
        </p>
        {item.consigne && item.consigne > 0 && (
          <p className="text-xs text-gray-500 italic">
            + Consigne de {item.consigne.toFixed(2)} € TTC
          </p>
        )}
      </div>
      
      {/* Remove button */}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      )}
    </div>
  );
}
```

---

## 🆕 HOOK: useCart.ts

```typescript
import { useEffect, useState } from 'react';
import type { CartItemData, CartTotals } from '../components/navbar/CartSidebar';

export function useCart() {
  const [cart, setCart] = useState<CartItemData[]>([]);
  const [totals, setTotals] = useState<CartTotals>({
    subtotal: 0,
    consigneTotal: 0,
    total: 0,
  });

  // Charger le panier depuis l'API
  useEffect(() => {
    fetch('/api/cart')
      .then(res => res.json())
      .then(data => {
        setCart(data.items || []);
        calculateTotals(data.items || []);
      })
      .catch(console.error);
  }, []);

  // Calculer les totaux
  const calculateTotals = (items: CartItemData[]) => {
    const subtotal = items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );
    
    const consigneTotal = items.reduce((sum, item) => 
      sum + ((item.consigne || 0) * item.quantity), 0
    );
    
    setTotals({
      subtotal,
      consigneTotal,
      total: subtotal + consigneTotal,
    });
  };

  // Supprimer un item
  const removeItem = async (id: number) => {
    try {
      await fetch(`/api/cart/${id}`, { method: 'DELETE' });
      const newCart = cart.filter(item => item.id !== id);
      setCart(newCart);
      calculateTotals(newCart);
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  return {
    cart,
    totals,
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    isEmpty: cart.length === 0,
    removeItem,
    refreshCart: () => {
      // Recharger le panier
      fetch('/api/cart')
        .then(res => res.json())
        .then(data => {
          setCart(data.items || []);
          calculateTotals(data.items || []);
        });
    },
  };
}
```

---

## 🆕 COMPOSANT: QuickSearchSidebar.tsx

```typescript
import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { Search, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';

interface QuickSearchSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSearchSidebar({ isOpen, onClose }: QuickSearchSidebarProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/find?quest=${encodeURIComponent(query)}`);
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full">
        <SheetHeader>
          <SheetTitle>Recherche par référence</SheetTitle>
        </SheetHeader>
        
        <div className="py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type="search"
                placeholder="Réf. d'origine ou commercial de votre pièce"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="pr-10"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            
            <Button type="submit" className="w-full">
              <Search className="w-4 h-4 mr-2" />
              Rechercher
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

## 🆕 CONFIGURATION: navigation-blog.ts

```typescript
import { BookOpen, Wrench, Car } from 'lucide-react';
import type { NavItem } from '../Navbar';

export const blogNavigation: NavItem[] = [
  {
    label: 'Entretien',
    href: '/blog/entretien',
    icon: Wrench,
  },
  {
    label: 'Constructeurs',
    href: '/blog/constructeurs',
    icon: Car,
  },
  {
    label: 'Guide',
    href: '/blog/guide',
    icon: BookOpen,
  },
];
```

---

## 🆕 COMPOSANT: NavbarBlog.tsx

```typescript
import { Link } from '@remix-run/react';
import { Menu, ShoppingCart, User, Search } from 'lucide-react';
import { Button } from '~/components/ui/button';
import NavbarLogo from './NavbarLogo';
import { blogNavigation } from './config/navigation-blog';
import { useCart } from './hooks/useCart';

interface NavbarBlogProps {
  user?: User | null;
  logo?: string;
  onMobileMenuToggle: (isOpen: boolean) => void;
  onCartOpen: () => void;
  onSearchOpen: () => void;
}

export default function NavbarBlog({
  user,
  logo,
  onMobileMenuToggle,
  onCartOpen,
  onSearchOpen,
}: NavbarBlogProps) {
  const { itemCount } = useCart();
  
  return (
    <div className="container mx-auto px-4">
      <div className="flex items-center justify-between h-16">
        {/* Left - Mobile triggers + Logo */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => onMobileMenuToggle(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-6 h-6" />
          </Button>

          <NavbarLogo logo={logo} href="/blog" />
        </div>

        {/* Center - Navigation */}
        <nav className="hidden lg:flex items-center space-x-1">
          {blogNavigation.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
            >
              {item.icon && <item.icon className="w-4 h-4 mr-2" />}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {/* Search mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onSearchOpen}
            aria-label="Rechercher"
          >
            <Search className="w-5 h-5" />
          </Button>

          {/* Cart */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={onCartOpen}
            aria-label="Panier"
          >
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-xs rounded-full">
                {itemCount}
              </span>
            )}
          </Button>

          {/* User */}
          {user ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/account/dashboard">
                <User className="w-4 h-4 mr-2" />
                {user.firstName}
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">
                <User className="w-4 h-4 mr-2" />
                Connexion
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 📡 API ENDPOINTS (Backend NestJS)

### 1. API Panier avec consignes

```typescript
// backend/src/modules/cart/cart.controller.ts

@Controller('api/cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly supabaseClient: SupabaseClient,
  ) {}

  @Get()
  async getCart(@Session() session: any) {
    const userId = session.user?.id;
    if (!userId) {
      return { items: [], totals: { subtotal: 0, consigneTotal: 0, total: 0 } };
    }

    // Récupérer items du panier (depuis session ou DB)
    const cartItems = await this.cartService.getCartItems(userId);
    
    // Pour chaque item, récupérer les infos produit depuis Supabase
    const items = await Promise.all(
      cartItems.map(async (cartItem) => {
        const { data: product } = await this.supabaseClient
          .from('PIECES')
          .select(`
            PIECE_ID,
            PIECE_REF,
            PIECE_NAME,
            PIECE_HAS_IMG,
            PIECES_PRICE!inner (
              PRI_VENTE_TTC,
              PRI_CONSIGNE_TTC,
              PIECE_QTY_SALE
            ),
            PIECES_MARQUE!inner (
              PM_NAME
            )
          `)
          .eq('PIECE_ID', cartItem.pieceId)
          .eq('PIECE_DISPLAY', 1)
          .single();

        if (!product) return null;

        // Gérer l'image
        let image = '/upload/articles/no.png';
        if (product.PIECE_HAS_IMG === 1) {
          const { data: imageData } = await this.supabaseClient
            .from('PIECES_MEDIA_IMG')
            .select('PMI_FOLDER, PMI_NAME')
            .eq('PMI_PIECE_ID', cartItem.pieceId)
            .eq('PMI_DISPLAY', 1)
            .limit(1)
            .single();

          if (imageData) {
            image = `rack/${imageData.PMI_FOLDER}/${imageData.PMI_NAME}.webp`;
          }
        }

        const price = product.PIECES_PRICE[0];
        return {
          id: cartItem.id,
          pieceId: product.PIECE_ID,
          name: product.PIECE_NAME,
          brand: product.PIECES_MARQUE[0].PM_NAME,
          reference: product.PIECE_REF,
          image,
          quantity: cartItem.quantity,
          price: price.PRI_VENTE_TTC * price.PIECE_QTY_SALE,
          consigne: price.PRI_CONSIGNE_TTC * price.PIECE_QTY_SALE,
        };
      })
    );

    const validItems = items.filter(Boolean);
    
    // Calculer totaux
    const subtotal = validItems.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );
    const consigneTotal = validItems.reduce((sum, item) => 
      sum + ((item.consigne || 0) * item.quantity), 0
    );

    return {
      items: validItems,
      totals: {
        subtotal,
        consigneTotal,
        total: subtotal + consigneTotal,
      },
    };
  }

  @Delete(':id')
  async removeItem(@Param('id') id: string, @Session() session: any) {
    const userId = session.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    await this.cartService.removeItem(parseInt(id), userId);
    return { success: true };
  }
}
```

### 2. API Mega Menu (optionnel - Phase 2)

```typescript
// backend/src/modules/navigation/navigation.controller.ts

@Controller('api/navigation')
export class NavigationController {
  constructor(
    private readonly cacheManager: CacheManager,
    private readonly supabaseClient: SupabaseClient,
  ) {}

  @Get('catalog')
  async getCatalog() {
    // Vérifier cache
    const cached = await this.cacheManager.get('navigation-catalog');
    if (cached) {
      return cached;
    }

    // Récupérer depuis DB
    const { data: families } = await this.supabaseClient
      .from('CATALOG_FAMILY')
      .select(`
        MF_ID,
        MF_NAME,
        MF_NAME_SYSTEM,
        MF_SORT
      `)
      .eq('MF_DISPLAY', 1)
      .order('MF_SORT');

    const catalogData = await Promise.all(
      families.map(async (family) => {
        const { data: gammes } = await this.supabaseClient
          .from('PIECES_GAMME')
          .select(`
            PG_ID,
            PG_NAME,
            PG_ALIAS,
            CATALOG_GAMME!inner (
              MC_SORT
            )
          `)
          .eq('PG_DISPLAY', 1)
          .eq('PG_LEVEL', 1)
          .eq('CATALOG_GAMME.MC_MF_ID', family.MF_ID)
          .order('CATALOG_GAMME.MC_SORT');

        return {
          id: family.MF_ID,
          name: family.MF_NAME_SYSTEM || family.MF_NAME,
          gammes: gammes.map(g => ({
            id: g.PG_ID,
            name: g.PG_NAME,
            alias: g.PG_ALIAS,
            href: `/piece/${g.PG_ALIAS}-${g.PG_ID}.html`,
          })),
        };
      })
    );

    // Mettre en cache (1 heure)
    await this.cacheManager.set('navigation-catalog', catalogData, 3600);

    return catalogData;
  }

  @Get('topbar')
  async getTopBarConfig() {
    // Configuration depuis env ou DB
    return {
      tagline: process.env.SITE_TAGLINE || 'Pièces auto à prix pas cher',
      phone: {
        display: process.env.SITE_PHONE_DISPLAY || '01 23 45 67 89',
        href: process.env.SITE_PHONE_HREF || '+33123456789',
      },
      showUserGreeting: true,
    };
  }
}
```

---

## 🔄 MISE À JOUR: Navbar.tsx (Orchestrateur)

```typescript
import { useEffect, useState } from 'react';
import { useLocation } from '@remix-run/react';
import { cn } from '~/lib/utils';
import { useOptionalUser } from '~/root';
import { useNavbarScroll } from './hooks/useNavbarScroll';
import TopBar from './TopBar';
import NavbarPublic from './NavbarPublic';
import NavbarAdmin from './NavbarAdmin';
import NavbarBlog from './NavbarBlog';
import NavbarMobile from './NavbarMobile';
import CartSidebar from './CartSidebar';
import QuickSearchSidebar from './QuickSearchSidebar';

export type NavbarVariant = 'public' | 'admin' | 'blog';

export interface NavbarProps {
  variant?: NavbarVariant;
  logo?: string;
  showTopBar?: boolean;
  className?: string;
}

export function Navbar({
  variant = 'public',
  logo,
  showTopBar = true,
  className,
}: NavbarProps) {
  const user = useOptionalUser();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  
  const { isScrolled } = useNavbarScroll({ threshold: 10 });

  // Auto-detect variant
  const effectiveVariant = (() => {
    // Blog explicite ou détection par route
    if (variant === 'blog' || location.pathname.startsWith('/blog')) {
      return 'blog';
    }
    // Admin si user level >= 7
    if (variant === 'admin' || (user && user.level >= 7 && location.pathname.startsWith('/admin'))) {
      return 'admin';
    }
    return 'public';
  })();

  // Fermer mobile menu sur navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setCartOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const commonProps = {
    user,
    logo,
    onMobileMenuToggle: setMobileMenuOpen,
    onCartOpen: () => setCartOpen(true),
    onSearchOpen: () => setSearchOpen(true),
  };

  const navbarClasses = cn(
    'navbar transition-all duration-300 bg-white',
    isScrolled && 'shadow-md',
    className
  );

  return (
    <>
      {/* TopBar (desktop only) */}
      {showTopBar && effectiveVariant !== 'admin' && (
        <TopBar
          tagline="Pièces auto à prix pas cher"
          phone={{
            display: '01 23 45 67 89',
            href: '+33123456789',
          }}
        />
      )}

      {/* Main Navbar */}
      <nav className={navbarClasses} role="navigation" aria-label="Navigation principale">
        {effectiveVariant === 'admin' && <NavbarAdmin {...commonProps} />}
        {effectiveVariant === 'blog' && <NavbarBlog {...commonProps} />}
        {effectiveVariant === 'public' && <NavbarPublic {...commonProps} />}
      </nav>

      {/* Sidebars */}
      <NavbarMobile
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        variant={effectiveVariant}
        {...commonProps}
      />

      <CartSidebar
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
      />

      <QuickSearchSidebar
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
```

---

## ✅ CHECKLIST D'IMPLÉMENTATION (MISE À JOUR)

### Phase 1: Structure de base (Jour 1)
- [ ] Créer dossier `navbar/` avec tous les sous-dossiers
- [ ] Créer fichiers principaux
- [ ] Créer hooks de base
- [ ] Créer configs (avec navigation-blog.ts)
- [ ] Créer types avec consignes

### Phase 2: Composants essentiels (Jours 2-3)
- [ ] **TopBar.tsx** ✨ NOUVEAU
- [ ] NavbarLogo.tsx
- [ ] Navbar.tsx (orchestrateur)
- [ ] NavbarPublic.tsx
- [ ] **NavbarBlog.tsx** ✨ NOUVEAU

### Phase 3: Panier avec consignes (Jours 4-5)
- [ ] **CartSidebar.tsx** ✨ NOUVEAU (remplace dropdown)
- [ ] **CartItem.tsx** ✨ NOUVEAU
- [ ] **useCart.ts hook** ✨ NOUVEAU
- [ ] API `/api/cart` backend
- [ ] Tests affichage consignes

### Phase 4: Mobile & Search (Jours 6-7)
- [ ] NavbarMobile.tsx (avec blog support)
- [ ] **QuickSearchSidebar.tsx** ✨ NOUVEAU
- [ ] Tests responsive complets

### Phase 5: Admin & Tests (Jours 8-10)
- [ ] NavbarAdmin.tsx
- [ ] Tests unitaires (coverage > 80%)
- [ ] Tests E2E
- [ ] Tests A11y

### Phase 6: API & Optimisations (Bonus)
- [ ] API `/api/navigation/catalog` (mega menu DB)
- [ ] API `/api/navigation/topbar` (config dynamique)
- [ ] Cache Redis/Memory
- [ ] Performance optimization

---

## 🎯 CRITÈRES DE SUCCÈS

### Fonctionnels
✅ TopBar visible sur desktop  
✅ Panier sidebar avec consignes affichées  
✅ Marque + référence visibles partout  
✅ Navigation blog fonctionnelle  
✅ Quick search sidebar mobile  
✅ Images produits avec fallback  
✅ Compteur panier dynamique  

### Techniques
✅ Utilise les tables existantes (PIECES, PIECES_PRICE, etc.)  
✅ Consignes depuis PRI_CONSIGNE_TTC  
✅ Images depuis PIECES_MEDIA_IMG  
✅ Pas de nouvelles tables nécessaires  
✅ Cache pour navigation (optionnel)  

### Performance & Qualité
✅ Lighthouse > 90  
✅ Tests coverage > 80%  
✅ WCAG AA compliant  
✅ Mobile responsive  

---

**Document créé le**: 14 Octobre 2025  
**Version**: 2.0 (Mise à jour avec analyse PHP)  
**Statut**: ✅ Prêt pour implémentation avec tables existantes  
**Prochaine étape**: Phase 1 - Setup avec nouveaux composants
