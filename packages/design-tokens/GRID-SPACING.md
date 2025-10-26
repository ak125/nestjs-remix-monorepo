# 📐 Système de Grille & Espacement

## ✅ Système 8px Grid + Spacings Fluides

**Grille de base:** 8px (avec exception 4px pour `xs`)  
**Tokens totaux:** 92 (23 spacing fixes + 11 spacing fluides + 18 layout)  
**Responsive:** 4/8/12/16 colonnes selon breakpoint

---

## 🔢 Espacement Fixe (8px Grid)

### Valeurs Disponibles

| Token | Valeur | Pixels | Usage Recommandé |
|-------|--------|--------|------------------|
| `xs`  | 4px    | 4px    | Espacement minimal, fine-tuning |
| `sm`  | 8px    | 8px    | Base 8px grid, spacing serré |
| `md`  | 16px   | 16px   | Espacement standard (boutons, cards) |
| `lg`  | 24px   | 24px   | Espacement confortable (sections) |
| `xl`  | 32px   | 32px   | Espacement large (entre blocs) |
| `2xl` | 40px   | 40px   | Grande séparation |
| `3xl` | 48px   | 48px   | Très grande séparation |
| `4xl` | 64px   | 64px   | Section spacing |
| `5xl` | 80px   | 80px   | Large section spacing |
| `6xl` | 96px   | 96px   | Hero spacing, grandes sections |

### Utilisation CSS

```css
/* Padding */
.element {
  padding: var(--spacing-md);           /* 16px */
  padding-top: var(--spacing-lg);       /* 24px */
  padding-bottom: var(--spacing-xl);    /* 32px */
}

/* Margin */
.section {
  margin-bottom: var(--spacing-4xl);    /* 64px */
}

/* Gap (Flexbox/Grid) */
.grid {
  gap: var(--spacing-lg);               /* 24px */
}
```

### Utilities Classes

```html
<!-- Padding -->
<div class="p-space-md">Padding 16px</div>
<div class="px-space-lg">Padding horizontal 24px</div>
<div class="py-space-xl">Padding vertical 32px</div>

<!-- Margin -->
<div class="m-space-lg">Margin 24px</div>
<div class="mx-space-xl">Margin horizontal 32px</div>
<div class="my-space-4xl">Margin vertical 64px</div>

<!-- Gap -->
<div class="gap-space-md">Gap 16px pour flex/grid</div>
```

---

## ✨ Espacement Fluide (Responsive avec clamp)

Ces espacements s'adaptent **automatiquement** à la taille de l'écran sans media queries.

### Sections (Vertical Spacing)

| Token | Formule | Min (Mobile) | Max (Desktop) | Usage |
|-------|---------|--------------|---------------|-------|
| `section-xs` | `clamp(1.5rem, 4vw, 2rem)` | 24px | 32px | Petites sections |
| `section-sm` | `clamp(2rem, 5vw, 3rem)` | 32px | 48px | Sections standard |
| `section-md` | `clamp(3rem, 6vw, 4rem)` | 48px | 64px | Sections moyennes |
| `section-lg` | `clamp(4rem, 8vw, 6rem)` | 64px | 96px | Grandes sections |
| `section-xl` | `clamp(6rem, 10vw, 8rem)` | 96px | 128px | Très grandes sections |
| `section-2xl` | `clamp(8rem, 12vw, 10rem)` | 128px | 160px | Hero sections |

### Gaps (Flexbox/Grid Spacing)

| Token | Formule | Min | Max | Usage |
|-------|---------|-----|-----|-------|
| `gap-xs` | `clamp(0.5rem, 1vw, 0.75rem)` | 8px | 12px | Gap serré |
| `gap-sm` | `clamp(0.75rem, 1.5vw, 1rem)` | 12px | 16px | Gap petit |
| `gap-md` | `clamp(1rem, 2vw, 1.5rem)` | 16px | 24px | Gap moyen |
| `gap-lg` | `clamp(1.5rem, 2.5vw, 2rem)` | 24px | 32px | Gap large |
| `gap-xl` | `clamp(2rem, 3vw, 2.5rem)` | 32px | 40px | Gap très large |

### Utilisation CSS

```css
/* Sections verticales */
.section {
  padding-top: var(--spacing-fluid-section-lg);
  padding-bottom: var(--spacing-fluid-section-lg);
}

/* Hero section */
.hero {
  padding-top: var(--spacing-fluid-section-xl);
  padding-bottom: var(--spacing-fluid-section-xl);
}

/* Gap responsive */
.card-grid {
  display: grid;
  gap: var(--spacing-fluid-gap-md);
}
```

### Utilities Classes

```html
<!-- Sections -->
<section class="py-section-lg">
  <div class="container">Grande section avec spacing fluide</div>
</section>

<section class="py-section-xl">
  <div class="container">Hero section</div>
</section>

<!-- Gaps -->
<div class="gap-gap-md">Gap fluide moyen</div>
<div class="gap-gap-lg">Gap fluide large</div>
```

---

## 📦 Container System

