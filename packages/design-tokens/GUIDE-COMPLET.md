# 🎨 Guide Complet des Design Tokens

## 🤔 C'est quoi les Design Tokens ?

Les **design tokens** sont comme un **dictionnaire universel de style** pour votre application. Au lieu d'écrire `#FF3B30` partout dans votre code, vous utilisez `--color-primary-500`.

### 💡 Analogie Simple

Imaginez que vous construisez une maison :
- **Sans tokens** : Vous dites "peinture rouge #FF3B30" à chaque pièce
- **Avec tokens** : Vous dites "couleur principale" partout, et si vous changez d'avis, vous ne modifiez qu'un seul endroit !

---

## 🎯 Pourquoi c'est important ?

### ✅ Avantages

1. **Cohérence** : Même design partout
2. **Maintenance** : Changez une valeur → tout se met à jour
3. **Scalabilité** : Facile d'ajouter des thèmes (dark mode, etc.)
4. **Communication** : Designers et devs parlent le même langage
5. **Performance** : CSS Variables = pas de rebuild

### ❌ Sans Design Tokens

```tsx
// 😱 Code spaghetti
<div style={{ 
  color: '#FF3B30',
  padding: '16px',
  borderRadius: '8px'
}}>
  Button
</div>

// Si vous voulez changer le rouge → chercher dans 500 fichiers !
```

### ✅ Avec Design Tokens

```tsx
// 😍 Code propre et maintenable
<div className="bg-brand-500 p-space-4 rounded-lg">
  Button
</div>

// Changement de couleur → 1 seul fichier à modifier !
```

---

## 📦 Votre Système Actuel

Vous avez **140+ tokens** organisés en catégories :

### 1. 🎨 **Couleurs** (60+ tokens)

#### Palette Primaire
```css
--color-primary-500: #FF3B30;  /* Votre rouge principal */
--color-secondary-500: #0F4C81; /* Votre bleu */
```

#### Couleurs Sémantiques (les plus importantes!)
```css
--color-semantic-action: #D63027;     /* Boutons CTA */
--color-semantic-info: #0F4C81;       /* Navigation, liens */
--color-semantic-success: #1E8449;    /* Messages de succès */
--color-semantic-warning: #D68910;    /* Avertissements */
--color-semantic-danger: #C0392B;     /* Erreurs */
--color-semantic-neutral: #4B5563;    /* États neutres */
```

**✨ Toutes conformes WCAG AA/AAA** (accessibilité garantie!)

### 2. 📏 **Espacements** (20+ tokens)

```css
/* Échelle fixe */
--spacing-4: 1rem;        /* 16px */
--spacing-8: 2rem;        /* 32px */

/* Échelle responsive (clamp) */
--spacing-fluid-section-md: clamp(3rem, 6vw, 4rem);
```

### 3. 📝 **Typographie** (30+ tokens)

```css
/* Tailles */
--font-size-base: 1rem;
--font-size-fluid-xl: clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem);

/* Familles */
--font-heading: 'Montserrat', sans-serif;
--font-body: 'Inter', sans-serif;
```

### 4. 🌐 **Layout** (15+ tokens)

```css
/* Containers */
--container-xl: 1280px;

/* Grid */
--grid-columns-desktop: 12;
--grid-gutter-desktop: 2rem;

/* Breakpoints */
--breakpoint-lg: 1024px;
```

### 5. 🎭 **Effets** (15+ tokens)

```css
/* Shadows */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

/* Border Radius */
--radius-lg: 0.5rem;

/* Transitions */
--transition-base: 250ms;

/* Z-Index */
--z-modal: 1050;
```

---

## 🚀 Comment les Utiliser ?

### Méthode 1 : Classes Utilitaires (RECOMMANDÉ ⭐)

```tsx
// Le plus simple et lisible
<button className="bg-brand-500 text-white p-space-4 rounded-lg shadow-md">
  Mon Bouton
</button>
```

**Classes disponibles** :
- `bg-brand-{50-950}` : Couleurs de fond
- `text-brand-{50-950}` : Couleurs de texte
- `p-space-4` : Padding avec token
- `m-space-8` : Margin avec token
- `rounded-lg` : Border radius
- `shadow-md` : Ombres

