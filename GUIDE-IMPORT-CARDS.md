# 🧭 Guide d'Import - Composants Cards

**Date:** 24 octobre 2025  
**Objectif:** Savoir quel composant Card utiliser selon le contexte

---

## 🎯 Décision Rapide

```tsx
// ❓ Quelle Card utiliser ?

// 1. Composant générique (profil, dashboard, formulaire) ?
import { Card, CardContent } from '~/components/ui/card';

// 2. Showcase UI Kit (page /ui-kit) ?
import { ProductCard } from '@fafa/ui';

// 3. Pages produits réelles (catalogue, recherche) ?
import { ProductCard } from '~/components/ecommerce/ProductCard';

// 4. Documentation Design System uniquement ?
import { ProductCardExample } from '~/components/examples/ProductCardExample';
```

---

## 📚 Guide Détaillé

### 1️⃣ Primitifs Shadcn/UI (`~/components/ui/card.tsx`)

**Quand utiliser :**
- Composants génériques (profil utilisateur, dashboard, statistiques)
- Formulaires dans des cartes
- Conteneurs de contenu simple
- N'importe quel usage NON lié aux produits

**Import :**
```tsx
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardContent, 
  CardFooter 
} from '~/components/ui/card';
```

**Exemple :**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Profil Utilisateur</CardTitle>
    <CardDescription>Vos informations personnelles</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Nom: Jean Dupont</p>
    <p>Email: jean@example.com</p>
  </CardContent>
  <CardFooter>
    <Button>Modifier</Button>
  </CardFooter>
</Card>
```

**Caractéristiques :**
- ✅ Minimaliste, flexible
- ✅ Base pour construire d'autres composants
- ✅ Pas de logique métier
- ❌ Pas adapté pour produits e-commerce

---

### 2️⃣ UI Kit CVA (`@fafa/ui` ProductCard)

**Quand utiliser :**
- Page `/ui-kit/components` (showcase technique)
- Tests visuels E2E
- Démonstration variants CVA
- Développement UI Kit partagé

**Import :**
```tsx
import { ProductCard } from '@fafa/ui';
```

**Exemple :**
```tsx
<ProductCard
  variant="elevated"
  density="compact"
  radius="lg"
  image="/product.jpg"
  imageAlt="Product"
  title="Product Name"
  price="49.90 €"
  oldPrice="59.90 €"
  stock="in-stock"
  ctaLabel="Add to Cart"
  onCtaClick={() => console.log('clicked')}
/>
```

**Caractéristiques :**
- ✅ Variants CVA (default, outlined, elevated, flat)
- ✅ Density (compact, comfy, spacious)
- ✅ Testé E2E (Playwright)
- ✅ Partagé dans monorepo
- ❌ Pas optimisé conversion e-commerce
- ❌ Pas de Design System couleurs métier

---

### 3️⃣ E-Commerce Production (`~/components/ecommerce/ProductCard`)

**Quand utiliser :** ⭐ **RECOMMANDÉ pour production**
- Pages catalogue produits
- Résultats de recherche
- Pages catégories
- Grilles produits
- Fiches produits recommandées

**Import :**
```tsx
import { ProductCard } from '~/components/ecommerce/ProductCard';
```

**Exemple :**
```tsx
<ProductCard
  id="plaquettes-frein-001"
  name="Plaquettes de frein avant"
  description="Plaquettes haute performance"
  oemRef="7701208265"
  imageUrl="/images/plaquettes.jpg"
  imageAlt="Plaquettes de frein"
  price={45.90}
  originalPrice={55.90}
  discountPercent={18}
  stockStatus="in-stock"
  stockQuantity={15}
  isCompatible={true}
  compatibilityNote="Compatible Renault Clio 4"
  onAddToCart={(id) => addToCart(id)}
  onImageClick={(id) => navigate(`/products/${id}`)}
  compactMode={false}
  showDescription={true}
  showCompatibility={true}
/>
```

**Caractéristiques :**
- ✅ **Optimisé conversion** (CTA unique Primary rouge)
- ✅ **Image zoom** au hover
- ✅ **Badge stock** dynamique (Success/Warning/Error)
- ✅ **Référence OEM** Roboto Mono (précision)
- ✅ **Prix + remise** claire
- ✅ **Design System 100%** (couleurs métier, typo, spacing 8px)
- ✅ **Compatibilité véhicule** affichée
- ✅ **Mode compact** pour grilles
- ✅ **Animation** ajout panier

---

### 4️⃣ Exemples Design System (`~/components/examples/ProductCardExample`)

**Quand utiliser :**
- Page `/design-system` uniquement
- Documentation Design System
- Showcase pédagogique
- Démonstration intégration couleurs/typo/spacing

**Import :**
```tsx
import { ProductCardExample } from '~/components/examples/ProductCardExample';
```

**Exemple :**
```tsx
<ProductCardExample
  name="Plaquettes de frein"
  oemRef="7701208265"
  price={45.90}
  compatible={true}
  stock="En stock"
  delayed={false}
