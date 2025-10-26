# 🎨 Guide d'Utilisation : Design System avec Couleurs Métier

**Version:** 2.0  
**Date:** 24 octobre 2025

---

## 🚀 Quick Start

### 1. Couleurs disponibles

| Couleur | Usage | Code HEX | Classe Tailwind |
|---------|-------|----------|-----------------|
| **Primary** | 🔴 **CTA / Actions** (Ajouter panier, Payer) | `#FF3B30` | `bg-primary-500` |
| **Secondary** | 🔵 **Navigation / Confiance** (Menu, liens) | `#0F4C81` | `bg-secondary-500` |
| **Success** | 🟢 **Validation** (Compatibilité, stock OK) | `#27AE60` | `bg-success` |
| **Warning** | 🟠 **Alerte** (Délai livraison, stock faible) | `#F39C12` | `bg-warning` |
| **Error** | 🔴 **Erreur** (Incompatibilité) | `#C0392B` | `bg-error` |
| **Neutral** | ⚪ **Fond/Texte** | `#F5F7FA` / `#212529` | `bg-neutral-50` |

---

## 📚 Exemples d'Utilisation

### ✅ Bouton CTA (Ajouter au panier)

```tsx
// ❌ AVANT (incorrect - couleur ad-hoc)
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
  Ajouter au panier
</button>

// ✅ APRÈS (correct - couleur métier)
<button className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-md">
  Ajouter au panier
</button>

// ✅ ALTERNATIVE (avec classes sémantiques)
<button className="bg-brand-500 hover:bg-brand-600 text-brand-500-contrast p-space-4 rounded-lg">
  Ajouter au panier
</button>
```

