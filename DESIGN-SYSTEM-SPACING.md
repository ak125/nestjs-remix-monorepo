# 📏 Design System : Système d'Espacement (8px Grid)

**Version:** 1.0  
**Date:** 24 octobre 2025

---

## 🎯 Principe Fondamental

**Toujours utiliser des multiples de 8px** pour garantir :
- ✅ Alignement pixel-perfect sur tous les écrans (HD, 2K, 4K)
- ✅ Cohérence visuelle sur l'ensemble de l'application
- ✅ Compatibilité avec Material Design et Apple HIG

---

## 📐 Échelle d'Espacement

### Valeurs Sémantiques

| Nom | Valeur | Utilisation | Exemples |
|-----|--------|-------------|----------|
| **XS** | `4px` | Micro-espaces | Padding badges, icônes, compteurs |
| **SM** | `8px` | Espacement serré | Vertical spacing entre label et input |
| **MD** | `16px` | Standard | Padding interne des cartes produit |
| **LG** | `24px` | Sections | Gap entre blocs de contenu |
| **XL** | `32px` | Grilles | Marges extérieures, gap grid produits |
| **2XL** | `40px` | Large | Hero sections, espacement entre sections majeures |
| **3XL** | `48px` | Extra large | Landing pages, headers majeurs |
| **4XL** | `64px` | Maximum | Espacement exceptionnel |

### Progression Logique

```
XS (4px) → SM (8px) → MD (16px) → LG (24px) → XL (32px) → 2XL (40px) → 3XL (48px)
   ×2        ×2          ×1.5        ×1.33       ×1.25        ×1.2
```

---

## 🛠️ Classes Tailwind Générées

### Padding

```tsx
className="p-xs"    // padding: 4px
className="p-sm"    // padding: 8px
className="p-md"    // padding: 16px
className="p-lg"    // padding: 24px
className="p-xl"    // padding: 32px
className="p-2xl"   // padding: 40px
className="p-3xl"   // padding: 48px
```

### Margin

```tsx
className="m-xs"    // margin: 4px
className="mt-sm"   // margin-top: 8px
className="mb-md"   // margin-bottom: 16px
className="ml-lg"   // margin-left: 24px
className="mr-xl"   // margin-right: 32px
```

### Gap (Flexbox / Grid)

```tsx
className="gap-xs"    // gap: 4px
className="gap-sm"    // gap: 8px
className="gap-md"    // gap: 16px
className="gap-lg"    // gap: 24px
className="gap-xl"    // gap: 32px
```

### Space Between

```tsx
className="space-x-sm"  // horizontal spacing: 8px
className="space-y-md"  // vertical spacing: 16px
className="space-y-lg"  // vertical spacing: 24px
```

---

## 📋 Usage par Contexte

### 1. **Badges / Icônes (XS - 4px)**

```tsx
// Badge compteur
<span className="bg-primary-500 text-white px-xs py-xs rounded-full text-xs">
  12
</span>

// Icône avec micro-padding
<div className="p-xs bg-neutral-100 rounded">
  <Icon size={16} />
</div>
```

**Quand utiliser :** Éléments compacts nécessitant un espacement minimal.

---

### 2. **Formulaires (SM - 8px)**

```tsx
// Label → Input
<div className="mb-sm">
  <label className="block mb-sm font-sans text-neutral-700">
    Référence OEM
  </label>
  <input 
    className="px-sm py-sm border rounded-md w-full" 
    placeholder="7701208265"
  />
</div>

// Groupe de boutons radio
<div className="space-y-sm">
  <label className="flex items-center gap-sm">
    <input type="radio" />
    <span>Option 1</span>
  </label>
  <label className="flex items-center gap-sm">
    <input type="radio" />
    <span>Option 2</span>
  </label>
</div>
```

**Quand utiliser :** Éléments de formulaire, espacement vertical serré.

---

### 3. **Cartes Produit (MD - 16px)**

```tsx
// Card avec padding standard
<div className="bg-white p-md rounded-lg shadow-md border border-neutral-200">
  {/* Image */}
  <img src="/piece.jpg" className="w-full rounded-md mb-md" />
  
  {/* Contenu */}
  <h3 className="font-heading text-lg font-semibold mb-sm">
    Plaquettes de frein avant
  </h3>
  
  <p className="font-sans text-sm text-neutral-600 mb-md">
    Compatible Renault Clio 4 (2012-2019)
  </p>
  
  {/* Badge */}
  <span className="inline-block bg-success text-white px-sm py-xs rounded-full text-xs mb-md">
    En stock
  </span>
  
  {/* Prix */}
  <div className="flex items-baseline justify-between mb-md">
    <span className="font-mono text-2xl font-bold">45,99 €</span>
    <span className="font-sans text-sm text-neutral-500">TTC</span>
  </div>
  
  {/* Action */}
  <button className="w-full bg-primary-500 text-white py-sm rounded-lg">
    Ajouter au panier
  </button>
</div>
```

**Quand utiliser :** Padding interne des composants, espacement entre éléments d'une même section.

---

### 4. **Sections / Blocs (LG - 24px)**

```tsx
// Espacement entre blocs de contenu
<section className="py-lg">
  <h2 className="font-heading text-2xl font-bold mb-lg">
    Nos meilleures ventes
  </h2>
  
  <div className="space-y-lg">
    <ProductCategory title="Freinage" />
    <ProductCategory title="Filtration" />
    <ProductCategory title="Éclairage" />
  </div>
</section>

// Grid de cartes avec gap
<div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
  <ProductCard />
  <ProductCard />
  <ProductCard />
</div>
```

