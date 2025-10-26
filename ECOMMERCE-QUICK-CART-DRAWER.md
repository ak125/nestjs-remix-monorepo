# 🛒 Quick Cart Drawer - Documentation Complète

## Vue d'ensemble

**Emplacement**: `frontend/app/components/ecommerce/QuickCartDrawer.tsx`  
**Lignes**: ~450  
**Status**: ✅ Production Ready  
**Dernière mise à jour**: Octobre 2025

### Rôle

**Panier latéral rapide (drawer)** optimisé pour e-commerce automobile avec ajout instantané sans rechargement, résumé temps réel (prix, livraison, compatibilité) et animation slide fluide.

---

## 🎯 Features Principales

### ✅ Ajout Instantané

- **Sans rechargement** : Ajout produits sans reload page
- **Feedback visuel** : Animation confirmation ajout
- **Auto-ouverture** : Drawer s'ouvre automatiquement après ajout
- **Portal React** : Rendu hors DOM principal (createPortal)

### 💰 Résumé Complet Temps Réel

```
Sous-total (4 articles):    181.80 €
Livraison (Express):          9.90 €
─────────────────────────────────────
Total:                      191.70 €
```

- Calcul automatique sous-total
- Options livraison (Standard, Express, Retrait)
- Total avec livraison
- Compteur articles

### ✓ Compatibilité Véhicule

- **Badges visuels** : ✓ OK (vert) ou ⚠ Non (rouge) sur chaque produit
- **Alerte incompatibilités** : Bandeau rouge si articles incompatibles
- **Info véhicule** : Affichage véhicule configuré en haut
- **Validation** : Prévention erreurs avant checkout

### 🎨 UX Optimisée

- **Animation slide** : Entrée/sortie fluide depuis droite
- **Backdrop** : Fond sombre cliquable pour fermer
- **Responsive** : Full-width mobile, 480px desktop
- **Scroll** : Liste produits scrollable, footer fixe
- **Modification quantités** : Boutons +/- inline
- **Suppression** : Bouton supprimer par produit

---

## 📋 Props API

```typescript
interface QuickCartDrawerProps {
  // État drawer
  isOpen: boolean;                              // Ouvert/fermé
  onClose: () => void;                          // Callback fermeture

  // Items panier
  items: CartItem[];                            // Liste produits
  onUpdateQuantity: (id, qty) => void;          // Modifier quantité
  onRemoveItem: (id) => void;                   // Supprimer produit

  // Checkout
  onCheckout: () => void;                       // Callback "Commander"

  // Options livraison
  deliveryOptions?: DeliveryOption[];           // Liste options (défaut: 3)
  selectedDeliveryId?: string;                  // ID option sélectionnée
  onSelectDelivery?: (id) => void;              // Callback changement livraison

  // Véhicule configuré (optionnel)
  savedVehicle?: {
    brand: string;
    model: string;
    year: number;
    engine?: string;
  } | null;
}
```

### CartItem (Type)

```typescript
interface CartItem {
  id: string;              // ID unique dans panier
  productId: string;       // ID produit original
  name: string;            // ex: "Plaquettes de frein avant"
  oemRef: string;          // ex: "7701208265"
  imageUrl: string;        // URL image produit
  price: number;           // ex: 45.90
  quantity: number;        // ex: 2
  isCompatible: boolean;   // Compatible avec véhicule ?
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
}
```

### DeliveryOption (Type)

```typescript
interface DeliveryOption {
  id: string;              // ex: "standard"
  name: string;            // ex: "Standard"
  price: number;           // ex: 4.90 (0 = gratuit)
  estimatedDays: string;   // ex: "3-5 jours"
  icon?: string;           // Icône optionnelle
}
```

**Options par défaut** :
```typescript
[
  { id: 'standard', name: 'Standard', price: 4.90, estimatedDays: '3-5 jours' },
  { id: 'express', name: 'Express', price: 9.90, estimatedDays: '1-2 jours' },
  { id: 'pickup', name: 'Retrait en magasin', price: 0, estimatedDays: 'Immédiat' },
]
```

---

## 🎨 Design System Integration

### Couleurs Utilisées

