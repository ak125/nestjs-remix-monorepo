# 🎨 Design Tokens - FAQ

## Questions Fréquentes

### 🤔 Questions Générales

#### Q1: C'est quoi exactement un "token" ?
**R:** Un token est une variable de design réutilisable qui stocke une valeur (couleur, espacement, taille, etc.). C'est comme un surnom : au lieu de dire "la couleur #FF3B30", on dit "primary-500".

**Exemple concret :**
```css
/* ❌ Sans token (valeur en dur) */
.button {
  background: #FF3B30;
  padding: 16px;
}

/* ✅ Avec tokens */
.button {
  background: var(--color-primary-500);
  padding: var(--spacing-4);
}
```

---

#### Q2: Pourquoi utiliser des tokens plutôt que des valeurs directes ?
**R:** Pour 5 raisons principales :

1. **Cohérence** : Même couleur de rouge partout
2. **Maintenance** : Changer 1 variable au lieu de 500 fichiers
3. **Thèmes** : Facilite le dark mode, le white label, etc.
4. **Communication** : Designers et développeurs parlent le même langage
5. **Accessibilité** : Les contrastes sont calculés automatiquement

---

#### Q3: Quelle est la différence entre les couleurs "sémantiques" et les couleurs de "palette" ?
**R:** 

**Couleurs Sémantiques** (à utiliser en priorité) :
- `action` → Boutons CTA
- `info` → Navigation, liens
- `success` → Validations
- `warning` → Avertissements
- `danger` → Erreurs
- `neutral` → États neutres

**Couleurs de Palette** (pour design custom) :
- `primary-50` à `primary-950` → 11 nuances de rouge
- `secondary-50` à `secondary-950` → 11 nuances de bleu
- `neutral-50` à `neutral-950` → 11 nuances de gris

**👉 Règle :** Toujours commencer par les couleurs sémantiques !

---

### 🎨 Questions sur les Couleurs

#### Q4: Je veux un bouton rouge, j'utilise quoi ?
**R:** Ça dépend de son rôle !

- **CTA principal** → `bg-[var(--color-semantic-action)]`
- **Bouton de suppression** → `bg-[var(--color-semantic-danger)]`
- **Design custom** → `bg-primary-500`

```tsx
// ✅ BON : CTA principal
<button className="bg-[var(--color-semantic-action)] text-[var(--color-semantic-action-contrast)]">
  Acheter maintenant
</button>

// ✅ BON : Suppression
<button className="bg-[var(--color-semantic-danger)] text-[var(--color-semantic-danger-contrast)]">
  Supprimer
</button>
```

---

#### Q5: C'est quoi les classes "-contrast" ?
**R:** Ce sont les couleurs de texte optimales pour chaque couleur de fond, calculées automatiquement pour garantir la conformité WCAG AA/AAA.

```tsx
// ❌ MAUVAIS : Texte blanc sur fond jaune (contraste insuffisant)
<div className="bg-warning text-white">
  Attention
</div>

// ✅ BON : Contraste automatique (texte noir sur fond jaune)
<div className="bg-[var(--color-semantic-warning)] text-[var(--color-semantic-warning-contrast)]">
  Attention
</div>
```

---

#### Q6: Comment faire un dégradé ?
**R:** Utilisez les nuances de palette :

```tsx
// Dégradé rouge
<div className="bg-gradient-to-r from-primary-400 to-primary-600">
  Dégradé
</div>

// Dégradé rouge vers bleu
<div className="bg-gradient-to-r from-primary-500 to-secondary-500">
  Dégradé multicolore
</div>
```

---

### 📏 Questions sur les Espacements

#### Q7: Quelle taille d'espacement utiliser ?
**R:** Suivez la grille 8px :

- `spacing-xs` (4px) → Micro-espaces (badges, icônes)
- `spacing-sm` (8px) → Espacement serré (label → input)
- `spacing-md` (16px) → Standard (padding cartes)
- `spacing-lg` (24px) → Sections, blocs
- `spacing-xl` (32px) → Grandes marges

**Règle d'or :** Commencez par `md`, ajustez si nécessaire.

```tsx
// Card standard
<div className="p-space-md rounded-lg">
  <h2 className="mb-space-sm">Titre</h2>
  <p className="mb-space-md">Description</p>
  <button>Action</button>
</div>
```

---

#### Q8: C'est quoi les espacements "fluid" ?
**R:** Des espacements qui s'adaptent automatiquement à la taille d'écran avec `clamp()`.

```css
/* Fixe (ne change pas) */
--spacing-4: 1rem; /* Toujours 16px */

/* Fluid (responsive) */
--spacing-fluid-section-md: clamp(3rem, 6vw, 4rem);
/* Mobile: 3rem (48px), Desktop: 4rem (64px) */
```

**Utilisation :**
```tsx
// Section responsive
<section className="py-[var(--spacing-fluid-section-lg)]">
  Contenu qui respire !
</section>
```

---

### ✍️ Questions sur la Typographie

#### Q9: Quelle font utiliser ?
**R:** 

- **Titres** → `font-heading` (Montserrat)
- **Texte** → `font-sans` (Inter)
- **Données techniques** → `font-mono` (Roboto Mono)

```tsx
<h1 className="font-heading text-4xl font-bold">
  Titre Principal
</h1>

<p className="font-sans text-base">
  Texte de description standard.
</p>

<code className="font-mono text-sm">
  REF: 7701208265
</code>
```

---

#### Q10: Comment faire des tailles responsive ?
**R:** Utilisez les tokens `fluid` :

```tsx
// Taille fixe
<h1 className="text-3xl">Titre</h1>

// Taille responsive (recommandé)
<h1 className="text-[var(--font-size-fluid-3xl)]">
  Titre qui s'adapte
</h1>
```

