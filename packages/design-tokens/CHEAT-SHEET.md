# 🎨 Design Tokens - Cheat Sheet

> Guide de référence ultra-rapide pour les développeurs pressés !

## 🚀 Quick Start (3 étapes)

```bash
# 1. Installer
npm install @fafa/design-tokens

# 2. Importer dans votre CSS global
@import '@fafa/design-tokens/utilities';

# 3. Utiliser !
<button className="bg-brand-500 text-white p-space-4 rounded-lg">
  Mon Bouton
</button>
```

---

## 🎨 Couleurs Sémantiques (À utiliser TOUJOURS en priorité!)

| Couleur | Usage | Exemple |
|---------|-------|---------|
| `action` | Boutons CTA principaux | `bg-[var(--color-semantic-action)]` |
| `info` | Navigation, liens | `bg-[var(--color-semantic-info)]` |
| `success` | Validations, confirmations | `bg-[var(--color-semantic-success)]` |
| `warning` | Avertissements | `bg-[var(--color-semantic-warning)]` |
| `danger` | Erreurs, suppressions | `bg-[var(--color-semantic-danger)]` |
| `neutral` | États neutres, disabled | `bg-[var(--color-semantic-neutral)]` |

**💡 Astuce :** Toujours utiliser avec `-contrast` pour le texte :
```tsx
<div className="bg-[var(--color-semantic-action)] text-[var(--color-semantic-action-contrast)]">
  CTA avec contraste optimal ✅
</div>
```

---

## 📏 Espacements (Grille 8px)

| Token | Valeur | Usage |
|-------|--------|-------|
| `spacing-xs` | 4px | Micro-espaces (badges) |
| `spacing-sm` | 8px | Serré (label → input) |
| `spacing-md` | 16px | **Standard (défaut)** |
| `spacing-lg` | 24px | Sections, blocs |
| `spacing-xl` | 32px | Grandes marges |
| `spacing-2xl` | 40px | Grilles larges |
| `spacing-3xl` | 48px | Hero sections |

**Utilisation avec classes :**
```tsx
<div className="p-space-md">      {/* Padding 16px */}
<div className="m-space-lg">      {/* Margin 24px */}
<div className="gap-space-sm">    {/* Gap 8px */}
```

---

## ✍️ Typographie

### Familles de Fonts

| Font | Usage | Classe |
|------|-------|--------|
| **Montserrat** | Titres, headers | `font-heading` |
| **Inter** | Texte standard | `font-sans` |
| **Roboto Mono** | Données techniques | `font-mono` |

### Tailles (Responsive recommandé!)

```tsx
{/* Fixe */}
<h1 className="text-3xl">Titre</h1>

{/* Responsive (recommandé) */}
<h1 className="text-[var(--font-size-fluid-3xl)]">
  Titre qui s'adapte
</h1>
```

---

## 🎭 Patterns Copy-Paste Ready

### Bouton CTA Principal
```tsx
<button className="
  bg-[var(--color-semantic-action)] 
  text-[var(--color-semantic-action-contrast)]
  px-6 py-3 
  rounded-lg 
  font-medium 
  shadow-md
  hover:shadow-lg
  transition-all
">
  Acheter maintenant
</button>
```

### Card Produit
```tsx
<div className="
  bg-white 
  p-space-6 
  rounded-xl 
  shadow-md 
  border border-neutral-200
  hover:shadow-lg
  transition-shadow
">
  <h3 className="font-heading text-xl font-bold mb-space-2">
    Titre
  </h3>
  <p className="text-neutral-600 mb-space-4">
    Description
  </p>
  <button className="w-full bg-[var(--color-semantic-action)] ...">
    Action
  </button>
</div>
```

### Alert Success
```tsx
<div className="
  bg-[var(--color-semantic-success)]
  text-[var(--color-semantic-success-contrast)]
  p-space-4
  rounded-lg
  shadow-sm
">
  ✅ Opération réussie !
</div>
```

