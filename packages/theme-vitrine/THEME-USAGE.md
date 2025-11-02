# 🎨 Utilisation du système de thèmes

## Import des CSS

Dans votre fichier root (`app/root.tsx` pour Remix) :

```tsx
// Importer les tokens de base
import '@fafa/design-tokens/css';
import '@fafa/design-tokens/utilities';

// Importer les thèmes
import '@fafa/theme-automecanik/css';
import '@fafa/theme-admin/css';
```

## Utilisation du ThemeSwitcher

### 1. Wrapper l'application

```tsx
import { ThemeSwitcher } from '@fafa/theme-automecanik';

export default function App() {
  return (
    <ThemeSwitcher defaultTheme="vitrine" defaultMode="light">
      <YourApp />
    </ThemeSwitcher>
  );
}
```

### 2. Créer un bouton de switch

```tsx
import { useThemeSwitcher } from '@fafa/theme-automecanik';

function ThemeToggle() {
  const { theme, mode, setTheme, toggleMode } = useThemeSwitcher();

  return (
    <div>
      {/* Switch theme (vitrine <-> admin) */}
      <button onClick={() => setTheme(theme === 'vitrine' ? 'admin' : 'vitrine')}>
        {theme === 'vitrine' ? '🏢 Admin' : '🏪 Vitrine'}
      </button>

      {/* Toggle dark mode */}
      <button onClick={toggleMode}>
        {mode === 'light' ? '🌙 Dark' : '☀️ Light'}
      </button>
    </div>
  );
}
```

## Variables CSS disponibles

### Thème Vitrine (`[data-theme="vitrine"]`)

```css
/* Brand colors (Automecanik) */
--color-brand-600: #031754 (bleu Automecanik)

/* Primary (Orange) */
--color-primary-600: #ff6b35

/* Accent (Rouge CTA) */
--color-accent-600: #ED5555

/* Success (Vert) */
--color-success: #1FDC93

/* Backgrounds */
--bg-primary: #FFFFFF
--bg-secondary: #F3F8F8
--text-primary: #350B60
```

### Thème Admin (`[data-theme="admin"]`)

```css
/* Brand colors (Professional) */
--color-brand-600: #475569

/* Primary (Bleu) */
--color-primary-600: #2563eb

/* Accent (Violet) */
--color-accent-600: #9333ea

/* Backgrounds */
--bg-primary: #ffffff
--bg-secondary: #f8fafc
--text-primary: #0f172a
```

## Dark Mode

Le dark mode est automatique via `[data-mode="dark"]` :

```css
[data-theme="vitrine"][data-mode="dark"] {
  --bg-primary: #0f172a;
  --text-primary: #ffffff;
}
```

## Exemple complet

```tsx
// app/root.tsx
import '@fafa/design-tokens/css';
import '@fafa/design-tokens/utilities';
import '@fafa/theme-automecanik/css';
import '@fafa/theme-admin/css';
import { ThemeSwitcher } from '@fafa/theme-automecanik';

export default function Root() {
  return (
    <html>
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeSwitcher defaultTheme="vitrine" defaultMode="light">
          <Outlet />
        </ThemeSwitcher>
        <Scripts />
      </body>
    </html>
  );
}
```

## Classes utilitaires

Les classes utilitaires utilisent les tokens automatiquement :

```tsx
// Utilise --color-primary-600 (adapté au thème actif)
<button className="bg-primary-600 text-primary-600-contrast">
  Click me
</button>

// Utilise --color-brand-600 (adapté au thème actif)
<div className="bg-brand-600 text-white">
  Brand section
</div>
```

## SSR-safe

Le `ThemeSwitcher` est SSR-safe :
- Pas d'hydration mismatch
- Sauvegarde dans localStorage (client-side only)
- Supporte les attributs `data-theme` et `data-mode`
