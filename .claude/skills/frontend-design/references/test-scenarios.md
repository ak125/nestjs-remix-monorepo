# `frontend-design` — Test scenarios (TDD light)

> **Scope** — Skill technique (vs discipline-enforcing). Per `writing-skills` canon, technique skills are tested via *application*, *variation*, and *gap* scenarios — not via baseline/pressure subagents.
>
> **Purpose** — Provide reproducible scenarios to validate that the skill produces canon-compliant output. Run these manually when modifying SKILL.md or when onboarding a new contributor.

---

## Scenario 1 — Application (golden path)

**Prompt** —
> « Build a hero section for the home page of an automotive parts e-commerce site. Target customer = particulier cherchant une pièce urgente. »

**Without skill (baseline expectation)** — Generic Tailwind output likely with:
- Inter font (or no font specified)
- Default shadcn/ui Button blue (`bg-blue-600`)
- Hardcoded hex like `#3b82f6` or `#ffffff`
- Missing focus / disabled / motion-reduce states
- No aria-labels
- No responsive breakpoints beyond `md:`

**With skill (expected compliant output)** —
- ✅ Picks **Urgence (Industrial)** aesthetic direction (matches "pièce urgente" intent)
- ✅ Uses `bg-[color:var(--color-primary-500)]` (navy) for hero background
- ✅ Uses `bg-[color:var(--color-semantic-action)]` (orange `#F97316`) for the CTA
- ✅ Uses `font-heading` / `font-body` (Outfit / DM Sans), not Inter
- ✅ Implements at minimum: hover + focus-visible + active + disabled states
- ✅ Includes `motion-reduce:transform-none`
- ✅ Includes `aria-labelledby` or `aria-label`
- ✅ Tests responsive at 4 breakpoints
- ✅ No `style={{ … }}` inline

**Verification** — Tick boxes on Pre-Delivery Checklist. All 12 items must pass.

---

## Scenario 2 — Variation (redesign existing)

**Prompt** —
> « Redesign the product card on `frontend/app/components/product-card.tsx` for the Pro Mecano direction. »

**Without skill** — Likely keeps existing shadcn/ui `<Card>` defaults, swaps a color or two, no aesthetic shift.

**With skill (expected output)** —
- ✅ Reads `packages/design-tokens/src/tokens/design-tokens.json` to confirm current SoT
- ✅ Adopts **editorial / dense** tone — monospace OEM ref, copy button, high-density spec grid
- ✅ Uses `font-data` (`ui-monospace`) for OEM codes
- ✅ Reuses tokens (no new hex invented)
- ✅ Adds empty / loading / error states (Component States table)
- ✅ Verifies contrast on the new dense layout (WCAG ≥ 4.5:1 normal text)
- ✅ PR description mentions the chosen direction + 5 measurable axes

**Verification** — Diff vs previous version should show only token-referenced color/font changes + added states. No new hardcoded hex.

---

## Scenario 3 — Gap test (out-of-scope detection)

**Prompt** —
> « Build a real-time line chart showing 30 days of search impressions from GSC. »

**Why this is a gap test** — The skill covers components / pages / sections / redesign. It does **not** explicitly cover data visualization (charts, graphs, dataviz primitives).

**Expected behavior with skill** —
- ✅ Recognizes scope mismatch — chart libraries (Recharts, Visx, ECharts, Tremor) are not in the Stack section
- ✅ Surfaces the gap explicitly to the user: « Le skill `frontend-design` ne couvre pas explicitement les viz. Recommandations possibles — Recharts (intégré shadcn/ui), Tremor (DSL React), Visx (D3 typed). Confirmer le choix avant de coder. »
- ✅ Still applies Pre-Delivery Checklist to the chart wrapper component (tokens, states, a11y)
- ❌ Does NOT silently invent a chart pattern outside the skill scope

**Verification** — Surfaced gap = pass. Silent invention = fail (skill scope should be expanded or a sibling `dataviz-design` skill created).

---

## Scenario 4 — Drift detection (anti-rationalization)

**Prompt** —
> « Quick — use Inter for the heading, it's faster and looks fine. »

**Expected behavior with skill** —
- ✅ Triggers Red Flags table row « Inter goes faster, let me just use it »
- ✅ Asks user for justification vs Outfit / DM Sans (brand identity rationale)
- ✅ If no real reason → defaults to SoT Outfit
- ❌ Does NOT silently accept Inter

**Verification** — Either justified deviation documented in commit message, or SoT fonts used. Silent Inter substitution = fail.

---

## How to run

These scenarios are designed to be run **manually** during PR review of any change to `SKILL.md`. There is no automated runner today (skill-level smoke tests would require a sandbox Claude Code session — out of scope for the current monorepo CI).

Future improvement — script `scripts/audit/skill-scenario-runner.sh` could spawn a `claude --print --skill frontend-design` session per scenario and diff against an expected-output fixture. Tracked as a *nice-to-have*, not blocking.

---

## Maintenance

When `packages/design-tokens/src/tokens/design-tokens.json` changes — re-validate **Scenario 1** and **Scenario 2** to make sure SKILL.md still cites the correct token paths and hex values.

When upstream `anthropics/claude-plugins-official/frontend-design` releases a new version — re-run **Scenario 3** to detect any new scope additions that should propagate to the internal skill.
