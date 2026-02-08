# Automecanik Design System - Source of Truth

> **LOGIC:** Ce fichier est la source de vérité unique pour tout travail UI/UX.
> Généré à partir des skills `ui-ux-pro-max` + `frontend-design` + `design-tokens`.
> Pour les pages spécifiques, créer des overrides dans `design-system/pages/[page].md`.

---

## 1. Règles Non-Négociables

### OBLIGATOIRE

| Règle | Source | Exemple |
|-------|--------|---------|
| shadcn/ui depuis `~/components/ui/` | shadcn.csv R1-3 | `import { Button } from '~/components/ui/button'` |
| lucide-react pour icônes | SKILL.md L78 | `import { Package, CheckCircle2 } from 'lucide-react'` |
| CSS variables pour couleurs | shadcn.csv R4-6 | `bg-primary`, `text-destructive` |
| FormField pour tous les inputs | shadcn.csv R16-19 | `<FormField><FormControl><Input/></FormControl></FormField>` |
| Dialog avec DialogTitle | shadcn.csv R11-13 | `<DialogHeader><DialogTitle>Titre</DialogTitle></DialogHeader>` |
| Table avec structure complète | shadcn.csv R24-26 | `<Table><TableHeader><TableBody>` |

### INTERDIT (Anti-patterns)

| Violation | Source | Alternative |
|-----------|--------|-------------|
| Emojis comme icônes | SKILL.md L78,349 | lucide-react SVG icons |
| Hex colors inline | shadcn.csv R4 | CSS variables: `bg-primary`, `text-success` |
| `<Input onChange={setState}>` | shadcn.csv R17 | react-hook-form + FormField |
| Native `<select>` | shadcn.csv R20-21 | shadcn Select component |
| Div grid pour tables | shadcn.csv R24 | shadcn Table component |
| Icon buttons sans aria-label | shadcn.csv R54 | `<Button aria-label="Close">` |
| Light backgrounds pour dashboards | ui-reasoning.csv R6 | Dark mode ou neutral backgrounds |

---

## 2. Directions Automecanik (Contexte E-commerce Auto)

> Source: `.claude/skills/frontend-design/SKILL.md` lignes 56-66

| Intent | Tone | Colors | Typography | Effects |
|--------|------|--------|------------|---------|
| **Urgence** (repair-fast) | Industrial/Utilitarian | `#FF3B30` (action red), pulse | Condensed, bold | Countdown badges, pulse animations |
| **Confiance** (trust/OEM) | Luxury/Refined | `#34C759` (trust green) | DM Sans, subtle shadows | Verified badges, quality indicators |
| **Pro Mécano** | Editorial/Dense | Neutral + OEM refs | JetBrains Mono | Copy buttons, high-density grids |
| **Budget** (économique) | Playful/Value | Savings green | Bold prices | Price-drop effects, comparisons |
| **Diagnostic** | Soft/Technical | `#6366F1` (purple) | Clear hierarchy | Wizard progress, confidence meters |

### Quand utiliser chaque direction

```
Page produit pièce urgente → Urgence (red pulse, countdown livraison)
Page marque premium (Bosch, Valeo) → Confiance (verified badges, OEM quality)
Dashboard admin/pro → Pro Mécano (dense data, monospace refs)
Page promotions/soldes → Budget (savings highlights, price drops)
Wizard diagnostic véhicule → Diagnostic (progress steps, confidence)
```

---

## 3. Couleurs Sémantiques

> Source: `packages/design-tokens/src/tokens/design-tokens.json`

### Palette Primaire

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#FF3B30` | Action CTA, urgence |
| `secondary` | `#0F4C81` | Navigation, liens |
| `action` | `#D63027` | Boutons d'action principaux |
| `info` | `#0F4C81` | Information, navigation |
| `success` | `#1E8449` | Validation, confirmations |
| `warning` | `#D68910` | Alertes, attention |
| `danger/destructive` | `#C0392B` | Erreurs, suppressions |
| `neutral` | `#4B5563` | États désactivés |

### Mapping Status → Couleurs

