---
name: frontend-design
description: Use when building or redesigning a frontend component, page, layout, or section in the AutoMecanik monorepo — produces production-grade UI with a distinctive aesthetic direction and a measurable a11y/perf budget, avoiding generic AI design patterns. Triggers — "build a [component]", "design [page]", "create a UI for X", "refonte visuelle d'un élément", or chained after a UI audit identifying missing components.
type: technique
status: stable
owners: ['@ak125']
domain: D15
runtime_class: mutating
llm_safe: true
last_verified: '2026-05-18'
license: Internal - Automecanik. Inherits upstream MIT terms from anthropics/claude-plugins-official/frontend-design.
compatibility: Designed for Claude Code in the AutoMecanik monorepo. Stack — React Router 8 + shadcn/ui + Tailwind CSS + lucide-react. Requires packages/design-tokens (SoT for colors, typography, spacing).
tags: [frontend, react-router, shadcn, tailwind, design-tokens, a11y, wcag]
metadata:
  version: "2.0"
  upstream: anthropics/claude-plugins-official/frontend-design@2026-05
  argument-hint: "[component or page description]"
  spec: agentskills.io/specification v1
---

## Overview

Production frontend skill: implements React Router 8 + shadcn/ui code with an assumed aesthetic direction and a measurable accessibility + performance budget.

**Canon principle** — *intentionnalité > intensité*. Output must be identifiable as AutoMecanik on five measurable axes (design tokens, component states, a11y WCAG, perf budget, motion), not on vague exhortations.

## When to use

| Detected context | Activation |
|---|---|
| New component or page request | `/frontend-design [description]` |
| Visual redesign of an existing element | `/frontend-design [élément à refaire]` |
| New homepage / landing section | `/frontend-design [section description]` |
| Chain after a UI gap audit | `/frontend-design [composant manquant]` |

**Do NOT use for**: pure state/fetcher logic refactor, isolated CSS bugfix, adding a single prop to an existing component, server-only NestJS work.

## Workflow 4 phases (mandatory)

### Phase 1 — Brief

1. **Identify need**: component / page / section / redesign?
2. **User context**: who uses it? what goal? primary device?
3. **Tech constraints**:
   - Framework: React Router 8 (Vite HMR)
   - UI lib: shadcn/ui (`~/components/ui/`)
   - Icons: `lucide-react`
   - Styling: Tailwind CSS only (no CSS modules, no styled-components, no inline `style={}`)
4. **Design system check**: read `packages/design-tokens/src/tokens.json` (the hex/typography SoT) before picking any color or typography. See [`references/canon-links.md`](references/canon-links.md) for the token SoT path, the non-color design-system gates, and the anti-invention guard.

### Phase 2 — Prototype (aesthetic direction)

1. Pick a bold aesthetic direction (see *Aesthetic direction* table below)
2. Anchor the palette on the SoT tokens (extension justified or rejected, never invented)
3. Define typography hierarchy (heading vs body vs data)
4. Sketch structure (H1, sections, CTA, micro-interactions)
5. **Before fixing CTA / section order**, open the exemplars — [`exemplars/good-r2-mobile.md`](exemplars/good-r2-mobile.md) (role-correct structure, lucide icon not emoji) and [`exemplars/antipattern-editorial-sprawl.md`](exemplars/antipattern-editorial-sprawl.md) (keep handoffs above editorial).

### Phase 3 — Code (implementation)

1. Implement with shadcn/ui + Tailwind classes
2. Handle every state listed in *Component States* table
3. Stay within the *Performance budget* table
4. Test on 4 breakpoints: 375 / 768 / 1024 / 1440 px

### Phase 4 — Validate

Apply the *Pre-Delivery Checklist*. **Any failing item → fix before delivery.**

---

## Design System Integration (SoT)

**Source of truth** — `packages/design-tokens/src/tokens.json` (consumed via `packages/design-tokens/src/tokens/generated.ts`).

