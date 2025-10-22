# @fafa/design-tokens

**Single source of truth** pour tous les design tokens du Design System.

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

### Import CSS Variables

```css
@import '@fafa/design-tokens/css';

.my-component {
  color: var(--colors-primary-600);
  padding: var(--spacing-4);
}
```

### Import TypeScript Types

```typescript
import { designTokens } from '@fafa/design-tokens';

const primaryColor = designTokens.colors.primary[600];
```

### Extend Tailwind Config

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