### Max-Widths Responsive

| Classe | Max-Width | Usage Typique |
|--------|-----------|---------------|
| `container-sm` | 640px | Mobile landscape |
| `container-md` | 768px | Tablet portrait |
| `container-lg` | 1024px | Tablet landscape / Small desktop |
| `container-xl` | 1280px | Desktop |
| `container-2xl` | 1536px | Large desktop |
| `container-full` | 100% | Full width |

### Container Responsive Automatique

La classe `.container` s'adapte automatiquement aux breakpoints :

```html
<div class="container">
  <!-- Max-width automatique selon breakpoint -->
  <!-- Mobile: 100% -->
  <!-- ≥640px: 640px -->
  <!-- ≥768px: 768px -->
  <!-- ≥1024px: 1024px -->
  <!-- ≥1280px: 1280px -->
  <!-- ≥1536px: 1536px -->
</div>
```

### Container Fixe

```html
<!-- Force un max-width spécifique -->
<div class="container-lg">Max 1024px sur tous les écrans</div>
<div class="container-xl">Max 1280px sur tous les écrans</div>
```

### CSS Variables

```css
.custom-container {
  max-width: var(--container-xl);  /* 1280px */
  margin: 0 auto;
  padding: 0 var(--spacing-md);
}
```

---

## 🎯 Grid System Responsive

### Colonnes par Breakpoint

| Breakpoint | Colonnes | Gutter | Classe CSS |
|------------|----------|--------|------------|
| Mobile (< 640px) | 4 | 16px (1rem) | `.grid-container` |
| Tablet (640-1024px) | 8 | 24px (1.5rem) | `.grid-container` |
| Desktop (1024-1440px) | 12 | 32px (2rem) | `.grid-container` |
| Wide (≥ 1440px) | 16 | 32px (2rem) | `.grid-container-wide` |

### Grid Container de Base

```html
<div class="grid-container">
  <!-- Grille responsive automatique -->
  <!-- Mobile: 4 colonnes, gutter 16px -->
  <!-- Tablet: 8 colonnes, gutter 24px -->
  <!-- Desktop: 12 colonnes, gutter 32px -->
</div>
```

### Column Spans

Disponibles de 1 à 16 colonnes :

```html
<div class="grid-container">
  <!-- Full width -->
  <div class="col-span-12">Full width sur desktop (12 cols)</div>
  
  <!-- Half width -->
  <div class="col-span-6">Half width sur desktop (6 cols)</div>
  <div class="col-span-6">Half width sur desktop (6 cols)</div>
  
  <!-- Third -->
  <div class="col-span-4">1/3 width (4 cols)</div>
  <div class="col-span-4">1/3 width (4 cols)</div>
  <div class="col-span-4">1/3 width (4 cols)</div>
  
  <!-- Quarter -->
  <div class="col-span-3">1/4 width (3 cols)</div>
  <div class="col-span-3">1/4 width (3 cols)</div>
  <div class="col-span-3">1/4 width (3 cols)</div>
  <div class="col-span-3">1/4 width (3 cols)</div>
</div>
```

### Grid Responsive avec Tailwind

```html
<div class="grid-container">
  <!-- Responsive column spans -->
  <div class="col-span-12 md:col-span-6 lg:col-span-4">
    <!-- Mobile: full width (12/12) -->
    <!-- Tablet: half width (6/8) -->
    <!-- Desktop: third width (4/12) -->
  </div>
</div>
```

### Row Spans

```html
<div class="grid-container">
  <div class="col-span-6 row-span-2">Tall item (2 rows)</div>
  <div class="col-span-6 row-span-1">Normal height</div>
  <div class="col-span-6 row-span-1">Normal height</div>
</div>
```

### CSS Variables Grid

```css
/* Personnaliser la grille */
.custom-grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns-desktop), 1fr);
  gap: var(--grid-gutter-desktop);
}

/* Colonnes personnalisées */
.custom-grid-wide {
  grid-template-columns: repeat(var(--grid-columns-wide), 1fr);
}
```

---

## 🎨 Exemples Complets

### 1. Layout de Page Standard

```html
<div class="py-section-lg">
  <div class="container">
    <h1 class="mb-space-lg">Page Title</h1>
    
    <div class="grid-container gap-gap-lg">
      <div class="col-span-12 lg:col-span-8">
        <!-- Main content -->
        <article class="mb-section-md">Content</article>
      </div>
      
      <aside class="col-span-12 lg:col-span-4">
        <!-- Sidebar -->
        <div class="mb-space-xl">Sidebar widget</div>
      </aside>
    </div>
  </div>
</div>
```

### 2. Card Grid Responsive

```html
<section class="py-section-xl bg-gray-50">
  <div class="container">
    <h2 class="mb-section-sm">Featured Products</h2>
    
    <div class="grid-container gap-gap-md">
      <!-- Cards adapt automatically -->
      <div class="col-span-12 md:col-span-4 lg:col-span-3">
        <div class="bg-white rounded-lg shadow-lg p-space-lg">
          <!-- Card content -->
        </div>
      </div>
      <!-- Repeat... -->
    </div>
  </div>
</section>
```

