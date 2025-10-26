# 🔤 Design System - Typographie Métier

**Version:** 2.0  
**Date:** 24 octobre 2025

---

## 📚 Polices Métier

### Règle UX : 3 Polices = 3 Fonctions

| Police | Rôle | Usage | Classe |
|--------|------|-------|--------|
| **Montserrat Bold** | 🏷️ **Headings** | Titres, headers, emphase | `font-heading` |
| **Inter Regular** | 📄 **Body** | Texte principal, descriptions | `font-body` ou `font-sans` |
| **Roboto Mono** | 🔢 **Data Technique** | Réf OEM, stock, codes | `font-data` ou `font-mono` |

---

## 🎨 Pourquoi ces polices ?

### Montserrat Bold (Headings)
✅ **Moderne et robuste**  
✅ **Excellente lisibilité mobile**  
✅ **Présence forte** pour les titres  
✅ **Compatible avec le branding** automobile

```tsx
<h1 className="font-heading font-bold text-4xl">
  Plaquettes de frein avant
</h1>
```

### Inter Regular (Body)
✅ **Sobre et professionnel**  
✅ **Lisibilité optimale** (optimisée pour écrans)  
✅ **Espacement parfait** pour longs textes  
✅ **Google Fonts** → Poids léger

```tsx
<p className="font-body text-base text-neutral-700">
  Compatible avec Renault Clio 4 (2012-2019). 
  Garantie constructeur 2 ans.
</p>
```

### Roboto Mono (Data Technique)
✅ **Précision visuelle**  
✅ **Crédibilité technique**  
✅ **Alignement parfait** des chiffres/codes  
✅ **Effet "catalogue constructeur"** 

```tsx
<span className="font-data text-sm text-neutral-600">
  Réf OEM: 7701208265
</span>
```

**Impact UX :** Petit détail qui change tout pour l'expérience "catalogue professionnel".

---

## 📏 Échelle de Tailles

### Headings (Montserrat)

```tsx
// Extra Large (Hero)
<h1 className="font-heading font-bold text-6xl">
  Titre Hero
</h1>

// Large (Page Title)
<h1 className="font-heading font-bold text-5xl">
  Catalogue Pièces Auto
</h1>

// Medium (Section Title)
<h2 className="font-heading font-bold text-3xl">
  Pièces de freinage
</h2>

// Small (Card Title)
<h3 className="font-heading font-semibold text-xl">
  Plaquettes de frein
</h3>

// Extra Small (Label)
<h4 className="font-heading font-semibold text-lg">
  Informations techniques
</h4>
```

### Body (Inter)

```tsx
// Large (Intro)
<p className="font-body text-lg">
  Découvrez notre sélection de pièces auto...
</p>

// Normal (Description)
<p className="font-body text-base">
  Compatible avec Renault Clio 4...
</p>

// Small (Caption)
<span className="font-body text-sm text-neutral-600">
  Stock disponible
</span>

// Extra Small (Meta)
<span className="font-body text-xs text-neutral-500">
  Mis à jour il y a 2h
</span>
```

### Data (Roboto Mono)

```tsx
// References OEM
<code className="font-data text-sm text-neutral-900">
  7701208265
</code>

// Stock / Quantité
<span className="font-data text-base font-medium">
  Stock: 12 unités
</span>

// Prix
<span className="font-data text-2xl font-bold text-neutral-900">
  45,99 €
</span>

// Codes / SKU
<span className="font-data text-xs text-neutral-600">
  SKU: BRK-12345-FR
</span>
```

---

## ✅ Exemples Concrets

### Card Produit Complète

```tsx
<div className="bg-white border border-neutral-200 rounded-lg p-6">
  {/* Badge (Data) */}
  <span className="font-data text-xs text-neutral-600 mb-2 block">
    SKU: BRK-12345-FR
  </span>
  
  {/* Titre (Heading) */}
  <h3 className="font-heading font-bold text-xl text-neutral-900 mb-2">
    Plaquettes de frein avant
  </h3>
  
  {/* Référence OEM (Data) */}
  <div className="flex items-center gap-2 mb-3">
    <span className="font-body text-sm text-neutral-500">Réf OEM:</span>
    <code className="font-data text-sm text-neutral-900 bg-neutral-100 px-2 py-1 rounded">
      7701208265
    </code>
  </div>
  
  {/* Description (Body) */}
  <p className="font-body text-base text-neutral-700 mb-4">
    Plaquettes de frein haute performance, compatibles avec Renault Clio 4 
    (2012-2019). Certifiées ECE R90. Garantie constructeur 2 ans.
  </p>
  
  {/* Stock (Data) */}
  <div className="flex items-center justify-between mb-4">
    <span className="font-data text-sm font-medium text-success">
      Stock: 12 unités
    </span>
    <span className="font-body text-xs text-neutral-500">
      Livraison 24-48h
    </span>
  </div>
  
  {/* Prix (Data + Heading mix) */}
  <div className="flex items-baseline gap-2 mb-4">
    <span className="font-data text-3xl font-bold text-neutral-900">
      45,99 €
    </span>
    <span className="font-body text-sm text-neutral-500">TTC</span>
  </div>
  
  {/* Bouton CTA (Heading) */}
  <button className="w-full bg-primary-500 hover:bg-primary-600 text-white 
                     font-heading font-semibold py-3 rounded-lg">
    Ajouter au panier
  </button>
</div>
```

