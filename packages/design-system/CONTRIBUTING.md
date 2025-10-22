# Contributing to @monorepo/design-system

Merci de contribuer au Design System ! Ce guide vous aidera à maintenir la qualité et la cohérence du projet.

## 🎯 Principes de base

### 1. Tokenisation systématique

**❌ INTERDIT** : Hard-coder des valeurs de design
```typescript
<div style={{ color: '#ED5555' }}>...</div>
```

**✅ REQUIS** : Utiliser les design tokens
```typescript
import { designTokens } from '../tokens/generated';

<div style={{ color: designTokens.colors.accent.khmerCurry }}>...</div>
```

### 2. Accessibilité (a11y)

- **Contraste minimum** : WCAG AA (4.5:1 pour le texte normal)
- **Navigation clavier** : tous les composants interactifs
- **ARIA labels** : pour les éléments sans texte visible
- **Focus visible** : toujours styliser le focus state

### 3. Responsive Design

- **Mobile-first** : commencer par les petits écrans
- **Breakpoints cohérents** : utiliser les tokens de spacing
- **Tests multi-devices** : tester sur plusieurs tailles

## 🏗️ Structure d'un composant

```typescript
/**
 * 📝 Brève description du composant
 * 
 * @example
 * <Button variant="primary" size="md">
 *   Click me
 * </Button>
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Définition des variants avec CVA
const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-11 px-8 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

// Props interface
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// Composant avec forwardRef
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
```

## 📦 Ajouter un nouveau composant

### 1. Créer le fichier composant

```bash
# Dans packages/design-system/src/components/
touch my-component.tsx
```

### 2. Implémenter le composant

- Suivre la structure ci-dessus
- Utiliser CVA pour les variants
- Exporter les types
- Ajouter JSDoc avec exemple

### 3. Créer la story Storybook

```typescript
// my-component.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './my-component';

const meta = {
  title: 'Components/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary'],
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'primary',
    children: 'My Component',
  },
};
```

### 4. Créer les tests

```typescript
// my-component.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './my-component';

describe('MyComponent', () => {
  it('should render with default props', () => {
    render(<MyComponent>Test</MyComponent>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should apply variant classes', () => {
    render(<MyComponent variant="primary">Test</MyComponent>);
    const element = screen.getByText('Test');
    expect(element).toHaveClass('bg-primary');
  });
});
```

### 5. Exporter le composant

```typescript
// src/components/index.ts
export * from './my-component';
```

## 🎨 Modifier les Design Tokens

### 1. Éditer le JSON source

```json
// src/tokens/design-tokens.json
{
  "colors": {
    "myNewColor": {
      "500": "#FF5733"
    }
  }
}
```

### 2. Régénérer les tokens

```bash
npm run tokens:build
```

Cela génère automatiquement :
- `src/styles/tokens.css`
- `src/tokens/generated.ts`
- `dist/tailwind.tokens.js`

### 3. Utiliser le nouveau token

```typescript
import { designTokens } from '@monorepo/design-system/tokens';

const color = designTokens.colors.myNewColor['500'];
```

## 🧪 Tests

### Exécuter tous les tests

```bash
npm run test
```

### Tests avec UI

```bash
npm run test:ui
```

### Coverage

```bash
npm run test:coverage
```

### Tests de sanité (exports)

```bash
npm run test:sanity
```

## 📚 Documentation

### Lancer Storybook en dev

```bash
npm run storybook
```

### Build Storybook pour déploiement

```bash
npm run build-storybook
```

## ✅ Checklist avant commit

- [ ] Tokens : pas de valeurs hard-codées (lint vérifie automatiquement)
- [ ] Types : TypeScript sans erreurs (`npm run typecheck`)
- [ ] Lint : ESLint propre (`npm run lint`)
- [ ] Tests : tous passent (`npm run test`)
- [ ] Stories : composant documenté dans Storybook
- [ ] A11y : tests d'accessibilité OK
- [ ] Responsive : testé sur plusieurs tailles

## 🚀 Publication

Le package utilise `prepack` pour build automatique :

```bash
npm publish
```

La séquence suivante s'exécute automatiquement :
1. `tokens:build` - Génère les tokens
2. `build` - Build avec tsup
3. `publish` - Publication sur npm

## 💡 Bonnes pratiques

### CSS-in-JS vs Tailwind

**Préférer Tailwind** pour la cohérence :
```typescript
// ✅ Bon
<div className="flex items-center gap-4 p-4">

// ❌ Éviter
<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
```

### Composition vs Héritage

**Préférer la composition** :
```typescript
// ✅ Bon
<Card>
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>

// ❌ Éviter
<ExtendedCard title="..." content="..." />
```

### Performance

- **Lazy loading** : `React.lazy()` pour les gros composants
- **Memoization** : `React.memo()` si re-renders fréquents
- **Callbacks** : `useCallback()` pour les props functions

## 🐛 Debugging

### Build issues

```bash
# Clean et rebuild
npm run clean
npm install
npm run build
```

### Type issues

```bash
# Régénérer les types
npm run tokens:build
npm run typecheck
```

### Storybook issues

```bash
# Clear cache
rm -rf node_modules/.cache
npm run storybook
```

## 📞 Support

Pour toute question :
1. Consulter la documentation (README.md)
2. Vérifier les stories Storybook
3. Ouvrir une issue GitHub

Merci de contribuer au Design System ! 🎉
