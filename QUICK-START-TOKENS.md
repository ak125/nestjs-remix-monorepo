# 🚀 Quick Start - Design Tokens

> Guide de démarrage rapide en 5 minutes

## 1️⃣ Comprendre (2 min)

### C'est quoi un Design Token ?

Un token = une variable de style réutilisable.

**Exemple :**
```tsx
// ❌ Avant (valeur en dur)
<button style={{ background: '#FF3B30', padding: '16px' }}>
  Bouton
</button>

// ✅ Après (avec tokens)
<button className="bg-brand-500 p-space-4">
  Bouton
</button>
```

### Pourquoi c'est utile ?

1. **Cohérence** : Même design partout
2. **Maintenance** : Changer 1 variable au lieu de 500 fichiers
3. **Accessibilité** : Contrastes WCAG AA/AAA garantis

---

## 2️⃣ Les 6 Couleurs Essentielles (1 min)

Toujours utiliser les **couleurs sémantiques** en priorité :

```tsx
// 🔴 Action - Boutons CTA principaux
<button className="
  bg-[var(--color-semantic-action)] 
  text-[var(--color-semantic-action-contrast)]
">
  Acheter
</button>

// 🔵 Info - Navigation, liens
<a className="text-[var(--color-semantic-info)]">
  En savoir plus
</a>

// 🟢 Success - Validations
<div className="
  bg-[var(--color-semantic-success)]
  text-[var(--color-semantic-success-contrast)]
">
  ✅ Succès !
</div>

// 🟡 Warning - Avertissements
<div className="
  bg-[var(--color-semantic-warning)]
  text-[var(--color-semantic-warning-contrast)]
">
  ⚠️ Attention
</div>

// 🔴 Danger - Erreurs
<div className="
  bg-[var(--color-semantic-danger)]
  text-[var(--color-semantic-danger-contrast)]
">
  ❌ Erreur
</div>

// ⚪ Neutral - États neutres
<button 
  disabled
  className="
    bg-[var(--color-semantic-neutral)]
    text-[var(--color-semantic-neutral-contrast)]
  "
>
  Désactivé
</button>
```

**💡 Règle d'or :** Toujours utiliser `-contrast` pour le texte !

---

## 3️⃣ Espacements Rapides (1 min)

Utilisez la **grille 8px** :

```tsx
// Espacements standards
<div className="p-space-md">      {/* 16px - Standard */}
<div className="p-space-lg">      {/* 24px - Large */}
<div className="m-space-sm">      {/* 8px - Petit */}
<div className="gap-space-xl">    {/* 32px - Très large */}
```

**Cheat sheet espacements :**
- `xs` = 4px → Micro (badges)
- `sm` = 8px → Serré (label → input)
- `md` = 16px → **Standard (défaut)**
- `lg` = 24px → Sections
- `xl` = 32px → Grandes marges

---

## 4️⃣ Typographie (30 sec)

3 fonts à retenir :

```tsx
// Titres
<h1 className="font-heading">Titre Principal</h1>

// Texte standard
<p className="font-sans">Description normale</p>

// Données techniques
<code className="font-mono">REF: 7701208265</code>
```

---

## 5️⃣ Pattern Copier-Coller (30 sec)

### Bouton CTA
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
  Mon CTA
</button>
```

### Card Simple
```tsx
<div className="
  bg-white 
  p-space-6 
  rounded-xl 
  shadow-md 
  border border-neutral-200
">
  <h3 className="font-heading text-xl mb-space-2">Titre</h3>
  <p className="text-neutral-600">Description</p>
</div>
```

### Alert Success
```tsx
<div className="
  bg-[var(--color-semantic-success)]
  text-[var(--color-semantic-success-contrast)]
  p-space-4 
  rounded-lg
">
  ✅ Opération réussie !
