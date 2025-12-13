---
title: "003 design tokens"
status: draft
version: 1.0.0
---

# ADR-003: Design Tokens Strategy

## Status

**Accepted** - 2024-07-15

## Context

Pour construire un Design System cohérent sur notre monorepo full-stack, nous devions définir une stratégie de gestion des **design tokens** (couleurs, espacements, typographie, ombres, etc.). L'objectif était de garantir la cohérence visuelle entre :

- **Frontend public** (site vitrine e-commerce)
- **Frontend admin** (backoffice/dashboard)
- **Components UI réutilisables** (@repo/ui)
- **Emails HTML** (templates de notifications)

### Options Considérées

1. **CSS Variables Inline** : Définir variables dans chaque app
2. **Tailwind Config Personnalisé** : Config Tailwind unique par app
3. **Design Tokens Package** : Package NPM centralisé (choix retenu)
4. **Styled System / Theme UI** : Library externe avec provider
5. **CSS-in-JS Variables** : Styled-components/Emotion avec ThemeProvider

### Contexte Technique

- **Stack** : Remix (React), TailwindCSS 3.x, TypeScript 5.x
- **Besoins** :
  - 2 thèmes visuels (Admin vs Vitrine)
  - Cohérence couleurs, espacements, typographie
  - Type safety (TypeScript)
  - Hot reload en dev
  - Scalabilité (ajout futurs tokens)

## Decision

**Nous avons adopté une architecture à 3 layers avec package centralisé @repo/design-tokens.**

### Architecture Adoptée

```
packages/
├── design-tokens/              # Layer 1: Base Tokens
│   ├── src/
│   │   ├── design-tokens.json  # 140+ tokens (source of truth)
│   │   └── build.ts            # Scripts génération
│   ├── dist/
│   │   ├── tokens.css          # CSS variables
│   │   ├── utilities.css       # Classes utilitaires
│   │   ├── generated.ts        # Types TypeScript
│   │   └── tailwind.config.js  # Preset Tailwind
│   └── package.json
├── theme-admin/                # Layer 2: Admin Theme
│   ├── src/
│   │   └── index.ts            # Overrides tokens admin
│   └── package.json
└── theme-vitrine/              # Layer 2: Vitrine Theme
    ├── src/
    │   └── index.ts            # Overrides tokens vitrine
    └── package.json
```

### Layer 1: Base Tokens (@repo/design-tokens)

**Rôle** : Single source of truth, tokens génériques applicables partout

**Fichier source** : `design-tokens.json`
```json
{
  "colors": {
    "brand": {
      "50": "#f0f9ff",
      "100": "#e0f2fe",
      "600": "#0284c7",
      "900": "#0c4a6e"
    },
    "semantic": {
      "success": "#10b981",
      "error": "#ef4444",
      "warning": "#f59e0b"
    }
  },
  "spacing": {
    "1": "0.25rem",
    "2": "0.5rem",
    "4": "1rem",
    "8": "2rem"
  },
  "typography": {
    "fontFamily": {
      "sans": ["Inter", "system-ui", "sans-serif"],
      "mono": ["Fira Code", "monospace"]
    },
    "fontSize": {
      "xs": "0.75rem",
      "sm": "0.875rem",
      "base": "1rem",
      "lg": "1.125rem",
      "xl": "1.25rem"
    }
  },
  "shadows": {
    "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "md": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1)"
  },
  "borderRadius": {
    "none": "0",
    "sm": "0.125rem",
    "md": "0.375rem",
    "lg": "0.5rem",
    "full": "9999px"
  }
}
```

**Build Process** : Auto-génération 4 outputs
```bash
npm run build
# Génère:
# 1. dist/tokens.css       → CSS variables
# 2. dist/utilities.css    → Classes utilitaires
# 3. dist/generated.ts     → Types TypeScript
# 4. dist/tailwind.config.js → Preset Tailwind
```

**Usage dans Apps** :
```css
/* frontend/app/global.css */
@import '@repo/design-tokens/utilities';

/* Utilisation */
<div className="bg-brand-600 text-white p-space-4 shadow-md">
  Content
</div>
```

```typescript
// TypeScript avec types
import { designTokens } from '@repo/design-tokens';

const primaryColor = designTokens.colors.brand[600]; // Type-safe
```

