---
name: frontend-design
description: "Create distinctive, production-grade frontend interfaces with high design quality. Generates creative, polished code that avoids generic AI aesthetics."
license: Internal - Automecanik
argument-hint: "[component or page description]"
version: "1.1"
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Quand proposer ce skill

| Contexte detecte | Proposition |
|------------------|------------|
| User demande un nouveau composant ou page | `/frontend-design [description]` |
| Redesign ou refonte visuelle d'un element | `/frontend-design [element a refaire]` |
| Nouveau layout ou section homepage | `/frontend-design [section description]` |
| Apres `/ui-os` qui identifie des lacunes | `/frontend-design [composant manquant]` (chaine UI) |

---

## Workflow 4 Phases (OBLIGATOIRE)

### Phase 1 — Brief (comprendre avant de coder)

1. **Identifier le besoin** : composant, page, section, redesign ?
2. **Contexte utilisateur** : qui utilise ? quel objectif ? quel device principal ?
3. **Contraintes techniques** :
   - Framework : Remix (React 18, Vite HMR)
   - UI library : shadcn/ui (`~/components/ui/`)
   - Icons : lucide-react
   - Styling : Tailwind CSS uniquement (pas de CSS modules, pas de styled-components)
4. **Design system existant** : consulter les tokens avant de choisir couleurs/typo

### Phase 2 — Prototype (direction aesthetique)

1. Choisir une direction aesthetique BOLD (voir section Aesthetics ci-dessous)
2. Definir la palette depuis les design tokens ou justifier une extension
3. Definir la hierarchie typographique
4. Esquisser la structure (H1, sections, CTA, interactions)

### Phase 3 — Code (implementation)

1. Implementer avec shadcn/ui + Tailwind
2. Gerer tous les etats du composant (voir section Component States)
3. Respecter le performance budget (voir section Performance)
4. Tester sur 4 breakpoints : 375px, 768px, 1024px, 1440px

### Phase 4 — Validate (pre-livraison)

Appliquer la Pre-Delivery Checklist ci-dessous. **Tout item echoue = corriger avant livraison.**

---

## Design System Integration

**Source de verite :** `packages/design-tokens/src/tokens/design-tokens.json`

| Token | Valeur | Usage |
|-------|--------|-------|
| `primary` | `#e8590c` (orange) | CTA, accents, prix, urgence |
| `secondary` | `#0d1b3e` (dark blue) | Headers, navigation, confiance |
| `background` | `#ffffff` | Fond principal |
| `surface` | `#f8f9fa` | Cartes, zones secondaires |
| `border` | `#e2e8f0` | Separateurs, contours |

**Regles :**
- Utiliser les tokens existants en priorite
- Si extension necessaire, la justifier (ex: couleur gamme specifique)
- Ne JAMAIS hardcoder des couleurs sans reference au token system
- Importer depuis `packages/design-tokens/src/tokens/generated.ts` ou CSS vars

---

## Component States (OBLIGATOIRE)

Chaque composant interactif doit gerer ces etats :

| Etat | Implementation | Exemple |
|------|----------------|---------|
| **Default** | Etat initial, neutre | Bouton bleu |
| **Hover** | `hover:` Tailwind, transition 150-300ms | Assombrissement, scale(1.02) |
| **Focus** | `focus-visible:` ring visible pour keyboard nav | Ring 2px primary |
| **Active/Pressed** | `active:` retour visuel immediat | Scale(0.98) |
| **Disabled** | `disabled:` opacity + cursor-not-allowed | Opacity 50%, pas de click |
| **Loading** | Spinner ou skeleton | Pulse animation |
| **Error** | Border rouge + message | `border-red-500` + texte erreur |
| **Empty** | Etat vide avec illustration ou CTA | "Aucun resultat" + action |

---

## Accessibility Audit (WCAG 2.1 AA)

| Check | Seuil | Outil |
|-------|-------|-------|
| Contrast ratio (texte normal) | >= 4.5:1 | Chrome DevTools |
| Contrast ratio (texte large) | >= 3:1 | Chrome DevTools |
| Focus visible | Ring visible sur tous les interactifs | Tab navigation |
| Touch target | >= 44x44px mobile | Mesure CSS |
| `aria-label` | Tous les boutons icone-only | Audit code |
| `alt` text | Toutes les images | Audit code |
| `prefers-reduced-motion` | Animations respectent | Media query |
| Semantic HTML | `<button>` pas `<div onClick>` | Audit code |

---

## Performance Budget

| Metrique | Budget | Comment verifier |
|----------|--------|-----------------|
| CSS addition | < 5KB par composant | Estimation Tailwind classes |
| JS bundle impact | < 10KB par composant | Import analysis |
| Animation | Transform + opacity only | Pas de `width`, `height`, `top`, `left` |
| CLS | 0 | Skeleton avec dimensions fixes |
| Images | WebP/AVIF, lazy loading | `loading="lazy"`, format moderne |
| Fonts | Max 2 familles | `font-display: swap` |

---

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors.

## INTERDIT (AI Slop)

NEVER use generic AI-generated aesthetics:
- :x: Overused font families: Inter, Roboto, Arial, system fonts
- :x: Cliched color schemes: particularly purple gradients on white backgrounds
- :x: Predictable layouts and component patterns
- :x: Cookie-cutter design that lacks context-specific character

## OBLIGATOIRE (Distinctive Design)

- :white_check_mark: No design should be the same
- :white_check_mark: Vary between light and dark themes, different fonts, different aesthetics
- :white_check_mark: NEVER converge on common choices (Space Grotesk, for example) across generations

## Automotive-Specific Directions (Automecanik)

| Intent | Tone | Visual Direction |
|--------|------|------------------|
| Urgence (repair-fast) | Industrial/Utilitarian | Bold reds, condensed typography, pulse animations, countdown badges |
| Confiance (trust) | Luxury/Refined | Deep greens (#34C759), verified badges, subtle shadows, OEM quality |
| Pro Mecano | Editorial/Dense | Monospace refs, high-density grids, copy buttons, technical specs |
| Budget | Playful/Value | Savings green, comparison tables, price-drop effects |
| Diagnostic | Soft/Technical | Purple diagnostic, wizard progress, confidence meters |

## Typography Recommendations

For automotive context:
- **Display/Heading**: Montserrat Bold, Archivo Black, Syncopate, DM Sans Bold
- **Body**: DM Sans, Source Sans Pro, Space Mono (for technical refs)
- **Monospace (OEM codes)**: JetBrains Mono, Fira Code, Source Code Pro

## Pre-Delivery Checklist

Before delivering any frontend code:
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] CLS=0 with skeleton dimensions
- [ ] Design tokens respected (primary, secondary, surface)
- [ ] All component states handled (hover, focus, disabled, loading, error, empty)

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

---

## Interaction avec Autres Skills

| Skill | Direction | Declencheur |
|-------|-----------|-------------|
| `ui-os` | ← recoit | `/ui-os` identifie composants manquants → `/frontend-design` les construit |
| `ui-ux-pro-max` | → propose | Apres construction, proposer `/ui-ux-pro-max` pour validation standards |
| `responsive-audit` | → propose | Apres construction, proposer `/responsive-audit` pour check mobile |
