# Layout Rules - Automecanik UI

Ce document définit les règles de layout obligatoires pour maintenir la qualité responsive du site.

---

## Breakpoints Tailwind (officiels)

| Token | Min-width | Usage | Trafic |
|-------|-----------|-------|--------|
| `sm:` | 640px | Phablets, petits mobiles landscape | ~5% |
| `md:` | 768px | Tablettes portrait, grands mobiles | ~15% |
| `lg:` | 1024px | Tablettes landscape, petits laptops | ~20% |
| `xl:` | 1280px | Desktop standard | ~40% |
| `2xl:` | 1536px | Grands écrans | ~20% |

### Viewports de test prioritaires

```typescript
const viewports = {
  iphoneSE: { width: 320, height: 568 },   // Crash test - overflow detection
  android: { width: 360, height: 800 },     // Android courant (~40%)
  iphone: { width: 390, height: 844 },      // iPhone 12-14 (~25%)
  ipad: { width: 768, height: 1024 },       // iPad portrait (~10%)
  laptop: { width: 1280, height: 720 },     // Petit laptop (~10%)
  desktop: { width: 1440, height: 900 },    // Desktop standard (~15%)
};
```

---

## Classes INTERDITES

### `w-screen` - JAMAIS

```tsx
// ❌ INTERDIT - Provoque scroll horizontal
<div className="w-screen">

// ✅ CORRECT - Utiliser w-full avec overflow contrôlé
<div className="w-full">
```

**Raison:** `w-screen` = 100vw inclut la scrollbar, provoquant un dépassement.

### `absolute` sans parent `relative`

```tsx
// ❌ INTERDIT - Position non contrôlée
<div>
  <span className="absolute top-0">Badge</span>
</div>

// ✅ CORRECT - Parent explicite
<div className="relative">
  <span className="absolute top-0">Badge</span>
</div>
```

### `fixed` sans `z-index` explicite

```tsx
// ❌ INTERDIT - Z-index implicite = bugs de superposition
<div className="fixed bottom-0">

// ✅ CORRECT - Z-index explicite
<div className="fixed bottom-0 z-50">
```

### Padding horizontal excessif sans responsive

```tsx
// ❌ INTERDIT - px-8 sans mobile fallback
<div className="px-8">

// ✅ CORRECT - Mobile-first progressive
<div className="px-4 sm:px-6 lg:px-8">
```

---

## Patterns OBLIGATOIRES

### 1. Container max-width

Tous les conteneurs principaux doivent utiliser:

```tsx
// Pattern standard
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {children}
</div>

// OU utiliser le composant Container
import { Container } from "~/components/layout/Container";
<Container>{children}</Container>
```

### 2. Touch targets WCAG

Tous les éléments interactifs (boutons, liens, inputs) doivent avoir:

```tsx
// Minimum 44x44px (WCAG AAA)
<button className="min-h-[44px] min-w-[44px]">

// Pour les boutons principaux: 48px recommandé
<button className="min-h-[48px] px-6 py-3">
```

### 3. Grilles responsive

```tsx
// Pattern mobile-first obligatoire
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// OU utiliser ResponsiveGrid
import { ResponsiveGrid } from "~/components/layout/ResponsiveGrid";
<ResponsiveGrid cols={{ sm: 1, md: 2, lg: 3 }}>{children}</ResponsiveGrid>
```

### 4. Overflow body

Le fichier `global.css` DOIT contenir:

```css
html, body {
  overflow-x: hidden;
}
```

### 5. Images responsive

```tsx
// Toujours avec aspect-ratio et object-fit
<img
  className="w-full aspect-square object-cover"
  loading="lazy"
  alt="Description"
/>
```

---

## Composants Layout à utiliser

| Composant | Usage | Import |
|-----------|-------|--------|
| `Container` | Wrapper max-width centré | `~/components/layout/Container` |
| `ResponsiveGrid` | Grille adaptive | `~/components/layout/ResponsiveGrid` |
| `Stack` | Espacement vertical | `~/components/layout/Stack` |

### Exemples

```tsx
import { Container } from "~/components/layout/Container";
import { ResponsiveGrid } from "~/components/layout/ResponsiveGrid";

export function ProductListing() {
  return (
    <Container>
      <h1>Produits</h1>
      <ResponsiveGrid cols={{ sm: 1, md: 2, lg: 3, xl: 4 }}>
        {products.map(p => <ProductCard key={p.id} {...p} />)}
      </ResponsiveGrid>
    </Container>
  );
}
```

---

## Tests automatisés

Les règles sont vérifiées par:

1. **ESLint** - Refuse `w-screen` dans className
2. **Playwright E2E** - Vérifie absence de scroll horizontal sur 6 viewports
3. **CI/CD** - Bloque le déploiement si tests échouent

### Commandes de test

```bash
# Test scroll horizontal sur tous viewports
npm run test:critical

# Test mobile spécifique
npm run test:mobile

# Lint UI custom
npm run lint:ui
```

---

## Checklist avant PR

- [ ] Pas de `w-screen` dans le code
- [ ] Tous les `absolute` ont un parent `relative`
- [ ] Tous les `fixed` ont un `z-index`
- [ ] Touch targets >= 44px
- [ ] Grilles sont responsive (grid-cols-1 sm:grid-cols-2...)
- [ ] Paddings horizontaux sont progressifs (px-4 sm:px-6...)
- [ ] Images ont `aspect-ratio` et `object-fit`
- [ ] Test sur viewport 320px (iPhone SE) sans scroll horizontal