### Badge
```tsx
<span className="
  bg-[var(--color-semantic-info)] 
  text-[var(--color-semantic-info-contrast)]
  px-3 py-1 
  rounded-full 
  text-sm 
  font-medium
">
  Info
</span>
```

---

## 🎨 Palettes de Couleurs

### Primary (Rouge) - 11 nuances
```
50  100  200  300  400  [500]  600  700  800  900  950
light ←                      → dark
```

**Utilisation :**
```tsx
<div className="bg-primary-50">    {/* Très clair */}
<div className="bg-primary-500">   {/* Couleur principale */}
<div className="bg-primary-950">   {/* Très foncé */}
```

### Secondary (Bleu) - 11 nuances
```
50  100  200  300  400  [500]  600  700  800  900  950
```

### Neutral (Gris) - 11 nuances
```
50  100  200  300  400  [500]  600  700  800  900  950
```

---

## 🛠️ Méthodes d'Utilisation

### 1️⃣ Classes Utilitaires (RECOMMANDÉ ⭐)
```tsx
<div className="bg-brand-500 text-white p-space-4 rounded-lg">
  Le plus simple !
</div>
```

### 2️⃣ CSS Variables
```css
.mon-composant {
  background: var(--color-primary-500);
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
}
```

### 3️⃣ TypeScript
```typescript
import { designTokens } from '@fafa/design-tokens';

const color = designTokens.colors.primary[500];
const spacing = designTokens.spacing[4];
```

---

## ✅ Checklist Avant de Coder

- [ ] Utiliser couleurs sémantiques (`action`, `info`, etc.)
- [ ] Utiliser grille 8px (`spacing-xs` à `spacing-3xl`)
- [ ] Utiliser bonnes fonts (`heading`, `sans`, `mono`)
- [ ] Toujours utiliser `-contrast` pour le texte
- [ ] Éviter valeurs hardcodées (#HEX, px)
- [ ] Tester dark mode
- [ ] Vérifier accessibilité

---

## ❌ À NE JAMAIS FAIRE

```tsx
// ❌ Valeur HEX en dur
<div style={{ color: '#FF3B30' }}>

// ❌ Padding hors grille
<div className="p-[23px]">

// ❌ Utiliser 'danger' pour un CTA
<button className="bg-danger">Acheter</button>

// ❌ Ignorer le contraste
<div className="bg-warning text-white"> {/* Mauvais contraste! */}
```

---

## ✅ À TOUJOURS FAIRE

```tsx
// ✅ Token sémantique
<div className="text-brand-500">

// ✅ Grille 8px
<div className="p-space-lg">

// ✅ 'action' pour CTA
<button className="bg-[var(--color-semantic-action)]">Acheter</button>

// ✅ Contraste auto
<div className="bg-[var(--color-semantic-warning)] text-[var(--color-semantic-warning-contrast)]">
```

---

## 🔧 Commandes Utiles

```bash
# Build tokens
cd packages/design-tokens && npm run build

# Dev mode avec watch
npm run dev

# Lancer l'app
npm run dev
```

---

## 📚 Ressources

- **Guide Complet :** [GUIDE-COMPLET.md](./GUIDE-COMPLET.md)
- **FAQ :** [FAQ.md](./FAQ.md)
- **Couleurs :** [COLOR-SYSTEM.md](./COLOR-SYSTEM.md)
- **UI Kit :** [/ui-kit](/ui-kit)
- **Dashboard Admin :** [/admin/design-system](/admin/design-system)

---

## 🎯 Résumé Ultra-Rapide

| Besoin | Solution |
|--------|----------|
| Bouton CTA | `bg-[var(--color-semantic-action)]` + `-contrast` |
| Lien | `text-[var(--color-semantic-info)]` |
| Message succès | `bg-[var(--color-semantic-success)]` + `-contrast` |
| Padding standard | `p-space-md` (16px) |
| Titre | `font-heading text-fluid-3xl` |
| Texte | `font-sans text-base` |
| Données | `font-mono text-sm` |
| Border radius | `rounded-lg` |
| Shadow | `shadow-md` |

---

**🎉 Vous êtes prêt ! Commencez à coder avec les tokens !**
