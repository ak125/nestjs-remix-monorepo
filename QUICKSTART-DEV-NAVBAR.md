# ⚡ NAVBAR - GUIDE QUICK START DÉVELOPPEURS

**Pour**: Nouveaux développeurs sur le projet  
**Temps lecture**: 5 minutes  
**Temps setup**: 0 minute (déjà installé !)

---

## 🎯 Résumé Ultra-Rapide

```bash
# 1. Checkout branch
git checkout update-navbar

# 2. Lancer le dev server
npm run dev

# 3. Tester
# - Mobile: F12 > Toggle device toolbar > iPhone
# - Desktop: Redimensionner fenêtre
```

**C'est tout !** Aucune dépendance supplémentaire nécessaire.

---

## 🧩 3 Composants à connaître

### 1. **TopBar** - Barre info desktop

```tsx
import { TopBar } from "./components/navbar/TopBar";

// Usage basique
<TopBar user={user} />

// Avec config custom
<TopBar 
  user={user}
  config={{ 
    tagline: "Mon slogan",
    phone: "01 99 88 77 66"
  }}
/>
```

**Où**: Au-dessus de la Navbar  
**Visible**: Desktop uniquement (>= 768px)

---

### 2. **NavbarMobile** - Menu burger mobile

```tsx
import { NavbarMobile } from "./components/navbar/NavbarMobile";

// Usage
<NavbarMobile user={user} />
```

**Où**: Dans la Navbar (à gauche du logo)  
**Visible**: Mobile uniquement (< 768px)  
**Clic**: Ouvre slide-in depuis gauche

---

### 3. **CartSidebar** - Panier moderne

```tsx
import { CartSidebar } from "./components/navbar/CartSidebar";
import { useCart } from "../hooks/useCart";

function MonComposant() {
  const { isOpen, closeCart } = useCart();
  
  return <CartSidebar isOpen={isOpen} onClose={closeCart} />;
}
```

**Où**: Slide-in depuis droite  
**Clic panier**: Ouvre sidebar

---

## 🪝 Hook useCart - Le plus important

```tsx
import { useCart } from "../hooks/useCart";

function MaPage() {
  const {
    items,          // CartItem[] - Articles du panier
    summary,        // CartSummary - Totaux (subtotal, consignes, total)
    isOpen,         // boolean - Sidebar ouverte ?
    isLoading,      // boolean - Chargement en cours ?
    error,          // string | null - Erreur éventuelle
    
    toggleCart,     // () => void - Toggle sidebar
    openCart,       // () => void - Ouvrir sidebar
    closeCart,      // () => void - Fermer sidebar
    removeItem,     // (id) => void - Supprimer item
    updateQuantity, // (id, qty) => void - Changer quantité
    refreshCart,    // () => void - Recharger depuis API
  } = useCart();
  
  return (
    <div>
      <button onClick={toggleCart}>
        Panier ({summary.total_items})
      </button>
      
      <p>Total: {summary.total_price}€</p>
      <p>Dont consignes: {summary.consigne_total}€</p>
    </div>
  );
}
```

---

## 📦 Types importants

### CartItem
```typescript
interface CartItem {
  id: string;
  product_id: string;
  product_name?: string;
  product_ref?: string;         // Référence
  product_brand?: string;        // 🆕 Marque
  product_image?: string;
  quantity: number;
  price: number;
  unit_price?: number;
  
  // 🆕 Phase 1: Consignes
  consigne_unit?: number;        // Consigne unitaire
  consigne_total?: number;       // Consigne totale
  has_consigne?: boolean;        // Flag
}
```

### CartSummary
```typescript
interface CartSummary {
  total_items: number;
  subtotal: number;              // Produits HT consignes
  consigne_total: number;        // 🆕 Total consignes
  total_price: number;           // Total TTC (subtotal + consignes)
  tax_amount: number;
  shipping_cost: number;
  currency: string;              // "EUR"
}
```

---

## 🎨 Breakpoints Responsive

```css
< 768px (mobile):
  - TopBar: hidden
  - NavbarMobile: visible (burger menu)
  - Navigation desktop: hidden
  - CartSidebar: width 100%

>= 768px (desktop):
  - TopBar: visible
  - NavbarMobile: hidden
  - Navigation desktop: visible
  - CartSidebar: width 480px
```

---

## 🧪 Tester rapidement

### Test 1: Mobile menu
```bash
1. F12 > Toggle device toolbar
2. Choisir iPhone 12
3. Cliquer burger menu (3 lignes en haut à gauche)
4. ✅ Menu slide-in s'ouvre
5. Cliquer overlay noir
6. ✅ Menu se ferme
```

### Test 2: CartSidebar
```bash
1. Cliquer icône panier
2. ✅ Sidebar s'ouvre depuis droite
3. ✅ Voir items avec consignes en orange
4. ✅ Footer affiche 3 totaux
5. Cliquer overlay
6. ✅ Sidebar se ferme
```

### Test 3: TopBar
```bash
1. Mode desktop (>= 768px)
2. ✅ TopBar visible en haut
3. ✅ "Bienvenue M./Mme Nom" si connecté
4. ✅ Téléphone cliquable
5. Mode mobile (< 768px)
6. ✅ TopBar caché
```

### Test 4: Consignes BDD
```bash
npx tsx test-consignes-supabase.ts

# Résultats attendus:
# - 442 173 lignes dans pieces_price
# - 46 746 produits avec consignes
# - Consigne moyenne: 32.74€
```

---

## 🐛 Debug courant

### Problème: "useCart is not defined"
```typescript
// ❌ Mauvais
import { useCart } from "../components/navbar/CartSidebar";

// ✅ Bon
import { useCart } from "../hooks/useCart";
```

