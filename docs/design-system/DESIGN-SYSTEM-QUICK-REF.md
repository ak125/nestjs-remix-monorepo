# 🎨 Design System - Quick Reference

> **Aide-mémoire rapide** pour l'utilisation quotidienne du Design System

---

## 🚦 Règle d'Or

### 1 Couleur = 1 Fonction (JAMAIS mélanger)

| Je veux... | J'utilise... | Classe |
|------------|--------------|--------|
| **Bouton d'action** (Ajouter panier, Payer) | Primary | `bg-primary-500` |
| **Lien navigation** (Menu, breadcrumb) | Secondary | `text-secondary-500` |
| **Valider** (Compatible, En stock) | Success | `bg-success` |
| **Alerter** (Délai, Stock faible) | Warning | `bg-warning` |
| **Bloquer** (Incompatible, Erreur) | Error | `bg-error` |
| **Neutre** (Fond, Texte) | Neutral | `bg-neutral-50` |

---

## 🎨 Couleurs

### Primary (CTA - Rouge/orangé)
```tsx
bg-primary-500     // #FF3B30 - Bouton principal
bg-primary-600     // Hover
bg-primary-700     // Pressed
text-primary-500   // Texte rouge
border-primary-500 // Bordure
```

### Secondary (Navigation - Bleu acier)
```tsx
bg-secondary-500     // #0F4C81 - Navigation
text-secondary-500   // Lien
text-secondary-600   // Lien hover
```

### Semantic (Fonctionnelles)
```tsx
bg-success   // #27AE60 - Vert mécanique
bg-warning   // #F39C12 - Orange
bg-error     // #C0392B - Rouge sombre
bg-info      // #3498DB - Bleu
```

### Neutral (Fond/Texte)
```tsx
bg-neutral-50    // #F5F7FA - Fond très clair
bg-neutral-900   // #212529 - Texte principal
text-neutral-500 // Texte secondaire
```

---

## 📏 Spacing (8px Grid)

### Échelle Sémantique

```tsx
// ✅ Utiliser les valeurs sémantiques
p-xs     // 4px  - Micro-espaces (badges)
p-sm     // 8px  - Serré (label → input)
p-md     // 16px - Standard (padding cartes)
p-lg     // 24px - Sections/blocs
p-xl     // 32px - Grilles/marges
p-2xl    // 40px - Large grilles
p-3xl    // 48px - Hero sections

// Fonctionne aussi avec margin, gap, space-y
m-xs, mt-sm, mb-md, ml-lg, mr-xl
gap-xs, gap-sm, gap-md, gap-lg
space-x-sm, space-y-md, space-y-lg
```

### Règle d'Or Spacing

> **Toujours des multiples de 8px** → Alignement pixel-perfect

```tsx
// ✅ CORRECT - Sémantique
<div className="p-md gap-lg">...</div>

// ❌ ÉVITER - Valeur arbitraire
<div className="p-[13px]">...</div>

// ❌ ÉVITER - Non-multiple de 8
<div className="p-3">...</div>  // 12px
```

### Usage par Contexte

| Contexte | Espacement | Exemple |
|----------|------------|---------|
| Badge | `px-xs py-xs` | Padding micro |
| Form | `mb-sm` | Label → Input |
| Card | `p-md` | Padding standard |
| Grid | `gap-lg` | Gap produits |
| Section | `py-xl` | Marges page |

---

## 🔲 Border Radius

```tsx
rounded-sm   // 0.125rem
rounded-md   // 0.375rem
rounded-lg   // 0.5rem
rounded-full // Cercle
```

---

## 🌑 Shadows

```tsx
shadow-sm  // Subtle
shadow-md  // Normal
shadow-lg  // Large
shadow-xl  // Extra large
```

---

## 📝 Typography

### Polices Métier

```tsx
// Titres (Montserrat Bold)
font-heading  // Moderne, robuste, lisible mobile

// Texte courant (Inter Regular)
font-sans     // Sobre, lisibilité optimale

// Données techniques (Roboto Mono)
font-mono     // Réf OEM, Stock, Prix → Précision
```

### Tailles

```tsx
text-xs    // 0.75rem
text-sm    // 0.875rem
text-base  // 1rem
text-lg    // 1.125rem
text-2xl   // 1.5rem
```

---

## 📝 Typography

### Polices Métier (3 fonctions distinctes)

```tsx
// Headings → Montserrat (Moderne, robuste)
font-heading         // Titres, headers

// Body → Inter (Sobre, lisible)
font-body ou font-sans  // Texte principal

// Data → Roboto Mono (Précision)
font-data ou font-mono  // Réf OEM, stock, codes
```

**Exemples :**

```tsx
// Titre produit
<h1 className="font-heading font-bold text-3xl">Plaquettes de frein</h1>

// Description
<p className="font-body text-base">Compatible Renault Clio...</p>

// Référence OEM
<code className="font-data text-sm">7701208265</code>

// Prix (alignement chiffres)
<span className="font-data text-2xl font-bold">45,99 €</span>

// Stock
<span className="font-data text-sm">Stock: 12 unités</span>
```

**Tailles :**

```tsx
text-xs    // 0.75rem
text-sm    // 0.875rem
text-base  // 1rem
text-lg    // 1.125rem
text-2xl   // 1.5rem
text-3xl   // 1.875rem
```

---

## ✅ Exemples Rapides

### Bouton CTA
```tsx
<button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg">
  Ajouter au panier
</button>
```