/>
```

**Caractéristiques :**
- ✅ Pédagogique (commentaires explicatifs)
- ✅ Démontre Design System
- ✅ Simple et clair
- ❌ Ne PAS utiliser en production
- ❌ Props limitées

---

## 🔀 Cas d'Usage Comparés

| Contexte | Composant à Utiliser | Import |
|----------|---------------------|--------|
| **Page profil utilisateur** | Primitif Card | `~/components/ui/card` |
| **Dashboard stats** | Primitif Card | `~/components/ui/card` |
| **Formulaire inscription** | Primitif Card | `~/components/ui/card` |
| **Page /ui-kit** | UI Kit ProductCard | `@fafa/ui` |
| **Tests E2E visuels** | UI Kit ProductCard | `@fafa/ui` |
| **Catalogue produits** ⭐ | E-commerce ProductCard | `~/components/ecommerce/ProductCard` |
| **Résultats recherche** ⭐ | E-commerce ProductCard | `~/components/ecommerce/ProductCard` |
| **Page catégorie** ⭐ | E-commerce ProductCard | `~/components/ecommerce/ProductCard` |
| **Grille homepage** ⭐ | E-commerce ProductCard | `~/components/ecommerce/ProductCard` |
| **Page /design-system** | ProductCardExample | `~/components/examples/ProductCardExample` |

---

## ⚡ Quick Start

### Cas 1: Page Catalogue Produits

```tsx
// app/routes/products.catalog.tsx
import { ProductCard } from '~/components/ecommerce/ProductCard';

export default function CatalogPage() {
  const products = useLoaderData<typeof loader>();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={product.id}
          name={product.name}
          oemRef={product.oemRef}
          imageUrl={product.imageUrl}
          imageAlt={product.name}
          price={product.price}
          originalPrice={product.originalPrice}
          stockStatus={product.stockStatus}
          isCompatible={product.isCompatible}
          onAddToCart={handleAddToCart}
          onImageClick={handleViewDetails}
        />
      ))}
    </div>
  );
}
```

### Cas 2: Dashboard Utilisateur

```tsx
// app/routes/account.dashboard.tsx
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Commandes Récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderList />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Véhicule Configuré</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleInfo />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Cas 3: Page UI Kit

```tsx
// app/routes/ui-kit.components.tsx
import { ProductCard } from '@fafa/ui';

export default function UIKitPage() {
  return (
    <section>
      <h2>ProductCard Variants</h2>
      
      <div className="grid grid-cols-3 gap-4">
        <ProductCard variant="default" {...props} />
        <ProductCard variant="outlined" {...props} />
        <ProductCard variant="elevated" {...props} />
      </div>
    </section>
  );
}
```

---

## 🚨 Erreurs Courantes

### ❌ ERREUR 1: Mauvais import pour catalogue

```tsx
// ❌ MAUVAIS (UI Kit pas optimisé conversion)
import { ProductCard } from '@fafa/ui';

<ProductCard variant="default" title="Product" price="49.90€" />
```

```tsx
// ✅ BON (E-commerce optimisé)
import { ProductCard } from '~/components/ecommerce/ProductCard';

<ProductCard
  id="prod-123"
  name="Product"
  price={49.90}
  stockStatus="in-stock"
  onAddToCart={handleAdd}
/>
```

---

### ❌ ERREUR 2: Utiliser ProductCardExample en production

```tsx
// ❌ MAUVAIS (Example = doc uniquement)
import { ProductCardExample } from '~/components/examples/ProductCardExample';

// Page catalogue
<ProductCardExample name="Product" price={49.90} />
```

```tsx
// ✅ BON
import { ProductCard } from '~/components/ecommerce/ProductCard';

<ProductCard id="prod-123" name="Product" price={49.90} stockStatus="in-stock" />
```

---

### ❌ ERREUR 3: Utiliser Card primitif pour produits

```tsx
// ❌ MAUVAIS (Trop basique, pas optimisé)
import { Card, CardContent } from '~/components/ui/card';

<Card>
  <CardContent>
    <img src="/product.jpg" />
    <h3>Product Name</h3>
    <p>49.90 €</p>
    <button>Add to Cart</button>
  </CardContent>
</Card>
```

```tsx
// ✅ BON (Composant dédié avec toutes les features)
import { ProductCard } from '~/components/ecommerce/ProductCard';

<ProductCard {...productProps} />
```

---

## 📊 Récapitulatif

| Composant | Fichier | Usage | Production ? |
|-----------|---------|-------|--------------|
| **Card** | `ui/card.tsx` | Générique | ✅ Oui |
| **ProductCard (UI Kit)** | `packages/ui/product-card.tsx` | Showcase | ⚠️ UI Kit uniquement |
| **ProductCard (E-commerce)** | `ecommerce/ProductCard.tsx` | Produits | ✅ **OUI** ⭐ |
| **ProductCardExample** | `examples/ProductCardExample.tsx` | Doc | ❌ Non |

---

## 🎯 Règle d'Or

```
Si vous affichez un PRODUIT E-COMMERCE en production
→ Utilisez TOUJOURS ~/components/ecommerce/ProductCard

Si vous créez un composant générique (profil, dashboard)
→ Utilisez ~/components/ui/card

Si vous êtes sur /ui-kit ou faites des tests
→ Utilisez @fafa/ui ProductCard

Si vous documentez le Design System
→ Utilisez ~/components/examples/ProductCardExample
```

---

**Version:** 1.0  
**Dernière mise à jour:** 24 octobre 2025  
**Auteur:** Design System Team
