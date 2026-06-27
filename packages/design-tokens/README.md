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

- `src/tokens.json` : source **DTCG** (W3C `$value`/`$type`), 140+ tokens (colors, spacing, typography, shadows, etc.)
- Auto-génération (**Style Dictionary**) :
  - **CSS variables** (`dist/tokens.css`, export `./css`)
  - **TypeScript** (`dist/index.*`, export `.` → `designTokens`)
  - **Projection Tailwind plate** (`src/tailwind-tokens.cjs`, export `./tailwind-tokens`)

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

### 4. Tokens dans Tailwind

`./tailwind-tokens` exporte une **projection plate** (`{ colors, spacing, typography, shadows, … }`)
consommée dans `theme.extend` (voir `frontend/tailwind.config.cjs`) :

```javascript
// tailwind.config.cjs
const tokens = require('@fafa/design-tokens/tailwind-tokens');
module.exports = {
  theme: { extend: { colors: { ...tokens.colors }, spacing: { ...tokens.spacing } } },
};
```

## 🔧 Build

```bash
npm run build         # Style Dictionary (validation Zod) → tsup
npm run build:check   # garde anti-dérive : rebuild en mémoire + byte-diff vs commité (CI)
```

Génère depuis `src/tokens.json` :
- `src/styles/tokens.css` → `dist/tokens.css` (CSS variables, export `./css`)
- `src/tailwind-tokens.cjs` (projection plate, export `./tailwind-tokens`)
- `src/tokens/generated.ts` → `dist/index.{cjs,js,d.ts}` (`designTokens` + types, export `.`)

## 📝 Modifier les Tokens

Éditez la source DTCG `src/tokens.json`, puis :

```bash
npm run build
```

Les artefacts (`tokens.css`, `tailwind-tokens.cjs`, `generated.ts`) sont régénérés et validés
(schéma Zod + garde de contraste WCAG). **Ne jamais** éditer ces fichiers générés à la main.