| Status | Background | Text | Icon |
|--------|------------|------|------|
| **PASS/CONFORME** | `bg-success/10` | `text-success` | `CheckCircle2` |
| **FAIL/NON-CONFORME** | `bg-destructive/10` | `text-destructive` | `XCircle` |
| **WARN/ATTENTION** | `bg-warning/10` | `text-warning` | `AlertTriangle` |
| **INFO** | `bg-info/10` | `text-info` | `Info` |
| **PENDING** | `bg-muted` | `text-muted-foreground` | `Clock` |
| **NEUTRAL** | `bg-muted` | `text-muted-foreground` | — |

### Utilisation CSS

```tsx
// CORRECT
<Badge className="bg-success/10 text-success">CONFORME</Badge>
<Badge variant="destructive">NON-CONFORME</Badge>

// INTERDIT
<Badge className="bg-green-100 text-green-800">...</Badge>  // raw colors
<Badge className="bg-[#1E8449]/10">...</Badge>              // hardcoded hex
```

---

## 4. Règles shadcn/ui (Extraites de shadcn.csv)

### Composants HIGH Severity

| Component | Do | Don't |
|-----------|----|----|
| **Dialog** | `<DialogHeader><DialogTitle><DialogDescription>` | Missing title/description |
| **Form** | `useForm + FormField + zodResolver` | Custom form state without FormField |
| **AlertDialog** | Pour confirmations destructives | Dialog pour confirmations |
| **Sidebar** | `<SidebarProvider><Sidebar>` | Sidebar sans provider |
| **Tooltip** | `<TooltipProvider>` au niveau app | TooltipProvider par tooltip |
| **Toast** | `toast.success()`, `toast.error()` | Generic `toast()` pour tout |

### Composants MEDIUM Severity

| Component | Do | Don't |
|-----------|----|----|
| **Table** | `TableHeader + TableBody + TableRow + TableCell` | Div grid pour données tabulaires |
| **Select** | `SelectTrigger + SelectValue + SelectContent + SelectItem` | Native `<select>` |
| **Tabs** | `defaultValue` spécifié | Sans defaultValue |
| **Accordion** | `type="single"` ou `type="multiple"` | Type par défaut |
| **Popover** | `align` et `side` props | Alignment par défaut |

### Patterns à Suivre

```tsx
// Form Pattern (shadcn.csv R16-19)
<Form {...form}>
  <FormField
    control={form.control}
    name="email"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>

// Dialog Pattern (shadcn.csv R11-14)
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Titre obligatoire</DialogTitle>
      <DialogDescription>Description recommandée</DialogDescription>
    </DialogHeader>
    {/* Contenu */}
  </DialogContent>
</Dialog>

// Table Pattern (shadcn.csv R24-26)
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Colonne</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Valeur</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

## 5. Typography

> Source: `packages/design-tokens` + `frontend-design SKILL.md`

### Font Families

| Usage | Font | Token |
|-------|------|-------|
| Headings | Montserrat / DM Sans Bold | `font-heading` |
| Body | DM Sans / system-ui | `font-sans` |
| Data/Code | JetBrains Mono / Roboto Mono | `font-mono` |
| OEM References | JetBrains Mono | `font-mono` |

### Automotive-Specific Typography

```tsx
// Référence OEM (Pro Mécano direction)
<span className="font-mono text-sm">OE: 34.11.6.778.048</span>

// Prix (Budget direction)
<span className="text-2xl font-bold text-success">29,90 €</span>
<span className="text-sm line-through text-muted-foreground">39,90 €</span>

// Urgence
<span className="font-bold text-destructive animate-pulse">URGENT</span>
```

---

## 6. Spacing & Layout

> Source: `packages/design-tokens`

### Spacing Scale (8px grid)

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Gaps entre icônes |
| `sm` | 8px | Gaps inline, padding badges |
| `md` | 16px | Padding cards, gaps sections |
| `lg` | 24px | Padding sections |
| `xl` | 32px | Gaps majeurs |
| `2xl` | 48px | Margins sections |

### Admin Dashboard Layout

```tsx
// DashboardShell pattern
<div className="space-y-6">
  {/* Header avec breadcrumb et actions */}
  <div className="flex justify-between items-center">
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
    <div className="flex gap-2">{actions}</div>
  </div>

  {/* KPI Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {kpis}
  </div>

  {/* Main Content */}
  <div className="space-y-4">
    {children}
  </div>