---

### 🛠️ Questions Techniques

#### Q11: Comment modifier un token ?
**R:** 

1. **Éditez** `packages/design-tokens/src/tokens/design-tokens.json`
2. **Rebuild** : `cd packages/design-tokens && npm run build`
3. **Profit** ! Tous les fichiers se régénèrent automatiquement

```bash
# Dans le terminal
cd packages/design-tokens
npm run build

# Vérifiez les changements
git status
```

---

#### Q12: Comment ajouter une nouvelle couleur ?
**R:** Éditez `design-tokens.json` :

```json
{
  "colors": {
    "accent": {
      "nouveauRouge": {
        "value": "#E74C3C",
        "type": "color"
      }
    }
  }
}
```

Puis rebuild. La couleur sera disponible en :
- CSS Variable : `--color-accent-nouveauRouge`
- Classe Tailwind : `bg-accent-nouveauRouge`
- TypeScript : `designTokens.colors.accent.nouveauRouge`

---

#### Q13: Les tokens fonctionnent avec le dark mode ?
**R:** Oui ! Le système supporte le dark mode out-of-the-box.

```tsx
// Ajouter la classe 'dark' au root
<html className={isDark ? "dark" : ""}>
  {/* Tout s'adapte automatiquement ! */}
</html>
```

Les couleurs comme `--background` et `--foreground` changent automatiquement.

---

#### Q14: Comment tester l'accessibilité ?
**R:** Les couleurs sémantiques sont déjà conformes WCAG AA/AAA ! Mais vous pouvez vérifier :

```bash
# Vérifier les contrastes
node packages/design-tokens/scripts/verify-colors.js
```

**Résultat attendu :**
```
✅ Action: 4.87:1 (WCAG AA)
✅ Info: 8.86:1 (WCAG AAA)
✅ Success: 4.72:1 (WCAG AA)
✅ Warning: 7.44:1 (WCAG AAA)
✅ Danger: 5.44:1 (WCAG AA)
✅ Neutral: 7.56:1 (WCAG AAA)
```

---

### 🚀 Questions Avancées

#### Q15: Peut-on utiliser les tokens en JavaScript/TypeScript ?
**R:** Oui ! Importez le package :

```typescript
import { designTokens } from '@fafa/design-tokens';

// Accéder aux valeurs
const primaryColor = designTokens.colors.primary[500]; // "#FF3B30"
const spacing = designTokens.spacing[4]; // "1rem"

// Utiliser dans un composant
const Button = () => (
  <button style={{
    backgroundColor: primaryColor,
    padding: spacing
  }}>
    Bouton
  </button>
);
```

---

#### Q16: Comment créer un thème custom (white label) ?
**R:** 

1. Créez un nouveau package de thème : `packages/theme-custom/`
2. Surcharge les CSS variables :

```css
/* theme-custom/src/styles/theme-custom.css */
:root {
  --color-primary-500: #8B5CF6; /* Nouveau violet */
  --color-secondary-500: #10B981; /* Nouveau vert */
}
```

3. Importez dans votre app :

```tsx
// app/root.tsx
import '@fafa/theme-custom/styles';
```

---

#### Q17: Les tokens sont compatibles avec shadcn/ui ?
**R:** Oui ! Le système inclut des variables de compatibilité shadcn :

```css
:root {
  --primary: 9 100% 59%; /* Équivalent HSL de notre primary-500 */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... */
}
```

Les composants shadcn fonctionnent sans modification !

---

#### Q18: Comment partager les tokens entre plusieurs projets ?
**R:** Publiez le package sur npm :

```bash
# Dans packages/design-tokens/
npm publish

# Dans un autre projet
npm install @fafa/design-tokens
```

Puis importez :

```tsx
// App externe
import '@fafa/design-tokens/css';
```

---

### 🎯 Bonnes Pratiques

#### Q19: Quelle est la checklist avant de coder un composant ?
**R:** 

- [ ] Utiliser les couleurs sémantiques (`action`, `info`, etc.)
- [ ] Utiliser les espacements de la grille 8px
- [ ] Utiliser les bonnes fonts (`heading`, `sans`, `mono`)
- [ ] Vérifier le contraste (utiliser `-contrast`)
- [ ] Tester en dark mode
- [ ] Éviter les valeurs hardcodées (#HEX, px fixes)

---

#### Q20: Quelles sont les erreurs à éviter ?
**R:** 

❌ **Erreurs courantes :**

```tsx
// ❌ Valeur HEX en dur
<div style={{ color: '#FF3B30' }}>

// ❌ Padding custom hors grille
<div className="p-[23px]">

// ❌ Utiliser 'danger' pour un CTA
<button className="bg-danger">Acheter</button>

// ❌ Ignorer le contraste automatique
<div className="bg-warning text-white"> {/* Mauvais contraste */}
```

✅ **Solutions :**

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

## 📚 Ressources Supplémentaires

- [Guide Complet](./GUIDE-COMPLET.md)
- [Système de Couleurs](./COLOR-SYSTEM.md)
- [Grille et Espacements](./GRID-SPACING.md)
- [Classes Utilitaires](./UTILITIES-GUIDE.md)
- [UI Kit](/ui-kit)
- [Dashboard Admin](/admin/design-system)

---

## 💬 Besoin d'aide ?

Si votre question n'est pas dans cette FAQ :

1. Consultez la [documentation complète](./GUIDE-COMPLET.md)
2. Regardez les exemples dans [/ui-kit](/ui-kit)
3. Explorez le code source dans `packages/design-tokens/`

---

**Dernière mise à jour :** Novembre 2025  
**Version :** 1.0.0
