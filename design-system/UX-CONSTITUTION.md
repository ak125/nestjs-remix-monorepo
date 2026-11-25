# UX Constitution - DCO V2

> Design as Continuous Optimization - Automecanik

## Non-Negotiable Rules

### 1. Performance Gates (BLOCKING)

| Metric | Good | Needs Improvement | Poor | Blocking |
|--------|------|-------------------|------|----------|
| **LCP** | ≤ 2500ms | ≤ 4000ms | > 4000ms | Yes |
| **CLS** | ≤ 0.05 | ≤ 0.10 | > 0.10 | Yes |
| **INP** | ≤ 200ms | ≤ 500ms | > 500ms | No |
| **TTFB** | ≤ 800ms | ≤ 1800ms | > 3000ms | No |
| **FCP** | ≤ 1800ms | ≤ 3000ms | > 4500ms | No |
| **TBT** | ≤ 200ms | ≤ 600ms | > 1000ms | No |

**Rule:** Any PR that degrades LCP or CLS beyond thresholds is BLOCKED.

---

### 2. Anti-AI-Slop Rules

#### FORBIDDEN Fonts
```
Inter, Roboto, Arial, Helvetica, Open Sans, system-ui, -apple-system
```

#### FORBIDDEN Colors
```
#7C3AED, #8B5CF6, #A78BFA (generic purple gradients)
```

#### FORBIDDEN Patterns
- Purple gradient on white background
- Gradient card headers
- Glass morphism overuse
- Excessive shadows (>3 layers)
- Emojis as icons (use Lucide)
- Stock photos in hero sections

---

### 3. Role Compliance

**1 URL = 1 Role = 1 Intent**

| Role | Intent | Forbidden Blocks | Required Blocks |
|------|--------|------------------|-----------------|
| R1 (Router) | selection | Product specs, reviews | Filters, navigation, cards |
| R2 (Product) | purchase | Heavy navigation | Trust badges, CTA, compatibility |
| R3 (Blog) | education | Sales CTAs above fold | Content, reading time |
| R4 (Reference) | definition | Filters, prices | Structured data, schema |
| R5 (Diagnostic) | diagnosis | Catalog grids | Wizard, symptoms, solutions |
| R6 (Support) | help | Marketing | Contact, FAQ, legal |

**Violation = UX Debt item with severity: high**

---

### 4. Accessibility Minimums

| Requirement | Value | Enforcement |
|-------------|-------|-------------|
| Color contrast (text) | 4.5:1 minimum | Automated |
| Color contrast (large text) | 3:1 minimum | Automated |
| Touch targets | 44x44px minimum | Manual audit |
| Focus states | Visible on all interactives | Automated |
| Reduced motion | Respect `prefers-reduced-motion` | Manual |
| Alt text | All images must have alt | Automated |

---

### 5. Mobile-First

- **Default viewport:** 390 px wide (measurement reference), also measured at 1440 px; no page overflows at 360 px or 320 px (P48)
- **Breakpoints:** 375px, 768px, 1024px, 1440px
- **Touch-first:** All interactions work with touch
- **Thumb zone:** Critical CTAs in bottom 60% of screen

---

### 6. Pre-Delivery Checklist

Before ANY component or page ships:

- [ ] No emojis as icons (use Lucide)
- [ ] `cursor: pointer` on all clickables
- [ ] Hover transitions: 150-300ms
- [ ] Contrast ratio: 4.5:1 minimum verified
- [ ] Focus states visible (`:focus-visible`)
- [ ] Reduced motion respected
- [ ] Responsive at all breakpoints tested
- [ ] Skeleton loaders for async content (no CLS)
- [ ] Error states designed
- [ ] Empty states designed

---

## Flow Packs (User Intent)

| Pack | Intent | Tone | Colors |
|------|--------|------|--------|
| **Urgence** | repair-fast | Industrial/Bold | By role, from the tokens (P44) |
| **Confiance** | trust-first | Luxury/Refined | By role, from the tokens (P44) |
| **Pro Mecano** | dense-technical | Editorial/Dense | By role, from the tokens (P44) |
| **Budget** | value-for-money | Playful/Value | By role, from the tokens (P44) |
| **Diagnostic** | symptom-to-part | Soft/Technical | By role, from the tokens (P44) |

---

## Enforcement

- **CI/CD:** `.github/workflows/perf-gates.yml` blocks PRs on bundle regressions via [size-limit](https://github.com/ai/size-limit) (Andrey Sitnik, standard industriel adopté par React/Redux/MobX/Prettier). Gzip-based, déterministe, pas de Lighthouse synthétique.
- **Bundle budgets:** `frontend/.size-limit.json` — see `frontend/size-limit.README.md` for philosophy and calibration history.
- **Database:** `__ux_perf_gates` table stores configurable thresholds
- **Skills:** `.claude/skills/ui-ux-pro-max/` validates designs

---

## Version

- **Version:** 2.0.0
- **Last Updated:** 2026-01-28
- **Maintainer:** AI-COS System