| Élément | Couleur | Usage |
|---------|---------|-------|
| **Header** | `bg-neutral-900` | Fond header (titre + compteur) |
| **CTA Commander** | `bg-primary-500` | Bouton principal (rouge #FF3B30) |
| **Badge Compatible** | `bg-success-500` | ✓ OK (vert #27AE60) |
| **Badge Incompatible** | `bg-error-500` | ⚠ Non (rouge #C0392B) |
| **Alerte incompatibilité** | `bg-error-50` | Bandeau alerte rouge |
| **Info véhicule** | `bg-success-50` | Bandeau véhicule configuré |
| **Option livraison sélectionnée** | `bg-secondary-50 border-secondary-500` | Option active (bleu) |
| **Items background** | `bg-neutral-50` | Fond cartes produits |
| **Backdrop** | `bg-black/50` | Fond sombre semi-transparent |

### Typographie

| Élément | Font | Taille | Usage |
|---------|------|--------|-------|
| Titre drawer | `font-heading` | `text-xl` | "Mon Panier" |
| Nom produit | `font-heading` | `text-sm` | Nom article |
| Prix | `font-mono` | `text-lg` → `text-2xl` | Prix unitaire → Total |
| OEM ref | `font-mono` | `text-xs` | Référence technique |
| Labels | `font-sans` | `text-sm` | Sous-total, Livraison |

### Espacement (8px Grid)

| Zone | Spacing | Valeur |
|------|---------|--------|
| **Padding drawer** | `px-md py-md` | 16px |
| **Gap items** | `space-y-md` | 16px |
| **Padding cartes** | `p-sm` | 8px |
| **Gap infos** | `gap-sm`, `gap-xs` | 8px, 4px |
| **Footer padding** | `px-md py-md` | 16px |

---

## 📦 Exemples d'Utilisation

### 1️⃣ Utilisation Basique

```typescript
import { useState } from 'react';
import { QuickCartDrawer, CartItem } from '~/components/ecommerce/QuickCartDrawer';

function CartPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([
    {
      id: '1',
      productId: 'prod-1',
      name: 'Plaquettes de frein',
      oemRef: '7701208265',
      imageUrl: '/images/plaquettes.jpg',
      price: 45.90,
      quantity: 2,
      isCompatible: true,
      stockStatus: 'in-stock',
    },
  ]);

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleCheckout = () => {
    // Rediriger vers page paiement
    window.location.href = '/checkout';
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Panier ({items.reduce((sum, i) => sum + i.quantity, 0)})
      </button>

      <QuickCartDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        items={items}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />
    </>
  );
}
```

### 2️⃣ Ajout Instantané depuis ProductCard

```typescript
import { useState } from 'react';
import { ProductCard } from '~/components/ecommerce/ProductCard';
import { QuickCartDrawer, CartItem } from '~/components/ecommerce/QuickCartDrawer';

function CatalogPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleAddToCart = (productId: string, product: {
    name: string;
    oemRef: string;
    imageUrl: string;
    price: number;
    isCompatible: boolean;
    stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  }) => {
    // Vérifier si produit déjà dans panier
    const existing = cartItems.find(item => item.productId === productId);

    if (existing) {
      // Incrémenter quantité
      setCartItems(prev =>
        prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      // Ajouter nouveau produit
      const newItem: CartItem = {
        id: `cart-${Date.now()}`,
        productId,
        ...product,
        quantity: 1,
      };
      setCartItems(prev => [...prev, newItem]);
    }

    // Ouvrir drawer automatiquement
    setIsCartOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-lg">
        {products.map(product => (
          <ProductCard
            key={product.id}
            {...product}
            onAddToCart={(id) => handleAddToCart(id, product)}
          />
        ))}
      </div>

      {/* Bouton panier flottant */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-8 right-8 px-xl py-md bg-primary-500 text-white rounded-full"
      >
        🛒 {cartItems.reduce((sum, i) => sum + i.quantity, 0)}
      </button>

      <QuickCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />
    </>
  );
}
```

### 3️⃣ Avec Options Livraison Personnalisées

```typescript
const customDeliveryOptions = [
  {
    id: 'economy',
    name: 'Économique',
    price: 2.90,
    estimatedDays: '5-7 jours',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 4.90,
    estimatedDays: '3-5 jours',
  },
  {
    id: 'express',
    name: 'Express 24h',
    price: 14.90,
    estimatedDays: '24h',
  },
  {
    id: 'premium',
    name: 'Premium (avant 12h)',
    price: 24.90,
    estimatedDays: 'Avant 12h',
  },
];

function CartWithCustomDelivery() {
  const [selectedDelivery, setSelectedDelivery] = useState('standard');

  return (
    <QuickCartDrawer
      isOpen={isOpen}
      onClose={onClose}
      items={items}
      deliveryOptions={customDeliveryOptions}
      selectedDeliveryId={selectedDelivery}
      onSelectDelivery={setSelectedDelivery}
      // ...autres props
    />
  );
}
```

### 4️⃣ Avec Véhicule Configuré

```typescript
function CartWithVehicle() {
  const savedVehicle = {
    brand: 'Peugeot',
    model: '208',
    year: 2016,
    engine: '1.6 HDi',
  };

  return (
    <QuickCartDrawer
      isOpen={isOpen}
      onClose={onClose}
      items={items}
      savedVehicle={savedVehicle}
      // ...autres props
    />
  );
}

// Résultat : Bandeau vert en haut du drawer :
// ✓ Véhicule: Peugeot 208 1.6 HDi (2016)
```

---

## 🏗️ Architecture Interne

### Structure Composant

```
QuickCartDrawer (Portal)
├── Backdrop (cliquable pour fermer)
│
└── Drawer (slide depuis droite)
    ├── Header (sticky top)
    │   ├── Titre "Mon Panier"
    │   ├── Compteur articles
    │   └── Bouton fermer
    │
    ├── Alerte Véhicule (optionnel)
    │   └── ✓ Peugeot 208 1.6 HDi (2016)
    │
    ├── Alerte Incompatibilités (si applicable)
    │   └── ⚠ 2 articles incompatibles
    │
    ├── Liste Produits (scrollable)
    │   └── CartItem Card (x N)
    │       ├── Image + Nom
    │       ├── Badge Compatible/Incompatible
    │       ├── Réf OEM
    │       ├── Quantité (+/-)
    │       ├── Prix (unitaire × quantité)
    │       └── Bouton Supprimer
    │
    └── Footer (sticky bottom)
        ├── Options Livraison
        │   └── Radio buttons (Standard, Express, Retrait)
        │
        ├── Résumé Prix
        │   ├── Sous-total
        │   ├── Livraison
        │   └── Total (large)
        │
        ├── Bouton "Commander" (Primary)
        └── Lien "Continuer mes achats"
```

### Animations

```typescript
// Backdrop fade in/out
className={`
  transition-opacity duration-300
  ${isOpen && animating ? 'opacity-100' : 'opacity-0 pointer-events-none'}
`}

// Drawer slide depuis droite
className={`
  transition-transform duration-300 ease-out
  ${isOpen && animating ? 'translate-x-0' : 'translate-x-full'}
`}
```

### État Interne

```typescript
const [mounted, setMounted] = useState(false);        // SSR-safe
const [animating, setAnimating] = useState(false);    // Animation state
```

---

## 📱 Responsive Behavior

### Mobile (< 768px)

- Drawer **full-width** (100vw)
- Images produits 80px × 80px
- Footer stack vertical
- Touch-friendly boutons +/-

### Desktop (≥ 768px)

- Drawer **fixe 480px** de large
- Backdrop cliquable pour fermer
- Footer horizontal si espace

---

## ♿ Accessibilité

### ARIA

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="cart-drawer-title"
>
  <h2 id="cart-drawer-title">Mon Panier</h2>
</div>
```

### Navigation Clavier

- **Tab** : Navigation entre boutons
- **Enter/Space** : Activer bouton
- **Escape** : Fermer drawer (à implémenter)

### Screen Readers

- Labels explicites sur tous boutons
- `aria-label` sur bouton fermer
- Annonce compteur articles

---

## ⚡ Performance

### Optimisations

1. **createPortal** : Rendu hors DOM principal (évite re-renders)
2. **Animations CSS** : Transitions hardware-accelerated
3. **useMemo calculs** : Total/sous-total calculés uniquement si items changent
4. **Debounce quantités** : Éviter appels API excessifs (à implémenter)

### Best Practices

```typescript
// ✅ BON: Calculs mémoïsés
const subtotal = useMemo(
  () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  [items]
);

// ✅ BON: Portal pour éviter re-renders parents
return createPortal(drawerContent, document.body);

// ⚠️ À AMÉLIORER: Debounce updates quantités
const debouncedUpdate = useMemo(
  () => debounce(onUpdateQuantity, 300),
  [onUpdateQuantity]
);
```

---

## 🧪 Tests Suggérés

### Tests Unitaires (Jest/Vitest)

```typescript
describe('QuickCartDrawer', () => {
  it('affiche compteur articles', () => {
    render(<QuickCartDrawer items={mockItems} />);
    expect(screen.getByText('4 articles')).toBeInTheDocument();
  });

  it('calcule sous-total correct', () => {
    render(<QuickCartDrawer items={mockItems} />);
    expect(screen.getByText('181.80 €')).toBeInTheDocument();
  });

  it('incrémente quantité au clic +', () => {
    const onUpdate = jest.fn();
    render(<QuickCartDrawer onUpdateQuantity={onUpdate} />);
    
    fireEvent.click(screen.getByLabelText('Augmenter quantité'));
    expect(onUpdate).toHaveBeenCalledWith('item-1', 3);
  });

  it('supprime item au clic supprimer', () => {
    const onRemove = jest.fn();
    render(<QuickCartDrawer onRemoveItem={onRemove} />);
    
    fireEvent.click(screen.getByText('Supprimer'));
    expect(onRemove).toHaveBeenCalledWith('item-1');
  });

  it('affiche alerte incompatibilités', () => {
    const items = [
      { ...mockItem, isCompatible: false },
    ];
    render(<QuickCartDrawer items={items} />);
    
    expect(screen.getByText(/articles incompatibles/)).toBeInTheDocument();
  });
});
```

### Tests E2E (Playwright)

```typescript
test('ajout produit ouvre drawer automatiquement', async ({ page }) => {
  await page.goto('/catalogue');
  
  // Ajouter au panier
  await page.click('text=Ajouter au panier');
  
  // Drawer devrait s'ouvrir
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('text=Mon Panier')).toBeVisible();
});

test('modification quantité met à jour total', async ({ page }) => {
  await page.goto('/panier');
  
  // Incrémenter quantité
  await page.click('[aria-label="Augmenter quantité"]');
  
  // Total devrait augmenter
  await expect(page.locator('text=91.80 €')).toBeVisible();
});

test('checkout redirige vers paiement', async ({ page }) => {
  await page.goto('/panier');
  
  await page.click('text=Commander');
  
  await expect(page).toHaveURL('/checkout');
});
```

---

## 🔗 Intégration avec Autres Composants

### Avec SmartHeader (Compteur Panier)

```typescript
import { SmartHeader } from '~/components/ecommerce/SmartHeader';
import { QuickCartDrawer } from '~/components/ecommerce/QuickCartDrawer';

function Layout() {
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const cartItemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      <SmartHeader
        cartItemCount={cartItemCount}
        onCartClick={() => setIsCartOpen(true)}
      />

      <QuickCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        // ...
      />
    </>
  );
}
```

### Avec ProductCard (Ajout Rapide)

```typescript
<ProductCard
  {...product}
  onAddToCart={(id) => {
    addToCart(id);
    setIsCartOpen(true); // Ouvrir drawer automatiquement
  }}
/>
```

---

## 📊 Stats Composant

| Métrique | Valeur |
|----------|--------|
| **Lignes de code** | ~450 |
| **Interfaces TypeScript** | 3 (CartItem, DeliveryOption, QuickCartDrawerProps) |
| **Couleurs Design System** | 5 (Primary, Success, Error, Secondary, Neutral) |
| **Fonts** | 3 (heading, sans, mono) |
| **Animations** | 2 (backdrop fade, drawer slide) |
| **Portal** | ✅ OUI (createPortal) |
| **Responsive** | ✅ OUI (mobile/desktop) |
| **Accessibilité** | ✅ ARIA + Labels |

---

## ✅ Checklist Production

- [x] Ajout instantané sans rechargement
- [x] Résumé temps réel (sous-total, livraison, total)
- [x] Options livraison (3 par défaut, customizable)
- [x] Badges compatibilité véhicule
- [x] Modification quantités inline
- [x] Suppression produits
- [x] Animation slide fluide
- [x] Responsive mobile/desktop
- [x] Accessibilité (ARIA, labels)
- [x] TypeScript 100% typé
- [ ] Persistence localStorage (à implémenter)
- [ ] Debounce updates quantités (à implémenter)
- [ ] Tests E2E complets (à créer)

---

## 🚀 Next Steps

1. **localStorage** : Persister panier entre sessions
2. **API Backend** : Synchroniser avec serveur
3. **Animations** : Feedback ajout produit (toast)
4. **Codes promo** : Champ code réduction
5. **Stock validation** : Vérifier disponibilité temps réel

---

**Version**: 1.0.0  
**Auteur**: Design System Team  
**License**: MIT
