# Canon links for frontend-design

Status: ADVISORY / POINTER-ONLY / NO CANONICAL AUTHORITY

This file does not define or restate product, SEO, design, accessibility,
performance, or governance rules. It only points frontend-design agents to the
current canonical sources for a few concrete concerns. If a linked source
conflicts with this file, the linked canonical source wins.

This skill builds UI STRUCTURE. It never invents keywords, URLs, slugs, meta,
or SEO page content — those are governed by the SEO batch pipeline, not by
frontend-design.

> **Not a role-discovery aid.** Page-role canon (R1/R2/R8…) already lives in
> `.spec/00-canon/role-matrix.md` and is surfaced to every agent by CLAUDE.md's
> "Invariants SEO R*" — a pilot A/B showed agents already resolve the role from
> there, so this file does **not** duplicate it. It covers only: the token hex
> authority, the non-color design-system gates, and an anti-invention guard.
> Paths are relative to the monorepo root.

## Design tokens — the single hex/typography authority

- **Token SoT** — `packages/design-tokens/src/tokens.json`
  (public package export `@fafa/design-tokens/tokens.json`; brand colors in
  `packages/design-tokens/src/tokens/brand-colors.json`).
  This is the **only** authority for color/typography values. Never hardcode a hex.
  (Do not cite the non-existent `src/tokens/design-tokens.json`, nor the empty
  placeholder `src/generated.ts`.)

## Design-system gates (non-color)

- **UX Constitution** — `design-system/UX-CONSTITUTION.md`
  Authority for **performance gates, accessibility minimums, mobile-first
  breakpoints, and anti-AI-slop rules ONLY** (its `### 1. Performance Gates`,
  `### 4. Accessibility Minimums`, `### 5. Mobile-First`, `### 2. Anti-AI-Slop Rules`).
  It is **NOT** the color/hex authority — its Flow Packs table diverges from the
  token SoT above.

## Out of scope (anti-invention guard)

- Do **not** read `.claude/prompts/R2_PRODUCT/*`. Those are SEO
  content-GENERATION contracts (meta_title/description, keyword plans, block copy)
  for the SEO batch pipeline. This skill builds UI structure; it never generates
  meta, keywords, slugs, URLs, or block copy.