```javascript
// Tailwind config
module.exports = {
  presets: [require('@repo/design-tokens/tailwind')],
  // Ajoute tous tokens comme classes Tailwind
};
```

### Layer 2: Theme Overrides

#### @repo/theme-admin

**Rôle** : Surcharge tokens pour backoffice (dashboard, gestion)

```typescript
// packages/theme-admin/src/index.ts
import { designTokens } from '@repo/design-tokens';

export const adminTheme = {
  ...designTokens,
  colors: {
    ...designTokens.colors,
    // Overrides admin-specific
    background: {
      primary: '#f8f9fa',
      secondary: '#ffffff',
      sidebar: '#2c3e50'
    },
    text: {
      primary: '#1a202c',
      secondary: '#4a5568',
      muted: '#a0aec0'
    }
  },
  spacing: {
    ...designTokens.spacing,
    // Dashboard spacieux
    dashboard: {
      padding: '2rem',
      gap: '1.5rem'
    }
  }
};

export type AdminTheme = typeof adminTheme;
```

**Usage** :
```typescript
// frontend/app/routes/admin/layout.tsx
import { adminTheme } from '@repo/theme-admin';

export default function AdminLayout() {
  return (
    <div style={{
      backgroundColor: adminTheme.colors.background.sidebar
    }}>
      <Sidebar />
      <main style={{ padding: adminTheme.spacing.dashboard.padding }}>
        <Outlet />
      </main>
    </div>
  );
}
```

#### @repo/theme-vitrine

**Rôle** : Surcharge tokens pour site public (e-commerce)

```typescript
// packages/theme-vitrine/src/index.ts
import { designTokens } from '@repo/design-tokens';

export const vitrineTheme = {
  ...designTokens,
  colors: {
    ...designTokens.colors,
    // Overrides vitrine-specific
    brand: {
      primary: '#0066cc',    // Bleu corporate
      secondary: '#ff6b35',  // Orange accent
      tertiary: '#4ecdc4'    // Vert CTA
    },
    background: {
      primary: '#ffffff',
      secondary: '#f5f5f5',
      accent: '#fff9f0'
    }
  },
  typography: {
    ...designTokens.typography,
    // Fonts e-commerce
    fontFamily: {
      heading: ['Poppins', 'sans-serif'],
      body: ['Inter', 'sans-serif']
    }
  }
};

export type VitrineTheme = typeof vitrineTheme;
```

**Usage** :
```typescript
// frontend/app/routes/_index.tsx
import { vitrineTheme } from '@repo/theme-vitrine';

export default function Homepage() {
  return (
    <section style={{
      backgroundColor: vitrineTheme.colors.background.accent,
      fontFamily: vitrineTheme.typography.fontFamily.heading
    }}>
      <h1 style={{ color: vitrineTheme.colors.brand.primary }}>
        Bienvenue
      </h1>
    </section>
  );
}
```

### Layer 3: TailwindCSS Integration

**Configuration** : Extend Tailwind avec tokens
```javascript
// frontend/tailwind.config.js
const { designTokens } = require('@repo/design-tokens');

module.exports = {
  presets: [require('@repo/design-tokens/tailwind')],
  theme: {
    extend: {
      colors: {
        // Base tokens automatiquement ajoutés via preset
        // Ajouts custom si besoin
        'admin-sidebar': '#2c3e50',
      },
      spacing: {
        // spacing-1 à spacing-8 auto-ajoutés
      },
      fontFamily: {
        sans: designTokens.typography.fontFamily.sans,
      }
    }
  }
};
```

**Classes générées** :
```html
<!-- Couleurs -->
<div class="bg-brand-600 text-white border-brand-700">

<!-- Spacing -->
<div class="p-space-4 m-space-8 gap-space-6">

<!-- Typography -->
<h1 class="font-sans text-xl">

<!-- Shadows -->
<div class="shadow-md rounded-lg">

<!-- Sémantiques -->
<button class="bg-success text-white">OK</button>
<div class="border-error text-error">Error</div>
```

## Rationale

### Avantages Design Tokens Package

#### 1. **Single Source of Truth**

✅ **Cohérence garantie** : 1 seul fichier définit couleurs/espacements
```json
// Changer primary → impacte tout le site
"brand": { "600": "#0284c7" }
// Si changé → propagé partout automatiquement
```