**Résultat** : Bouton rouge/orangé (#FF3B30) qui attire l'attention sur l'action principale.

---

### ✅ Lien Navigation

```tsx
// ❌ AVANT (incorrect - couleur action)
<a href="/pieces" className="text-primary-500 hover:underline">
  Voir toutes les pièces
</a>

// ✅ APRÈS (correct - couleur navigation)
<a href="/pieces" className="text-secondary-500 hover:text-secondary-600 hover:underline">
  Voir toutes les pièces
</a>
```

**Résultat** : Lien bleu acier (#0F4C81) qui inspire confiance.

---

### ✅ Badge Compatibilité (Success)

```tsx
// ❌ AVANT (incorrect - couleur générique)
<span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs">
  Compatible
</span>

// ✅ APRÈS (correct - sémantique)
<span className="bg-success text-white px-2 py-1 rounded-full text-xs">
  Compatible avec votre véhicule
</span>

// ✅ ALTERNATIVE (avec utilities)
<span className="bg-success text-success-contrast p-space-2 rounded-full text-xs">
  Compatible
</span>
```

**Résultat** : Badge vert mécanique (#27AE60) pour validation.

---

### ✅ Alerte Délai Livraison (Warning)

```tsx
// ❌ AVANT (incorrect - couleur erreur)
<div className="bg-red-500 text-white p-4 rounded-md">
  Livraison sous 5-7 jours
</div>

// ✅ APRÈS (correct - warning)
<div className="bg-warning text-black p-4 rounded-md flex items-center gap-2">
  <AlertIcon />
  <span>Livraison sous 5-7 jours</span>
</div>
```

**Résultat** : Alerte orange (#F39C12) qui informe sans alarmer.

---

### ✅ Message Incompatibilité (Error)

```tsx
// ❌ AVANT (incorrect - couleur warning)
<div className="bg-yellow-500 text-black p-4 rounded-md">
  Cette pièce n'est pas compatible avec votre véhicule
</div>

// ✅ APRÈS (correct - error)
<div className="bg-error text-white p-4 rounded-md flex items-center gap-2">
  <XCircleIcon />
  <span>Cette pièce n'est pas compatible avec votre véhicule</span>
</div>
```

**Résultat** : Erreur rouge sombre (#C0392B) claire et ferme.

---

### ✅ Card Produit

```tsx
// ✅ Exemple complet
<div className="bg-white border border-neutral-200 rounded-lg shadow-md p-space-6">
  {/* Image */}
  <img src="/piece.jpg" alt="Pièce" className="w-full rounded-md mb-space-4" />
  
  {/* Titre */}
  <h3 className="text-xl font-semibold text-neutral-900 mb-space-2">
    Plaquettes de frein avant
  </h3>
  
  {/* Badge compatibilité */}
  <span className="inline-flex items-center bg-success text-white px-space-3 py-space-1 rounded-full text-sm mb-space-4">
    ✓ Compatible
  </span>
  
  {/* Prix */}
  <div className="flex items-center justify-between mb-space-4">
    <span className="text-2xl font-bold text-neutral-900">45,99 €</span>
    <span className="text-sm text-neutral-500">TTC</span>
  </div>
  
  {/* Alerte délai */}
  <div className="bg-warning/10 border border-warning text-warning-foreground p-space-3 rounded-md mb-space-4">
    ⚠️ Livraison sous 3-5 jours
  </div>
  
  {/* Bouton CTA */}
  <button className="w-full bg-primary-500 hover:bg-primary-600 text-white py-space-3 rounded-lg font-medium transition-colors">
    Ajouter au panier
  </button>
</div>
```

---

## 🎯 Règle d'Or : 1 Couleur = 1 Fonction

### ✅ CORRECT

```tsx
// Primary = CTA
<button className="bg-primary-500">Acheter</button>
<button className="bg-primary-500">Ajouter au panier</button>

// Secondary = Navigation
<a className="text-secondary-500">Voir catalogue</a>
<nav className="bg-secondary-50">Menu</nav>

// Success = Validation
<div className="bg-success">Stock disponible</div>
<span className="bg-success">Compatible</span>

// Warning = Alerte
<div className="bg-warning">Délai livraison</div>
<span className="bg-warning">Stock faible</span>

// Error = Erreur
<div className="bg-error">Incompatible</div>
<span className="bg-error">Erreur paiement</span>
```

### ❌ INCORRECT (Ne JAMAIS mélanger)

```tsx
// ❌ Primary pour info (rôle confus)
<div className="bg-primary-500">Livraison estimée 3 jours</div>

// ❌ Success pour CTA (pas assez "action")
<button className="bg-success">Acheter maintenant</button>

// ❌ Error pour warning (trop alarmant)
<div className="bg-error">Stock faible</div>

// ❌ Warning pour erreur (pas assez ferme)
<div className="bg-warning">Pièce incompatible</div>
```

---

## 🎨 Nuances de Couleurs

Chaque couleur principale a **11 nuances** (50 → 950) :

```tsx
// Primary (Rouge/orangé CTA)
className="bg-primary-50"   // Très clair (arrière-plan hover)
className="bg-primary-500"  // Normal (bouton CTA)
className="bg-primary-700"  // Foncé (bouton hover)
className="bg-primary-950"  // Très foncé (texte sur fond clair)

// Secondary (Bleu acier Navigation)
className="bg-secondary-50"   // Arrière-plan navigation
className="bg-secondary-500"  // Lien actif
className="bg-secondary-700"  // Lien hover
```

**Contraste automatique** :

```tsx
// Texte contrastant auto-calculé (WCAG AA)
className="bg-primary-500 text-primary-500-contrast"  // Texte noir sur fond clair
className="bg-primary-900 text-primary-900-contrast"  // Texte blanc sur fond foncé
```

---

## 📦 Classes Utilities Disponibles

### Couleurs

```tsx
// Backgrounds
.bg-brand-{50-950}         // Primary (alias)
.bg-primary-{50-950}       // Primary
.bg-secondary-{50-950}     // Secondary
.bg-success                // Semantic success
.bg-warning                // Semantic warning
.bg-error                  // Semantic error

// Texte
.text-brand-500            // Texte rouge/orangé
.text-secondary-500        // Texte bleu acier
.text-success              // Texte vert
.text-error                // Texte rouge erreur

// Bordures
.border-primary-500
.border-secondary-500
.border-success
```

### Spacing (Design Tokens)

```tsx
.p-space-4        // Padding 1rem
.m-space-8        // Margin 2rem
.gap-space-6      // Gap 1.5rem
```

### Border Radius

```tsx
.rounded-sm       // 0.125rem
.rounded-md       // 0.375rem
.rounded-lg       // 0.5rem
.rounded-full     // Cercle
```

### Shadows

```tsx
.shadow-sm        // Ombre subtle
.shadow-md        // Ombre moyenne
.shadow-lg        // Ombre large
```

---

## 🔧 Configuration TypeScript

```tsx
// Import types Design Tokens
import type { DesignTokens } from '@fafa/design-tokens';

// Accès aux valeurs
const primaryColor = '#FF3B30';  // primary-500
const secondaryColor = '#0F4C81'; // secondary-500
```

---

## 🎯 Checklist Développeur

Avant de créer un composant, demandez-vous :

- [ ] **Quelle est la fonction de cet élément ?**
  - Action CTA → `bg-primary-500`
  - Navigation → `text-secondary-500`
  - Validation → `bg-success`
  - Alerte → `bg-warning`
  - Erreur → `bg-error`

- [ ] **Le contraste est-il suffisant ?**
  - Utilisez `.text-{color}-contrast` pour contraste auto

- [ ] **La couleur est-elle cohérente avec le reste de l'app ?**
  - Vérifiez que le même type d'élément utilise la même couleur partout

---

## 📊 Palette Visuelle Complète

### Primary (CTA)
```
█ #ffe5e5 (50)
█ #ffcccc (100)
█ #ff9999 (200)
█ #ff6666 (300)
█ #ff4d4d (400)
█ #FF3B30 (500) ← CTA principal
█ #e63629 (600)
█ #cc2f24 (700)
█ #b3291f (800)
█ #99221a (900)
█ #7f1b15 (950)
```

### Secondary (Navigation)
```
█ #e6f0f7 (50)
█ #cce1ef (100)
█ #99c3df (200)
█ #66a5cf (300)
█ #3387bf (400)
█ #0F4C81 (500) ← Navigation
█ #0d4473 (600)
█ #0b3c65 (700)
█ #093457 (800)
█ #072c49 (900)
█ #05243b (950)
```

### Semantic
```
█ #27AE60 Success (Vert mécanique)
█ #F39C12 Warning (Orange)
█ #C0392B Error (Rouge sombre)
█ #3498DB Info (Bleu)
```

---

## � Système d'Espacement (8px Grid)

### Principe Fondamental
**Toujours utiliser des multiples de 8px** pour un alignement pixel-perfect sur tous les écrans (HD, 2K, 4K).

### Échelle d'Espacement

| Nom | Valeur | Usage | Classes Tailwind |
|-----|--------|-------|------------------|
| **XS** | `4px` | Micro-espaces (badges, icônes) | `p-xs`, `m-xs`, `gap-xs` |
| **SM** | `8px` | Serré (label ↔ input) | `p-sm`, `m-sm`, `gap-sm` |
| **MD** | `16px` | Standard (padding cartes) | `p-md`, `m-md`, `gap-md` |
| **LG** | `24px` | Sections/blocs | `p-lg`, `m-lg`, `gap-lg` |
| **XL** | `32px` | Grilles, marges extérieures | `p-xl`, `m-xl`, `gap-xl` |
| **2XL** | `40px` | Large grilles | `p-2xl`, `m-2xl` |
| **3XL** | `48px` | Hero sections | `p-3xl`, `m-3xl` |
| **4XL** | `64px` | Landing pages | `p-4xl` |

### Exemples d'Utilisation

#### ✅ Badge avec micro-espacement (XS)
```tsx
<span className="bg-success text-white px-xs py-xs rounded-full text-xs">
  Compatible
</span>
```

#### ✅ Formulaire label → input (SM)
```tsx
<div className="mb-sm">
  <label className="block mb-sm font-sans text-neutral-700">
    Référence OEM
  </label>
  <input className="px-sm py-sm border rounded-md" />
</div>
```

#### ✅ Card produit avec padding standard (MD)
```tsx
<div className="bg-white p-md rounded-lg shadow-md">
  <h3 className="mb-sm">Plaquettes de frein</h3>
  <p className="mb-md">Compatible Renault Clio 4</p>
  <button className="px-md py-sm bg-primary-500">Acheter</button>
</div>
```

#### ✅ Grid de produits avec espacement (LG)
```tsx
<div className="grid grid-cols-3 gap-lg">
  <ProductCard />
  <ProductCard />
  <ProductCard />
</div>
```

#### ✅ Sections avec marges larges (XL)
```tsx
<section className="py-xl px-md">
  <h2 className="mb-lg">Nos meilleures ventes</h2>
  <div className="grid gap-lg">...</div>
</section>
```

### 🎯 Règles d'Or

1. **Toujours utiliser les valeurs sémantiques** : `p-md` plutôt que `p-4`
2. **Cohérence verticale** : Même espacement entre sections similaires
3. **Respiration visuelle** : Ne pas hésiter à espacer (meilleure UX)
4. **Mobile-first** : Les espacements s'adaptent automatiquement

### ❌ À Éviter

```tsx
// ❌ Valeurs arbitraires
<div className="p-[13px]">...</div>

// ❌ Valeurs non-multiples de 8
<div className="p-3">...</div>  // 0.75rem = 12px

// ✅ CORRECT
<div className="p-md">...</div>  // 16px
```

---

## �🚀 Migration Automatique (À venir)

```bash
# Codemod pour migration auto
npm run codemod:colors

# Exemple :
# bg-blue-600 → bg-primary-500
# text-green-500 → text-success
```

---

## 📝 Support

- **Documentation** : `/packages/design-tokens/README.md`
- **Tokens Source** : `/packages/design-tokens/src/tokens/design-tokens.json`
- **Build Script** : `/packages/design-tokens/scripts/build-tokens.js`

---

**Version** : 2.0  
**Dernière mise à jour** : 24 octobre 2025