### Méthode 2 : CSS Variables

```css
.mon-composant {
  background: var(--color-primary-500);
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-base);
}
```

### Méthode 3 : TypeScript (pour logique)

```typescript
import { designTokens } from '@fafa/design-tokens';

const primaryColor = designTokens.colors.primary[500]; // '#FF3B30'
const spacing = designTokens.spacing[4]; // '1rem'
```

---

## 🎨 Cas d'Usage Concrets

### 1. Créer un Bouton CTA

```tsx
// ✅ GOOD: Utilise les tokens sémantiques
<button className="
  bg-[var(--color-semantic-action)] 
  text-[var(--color-semantic-action-contrast)]
  p-space-4 
  rounded-lg 
  shadow-md
  transition-[var(--transition-base)]
  hover:shadow-lg
">
  Acheter maintenant
</button>
```

### 2. Créer une Card

```tsx
<div className="
  bg-white
  p-space-6
  rounded-xl
  shadow-base
  border border-neutral-200
">
  <h3 className="text-fluid-xl font-heading mb-space-4">
    Titre de la Card
  </h3>
  <p className="text-neutral-600">
    Contenu...
  </p>
</div>
```

### 3. Message de Succès

```tsx
<div className="
  bg-[var(--color-semantic-success)]
  text-[var(--color-semantic-success-contrast)]
  p-space-4
  rounded-lg
  shadow-sm
">
  ✅ Commande confirmée !
</div>
```

### 4. Layout Responsive

```css
.section {
  padding-block: var(--spacing-fluid-section-lg);
  max-width: var(--container-xl);
  margin-inline: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns-desktop), 1fr);
  gap: var(--grid-gutter-desktop);
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: repeat(var(--grid-columns-mobile), 1fr);
    gap: var(--grid-gutter-mobile);
  }
}
```

---

## 🎭 Thèmes et Dark Mode

Vos tokens supportent le dark mode out-of-the-box !

```css
/* Light mode (par défaut) */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

/* Dark mode */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

**Utilisation :**

```tsx
// Ajouter la classe 'dark' au root
<html className="dark">
  {/* Tout s'adapte automatiquement ! */}
</html>
```

---

## 🛠️ Modifier les Tokens

### Étape 1 : Éditer le fichier source

```bash
# Le fichier maître
packages/design-tokens/src/tokens/design-tokens.json
```

### Étape 2 : Rebuild

```bash
cd packages/design-tokens
npm run build
```

### Étape 3 : Profit ! 🎉

Tous les fichiers sont régénérés :
- ✅ `dist/tokens.css` (CSS variables)
- ✅ `dist/generated.ts` (TypeScript types)
- ✅ `dist/tailwind.config.js` (Config Tailwind)
- ✅ `dist/utilities.css` (Classes utilitaires)

---

## 📊 Hiérarchie des Couleurs

```
Couleurs Sémantiques (TOUJOURS utiliser en priorité)
├── action      → Boutons CTA principaux
├── info        → Navigation, liens
├── success     → Confirmations
├── warning     → Avertissements
├── danger      → Erreurs, suppressions
└── neutral     → États neutres, disabled

Couleurs de Palette (pour design custom)
├── primary     → Rouge #FF3B30 (10 nuances)
├── secondary   → Bleu #0F4C81 (10 nuances)
├── accent      → Couleurs d'accent variées
└── neutral     → Gris (11 nuances + variantes)
```

---

## 🎯 Règles d'Or

### ✅ DO

1. **Toujours utiliser les tokens** au lieu de valeurs en dur
   ```tsx
   ✅ className="text-brand-500"
   ❌ style={{ color: '#FF3B30' }}
   ```

2. **Respecter la sémantique des couleurs**
   ```tsx
   ✅ <Button variant="action">CTA</Button>
   ❌ <Button style={{ background: 'red' }}>CTA</Button>
   ```

3. **Utiliser les espacements fluides pour les sections**
   ```css
   ✅ padding: var(--spacing-fluid-section-md);
   ❌ padding: 50px;
   ```

4. **Préférer les classes utilitaires**
   ```tsx
   ✅ className="p-space-4 rounded-lg"
   ❌ style={{ padding: '16px', borderRadius: '8px' }}
   ```

### ❌ DON'T

1. **Jamais de couleurs en dur**
   ```tsx
   ❌ <div style={{ color: '#FF3B30' }}>
   ```

2. **Jamais de valeurs magiques**
   ```css
   ❌ padding: 23px; /* Pourquoi 23 ? */
   ```

3. **Jamais mélanger les systèmes**
   ```tsx
   ❌ <div className="p-4" style={{ padding: '20px' }}>
   ```

---

## 🔍 Debugging

### Voir tous les tokens disponibles

```tsx
// Composant dev pour visualiser
import { designTokens } from '@fafa/design-tokens';