### 3. Hero Section avec Spacing Fluide

```html
<section class="py-section-2xl bg-gradient-to-r from-blue-600 to-purple-600">
  <div class="container-xl">
    <div class="grid-container gap-gap-xl">
      <div class="col-span-12 lg:col-span-6">
        <h1 class="mb-space-xl">Hero Title</h1>
        <p class="mb-space-2xl">Description</p>
        <button>CTA Button</button>
      </div>
      
      <div class="col-span-12 lg:col-span-6">
        <!-- Hero image -->
      </div>
    </div>
  </div>
</section>
```

### 4. Dashboard Layout (16 colonnes sur wide)

```html
<div class="container-2xl">
  <div class="grid-container-wide gap-gap-lg">
    <!-- Sidebar -->
    <aside class="col-span-4 lg:col-span-3 2xl:col-span-2">
      Navigation
    </aside>
    
    <!-- Main content -->
    <main class="col-span-8 lg:col-span-9 2xl:col-span-12">
      Dashboard widgets
    </main>
    
    <!-- Right sidebar (only on very wide screens) -->
    <aside class="hidden 2xl:block 2xl:col-span-2">
      Activity feed
    </aside>
  </div>
</div>
```

---

## 📊 Breakpoints Reference

| Nom | Valeur | Usage |
|-----|--------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet portrait |
| `lg` | 1024px | Tablet landscape / Small desktop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

**CSS Variables:**
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

**Media Queries:**
```css
@media (min-width: var(--breakpoint-sm)) { /* Tablet+ */ }
@media (min-width: var(--breakpoint-md)) { /* Tablet portrait+ */ }
@media (min-width: var(--breakpoint-lg)) { /* Desktop+ */ }
@media (min-width: var(--breakpoint-xl)) { /* Large desktop+ */ }
@media (min-width: var(--breakpoint-2xl)) { /* XL desktop+ */ }
```

---

## ✅ Bonnes Pratiques

### ✅ DO

1. **Utiliser les spacings fluides pour les sections**
   ```html
   <section class="py-section-lg">
     <!-- S'adapte automatiquement mobile → desktop -->
   </section>
   ```

2. **Utiliser la grille responsive pour les layouts**
   ```html
   <div class="grid-container">
     <div class="col-span-12 md:col-span-6 lg:col-span-4">
       <!-- Responsive automatique -->
     </div>
   </div>
   ```

3. **Combiner container + grid**
   ```html
   <section class="py-section-xl">
     <div class="container">
       <div class="grid-container gap-gap-md">
         <!-- Grille centrée avec max-width -->
       </div>
     </div>
   </section>
   ```

4. **Respecter la grille 8px pour les petits spacings**
   ```css
   .button {
     padding: var(--spacing-sm) var(--spacing-md);  /* 8px 16px */
   }
   ```

### ❌ DON'T

1. **Ne pas mélanger pixels fixes et tokens**
   ```css
   /* ❌ Mauvais */
   .element {
     padding: 23px;  /* Pas dans la grille 8px */
   }
   
   /* ✅ Bon */
   .element {
     padding: var(--spacing-lg);  /* 24px (8px × 3) */
   }
   ```

2. **Ne pas ignorer les breakpoints du système**
   ```css
   /* ❌ Mauvais */
   @media (min-width: 900px) { /* Breakpoint arbitraire */ }
   
   /* ✅ Bon */
   @media (min-width: var(--breakpoint-lg)) { /* 1024px */ }
   ```

3. **Ne pas recréer un grid custom sans raison**
   ```html
   <!-- ❌ Mauvais -->
   <div style="display: grid; grid-template-columns: repeat(12, 1fr);">
   
   <!-- ✅ Bon -->
   <div class="grid-container">
   ```

---

## 🚀 Migration depuis l'ancien système

### Mapping des spacings

| Ancien | Nouveau | Notes |
|--------|---------|-------|
| `spacing-3` (12px) | ❌ Retiré | Non conforme 8px grid |
| `spacing-5` (20px) | ❌ Retiré | Non conforme 8px grid |
| `spacing-md` | `spacing-md` | ✅ Inchangé (16px) |
| Section spacings fixes | `spacing-fluid-section-*` | ✅ Maintenant responsive |

### Migration automatique

```bash
# Remplacer les anciens tokens
sed -i 's/spacing-3/spacing-sm/g' **/*.css
sed -i 's/spacing-5/spacing-lg/g' **/*.css
```

---

## 📖 Ressources

- [8-Point Grid System](https://spec.fm/specifics/8-pt-grid)
- [CSS clamp() for Responsive Spacing](https://web.dev/min-max-clamp/)
- [CSS Grid Layout Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)

---

**Dernière mise à jour:** $(date +%Y-%m-%d)  
**Tokens totaux:** 92 (23 + 11 + 18 + autres)  
**Conformité:** 8px grid (sauf xs: 4px)  
**Responsive:** clamp() + media queries