### Lien Navigation
```tsx
<a className="text-secondary-500 hover:text-secondary-600 hover:underline">
  Voir catalogue
</a>
```

### Badge Compatible
```tsx
<span className="bg-success text-white px-4 py-2 rounded-full text-sm">
  ✓ Compatible
</span>
```

### Alerte Délai
```tsx
<div className="bg-warning/10 border border-warning text-warning-foreground p-4 rounded-md">
  ⚠️ Livraison sous 5-7 jours
</div>
```

### Message Erreur
```tsx
### Message Erreur
```tsx
<div className="bg-error text-white p-4 rounded-md">
  ✗ Cette pièce n'est pas compatible
</div>
```

### Card Produit (avec typographie + spacing)
```tsx
<div className="bg-white rounded-lg shadow-md p-md">
  {/* Titre (Montserrat) */}
  <h3 className="font-heading text-xl font-bold mb-sm">
    Plaquettes de frein avant
  </h3>
  
  {/* Référence (Roboto Mono) */}
  <p className="font-mono text-sm text-neutral-600 mb-md">
    Réf OEM: 7701207795
  </p>
  
  {/* Prix (Roboto Mono) */}
  <div className="font-mono text-3xl font-bold mb-md">
    45,99 €
  </div>
  
  {/* Description (Inter) */}
  <p className="font-sans text-sm text-neutral-700 mb-md">
    Description produit avec lisibilité optimale
  </p>
  
  {/* Button CTA */}
  <button className="w-full bg-primary-500 hover:bg-primary-600 text-white py-sm px-md rounded-lg font-heading">
    Ajouter au panier
  </button>
</div>
```

### Grid Produits (avec spacing)
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
  <ProductCard />
  <ProductCard />
  <ProductCard />
</div>
```

### Section avec marges (spacing)
```tsx
<section className="py-xl px-md max-w-7xl mx-auto">
  <h2 className="font-heading text-3xl font-bold mb-lg">
    Nos meilleures ventes
  </h2>
  <div className="grid grid-cols-3 gap-lg">
    {/* Produits */}
  </div>
</section>
```

---

## 🔧 Commandes Utiles
```

---

## ❌ Erreurs Courantes

### Couleurs

```tsx
// ❌ MAUVAIS : Primary pour info
<div className="bg-primary-500">Info livraison</div>

// ✅ CORRECT : Neutral pour info
<div className="bg-neutral-100 text-neutral-900">Info livraison</div>

// ❌ MAUVAIS : Success pour CTA
<button className="bg-success">Acheter</button>

// ✅ CORRECT : Primary pour CTA
<button className="bg-primary-500">Acheter</button>

// ❌ MAUVAIS : Warning pour erreur bloquante
<div className="bg-warning">Pièce incompatible</div>

// ✅ CORRECT : Error pour erreur bloquante
<div className="bg-error text-white">Pièce incompatible</div>
```

### Spacing

```tsx
// ❌ MAUVAIS : Valeur arbitraire
<div className="p-[15px] m-[23px]">...</div>

// ✅ CORRECT : Valeur sémantique
<div className="p-md m-lg">...</div>

// ❌ MAUVAIS : Non-multiple de 8
<div className="p-3 gap-5">...</div>  // 12px, 20px

// ✅ CORRECT : Multiple de 8
<div className="p-sm gap-lg">...</div>  // 8px, 24px

// ❌ MAUVAIS : Valeur numérique ambiguë
<div className="p-4">...</div>

// ✅ CORRECT : Nom sémantique clair
<div className="p-md">...</div>
```

### Typographie

```tsx
// ❌ MAUVAIS : Mélange des rôles
<h1 className="font-mono">Titre</h1>
<code className="font-heading">7701208265</code>

// ✅ CORRECT : Rôles respectés
<h1 className="font-heading">Titre</h1>
<code className="font-mono">7701208265</code>
```

---

## 🔧 Commandes Utiles

```bash
# Rebuild Design Tokens
cd packages/design-tokens && npm run build

# Vérifier couleurs générées
cat packages/design-tokens/src/styles/tokens.css | grep "primary-500"

# Redémarrer dev
cd frontend && npm run dev
```

---

## 📚 Documentation Complète

- **Guide complet** : `/DESIGN-SYSTEM-USAGE-GUIDE.md`
- **Audit** : `/DESIGN-SYSTEM-AUDIT.md`
- **Checklist** : `/DESIGN-SYSTEM-CHECKLIST.md`
- **Tokens README** : `/packages/design-tokens/README.md`

---

## 🎯 Checklist Rapide

Avant de commit :

**Couleurs**
- [ ] Pas de `#...` ou `rgb(...)` hardcodés
- [ ] Couleurs sémantiques utilisées (Primary/Secondary/Success/Warning/Error)
- [ ] Règle "1 couleur = 1 fonction" respectée
- [ ] Contraste vérifié (texte lisible - WCAG AA)

**Spacing**
- [ ] Classes sémantiques (`p-md`, `gap-lg`) au lieu de valeurs arbitraires
- [ ] Toujours des multiples de 8px
- [ ] Pas de `p-[15px]` ou valeurs custom
- [ ] Cohérence verticale (même espacement pour éléments similaires)

**Typographie**
- [ ] `font-heading` pour titres (Montserrat)
- [ ] `font-sans` pour body (Inter)
- [ ] `font-mono` pour données techniques (Roboto Mono)
- [ ] Pas de mélange des rôles

---

**Version** : 2.0 | **Mise à jour** : 24 oct. 2025
