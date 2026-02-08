# Design System Master Reference - DCO V2

> Tokens, palettes, and typography for Automecanik

## Color Palettes

### Base Palette (Brand)

```css
--color-primary: #1D1D1F;      /* Near black (Apple-inspired) */
--color-secondary: #007AFF;    /* Trust blue */
--color-accent: #FF6B35;       /* Automecanik orange */
--color-background: #FAFAFA;   /* Warm white */
--color-text: #1D1D1F;         /* Dark text */
```

### Semantic Colors

```css
--color-success: #34C759;      /* Verified green */
--color-warning: #FF9500;      /* Warning amber */
--color-error: #FF3B30;        /* Error red */
--color-info: #007AFF;         /* Info blue */
```

### Pack-Specific CTAs

| Pack | CTA Color | Hex |
|------|-----------|-----|
| Urgence | Urgent Red | `#FF3B30` |
| Confiance | Verified Green | `#34C759` |
| Pro Mecano | Automecanik Orange | `#FF6B35` |
| Budget | Savings Green | `#34C759` |
| Diagnostic | Trust Teal | `#059669` |

---

## Typography

### Font Families

| Use Case | Primary | Fallback |
|----------|---------|----------|
| **Headings** | Montserrat | system-ui, sans-serif |
| **Body** | DM Sans | system-ui, sans-serif |
| **Mono (OEM refs)** | JetBrains Mono | monospace |

### Font Scale

```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

### Line Heights

```css
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

---

## Spacing Scale

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

---

## Border Radius

```css
--radius-none: 0;
--radius-sm: 0.125rem;   /* 2px */
--radius-md: 0.375rem;   /* 6px */
--radius-lg: 0.5rem;     /* 8px */
--radius-xl: 0.75rem;    /* 12px */
--radius-2xl: 1rem;      /* 16px */
--radius-full: 9999px;
```

---

## Shadows

```css
/* Subtle elevation */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* Card elevation */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);

/* Hover elevation */
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);

/* Modal elevation */
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
```

---

## Transitions

```css
--transition-fast: 100ms ease-out;
--transition-normal: 200ms ease-out;
--transition-slow: 300ms ease-out;
--transition-spring: 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

## Breakpoints

```css
--screen-sm: 640px;
--screen-md: 768px;
--screen-lg: 1024px;
--screen-xl: 1280px;
--screen-2xl: 1536px;
```

### Mobile-First Pattern

```css
/* Mobile (default) */
.component { ... }

/* Tablet */
@media (min-width: 768px) { .component { ... } }

/* Desktop */
@media (min-width: 1024px) { .component { ... } }

/* Wide */
@media (min-width: 1440px) { .component { ... } }
```

---

## Z-Index Scale

```css
--z-dropdown: 1000;
--z-sticky: 1020;
--z-fixed: 1030;
--z-modal-backdrop: 1040;
--z-modal: 1050;
--z-popover: 1060;
--z-tooltip: 1070;
```

---

## Component Tokens

### Buttons

```css
/* Primary CTA */
--btn-primary-bg: var(--color-success);
--btn-primary-text: #FFFFFF;
--btn-primary-hover: #2FB350;

/* Secondary */
--btn-secondary-bg: transparent;
--btn-secondary-border: var(--color-primary);
--btn-secondary-text: var(--color-primary);

/* Touch target minimum */
--btn-min-height: 44px;
--btn-min-width: 44px;
```

### Cards

```css
--card-bg: #FFFFFF;
--card-border: rgba(0, 0, 0, 0.08);
--card-radius: var(--radius-lg);
--card-padding: var(--space-4);
--card-shadow: var(--shadow-md);
--card-hover-shadow: var(--shadow-lg);
```

### Trust Badges

```css
--badge-verified-bg: rgba(52, 199, 89, 0.1);
--badge-verified-text: #34C759;
--badge-verified-border: rgba(52, 199, 89, 0.3);

--badge-compatible-bg: rgba(0, 122, 255, 0.1);
--badge-compatible-text: #007AFF;

--badge-unknown-bg: rgba(142, 142, 147, 0.1);
--badge-unknown-text: #8E8E93;
```

---

## Effects Library

### Verified Animation

```css
@keyframes verified-appear {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

.verified-badge {
  animation: verified-appear 200ms ease-out forwards;
}
```

### Pulse CTA (Urgence)

```css
@keyframes pulse-cta {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.urgent-cta {
  animation: pulse-cta 1.5s infinite;
}
```

### Compatibility Check

```css
@keyframes shake-verify {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

.compatibility-check:active {
  animation: shake-verify 150ms ease;
}
```

### Stagger Reveal

```css
.stagger-item {
  opacity: 0;
  transform: translateY(10px);
  animation: stagger-reveal 200ms ease-out forwards;
}

.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 50ms; }
.stagger-item:nth-child(3) { animation-delay: 100ms; }

@keyframes stagger-reveal {
  to { opacity: 1; transform: translateY(0); }
}
```

---

## Anti-Patterns (FORBIDDEN)

### Fonts
- Inter, Roboto, Arial, Helvetica, Open Sans

### Colors
- `#7C3AED`, `#8B5CF6`, `#A78BFA` (generic AI purples)

### Patterns
- Purple gradients on white
- Glass morphism cards
- Excessive drop shadows (>3 layers)
- Emojis as icons
- Stock photography in hero

---

## Version

- **Version:** 2.0.0
- **Source:** `backend/src/modules/ai-cos/services/ux-design-system.service.ts`
- **Last Updated:** 2026-01-28