### Problème: "TopBar toujours visible sur mobile"
```tsx
// Vérifier que la classe lg:block est présente
<div className="hidden lg:block bg-gray-100">
  {/* TopBar content */}
</div>
```

### Problème: "CartSidebar ne s'ouvre pas"
```tsx
// Vérifier que isOpen vient de useCart()
const { isOpen, toggleCart } = useCart();

// Et que CartSidebar reçoit isOpen
<CartSidebar isOpen={isOpen} onClose={closeCart} />
```

### Problème: "Consignes pas affichées"
```tsx
// Vérifier types dans cart.ts
interface CartItem {
  consigne_unit?: number;  // ← Doit exister
  consigne_total?: number; // ← Doit exister
  has_consigne?: boolean;  // ← Doit exister
}
```

---

## 📁 Fichiers clés à éditer

### Pour modifier le TopBar
```
frontend/app/components/navbar/TopBar.tsx
```

### Pour modifier le menu mobile
```
frontend/app/components/navbar/NavbarMobile.tsx
```

### Pour modifier le panier
```
frontend/app/components/navbar/CartSidebar.tsx
frontend/app/hooks/useCart.ts
frontend/app/types/cart.ts
```

### Pour modifier la navbar principale
```
frontend/app/components/Navbar.tsx
```

### Pour modifier le layout global
```
frontend/app/root.tsx
```

---

## 🎨 Customisation rapide

### Changer le tagline TopBar
```tsx
// frontend/app/root.tsx
<TopBar 
  user={user}
  config={{ 
    tagline: "Votre nouveau slogan ici" 
  }}
/>
```

### Changer le téléphone
```tsx
<TopBar 
  user={user}
  config={{ 
    phone: "01 99 88 77 66" 
  }}
/>
```

### Masquer les liens rapides
```tsx
<TopBar 
  user={user}
  config={{ 
    showQuickLinks: false 
  }}
/>
```

### Ajouter un nouveau lien dans NavbarMobile
```tsx
// frontend/app/components/navbar/NavbarMobile.tsx

<li>
  <Link
    to="/ma-nouvelle-page"
    onClick={closeMenu}
    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100"
  >
    <MonIcon className="h-5 w-5 text-blue-600" />
    <span className="font-medium">Mon lien</span>
  </Link>
</li>
```

---

## 🚀 Workflow rapide

### Ajouter une feature à la navbar

```bash
# 1. Créer une branche depuis update-navbar
git checkout update-navbar
git checkout -b feature/ma-nouvelle-feature

# 2. Coder votre feature
# Éditer les fichiers dans frontend/app/components/navbar/

# 3. Tester
npm run dev
# Tester mobile + desktop

# 4. Commit
git add .
git commit -m "✨ feat: Ma nouvelle feature navbar"

# 5. Merge dans update-navbar
git checkout update-navbar
git merge feature/ma-nouvelle-feature
```

---

## 📚 Aller plus loin

### Documentation complète
- **Vue d'ensemble**: `README-NAVBAR.md`
- **Phase 1 POC**: `PHASE1-POC-CARTSIDEBAR-COMPLETE.md`
- **Phase 2 Mobile**: `PHASE2-NAVBAR-MOBILE-COMPLETE.md`
- **Phase 3 TopBar**: `PHASE3-TOPBAR-COMPLETE.md`
- **Spécifications**: `SPEC-NAVBAR-V2-TABLES-EXISTANTES.md`

### Architecture détaillée
```
Lire: README-NAVBAR.md > Section Architecture
```

### Tests avancés
```
Lire: README-NAVBAR.md > Section Tests
```

---

## 💡 Tips & Tricks

### 1. Helpers disponibles
```typescript
import { formatPrice } from '../hooks/useCart';

formatPrice(1234.56) // "1 234,56 €"
```

### 2. Icônes lucide-react
```tsx
import { Phone, Mail, Settings } from 'lucide-react';

<Phone className="h-5 w-5" />
```

### 3. Tailwind classes responsive
```tsx
// Hidden mobile, visible desktop
className="hidden md:block"

// Visible mobile, hidden desktop
className="block md:hidden"

// Taille responsive
className="w-full md:w-[480px]"
```

### 4. Debug useCart
```tsx
const cart = useCart();
console.log('Cart state:', cart);
```

### 5. Test user levels
```tsx
// Non connecté
user = null

// Client (level 0-2)
user = { level: 1 }

// Commercial (level 3-6)
user = { level: 5 }

// Admin (level 7+)
user = { level: 10 }
```

---

## 🎯 Checklist nouveau dev

- [ ] Branch `update-navbar` checkoutée
- [ ] Dev server lancé (`npm run dev`)
- [ ] Testé mobile (F12 > device toolbar)
- [ ] Testé desktop (redimensionner fenêtre)
- [ ] Burger menu ouvert/fermé ✅
- [ ] CartSidebar ouvert/fermé ✅
- [ ] TopBar visible desktop uniquement ✅
- [ ] Lu README-NAVBAR.md (vue d'ensemble)
- [ ] Fichiers clés identifiés
- [ ] useCart() testé dans console

---

## ❓ Besoin d'aide ?

### Erreurs TypeScript
```bash
# Redémarrer le serveur TypeScript
Ctrl+Shift+P > "TypeScript: Restart TS Server"
```

### Erreurs Tailwind
```bash
# Vérifier que la classe existe
# Voir: https://tailwindcss.com/docs
```

### Problème de state
```bash
# Vérifier React DevTools
F12 > Components tab > Chercher composant
```

### Documentation
```bash
# Lire README-NAVBAR.md pour vue d'ensemble complète
```

---

**Créé le**: 14 Octobre 2025  
**Pour**: Nouveaux développeurs  
**Temps setup**: 0 minute  
**Prêt**: Immédiatement ! 🚀
