# 📱 Mobile-First Architecture Guide

## 🎯 Principe Mobile-First

**Toujours commencer par le mobile, puis enrichir pour desktop.**

### ✅ Philosophie

```
Mobile (Base) → Tablette (md:) → Desktop (lg:) → Large Desktop (xl:)
```

---

## 🏗️ Patterns Mobile-First

### ✅ Pattern 1 : Layouts & Grids

```tsx
// ✅ BON - Mobile-first
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {/* 1 colonne mobile → 2 tablette → 3 desktop → 4 large */}
</div>

// ✅ BON - Flex mobile-first
<div className="flex flex-col md:flex-row">
  {/* Vertical mobile → Horizontal desktop */}
</div>

// ❌ MAUVAIS - Desktop-first
<div className="grid grid-cols-4 md:grid-cols-2 sm:grid-cols-1">
  {/* Commence par 4 colonnes = desktop-first */}
</div>
```

### ✅ Pattern 2 : Spacing & Sizes

```tsx
// ✅ BON - Petits espaces mobile → grands desktop
<div className="p-4 md:p-6 lg:p-8">
<div className="gap-2 md:gap-4 lg:gap-6">
<div className="py-12 md:py-16 lg:py-20">

// ✅ BON - Petites tailles mobile → grandes desktop
<h1 className="text-2xl md:text-3xl lg:text-4xl">
<div className="w-full md:w-3/4 lg:w-1/2">

// ❌ MAUVAIS - Desktop-first
<div className="p-8 md:p-6 sm:p-4">
  {/* Commence par grande taille */}
</div>
```

### ⚠️ Pattern 3 : Visibilité (Cas Spécial)

**Problème** : `hidden lg:flex` est techniquement **desktop-first** mais souvent nécessaire.

```tsx
// ⚠️ CAS SPÉCIAL - Acceptable pour navigation
<div className="lg:hidden">
  {/* Menu mobile - visible mobile, caché desktop */}
  <MobileMenu />
</div>

<div className="hidden lg:flex">
  {/* Menu desktop - caché mobile, visible desktop */}
  <DesktopMenu />
</div>
```

**Pourquoi c'est acceptable ?**
- Deux implémentations différentes (mobile vs desktop)
- Performance (pas de code mobile chargé sur desktop)
- UX différente entre mobile et desktop

**Alternative mobile-first pure** (moins performante) :
```tsx
// 🤔 MOBILE-FIRST PUR mais moins optimal
<div className="flex lg:hidden">
  <MobileMenu />
</div>

<div className="flex-col lg:flex-row lg:flex">
  <DesktopMenu />
</div>
```

### ✅ Pattern 4 : Responsive Images

```tsx
// ✅ BON - Petites images mobile → grandes desktop
<img 
  className="h-32 md:h-48 lg:h-64 w-full object-cover"
  src="/image.jpg"
  alt="..."
/>

// ✅ BON - srcset pour résolutions
<img
  src="/logo.webp"
  srcSet="/logo.webp 1x, /logo@2x.webp 2x"
  className="h-8 lg:h-12"
/>
```

---

## 📊 Breakpoints Tailwind

```tsx
// Breakpoints par défaut
sm:  640px   // Petit mobile landscape / Tablette portrait
md:  768px   // Tablette
lg:  1024px  // Desktop
xl:  1280px  // Large desktop
2xl: 1536px  // Très large desktop
```

### Ordre de Priorité

1. **Base (pas de préfixe)** : Mobile portrait (< 640px)
2. **sm:** : Mobile landscape / Petit tablette
3. **md:** : Tablette
4. **lg:** : Desktop
5. **xl:** : Large desktop
6. **2xl:** : Très large desktop

---

## 🎨 Exemples Concrets

### Exemple 1 : Card Produit

```tsx
// ✅ MOBILE-FIRST PARFAIT
<Card className="
  p-4 md:p-6 lg:p-8
  gap-3 md:gap-4 lg:gap-6
  grid grid-cols-1 md:grid-cols-2
  rounded-lg md:rounded-xl lg:rounded-2xl
">
  <img className="h-48 md:h-64 lg:h-80 w-full object-cover" />
  <div className="flex flex-col gap-2 md:gap-3">
    <h3 className="text-lg md:text-xl lg:text-2xl font-bold">Titre</h3>
    <p className="text-sm md:text-base text-neutral-600">Description</p>
    <Button className="w-full md:w-auto">CTA</Button>
  </div>
</Card>
```

### Exemple 2 : Hero Section

```tsx
// ✅ MOBILE-FIRST PARFAIT
<section className="
  relative overflow-hidden
  py-12 md:py-16 lg:py-24
  px-4 md:px-6 lg:px-8
  bg-gradient-to-br from-blue-950 to-purple-900
">
  <div className="container mx-auto">
    <h1 className="
      text-2xl md:text-3xl lg:text-4xl xl:text-5xl
      font-bold text-white
      mb-4 md:mb-6 lg:mb-8
      leading-tight
    ">
      Titre Principal
    </h1>
    
    <p className="
      text-base md:text-lg lg:text-xl
      text-white/80
      max-w-full md:max-w-2xl lg:max-w-3xl
      mb-6 md:mb-8
    ">
      Description du hero
    </p>
    
    <div className="
      flex flex-col md:flex-row
      gap-3 md:gap-4
      items-stretch md:items-center
    ">
      <Button className="w-full md:w-auto">CTA Primaire</Button>
      <Button variant="outline" className="w-full md:w-auto">CTA Secondaire</Button>
    </div>
  </div>
</section>
```

### Exemple 3 : Navigation