✅ **Pas de duplication** : Évite copier/coller variables
```typescript
// ❌ Sans tokens (duplication)
// frontend/app/styles/colors.ts
export const primary = '#0284c7';

// backend/src/mail/styles.ts
const primary = '#0284c7'; // Dupliqué !

// ✅ Avec tokens (centralisé)
import { designTokens } from '@repo/design-tokens';
const primary = designTokens.colors.brand[600];
```

#### 2. **Type Safety & DX**

✅ **Types TypeScript automatiques** : Autocomplete + validation
```typescript
import { designTokens } from '@repo/design-tokens';

// ✅ Autocomplete dans IDE
designTokens.colors.brand[600]; // OK
designTokens.colors.brand[999]; // ❌ Error: Property '999' does not exist

// ✅ Catch errors compile-time
const invalid = designTokens.spcing.x; // ❌ Typo détecté
```

✅ **Hot Reload** : Changements tokens → reload automatique
```bash
# Terminal 1: Watch tokens
cd packages/design-tokens && npm run build:watch

# Terminal 2: Dev frontend
cd frontend && npm run dev

# Modifier design-tokens.json → reload frontend immédiat
```

#### 3. **Flexibilité Theming**

✅ **Multi-themes facile** : Admin vs Vitrine avec overrides
```typescript
// Thème admin sombre
const adminDark = {
  ...adminTheme,
  colors: { background: { primary: '#1a202c' } }
};

// Thème vitrine high-contrast
const vitrineHighContrast = {
  ...vitrineTheme,
  colors: { text: { primary: '#000000' } }
};
```

✅ **Context-based theming** : Switch runtime si besoin (futur)
```typescript
// Futur: Dark mode toggle
const theme = isDarkMode ? adminDarkTheme : adminTheme;
```

#### 4. **Maintenance & Evolution**

✅ **Ajout tokens simple** : Modifier JSON → rebuild
```json
// Ajouter nouveau token
"colors": {
  "brand": { ... },
  "accent": {                 // ✨ Nouveau
    "teal": "#14b8a6",
    "purple": "#a855f7"
  }
}
```

✅ **Versioning sémantique** : @repo/design-tokens peut évoluer
```json
// package.json
{
  "name": "@repo/design-tokens",
  "version": "2.0.0",  // Breaking: rename "brand" → "primary"
  "version": "2.1.0",  // Feature: add "accent" colors
  "version": "2.1.1"   // Patch: fix spacing-6 value
}
```

#### 5. **Documentation & Collaboration**

✅ **Documentation riche** : 8 fichiers Markdown
- `README.md` : Usage général
- `COLOR-SYSTEM.md` : Palette complète
- `GRID-SPACING.md` : Grille et espacements
- `UTILITIES-GUIDE.md` : Classes utilitaires
- `CHEAT-SHEET.md` : Aide-mémoire rapide
- `FAQ.md` : Questions fréquentes
- `GUIDE-COMPLET.md` : Guide exhaustif
- `RECAPITULATIF.md` : Récapitulatif

✅ **Collaboration designers** : Fichier JSON éditable
- Designers peuvent modifier tokens sans toucher code
- Validation JSON empêche erreurs de syntaxe
- Git track changes sur tokens

### Inconvénients Acceptés

#### 1. **Build Step Requis**

❌ **Génération obligatoire** : `npm run build` après changements
```bash
# Workflow dev
1. Modifier design-tokens.json
2. npm run build (génère CSS/TS/Tailwind)
3. Apps reload automatiquement
```

**Mitigation** :
- Script `build:watch` pour auto-rebuild
- Build time rapide (<2s)
- Turborepo cache build

#### 2. **Abstractions Supplémentaires**

❌ **Complexité accrue** : 3 layers vs 1 fichier CSS
```
Sans tokens: colors.css (50 lignes)
Avec tokens: design-tokens.json + build.ts + 3 outputs (300 lignes)
```

**Mitigation** :
- Documentation exhaustive (8 fichiers)
- Exemples concrets dans README
- Cheat-sheet pour quick reference

#### 3. **Dépendance Package Interne**

