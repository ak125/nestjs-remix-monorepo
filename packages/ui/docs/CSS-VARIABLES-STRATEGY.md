# 🎨 Stratégie CSS Variables pour composants UI

## 🎯 Objectif
Remplacer les classes Tailwind directes par des CSS variables pour :
- ✅ Support multi-thèmes (vitrine/admin)
- ✅ Dark mode natif
- ✅ Respect règle "zéro HEX dans le code"

---

## 📋 Mapping Tailwind → CSS Variables

### **Colors**
```tsx
// ❌ AVANT (Tailwind direct)
className="bg-primary-600 text-white hover:bg-primary-700"

// ✅ APRÈS (CSS variables)
className="bg-[var(--color-primary-600)] text-[var(--text-inverse)] hover:bg-[var(--color-primary-700)]"
```

### **Semantic Colors**
```tsx
// Backgrounds
bg-primary-600     → bg-[var(--color-primary-600)]
bg-secondary-200   → bg-[var(--color-brand-200)]
bg-accent-500      → bg-[var(--color-accent-500)]
bg-success         → bg-[var(--color-success)]
bg-error           → bg-[var(--color-error)]
bg-warning         → bg-[var(--color-warning)]

// Text
text-primary-600   → text-[var(--color-primary-600)]
text-secondary-900 → text-[var(--text-primary)]
text-secondary-600 → text-[var(--text-secondary)]
text-white         → text-[var(--text-inverse)]

// Borders
border-primary-500      → border-[var(--color-primary-500)]
border-secondary-300    → border-[var(--border-primary)]
focus-visible:ring-primary-500 → focus-visible:ring-[var(--color-primary-500)]
```

### **Spacing** (garder Tailwind)
```tsx
// ✅ OK - Spacing tokens restent en classes Tailwind
className="px-4 py-2 gap-2 space-y-1.5"
// Ou utiliser les classes custom
className="p-space-4"
```

### **Shadows** (garder Tailwind)
```tsx
// ✅ OK - Shadows restent en classes Tailwind
className="shadow-md shadow-lg shadow-2xl"
```

### **Border Radius** (garder Tailwind)
```tsx
// ✅ OK - Border radius restent en classes Tailwind
className="rounded-md rounded-lg rounded-full"
```

### **Z-Index** (garder classes custom)
```tsx
// ✅ OK - Classes custom z-index
className="z-modal z-modalBackdrop z-dropdown"
```

---

## 🔧 Stratégie d'implémentation

### **1. Composants de base** (Button, Input, Dialog)
- Remplacer toutes les couleurs par CSS variables
- Garder spacing, shadows, radius en Tailwind
- Ajouter variantes `tone` pour mapper sur les thèmes

### **2. Nouveaux composants** (ProductCard, etc.)
- Utiliser uniquement CSS variables pour les couleurs
- Convention: `bg-[var(--color-*)]` pour les couleurs
- `className` composition avec `cn()` helper

### **3. Patterns métier**
- Hériter des variantes des composants de base
- Pas de couleurs hardcodées
- Props `theme` pour override si nécessaire

---

## 📝 Exemples de variantes CVA

### **Button avec tone**
```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      intent: {
        primary: "bg-[var(--color-primary-600)] text-[var(--text-inverse)] hover:bg-[var(--color-primary-700)]",
        accent: "bg-[var(--color-accent-600)] text-[var(--text-inverse)] hover:bg-[var(--color-accent-700)]",
        ghost: "bg-transparent text-[var(--color-primary-600)] hover:bg-[var(--bg-secondary)]",
      },
      tone: {
        brand: "focus-visible:ring-[var(--color-brand-500)]",
        semantic: "focus-visible:ring-[var(--color-success)]",
        neutral: "focus-visible:ring-[var(--border-primary)]",
      }
    }
  }
);
```

### **Input avec state**
```tsx
const inputVariants = cva(
  "w-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      state: {
        default: "border-[var(--border-primary)] focus-visible:ring-[var(--color-primary-500)]",
        error: "border-[var(--color-error)] focus-visible:ring-[var(--color-error)]",
        success: "border-[var(--color-success)] focus-visible:ring-[var(--color-success)]",
      },
      size: {
        sm: "h-8 px-2 text-sm rounded-md",
        md: "h-10 px-3 text-base rounded-md",
        lg: "h-12 px-4 text-lg rounded-lg",
      }
    }
  }
);
```

---

## ✅ Checklist de migration

- [ ] Button: Migrer couleurs vers CSS vars + ajouter `tone`, `radius`, `density`
- [ ] Input: Migrer couleurs + ajouter `state`, `size`, icons
- [ ] Dialog: Migrer couleurs (overlay, content, close)
- [ ] Créer composants patterns avec CSS vars uniquement
- [ ] Tester thème vitrine + admin
- [ ] Tester dark mode
- [ ] Vérifier a11y (contraste, focus-visible)

---

## 🎨 Résultat attendu

```tsx
// ✅ Composant final "pro-ready"
<Button
  intent="primary"
  tone="brand"
  size="md"
  radius="lg"
  density="comfy"
>
  Ajouter au panier
</Button>

// 🎭 Change automatiquement selon [data-theme="vitrine|admin"]
// 🌙 Change automatiquement selon [data-mode="light|dark"]
// ♿ Focus-visible avec ring adapté au thème
// 🎯 Zéro HEX, zéro couleur hardcodée
```
