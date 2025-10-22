# @monorepo/design-system

> Design System industrialisé pour NestJS-Remix Monorepo - Tokens, Thèmes, UI, Patterns

## 🎯 Architecture

```
@monorepo/design-system
├── tokens/          # Design tokens (couleurs, espacement, typo, etc.)
├── themes/          # Système de thèmes multi-marques (vitrine/admin, light/dark)
├── components/      # Composants UI (shadcn/ui + Radix UI)
├── patterns/        # Patterns compositionnels de haut niveau
└── styles/          # Styles globaux et CSS tokens
```

## 📦 Installation

```bash
npm install @monorepo/design-system
```

## 🚀 Usage

### Import des tokens

```typescript
import { designTokens } from '@monorepo/design-system/tokens';

// Utilisation
const primaryColor = designTokens.colors.primary['500'];
```

### Import des composants

```typescript
import { Button } from '@monorepo/design-system/components/button';

function App() {
  return <Button variant="primary">Click me</Button>;
}
```

### Import des thèmes

```typescript
import { ThemeProvider, useTheme } from '@monorepo/design-system/themes';

function App() {
  return (
    <ThemeProvider defaultBrand="vitrine" defaultMode="light">
      <YourApp />
    </ThemeProvider>
  );
}

function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>
      Toggle theme
    </button>
  );
}
```

### Import des styles

```typescript
// Dans votre app root ou entry point
import '@monorepo/design-system/styles';
```

## 🎨 Design Tokens

Les tokens sont générés automatiquement depuis `src/tokens/design-tokens.json` :

- **Colors** : primary, secondary, accent, semantic, neutral
- **Spacing** : 0-32 (échelle standardisée)
- **Typography** : fontFamily, fontSize, lineHeight, fontWeight
- **Shadows** : sm, base, md, lg, xl, 2xl, inner
- **Border Radius** : sm, base, md, lg, xl, 2xl, 3xl, full
- **Transitions** : fast, base, slow, slower
- **Z-index** : dropdown, sticky, fixed, modal, popover, tooltip

## 🎭 Système de Thèmes

### Marques supportées

- **Vitrine** : Thème public/site vitrine
- **Admin** : Thème backoffice/administration

### Modes

- **Light** : Mode clair
- **Dark** : Mode sombre

## 🛠️ Développement

### Scripts disponibles

```bash
# Développement avec watch mode
npm run dev

# Build complet (tokens + tsup)
npm run build

# Build uniquement les tokens
npm run tokens:build

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Tests
npm run test
npm run test:ui
npm run test:coverage
npm run test:sanity

# Storybook
npm run storybook
npm run build-storybook

# Tests d'accessibilité
npm run a11y
```

### Génération des tokens

Les tokens sont automatiquement générés lors du build. Pour les générer manuellement :

```bash
npm run tokens:build
```

Cela génère :
- `src/styles/tokens.css` - CSS variables
- `src/tokens/generated.ts` - Types TypeScript
- `dist/tailwind.tokens.js` - Config Tailwind

## 📚 Documentation

La documentation complète est disponible via Storybook :

```bash
npm run storybook
```

Ouvrez http://localhost:6006

## 🧪 Tests

### Tests unitaires

```bash
npm run test
```

### Tests de sanité (exports)

```bash
npm run test:sanity
```

### Tests d'accessibilité

```bash
npm run a11y
```

## 🚫 Règles de qualité

### ESLint : Anti-HEX hard-codé

Le package interdit les valeurs HEX hard-codées dans le code (sauf dans les fichiers de tokens). Utilisez toujours les design tokens.

❌ **Interdit** :
```typescript
<div style={{ color: '#ED5555' }}>...</div>
```

✅ **Autorisé** :
```typescript
import { designTokens } from '@monorepo/design-system/tokens';

<div style={{ color: designTokens.colors.accent.khmerCurry }}>...</div>
```

## 📦 Exports

Le package expose plusieurs entry points pour un tree-shaking optimal :

```typescript
// Barrel export
import * as DS from '@monorepo/design-system';

// Sous-chemins spécifiques
import { designTokens } from '@monorepo/design-system/tokens';
import { Button } from '@monorepo/design-system/components/button';
import { ThemeProvider } from '@monorepo/design-system/themes';
import { FormLayout } from '@monorepo/design-system/patterns/form-layout';

// Styles
import '@monorepo/design-system/styles';
```

## 🔧 Configuration Tailwind

Pour utiliser les tokens dans votre config Tailwind :

```javascript
const tokens = require('@monorepo/design-system/dist/tailwind.tokens.js');

module.exports = {
  theme: {
    extend: {
      colors: tokens.colors,
      spacing: tokens.spacing,
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      boxShadow: tokens.boxShadow,
      borderRadius: tokens.borderRadius,
    },
  },
};
```

## 🤝 Contribution

Voir [CONTRIBUTING.md](./CONTRIBUTING.md) pour les guidelines de contribution.

## 📄 License

MIT