❌ **Couplage** : Apps dépendent de @repo/design-tokens
```json
// Si design-tokens break → impacte toutes apps
"dependencies": {
  "@repo/design-tokens": "workspace:*"
}
```

**Mitigation** :
- Tests unitaires sur tokens (validation schema)
- Versioning sémantique strict
- Breaking changes documentés dans CHANGELOG

#### 4. **Tooling Specificity**

❌ **Custom build script** : Maintenance long-terme
```typescript
// build.ts : script custom génération
// Si bug → doit être fixé manuellement
```

**Mitigation** :
- Script simple (~100 lignes)
- Tests automatiques sur outputs
- Fallback: éditer CSS/TS manuellement si besoin

## Comparison Table

| Critère | Tokens Package | CSS Variables Inline | Tailwind Config | Styled System | CSS-in-JS |
|---------|----------------|----------------------|-----------------|---------------|-----------|
| **Type Safety** | ✅ Excellent (TS) | ❌ Aucun | ⚠️ Partial | ✅ Bon | ✅ Excellent |
| **Hot Reload** | ✅ Oui (watch) | ✅ Oui | ⚠️ Rebuild requis | ✅ Oui | ✅ Oui |
| **Multi-themes** | ✅ Facile (overrides) | ❌ Difficile | ⚠️ Moyen | ✅ Natif | ✅ Natif |
| **Cohérence** | ✅ Garantie (1 source) | ❌ Duplication | ⚠️ Partielle | ✅ Bonne | ✅ Bonne |
| **Maintenance** | ✅ Facile (JSON) | ❌ Difficile | ⚠️ Moyenne | ⚠️ Moyenne | ❌ Complexe |
| **Performance** | ✅ Excellent (CSS) | ✅ Excellent | ✅ Excellent | ⚠️ Runtime | ❌ Runtime overhead |
| **Learning Curve** | ⚠️ Moyenne | ✅ Faible | ⚠️ Moyenne | ⚠️ Moyenne | ❌ Élevée |
| **Ecosystem** | ⚠️ Custom | ✅ Standard CSS | ✅ Tailwind mature | ⚠️ Niche | ✅ Riche |
| **Bundle Size** | ✅ Petit (CSS) | ✅ Petit | ✅ Petit | ⚠️ Moyen | ❌ Gros (JS) |

## Consequences

### Positives

1. ✅ **Cohérence visuelle** : 100% des couleurs/espacements centralisés
2. ✅ **Type safety** : Erreurs détectées compile-time (TypeScript)
3. ✅ **Productivité** : Classes utilitaires + autocomplete IDE
4. ✅ **Scalabilité** : Ajout tokens sans refactor
5. ✅ **Multi-themes** : Admin vs Vitrine avec overrides propres

### Négatives

1. ❌ **Build step** : Génération requise (mais automatisable)
2. ❌ **Complexité initiale** : 3 layers vs 1 fichier CSS
3. ❌ **Maintenance scripts** : Build custom à maintenir

### Neutral

1. ⚠️ **Documentation** : Exhaustive (8 fichiers) mais nécessaire pour adoption
2. ⚠️ **Versioning** : Permet évolution controlled mais ajoute overhead

## Implementation Details

### Current Tokens Inventory

**Couleurs** : 140+ valeurs
- Brand colors: 50-950 scale (10 nuances)
- Accent colors: Khmer Curry, Persian Indigo, Vert, etc.
- Semantic colors: success, error, warning, info
- Background colors: primary, secondary, accent
- Text colors: primary, secondary, muted

**Spacing** : 20 valeurs
- Scale: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96

**Typography** :
- Font families: sans, mono
- Font sizes: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl
- Font weights: light, normal, medium, semibold, bold, extrabold
- Line heights: tight, normal, relaxed, loose

**Shadows** : 6 valeurs
- sm, md, lg, xl, 2xl, inner

**Border Radius** : 8 valeurs
- none, sm, md, lg, xl, 2xl, 3xl, full

### Migration Statistics

**Migration complétée** : 1,300+ composants migrés
- Frontend routes: 213 routes utilisent tokens
- Components UI: 50+ composants @repo/ui
- Admin dashboard: 100% coverage
- Site vitrine: 95% coverage (legacy 5% en cours)

