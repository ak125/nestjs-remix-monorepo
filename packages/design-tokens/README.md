# @fafa/design-tokens

**Single source of truth** pour tous les design tokens du Design System.

---

## 🚀 Navigation Rapide

### 📚 Documentation

| Document | Durée | Pour qui | Description |
|----------|-------|----------|-------------|
| [`README-QUICK.md`](./README-QUICK.md) | 2 min | Décideurs | Résumé exécutif - Migration ou pas ? |
| [`CHEAT-SHEET.md`](./CHEAT-SHEET.md) | 5 min | Développeurs | Référence rapide des tokens |
| [`MIGRATION-GUIDE.md`](./MIGRATION-GUIDE.md) | 10 min | Développeurs | Guide complet de migration |
| [`VALIDATION-CHECKLIST.md`](./VALIDATION-CHECKLIST.md) | 5 min | QA/Dev | Checklist validation sans régression |
| [`AUDIT-DESIGN-SYSTEM.md`](./AUDIT-DESIGN-SYSTEM.md) | 15 min | Tech Lead | Audit complet + recommandations |

### 🛠️ Outils

- **Script validation** : [`/scripts/validate-migration.sh`](../../scripts/validate-migration.sh)

---

## 📦 Contenu

- `design-tokens.json` : 140+ tokens (colors, spacing, typography, shadows, etc.)
- Auto-génération :
  - **CSS variables** (`dist/tokens.css`)
  - **TypeScript types** (`dist/generated.ts`)
  - **Tailwind preset** (`dist/tailwind.config.js`)

## 🚀 Installation

```bash
npm install @fafa/design-tokens
```

## 📖 Usage

### 1. Import CSS Utilities (Recommandé) ✨

```css
/* frontend/app/global.css */
@import '@fafa/design-tokens/utilities';
```

```typescript
// Utilisation avec classes sémantiques
<div className="bg-brand-600 text-white p-space-4 rounded-lg shadow-md">
  Bouton
</div>

// Au lieu de :
<div className="bg-[var(--color-primary-600)] text-white padding-[1rem]">
```

**Classes disponibles** :
- **Couleurs** : `.bg-brand-{50-950}`, `.text-brand-{50-950}`, `.border-brand-{50-950}`
- **Accent** : `.bg-khmer-curry`, `.text-persian-indigo`, `.bg-vert`
- **Sémantiques** : `.bg-success`, `.text-error`, `.border-warning`
- **Spacing** : `.p-space-4`, `.m-space-8`, `.gap-space-6`
- **Border Radius** : `.rounded-sm`, `.rounded-lg`, `.rounded-full`
- **Shadows** : `.shadow-sm`, `.shadow-lg`, `.shadow-xl`

### 2. Import CSS Variables

```css
@import '@fafa/design-tokens/css';

.my-component {
  color: var(--color-primary-600);
  padding: var(--spacing-4);
}
```

### 3. Import TypeScript Types

```typescript
import { designTokens } from '@fafa/design-tokens';

const primaryColor = designTokens.colors.primary[600];
```

### 4. Extend Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  presets: [require('@fafa/design-tokens/tailwind')],
  // ... votre config
};
```

## 🔧 Build

```bash
npm run build
```

Génère :
- `dist/tokens.css` (CSS variables)
- `dist/generated.ts` (TypeScript types)
- `dist/tailwind.config.js` (Tailwind preset)
- `dist/index.{cjs,mjs,d.ts}` (Exports package)

## 📝 Modifier les Tokens

Éditez `src/design-tokens.json`, puis :

```bash
npm run build
```

Les outputs sont régénérés automatiquement.