</div>
```

---

## ✅ Checklist Rapide

Avant de coder un composant :

- [ ] Utiliser couleurs sémantiques (`action`, `info`, etc.)
- [ ] Utiliser grille 8px (`p-space-md`, `m-space-lg`)
- [ ] Utiliser bonnes fonts (`font-heading`, `font-sans`, `font-mono`)
- [ ] Toujours mettre `-contrast` avec les couleurs
- [ ] Éviter les valeurs en dur (#HEX, px)

---

## 🎓 Aller Plus Loin

### Documentation Complète
- **[GUIDE-COMPLET.md](./packages/design-tokens/GUIDE-COMPLET.md)** - Tout comprendre (15 min)
- **[FAQ.md](./packages/design-tokens/FAQ.md)** - 20 questions/réponses
- **[CHEAT-SHEET.md](./packages/design-tokens/CHEAT-SHEET.md)** - Référence rapide

### Interface Interactive
- **[/admin/design-system](/admin/design-system)** - Tester en live

---

## 📊 Ressources Visuelles

### Couleurs Sémantiques

| Couleur | Hex | Usage | WCAG |
|---------|-----|-------|------|
| `action` | #D63027 | CTA principaux | AA |
| `info` | #0F4C81 | Navigation, liens | AAA |
| `success` | #1E8449 | Validations | AA |
| `warning` | #D68910 | Avertissements | AAA |
| `danger` | #C0392B | Erreurs | AA |
| `neutral` | #4B5563 | États neutres | AAA |

### Espacements (Grille 8px)

| Token | px | Usage |
|-------|-----|-------|
| `xs` | 4px | Micro-espaces |
| `sm` | 8px | Serré |
| `md` | 16px | **Standard** |
| `lg` | 24px | Sections |
| `xl` | 32px | Grandes marges |

---

## 🎯 Exercice Pratique (2 min)

Créez cette card avec les tokens :

```tsx
<div className="
  bg-white 
  p-space-6 
  rounded-xl 
  shadow-md 
  border border-neutral-200
  max-w-sm
">
  {/* Image */}
  <img 
    src="/product.jpg" 
    alt="Produit"
    className="w-full h-48 object-cover rounded-lg mb-space-4"
  />
  
  {/* Titre */}
  <h3 className="
    font-heading 
    text-xl 
    font-bold 
    mb-space-2
  ">
    Plaquettes de frein
  </h3>
  
  {/* Référence */}
  <p className="
    font-mono 
    text-sm 
    text-neutral-600 
    mb-space-2
  ">
    Réf: 7701208265
  </p>
  
  {/* Badge */}
  <span className="
    inline-block
    bg-[var(--color-semantic-success)] 
    text-[var(--color-semantic-success-contrast)]
    px-3 py-1 
    rounded-full 
    text-sm 
    mb-space-4
  ">
    ✓ Compatible
  </span>
  
  {/* Prix */}
  <div className="
    font-mono 
    text-3xl 
    font-bold 
    mb-space-4
  ">
    45,99 €
  </div>
  
  {/* Bouton */}
  <button className="
    w-full
    bg-[var(--color-semantic-action)] 
    text-[var(--color-semantic-action-contrast)]
    py-3 
    rounded-lg 
    font-medium
    shadow-md
    hover:shadow-lg
    transition-all
  ">
    Ajouter au panier
  </button>
</div>
```

**Résultat attendu :**
- ✅ Utilise les couleurs sémantiques
- ✅ Respecte la grille 8px
- ✅ Utilise les 3 fonts correctement
- ✅ Contrastes automatiques
- ✅ Composant accessible

---

## 🚀 Vous Êtes Prêt !

**En 5 minutes, vous savez maintenant :**

1. ✅ Ce qu'est un design token
2. ✅ Les 6 couleurs sémantiques essentielles
3. ✅ La grille 8px pour les espacements
4. ✅ Les 3 fonts à utiliser
5. ✅ Comment créer un composant avec les tokens

**Next steps :**
- Explorez la [page interactive](/admin/design-system)
- Lisez le [GUIDE-COMPLET.md](./packages/design-tokens/GUIDE-COMPLET.md)
- Créez votre premier composant !

**Bon coding ! 🎨✨**