**Performance Impact** :
- Bundle size: +2KB CSS (négligeable)
- Build time: +2s (génération tokens)
- Runtime: 0ms overhead (CSS variables natif browser)

## Alternatives Considered

### 1. CSS Variables Inline

**Rejected Reasons:**
- Duplication entre apps (frontend, emails, etc.)
- Pas de type safety TypeScript
- Difficile maintenir cohérence

**Would Reconsider If:**
- Projet ultra-simple (<5 composants)
- Pas besoin multi-themes
- Équipe non TypeScript

### 2. Tailwind Config Unique

**Rejected Reasons:**
- Couplage fort Tailwind (difficile switch library)
- Overrides thème complexes
- Pas utilisable en dehors Tailwind (emails HTML)

**Would Reconsider If:**
- 100% TailwindCSS (pas de CSS custom)
- Pas besoin tokens en TypeScript

### 3. Styled System / Theme UI

**Rejected Reasons:**
- Runtime overhead JavaScript
- Dépendance library externe
- Learning curve élevée équipe
- Bundle size augmenté

**Would Reconsider If:**
- Besoin runtime theming dynamique (user preferences)
- Application 100% React (pas de SSR concerns)

### 4. CSS-in-JS (Styled-components/Emotion)

**Rejected Reasons:**
- Performance overhead runtime
- Bundle size JavaScript
- SSR complexity (hydration)
- Remix recommande éviter CSS-in-JS

**Would Reconsider If:**
- Framework change (ex: Next.js)
- Besoin dynamic styling intense

## Migration Strategy

### Vers Tailwind Config Unique (Simplification)

**Effort Estimé:** 1 semaine (80h)

**Steps:**
1. Copier design-tokens.json dans tailwind.config.js
2. Remplacer imports `@repo/design-tokens` par `theme()`
3. Supprimer package design-tokens
4. Supprimer build scripts

**Risques:**
- Perte type safety TypeScript
- Pas utilisable hors Tailwind (emails)
- Difficile multi-themes

### Vers Styled System (Runtime Theming)

**Effort Estimé:** 3 semaines (240h)

**Steps:**
1. Installer @theme-ui/core ou styled-system
2. Créer theme objects depuis design-tokens.json
3. Wrapper apps dans ThemeProvider
4. Migrer components vers system props
5. Tests visuels

**Bénéfices:**
- Runtime theme switching
- CSS-in-JS benefits (scoped styles)

## Related Decisions

- **ADR-002**: Monorepo Architecture - Permet packages/@repo/design-tokens
- **ADR-004**: State Management Frontend - Indépendant de cette décision

## References

### Documentation
- [Design Tokens Package README](../../packages/design-tokens/README.md)
- [Color System Guide](../../packages/design-tokens/COLOR-SYSTEM.md)
- [Utilities Guide](../../packages/design-tokens/UTILITIES-GUIDE.md)
- [Complete Guide](../../packages/design-tokens/GUIDE-COMPLET.md)
- [Cheat Sheet](../../packages/design-tokens/CHEAT-SHEET.md)

### Standards
- [W3C Design Tokens Community Group](https://www.w3.org/community/design-tokens/)
- [Design Tokens Format Module](https://tr.designtokens.org/format/)

### Tools
- [Style Dictionary](https://amzn.github.io/style-dictionary/) - Alternative tool (non utilisé)
- [Theo](https://github.com/salesforce-ux/theo) - Salesforce tokens tool (non utilisé)

## Metrics

### Current Coverage

**Tokens Usage** :
- Frontend: 100% routes utilisent tokens
- Components UI: 100% @repo/ui
- Admin: 100% dashboard
- Vitrine: 95% (legacy 5%)

**Build Performance** :
- Token generation: 1.8s
- CSS output: 12KB minified
- TypeScript types: 450 lines

### Target Metrics (6 mois)

- ✅ 100% coverage frontend (achieved: 95%)
- ✅ <2s build time (achieved: 1.8s)
- ✅ <15KB CSS bundle (achieved: 12KB)
- ⏳ 0 hardcoded colors in codebase (current: ~20 occurrences legacy)

---

**Last Updated:** 2025-11-14  
**Authors:** Frontend Team, Design Team  
**Reviewers:** Tech Lead  
**Status:** Accepted (production depuis 2024-08-01)