**Authoritative palette** (verified against SoT 2026-05):

| Role | Token path | Hex (`500`) | Usage |
|---|---|---|---|
| Brand / trust | `colors.primary.500` | `#0F1E38` (navy) | Headers, navigation, surfaces signaling confiance |
| Marine / info | `colors.secondary.500` | `#0F4C81` | Liens, info, accents secondaires |
| **CTA / action** | `colors.semantic.action` | `#F97316` (orange) | Boutons CTA, accents urgence, prix, pulse |
| Success | `colors.semantic.success` | `#1E8449` | Validation, états « OK » |
| Danger | `colors.semantic.danger` | `#C0392B` | Erreurs, suppression, alertes critiques |
| Warning | `colors.semantic.warning` | `#D68910` | Avertissements, états dégradés |
| Surface | `colors.neutral.50` | `#F5F7FA` | Fond cartes, zones secondaires |
| Border | `colors.neutral.100` | `#E5E7EB` | Séparateurs, contours |
| Text default | `colors.neutral.800` | `#1F2937` | Corps de texte |

> ⚠️ **Drift fix 2026-05** — anciennes versions de ce skill annonçaient `primary = #e8590c (orange)`. C'est faux : l'orange est dans `semantic.action`, le primary est navy. Toujours relire `design-tokens.json` avant de citer un hex.

**Rules**:
- Use existing tokens first
- If extension required (ex: couleur de gamme), document the justification in the PR description and propose adding it to SoT
- **NEVER hardcode hex** without referencing the token path
- Import via `import { tokens } from '@fafa/design-tokens'` (path: `packages/design-tokens/src/tokens/generated.ts`) or CSS vars exported by `@fafa/design-tokens`

**Typography SoT** (`typography.fontFamily`):

| Role | Stack | Use |
|---|---|---|
| Heading | `'Outfit', system-ui, …` | H1-H6, display |
| Body | `'DM Sans', system-ui, …` | Paragraphs, UI text |
| Data / mono | `ui-monospace, 'SF Mono', 'Cascadia Code', …` | OEM codes, refs, technical |

> ⚠️ **Drift fix 2026-05** — anciennes versions citaient Montserrat Bold / Archivo Black / Syncopate. Le SoT actuel est **Outfit** pour heading + **DM Sans** pour body. Aligner systématiquement avant tout import Google Fonts.

---

## Component States (mandatory for every interactive)

| State | Tailwind hook | Visual |
|---|---|---|
| Default | base | Neutral |
| Hover | `hover:` + `transition` 150–300 ms | Darken or `scale(1.02)` |
| Focus | `focus-visible:ring-2` + `ring-offset-2` | Ring 2 px primary |
| Active / pressed | `active:scale-[0.98]` | Immediate visual feedback |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` | Non-interactive |
| Loading | Spinner or `animate-pulse` skeleton | Width preserved (no CLS) |
| Error | `border-red-500` + helper text | Aria-described |
| Empty | Illustration / CTA | « Aucun résultat » + action |

---

## Accessibility audit (WCAG 2.1 AA)

| Check | Threshold | Tool |
|---|---|---|
| Contrast ratio (normal text) | ≥ 4.5:1 | Chrome DevTools / `pa11y` |
| Contrast ratio (large text ≥ 18 px / 14 bold) | ≥ 3:1 | Chrome DevTools |
| Focus visible | Ring visible on all interactives | Tab nav |
| Touch target | ≥ 44 × 44 px on mobile | CSS measure |
| `aria-label` | All icon-only buttons | Code audit |
| `alt` text | All meaningful images | Code audit |
| `prefers-reduced-motion` | Animations gated | `@media (prefers-reduced-motion: reduce)` |
| Semantic HTML | `<button>`, never `<div onClick>` | Code audit |

---

## Performance budget

| Metric | Budget | How to verify |
|---|---|---|
| CSS addition | < 5 KB / component | Tailwind class estimate |
| JS bundle impact | < 10 KB / component | Import analysis |
| Animation properties | `transform` + `opacity` only | No `width` / `height` / `top` / `left` |
| CLS | 0 | Skeletons with fixed dimensions |
| Images | WebP / AVIF, lazy | `loading="lazy"` + modern format |
| Fonts | Max 2 families | `font-display: swap` |

---

## Aesthetic direction (commit to one)

Pick one direction — do not blend. *Intentionnalité > intensité*.

| Intent | Tone | Visual cues |
|---|---|---|
| Urgence (repair-fast) | Industrial / utilitarian | Action orange (`#F97316`), condensed type, pulse animations, countdown badges |
| Confiance (trust) | Refined | Navy primary (`#0F1E38`), success green (`#1E8449`), verified badges, subtle shadows |
| Pro Mecano | Editorial / dense | Monospace OEM refs, high-density grids, copy buttons, technical specs |
| Budget | Playful / value | Success green accents, comparison tables, price-drop animations |
| Diagnostic | Soft / technical | Info blue, wizard progress, confidence meters |

