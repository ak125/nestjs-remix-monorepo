# 🎨 Guide d'Utilisation : CSS Utilities Sémantiques

## 📦 Installation

```bash
# Déjà inclus dans le monorepo
npm install @fafa/design-tokens
```

## 🚀 Import dans votre app

```css
/* frontend/app/global.css */
@import '@fafa/design-tokens/css';         /* CSS Variables */
@import '@fafa/design-tokens/utilities';   /* Classes sémantiques ✨ */
```

---

## 🎯 Exemples d'Utilisation

### ✅ AVANT (Classes Tailwind ad-hoc)

```typescript
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm">
  Ajouter au panier
</button>
```

**Problèmes** :
- ❌ Couleur hardcodée (`blue-600`)
- ❌ Pas de cohérence avec la marque
- ❌ Changement global impossible

---

### ✅ APRÈS (Classes sémantiques)

```typescript
<button className="bg-brand-600 hover:bg-brand-700 text-white px-space-4 py-space-2 rounded-md shadow-sm">
  Ajouter au panier
</button>
```

**Avantages** :
- ✅ Couleur brandée (`brand-600` = primary-600)
- ✅ Cohérence garantie
- ✅ Changement global facile (modifiez `design-tokens.json`)

---

## 📚 Catalogue des Classes

### 🎨 Couleurs

#### Primary (Brand)
```html
<!-- Backgrounds -->
<div className="bg-brand-50">Très clair</div>
<div className="bg-brand-500">Normal</div>
<div className="bg-brand-900">Très foncé</div>

<!-- Texte -->
<p className="text-brand-600">Texte brandé</p>

<!-- Bordures -->
<div className="border border-brand-500">Avec bordure</div>
```

#### Secondary
```html
<div className="bg-secondary-100 text-secondary-800">
  Fond secondaire clair
</div>
```

#### Accent (Couleurs custom)
```html
<div className="bg-khmer-curry">Accent khmerCurry (#ED5555)</div>
<div className="bg-persian-indigo">Accent persianIndigo (#350B60)</div>
<div className="bg-vert text-white">Accent vert (#1FDC93)</div>
```

#### Sémantiques
```html
<div className="bg-success text-white">Succès</div>
<div className="bg-error text-white">Erreur</div>
<div className="bg-warning text-white">Attention</div>
<div className="bg-info text-white">Info</div>
```

#### Neutral
```html
<div className="bg-white text-black">Blanc</div>
<div className="bg-iron">Iron (#EEEEEE)</div>
<div className="text-dark-iron">Dark Iron (#B0B0B0)</div>
```

---

### 📏 Spacing

```html
<!-- Padding -->
<div className="p-space-4">Padding 4 (1rem / 16px)</div>
<div className="px-space-6 py-space-2">Padding horizontal 6, vertical 2</div>

<!-- Margin -->
<div className="m-space-8">Margin 8 (2rem / 32px)</div>
<div className="mx-space-auto">Centré horizontalement</div>

<!-- Gap (Flexbox/Grid) -->
<div className="flex gap-space-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

**Échelle disponible** : `0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32`

---

### 🔲 Border Radius

```html
<div className="rounded-none">Pas de radius</div>
<div className="rounded-sm">Petit (0.125rem)</div>
<div className="rounded">Normal (0.25rem)</div>
<div className="rounded-md">Moyen (0.375rem)</div>
<div className="rounded-lg">Large (0.5rem)</div>
<div className="rounded-xl">Extra large (0.75rem)</div>
<div className="rounded-2xl">2XL (1rem)</div>
<div className="rounded-3xl">3XL (1.5rem)</div>
<div className="rounded-full">Cercle</div>
```

---

### 🌑 Shadows

```html
<div className="shadow-sm">Ombre subtle</div>
<div className="shadow">Ombre normale</div>
<div className="shadow-md">Ombre moyenne</div>
<div className="shadow-lg">Ombre large</div>
<div className="shadow-xl">Ombre extra large</div>
<div className="shadow-2xl">Ombre 2XL</div>
<div className="shadow-inner">Ombre intérieure</div>
<div className="shadow-none">Pas d'ombre</div>
```

---

### 📝 Typography

```html
<!-- Font Sizes -->
<p className="text-xs">Extra small (0.75rem)</p>
<p className="text-sm">Small (0.875rem)</p>
<p className="text-base">Base (1rem)</p>
<p className="text-lg">Large (1.125rem)</p>

<!-- Font Families -->
<p className="font-sans">Sans-serif</p>
<p className="font-mono">Monospace</p>
```

---

## 🔄 Migration Facile

### Avec Codemod (À venir)

```bash
npm run codemod:tokens
```

### Manuellement

| Tailwind Ad-hoc | Classes Sémantiques |
|-----------------|---------------------|
| `bg-blue-600` | `bg-brand-600` |
| `text-slate-700` | `text-secondary-700` |
| `p-4` | `p-space-4` |
| `rounded-md` | `rounded-md` ✅ (identique) |
| `shadow-lg` | `shadow-lg` ✅ (identique) |

---

## 💡 Bonnes Pratiques

### ✅ À FAIRE

```typescript
// Utiliser classes sémantiques
<div className="bg-brand-600 text-white p-space-4 rounded-lg">

// Combiner avec Tailwind standards
<div className="bg-brand-600 flex items-center justify-between">

// Responsive
<div className="bg-brand-600 md:bg-brand-700 lg:bg-brand-800">
```

### ❌ À ÉVITER

```typescript
// ❌ Couleurs hardcodées
<div className="bg-[#0284c7]">

// ❌ Valeurs arbitraires pour spacing existant
<div className="p-[16px]"> // Utiliser p-space-4 à la place

// ❌ Mixer tokens et valeurs ad-hoc
<div className="bg-brand-600 p-[20px]"> // Incohérent
```

---

## 🎨 Personnalisation Thème

Les classes sémantiques utilisent les **CSS Variables**, donc vous pouvez les overrider par thème :

```css
/* Dans @fafa/theme-automecanik */
:root {
  --color-primary-600: #ED5555; /* khmerCurry */
}

/* Dans @fafa/theme-admin */
:root {
  --color-primary-600: #350B60; /* persianIndigo */
}
```

**Résultat** : La même classe `.bg-brand-600` rend des couleurs différentes selon le thème actif ! 🎉

---

## 📊 Comparaison Taille Bundle

| Approche | Bundle Size | Avantages |
|----------|-------------|-----------|
| Inline styles | 0 KB | ❌ Pas de réutilisation |
| Tailwind JIT | ~5 KB | ✅ Tree-shaking |
| **Utilities CSS** | ~15 KB | ✅ Sémantique + tokens |

**Verdict** : +10 KB pour une **lisibilité ×10** et une **maintenabilité infinie**.

---

## 🚀 Prochaines Étapes

1. **Importer utilities.css** dans `frontend/app/global.css`
2. **Remplacer classes ad-hoc** par classes sémantiques
3. **Utiliser codemod** (quand disponible) pour migration automatique
4. **Profiter** de l'autocomplete IDE ! 🎉