**Résultat :** 
- Titre **Montserrat** → Impact visuel
- Description **Inter** → Confort de lecture
- Codes/Stock **Roboto Mono** → Crédibilité technique

---

### Header Navigation

```tsx
<header className="bg-white border-b border-neutral-200">
  <div className="container mx-auto px-4 py-4">
    {/* Logo + Titre */}
    <div className="flex items-center gap-3">
      <img src="/logo.svg" alt="Logo" className="h-10" />
      <h1 className="font-heading font-bold text-2xl text-secondary-500">
        AutoMécanik Pro
      </h1>
    </div>
    
    {/* Navigation */}
    <nav className="mt-4">
      <ul className="flex gap-6">
        <li>
          <a href="/catalogue" className="font-body text-base text-secondary-500 
                                          hover:text-secondary-600">
            Catalogue
          </a>
        </li>
        <li>
          <a href="/marques" className="font-body text-base text-secondary-500 
                                        hover:text-secondary-600">
            Marques
          </a>
        </li>
        <li>
          <a href="/aide" className="font-body text-base text-secondary-500 
                                      hover:text-secondary-600">
            Aide
          </a>
        </li>
      </ul>
    </nav>
  </div>
</header>
```

---

### Tableau Technique

```tsx
<table className="w-full border border-neutral-200">
  <thead className="bg-neutral-100">
    <tr>
      <th className="font-heading font-semibold text-sm text-left p-3">
        Référence
      </th>
      <th className="font-heading font-semibold text-sm text-left p-3">
        Désignation
      </th>
      <th className="font-heading font-semibold text-sm text-right p-3">
        Stock
      </th>
      <th className="font-heading font-semibold text-sm text-right p-3">
        Prix
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-neutral-200">
      <td className="p-3">
        <code className="font-data text-sm text-neutral-900 bg-neutral-50 px-2 py-1 rounded">
          7701208265
        </code>
      </td>
      <td className="p-3">
        <span className="font-body text-base text-neutral-900">
          Plaquettes de frein avant
        </span>
      </td>
      <td className="p-3 text-right">
        <span className="font-data text-sm font-medium text-success">
          12
        </span>
      </td>
      <td className="p-3 text-right">
        <span className="font-data text-base font-bold text-neutral-900">
          45,99 €
        </span>
      </td>
    </tr>
  </tbody>
</table>
```

**Résultat :** Tableau professionnel avec crédibilité technique.

---

## 🎯 Bonnes Pratiques

### ✅ À FAIRE

```tsx
// Titres → Montserrat
<h1 className="font-heading font-bold text-3xl">Titre</h1>

// Texte → Inter
<p className="font-body text-base">Description produit...</p>

// Références → Roboto Mono
<code className="font-data text-sm">7701208265</code>

// Prix → Roboto Mono (alignement chiffres)
<span className="font-data text-2xl font-bold">45,99 €</span>

// Stock → Roboto Mono (précision)
<span className="font-data text-sm">Stock: 12</span>
```

### ❌ À ÉVITER

```tsx
// ❌ MAUVAIS : Référence en Inter (manque de précision)
<span className="font-body">7701208265</span>

// ❌ MAUVAIS : Titre en Inter (manque d'impact)
<h1 className="font-body text-3xl">Catalogue Pièces</h1>

// ❌ MAUVAIS : Long texte en Roboto Mono (fatigue visuelle)
<p className="font-mono">
  Lorem ipsum dolor sit amet, consectetur adipiscing elit...
</p>

// ❌ MAUVAIS : Prix en Inter (manque d'alignement)
<span className="font-body text-2xl">45,99 €</span>
```

---

## 🔢 Poids de Police (Font Weights)

### Montserrat (Headings)

| Poids | Classe | Usage |
|-------|--------|-------|
| **400 (Normal)** | `font-normal` | Sous-titres légers |
| **500 (Medium)** | `font-medium` | Labels, menus |
| **600 (Semibold)** | `font-semibold` | Titres secondaires |
| **700 (Bold)** | `font-bold` | Titres principaux |
| **800 (Extrabold)** | `font-extrabold` | Héros, emphase forte |
| **900 (Black)** | `font-black` | Impact maximum |

### Inter (Body)