</div>
```

---

## 7. Animations & Transitions

> Source: `tailwind.config.cjs` + skills

### Transitions Standard

| Duration | Usage | Class |
|----------|-------|-------|
| 150ms | Micro-interactions (hover) | `duration-150` |
| 200ms | Boutons, badges | `duration-200` |
| 300ms | Cards, panels | `duration-300` |
| 500ms | Modals, reveals | `duration-500` |

### Animations Automecanik

| Animation | Usage | Class |
|-----------|-------|-------|
| `pulse` | Urgence, alertes | `animate-pulse` |
| `shimmer` | Loading skeletons | `animate-shimmer` |
| `scale-in` | Apparition modals | `animate-scale-in` |
| `verified-reveal` | Badge OEM | `animate-verified-reveal` |

### Règles Motion

```tsx
// TOUJOURS respecter prefers-reduced-motion
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }}
  className="motion-reduce:transition-none"
/>

// Transitions sur hover (150-300ms)
<Card className="transition-all duration-200 hover:shadow-lg">

// INTERDIT: scale transforms qui shift le layout
// <Card className="hover:scale-105"> ❌
```

---

## 8. Admin Patterns (Composants Métier)

### KpiCard

```tsx
interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  trend?: { value: number; direction: 'up' | 'down' };
}
```

### StatusBadge

```tsx
type StatusType = 'PASS' | 'FAIL' | 'WARN' | 'PENDING' | 'NEUTRAL';

// Auto-mapping vers couleurs sémantiques + icônes lucide
<StatusBadge status="PASS" />  // → green + CheckCircle2 + "CONFORME"
<StatusBadge status="FAIL" />  // → red + XCircle + "NON-CONFORME"
```

### ValidationPanel

```tsx
interface ValidationPanelProps {
  title: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  tests: Array<{
    id: string;      // "T-A", "T-B", etc.
    label: string;
    value: number | string;
    status: 'pass' | 'fail' | null;
  }>;
  onRecalculate?: () => void;
}
```

---

## 9. Pre-Delivery Checklist

> Source: `ui-ux-pro-max/SKILL.md` L346-377 + `frontend-design/SKILL.md` L75-86

Avant de livrer du code UI, vérifier:

### Visual Quality
- [ ] **No emojis as icons** — Utiliser lucide-react SVG
- [ ] **Icons from consistent set** — Lucide uniquement
- [ ] **Hover states don't shift layout** — Pas de `scale` transforms
- [ ] **Theme colors directly** — `bg-primary` pas `var(--primary)`

### Interaction
- [ ] **cursor-pointer on all clickables** — Cards, buttons, liens
- [ ] **Smooth transitions** — 150-300ms pour hover states
- [ ] **Focus states visible** — Pour navigation clavier

### Accessibility
- [ ] **Light mode contrast 4.5:1** — Vérifier avec DevTools
- [ ] **aria-label on icon buttons** — `<Button aria-label="Fermer">`
- [ ] **prefers-reduced-motion respected** — `motion-reduce:` classes

### Responsive
- [ ] **375px** — Mobile iPhone SE
- [ ] **768px** — Tablet
- [ ] **1024px** — Desktop small
- [ ] **1440px** — Desktop large
- [ ] **No horizontal scroll** — Sur tous breakpoints

### Performance
- [ ] **CLS = 0** — Réserver dimensions pour images/skeletons
- [ ] **Skeleton dimensions** — Match loaded content size

---

## 10. Fichiers de Référence

| Fichier | Contenu |
|---------|---------|
| `packages/design-tokens/src/tokens/design-tokens.json` | Tokens JSON source |
| `frontend/tailwind.config.cjs` | Config Tailwind avec tokens |
| `frontend/components.json` | Config shadcn/ui |
| `.claude/skills/ui-ux-pro-max/SKILL.md` | Skill UI/UX complet |
| `.claude/skills/frontend-design/SKILL.md` | Directions Automecanik |
| `.claude/skills/ui-ux-pro-max/data/stacks/shadcn.csv` | 62 règles shadcn |
| `.claude/skills/ui-ux-pro-max/data/ui-reasoning.csv` | 100 catégories UI |

---

*Dernière mise à jour: 2026-01-29*
*Généré par Claude Code à partir des skills ui-ux-pro-max + frontend-design*