**Anti-patterns** (commit to avoiding):

- Generic fonts without justification — if Inter / system UI is your pick, document why vs Outfit / DM Sans
- Cliché color schemes (e.g. purple gradient on white) outside the brand palette
- Predictable shadcn/ui defaults with no token customization
- Cookie-cutter layout with no contextual character

> The rule is **justify > prohibit**. A common font / palette is acceptable if the design rationale is explicit; an exotic choice without rationale is rejected.

---

## Red Flags — STOP if you catch yourself thinking…

| Thought | Reality |
|---|---|
| « Inter goes faster, let me just use it » | Justify vs brand identity ; without a real reason → pick the SoT Outfit / DM Sans |
| « Skipping the 8 states, the happy path is enough » | Pre-Delivery Checklist is non-negotiable. Don't ship without all states |
| « Client just wants something that works » | Phase 1 brief is mandatory. No brief → no code |
| « I'll hardcode this one hex, it's just here » | `design-tokens.json` is the SoT. Hardcode = future regression |
| « Design is subjective, my taste suffices » | Five measurable axes — tokens, states, a11y, perf, motion. Verify, don't argue |
| « Token says #e8590c orange primary » | **Stale**. Re-read `design-tokens.json` ; primary is navy, action is orange |
| « Montserrat / Archivo for headings » | **Stale**. SoT is Outfit. Verify before importing fonts |

---

## Core Pattern — before / after

**Before** (generic AI output — *what to avoid*):

```tsx
// frontend/app/components/hero-cta.tsx
import { Button } from '~/components/ui/button';

export function HeroCta() {
  return (
    <section style={{ padding: '4rem', background: '#fff' }}>
      <h1 style={{ fontFamily: 'Inter', fontSize: '48px', color: '#000' }}>
        Welcome to AutoMecanik
      </h1>
      <p style={{ fontFamily: 'Inter', color: '#666' }}>
        Find the right part for your car.
      </p>
      <Button style={{ background: '#3b82f6' }}>Search</Button>
    </section>
  );
}
```

**Why it fails**: inline styles, hardcoded hex unrelated to SoT, Inter without justification, generic blue CTA instead of brand action orange, no states (hover / focus / disabled), no a11y label, no responsive breakpoints, no motion.

**After** (aligned to canon — *Industrial / Urgence* direction):