| Poids | Classe | Usage |
|-------|--------|-------|
| **300 (Light)** | `font-light` | Texte secondaire, captions |
| **400 (Normal)** | `font-normal` | Texte principal |
| **500 (Medium)** | `font-medium` | Emphase douce |
| **600 (Semibold)** | `font-semibold` | Labels importants |
| **700 (Bold)** | `font-bold` | Mise en valeur |

### Roboto Mono (Data)

| Poids | Classe | Usage |
|-------|--------|-------|
| **400 (Normal)** | `font-normal` | Références, codes |
| **500 (Medium)** | `font-medium` | Stock, quantités |
| **600 (Semibold)** | `font-semibold` | Données importantes |
| **700 (Bold)** | `font-bold` | Prix, valeurs critiques |

---

## 📱 Responsive Typography

```tsx
// Titre responsive
<h1 className="font-heading font-bold 
               text-3xl md:text-4xl lg:text-5xl">
  Catalogue Pièces Auto
</h1>

// Description responsive
<p className="font-body 
              text-sm md:text-base lg:text-lg">
  Compatible avec tous modèles Renault...
</p>

// Référence responsive (reste lisible)
<code className="font-data 
                 text-xs md:text-sm">
  7701208265
</code>
```

---

## 🎨 Combinaisons Recommandées

### Hero Section

```tsx
<section className="bg-gradient-to-r from-secondary-500 to-secondary-700 text-white py-20">
  <div className="container mx-auto px-4">
    {/* Titre Hero */}
    <h1 className="font-heading font-extrabold text-5xl md:text-6xl mb-4">
      Pièces Auto Neuves
    </h1>
    
    {/* Sous-titre */}
    <p className="font-body text-xl md:text-2xl font-light mb-8">
      + de 50 000 références en stock
    </p>
    
    {/* CTA */}
    <button className="bg-primary-500 hover:bg-primary-600 text-white 
                       font-heading font-bold text-lg px-8 py-4 rounded-lg">
      Voir le catalogue
    </button>
  </div>
</section>
```

### Badge Statut

```tsx
{/* Stock disponible */}
<span className="inline-flex items-center gap-2 
                 bg-success/10 border border-success 
                 text-success px-3 py-1 rounded-full">
  <span className="font-body text-sm font-medium">En stock</span>
  <span className="font-data text-xs">12 unités</span>
</span>

{/* Référence OEM */}
<div className="bg-neutral-100 px-3 py-2 rounded-md inline-block">
  <span className="font-body text-xs text-neutral-500 block mb-1">
    Réf OEM
  </span>
  <code className="font-data text-sm font-semibold text-neutral-900">
    7701208265
  </code>
</div>
```

---

## 📊 Impact Performance

### Poids des polices

| Police | Poids (woff2) | Impact |
|--------|---------------|--------|
| Montserrat (Bold) | ~15 KB | ✅ Léger |
| Inter (Regular) | ~12 KB | ✅ Léger |
| Roboto Mono | ~10 KB | ✅ Léger |
| **Total** | **~37 KB** | ✅ Excellent |

**Optimisation :** Google Fonts avec `&display=swap` → pas de FOIT/FOUT.

---

## 🔧 Configuration Technique

### Google Fonts Import

```css
/* frontend/app/global.css */
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;500;600;700&display=swap');
```

### Tailwind Config

```javascript
// frontend/tailwind.config.cjs
fontFamily: {
  heading: "'Montserrat', system-ui, -apple-system, sans-serif",
  body: "'Inter', system-ui, -apple-system, sans-serif",
  data: "'Roboto Mono', ui-monospace, 'SF Mono', Consolas, monospace",
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'Roboto Mono', ui-monospace, 'SF Mono', Consolas, monospace"
}
```

---

## ✅ Checklist Typographie

Avant de valider un composant :

- [ ] **Titres** utilisent `font-heading` (Montserrat)
- [ ] **Descriptions** utilisent `font-body` (Inter)
- [ ] **Références/Stock/Prix** utilisent `font-data` (Roboto Mono)
- [ ] **Poids cohérent** (Bold pour headings, Normal pour body)
- [ ] **Tailles responsive** (sm:, md:, lg:)
- [ ] **Contraste texte** suffisant (WCAG AA)

---

## 🚀 Résultat Final

**Bénéfices UX :**
- ✅ **Impact visuel** → Montserrat pour les titres
- ✅ **Confort de lecture** → Inter pour le body
- ✅ **Crédibilité technique** → Roboto Mono pour les données
- ✅ **Cohérence totale** → 3 polices bien distinctes
- ✅ **Performance** → 37 KB seulement (léger)

**Effet "catalogue professionnel"** garanti ! 🎯

---

**Version** : 2.0  
**Dernière mise à jour** : 24 octobre 2025  
**Statut** : ✅ Production Ready