```tsx
// ⚠️ CAS SPÉCIAL - Double implémentation
<nav className="flex items-center justify-between px-4 lg:px-8">
  {/* Logo - Toujours visible */}
  <Logo className="h-8 lg:h-12" />
  
  {/* Mobile Menu - Visible mobile uniquement */}
  <div className="lg:hidden">
    <MobileMenuButton />
  </div>
  
  {/* Desktop Nav - Visible desktop uniquement */}
  <div className="hidden lg:flex items-center gap-6">
    <NavLink>Catalogue</NavLink>
    <NavLink>Marques</NavLink>
    <NavLink>Blog</NavLink>
  </div>
  
  {/* Actions - Responsive */}
  <div className="flex items-center gap-2 md:gap-4">
    <SearchButton />
    <CartButton />
    <UserButton />
  </div>
</nav>
```

### Exemple 4 : Grid de Produits

```tsx
// ✅ MOBILE-FIRST PARFAIT
<div className="
  grid
  grid-cols-1          /* 1 colonne mobile */
  sm:grid-cols-2       /* 2 colonnes petit écran */
  md:grid-cols-2       /* 2 colonnes tablette */
  lg:grid-cols-3       /* 3 colonnes desktop */
  xl:grid-cols-4       /* 4 colonnes large desktop */
  gap-4 md:gap-6 lg:gap-8
">
  {products.map(product => (
    <ProductCard key={product.id} product={product} />
  ))}
</div>
```

---

## 🚨 Anti-Patterns à Éviter

### ❌ Anti-Pattern 1 : Desktop-First Sizing

```tsx
// ❌ MAUVAIS
<div className="text-4xl md:text-3xl sm:text-2xl">
  {/* Commence par grande taille desktop */}
</div>

// ✅ BON
<div className="text-2xl md:text-3xl lg:text-4xl">
  {/* Commence par petite taille mobile */}
</div>
```

### ❌ Anti-Pattern 2 : Desktop-First Spacing

```tsx
// ❌ MAUVAIS
<div className="p-8 lg:p-6 md:p-4">
  {/* Espaces décroissants = desktop-first */}
</div>

// ✅ BON
<div className="p-4 md:p-6 lg:p-8">
  {/* Espaces croissants = mobile-first */}
</div>
```

### ❌ Anti-Pattern 3 : Desktop-First Grid

```tsx
// ❌ MAUVAIS
<div className="grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1">
  {/* Colonnes décroissantes = desktop-first */}
</div>

// ✅ BON
<div className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
  {/* Colonnes croissantes = mobile-first */}
</div>
```

### ❌ Anti-Pattern 4 : Widths Fixes

```tsx
// ❌ MAUVAIS
<div className="w-1/2 md:w-full">
  {/* Desktop width vers mobile = desktop-first */}
</div>

// ✅ BON
<div className="w-full md:w-3/4 lg:w-1/2">
  {/* Mobile full width vers desktop réduit */}
</div>
```

---

## 🧪 Checklist Mobile-First

Avant de commiter du code responsive :

- [ ] **Sizing** : Valeurs croissantes (petit → grand)
  - `text-sm md:text-base lg:text-lg`
  - `h-32 md:h-48 lg:h-64`
  
- [ ] **Spacing** : Valeurs croissantes (serré → large)
  - `p-4 md:p-6 lg:p-8`
  - `gap-2 md:gap-4 lg:gap-6`
  
- [ ] **Grid/Flex** : Colonnes croissantes (1 → 4)
  - `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
  - `flex-col md:flex-row`
  
- [ ] **Visibilité** : Cas spécial justifié
  - `hidden lg:flex` uniquement pour double implémentation
  
- [ ] **Test** : Vérifier sur vraies tailles d'écran
  - 375px (iPhone SE)
  - 768px (iPad)
  - 1280px (Desktop)
  - 1920px (Large desktop)

---

## 📏 Tableau de Conversion

| Propriété | Mobile (base) | Tablette (md:) | Desktop (lg:) |
|-----------|---------------|----------------|---------------|
| **Padding** | `p-4` | `md:p-6` | `lg:p-8` |
| **Gap** | `gap-2` | `md:gap-4` | `lg:gap-6` |
| **Text** | `text-base` | `md:text-lg` | `lg:text-xl` |
| **Heading** | `text-2xl` | `md:text-3xl` | `lg:text-4xl` |
| **Height** | `h-32` | `md:h-48` | `lg:h-64` |
| **Grid Cols** | `grid-cols-1` | `md:grid-cols-2` | `lg:grid-cols-3` |

---

## 🎯 Résumé

### Règle d'Or

```
Base (mobile) + Progressive Enhancement (desktop)
= Mobile-First ✅
```

### Patterns Corrects

1. ✅ Valeurs croissantes : `petit md:moyen lg:grand`
2. ✅ Colonnes croissantes : `1 md:2 lg:3 xl:4`
3. ✅ Flex direction : `flex-col md:flex-row`
4. ⚠️ Hidden/flex : Accepté pour double implémentation

### Test Rapide

Si vous pouvez lire votre code de gauche à droite et voir une progression mobile → desktop, c'est mobile-first ✅

```tsx
// ✅ MOBILE-FIRST - Lecture naturelle
text-sm    md:text-base    lg:text-lg    xl:text-xl
↑ mobile   ↑ tablette      ↑ desktop     ↑ large

// ❌ DESKTOP-FIRST - Lecture inversée
text-xl    lg:text-lg      md:text-base  sm:text-sm
↑ commence par desktop = MAUVAIS
```

---

**Créé le :** 10 novembre 2025  
**Version :** 1.0.0  
**Status :** 📐 Guide de référence