console.log(designTokens);
```

### Vérifier les contrastes WCAG

```bash
cd packages/design-tokens
node scripts/verify-colors.js
```

### Inspecter en live

```tsx
// Ajouter dans votre app
<div style={{
  position: 'fixed',
  bottom: 0,
  right: 0,
  background: 'white',
  padding: '1rem',
  boxShadow: 'var(--shadow-lg)',
  zIndex: 9999
}}>
  <pre>{JSON.stringify(designTokens, null, 2)}</pre>
</div>
```

---

## 📚 Ressources

### Documentation dans le projet

- `/packages/design-tokens/README.md` - Guide rapide
- `/packages/design-tokens/COLOR-SYSTEM.md` - Système de couleurs
- `/packages/design-tokens/GRID-SPACING.md` - Grilles et espacements
- `/packages/design-tokens/UTILITIES-GUIDE.md` - Classes utilitaires

### Ressources externes

- [Design Tokens W3C](https://www.w3.org/community/design-tokens/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [CSS Custom Properties](https://developer.mozilla.org/fr/docs/Web/CSS/--*)

---

## 🚀 Exercice Pratique

Essayez de créer ce composant avec vos tokens :

```tsx
// Card Produit
<article className="
  bg-white
  p-space-6
  rounded-xl
  shadow-md
  hover:shadow-xl
  transition-[var(--transition-base)]
  border border-neutral-200
">
  <img 
    src="/product.jpg" 
    alt="Produit"
    className="w-full h-48 object-cover rounded-lg mb-space-4"
  />
  
  <h2 className="
    font-heading
    text-fluid-xl
    text-neutral-900
    mb-space-2
  ">
    Nom du Produit
  </h2>
  
  <p className="
    text-neutral-600
    mb-space-4
    line-clamp-3
  ">
    Description du produit...
  </p>
  
  <div className="flex items-center justify-between">
    <span className="
      text-fluid-2xl
      font-bold
      text-brand-600
    ">
      99,99 €
    </span>
    
    <button className="
      bg-[var(--color-semantic-action)]
      text-[var(--color-semantic-action-contrast)]
      px-space-6
      py-space-3
      rounded-lg
      font-medium
      shadow-sm
      hover:shadow-md
      transition-[var(--transition-base)]
    ">
      Acheter
    </button>
  </div>
</article>
```

---

## 🎉 Conclusion

Vos design tokens sont un **système professionnel** qui vous permettent de :

1. ✅ **Maintenir** facilement votre design
2. ✅ **Garantir** l'accessibilité (WCAG AA/AAA)
3. ✅ **Scaler** sans réécrire le CSS
4. ✅ **Themer** (dark mode, white label)
5. ✅ **Collaborer** efficacement (designers + devs)

**Next steps :**
- [ ] Explorer `/frontend/app/routes/ui-kit.*` pour voir des exemples
- [ ] Créer votre premier composant avec les tokens
- [ ] Lire `COLOR-SYSTEM.md` pour maîtriser les couleurs sémantiques
- [ ] Tester le dark mode !

---

**Questions fréquentes** : Voir [FAQ.md](./FAQ.md)  
**Changelog** : Voir [CHANGELOG.md](./CHANGELOG.md)  
**Contribuer** : Voir [CONTRIBUTING.md](./CONTRIBUTING.md)