**Quand utiliser :** Séparation de sections, gap dans les grilles de produits.

---

### 5. **Grilles / Marges Extérieures (XL - 32px)**

```tsx
// Container principal
<main className="max-w-7xl mx-auto px-xl py-xl">
  <h1 className="font-heading text-4xl font-bold mb-xl">
    Catalogue Pièces Auto
  </h1>
  
  <div className="grid grid-cols-1 lg:grid-cols-4 gap-xl">
    {/* Sidebar */}
    <aside className="lg:col-span-1">
      <FilterPanel />
    </aside>
    
    {/* Content */}
    <div className="lg:col-span-3">
      <ProductGrid />
    </div>
  </div>
</main>

// Sections majeures
<div className="space-y-xl">
  <HeroSection />
  <FeaturesSection />
  <TestimonialsSection />
</div>
```

**Quand utiliser :** Marges de page, gap entre sections majeures.

---

### 6. **Hero Sections (2XL/3XL - 40px/48px)**

```tsx
// Hero landing page
<section className="py-3xl px-xl bg-gradient-to-r from-secondary-500 to-secondary-700">
  <div className="max-w-4xl mx-auto text-center">
    <h1 className="font-heading text-5xl font-extrabold text-white mb-2xl">
      + de 50 000 références en stock
    </h1>
    
    <p className="font-sans text-xl text-white/90 mb-3xl">
      Pièces automobiles neuves pour toutes marques
    </p>
    
    <button className="bg-primary-500 text-white px-xl py-lg rounded-lg text-lg font-heading">
      Voir le catalogue
    </button>
  </div>
</section>
```

**Quand utiliser :** Hero sections, landing pages, espacement exceptionnel.

---

## ✅ Bonnes Pratiques

### 1. **Utiliser les noms sémantiques**

```tsx
// ✅ CORRECT - Sémantique clair
<div className="p-md">...</div>

// ❌ ÉVITER - Valeur numérique ambiguë
<div className="p-4">...</div>
```

### 2. **Cohérence verticale**

```tsx
// ✅ CORRECT - Même espacement pour éléments similaires
<div className="space-y-md">
  <ProductCard />  {/* margin-bottom: 16px */}
  <ProductCard />  {/* margin-bottom: 16px */}
  <ProductCard />  {/* margin-bottom: 16px */}
</div>
```

### 3. **Respiration visuelle**

```tsx
// ✅ CORRECT - Espacement généreux pour faciliter la lecture
<article className="prose">
  <h2 className="mb-lg">Titre</h2>
  <p className="mb-md">Paragraphe 1</p>
  <p className="mb-md">Paragraphe 2</p>
</article>
```

### 4. **Mobile-first**

```tsx
// ✅ CORRECT - Adaptatif selon breakpoint
<div className="p-md lg:p-xl">
  {/* Padding 16px mobile, 32px desktop */}
</div>

<div className="grid gap-md lg:gap-xl">
  {/* Gap 16px mobile, 32px desktop */}
</div>
```

---

## ❌ Erreurs Courantes

### 1. **Valeurs arbitraires**

```tsx
// ❌ ÉVITER - Valeur ad-hoc
<div className="p-[13px]">...</div>

// ✅ CORRECT - Utiliser l'échelle
<div className="p-md">...</div>
```

### 2. **Valeurs non-multiples de 8**

```tsx
// ❌ ÉVITER - 12px (non-multiple de 8)
<div className="p-3">...</div>  // 0.75rem = 12px

// ✅ CORRECT - 16px (multiple de 8)
<div className="p-md">...</div>  // 16px
```

### 3. **Mélange des échelles**

```tsx
// ❌ ÉVITER - Incohérent
<div className="p-md">
  <h2 className="mb-3">Titre</h2>  {/* 12px */}
  <p className="mb-md">Texte</p>    {/* 16px */}
</div>

// ✅ CORRECT - Cohérent
<div className="p-md">
  <h2 className="mb-sm">Titre</h2>  {/* 8px */}
  <p className="mb-md">Texte</p>    {/* 16px */}
</div>
```

---

## 📊 Tableau Récapitulatif

| Contexte | Espacement | Exemple |
|----------|------------|---------|
| Badge / Icône | **XS (4px)** | `px-xs py-xs` |
| Label → Input | **SM (8px)** | `mb-sm` |
| Card padding | **MD (16px)** | `p-md` |
| Grid gap | **LG (24px)** | `gap-lg` |
| Section spacing | **XL (32px)** | `py-xl` |
| Hero section | **3XL (48px)** | `py-3xl` |

---

## 🔗 Ressources

- **Configuration Tailwind** : `frontend/tailwind.config.cjs`
- **Tokens Source** : `packages/design-tokens/src/tokens/design-tokens.json`
- **Exemples** : `frontend/app/components/examples/DesignSystemExamples.tsx`
- **Guide Usage** : `DESIGN-SYSTEM-USAGE-GUIDE.md`

---

## 📝 Notes Techniques

### Configuration Tailwind

```javascript
// frontend/tailwind.config.cjs
module.exports = {
  theme: {
    extend: {
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '40px',
        '3xl': '48px',
        '4xl': '64px'
      }
    }
  }
};
```

### Génération Automatique

Les classes sont générées par Tailwind JIT :
- `p-{size}` → padding
- `m-{size}` → margin
- `gap-{size}` → gap
- `space-{x|y}-{size}` → space between

---

**Version** : 1.0  
**Dernière mise à jour** : 24 octobre 2025  
**Auteur** : Design System Team