```tsx
// frontend/app/components/hero-cta.tsx
import { Search } from 'lucide-react';
import { Button } from '~/components/ui/button';

export function HeroCta() {
  return (
    <section
      aria-labelledby="hero-cta-heading"
      className="
        relative isolate overflow-hidden
        bg-[color:var(--color-primary-500)] text-white
        px-6 py-20 md:px-12 md:py-28
      "
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,_rgba(249,115,22,0.18),_transparent_55%)]"
      />
      <h1
        id="hero-cta-heading"
        className="font-heading text-4xl md:text-6xl font-bold tracking-tight max-w-3xl"
      >
        La pièce qu'il vous faut.{' '}
        <span className="text-[color:var(--color-semantic-action)]">Aujourd'hui.</span>
      </h1>
      <p className="font-body mt-6 max-w-xl text-lg text-white/80">
        Recherche par plaque, marque ou référence OEM. Livraison J+1 sur 95 % du catalogue.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row gap-4">
        <Button
          size="lg"
          className="
            bg-[color:var(--color-semantic-action)] hover:bg-[color:var(--color-semantic-action)]/90
            text-white font-semibold
            transition-transform duration-200
            hover:scale-[1.02] active:scale-[0.98]
            focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            motion-reduce:transform-none motion-reduce:transition-none
          "
        >
          <Search className="size-5 mr-2" aria-hidden />
          Trouver ma pièce
        </Button>
      </div>
    </section>
  );
}
```

**Why it works**: CSS vars from SoT tokens (primary navy + action orange), Outfit heading via `font-heading` Tailwind class, DM Sans body via `font-body`, hover / focus / active / disabled states, `motion-reduce` respected, semantic `<h1>` + `aria-labelledby`, responsive breakpoints, no inline styles, no hardcoded hex outside CSS vars.

> **Note** — CSS variables `--color-primary-500` / `--color-semantic-action` / `font-heading` / `font-body` are emitted by `@fafa/design-tokens`. If your Tailwind config does not yet expose them, wire them via `tailwind.config.ts` `theme.extend.colors` and `fontFamily` (don't redefine the hex).

---

## Pre-Delivery Checklist

Before declaring the work done:

- [ ] No emoji as icons (use SVG via Heroicons / lucide-react)
- [ ] `cursor-pointer` on every clickable element
- [ ] Hover states with smooth transitions (150–300 ms)
- [ ] Light mode: text contrast ≥ 4.5:1
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive verified at 375 / 768 / 1024 / 1440 px
- [ ] CLS = 0 (skeletons with fixed dimensions)
- [ ] Design tokens respected (no hardcoded hex)
- [ ] Typography uses `font-heading` (Outfit) / `font-body` (DM Sans)
- [ ] All component states handled (hover, focus, active, disabled, loading, error, empty)
- [ ] No `style={{ … }}` inline (Tailwind only)

---

## Skill chain (real skills only)

| Skill | Direction | Trigger |
|---|---|---|
| `ui-ux-pro-max` | → propose | After build, validate design system standards (contrast, a11y, hierarchy) |
| `responsive-audit` | → propose | After build, validate mobile compliance (touch targets, viewport, fluid tokens) |
| `vehicle-ops` | ← receives | If `VehicleSelector` breaks, rebuild via this skill |

## Références canon & exemplars

Open these **at the decision point** (see Phase 1 design-system check / Phase 2), not as passive reading:

- **Canon (links only, never restated)** — [`references/canon-links.md`](references/canon-links.md): the token SoT (hex/typography authority), non-color design-system gates, and an anti-invention guard. `NO CANONICAL AUTHORITY` — the linked source always wins; this skill builds UI structure and never invents SEO content/keywords/URLs. (Page-role canon lives in `role-matrix.md` via CLAUDE.md, not here.)
- **Exemplars** — [`exemplars/good-r2-mobile.md`](exemplars/good-r2-mobile.md) (real production R2 surface: lucide icon, not emoji) · [`exemplars/antipattern-editorial-sprawl.md`](exemplars/antipattern-editorial-sprawl.md) (editorial must sit below the handoffs; R8 no-cart is correct-by-canon).
- **Test scenarios** (gap testing, application scenarios) — [`references/test-scenarios.md`](references/test-scenarios.md).
