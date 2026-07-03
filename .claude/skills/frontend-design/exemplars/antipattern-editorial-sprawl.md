> **Scope** — This exemplar is about UI STRUCTURE and layout order only.
> It is NOT about SEO content, keywords, URLs, slugs, or meta — those are governed by
> the SEO batch pipeline, not by frontend-design. The word "SEO" below refers to *where
> editorial blocks sit in the layout*, never to generating them.

# Anti-pattern — editorial sprawl that buries the handoffs

**Described risk, not a named file.** This anti-pattern is illustrated generically on purpose:
no real route is labelled "bad" here. A page can be fully canon-conformant and still be misjudged
if you only skim it — so verify layout *order*, not just presence of editorial blocks.

## The anti-pattern

On a page whose job is to route the user onward (e.g. an **R8 vehicle fiche**, which hands off to
R1 gamme / R2 product), the failure mode is **putting long editorial/SEO blocks above the useful
handoffs**, so a user has to scroll past guides/FAQ/trust walls before reaching the links that let
them act.

Symptoms:
- Hero → long intro → how-to → FAQ → *then* the catalogue/handoff grid, far below the fold.
- The primary next-step (link to gammes/products) is visually subordinate to editorial content.
- No early jump-link to the actionable section.

## What is NOT the anti-pattern (avoid over-correcting)

- **Absence of a cart on an R8 page is correct by canon**, not a bug. `role-matrix.md`
  `### R8 — VEHICLE / FICHE VEHICULE` lists cart/pricing among the **forbidden** dominant signals;
  R8 hands off to R1/R2, it does not sell directly. Do **not** "fix" a no-cart R8 page by adding a
  basket.
- **Rich editorial content is allowed** — the issue is *order/prominence*, not existence. Editorial
  sits **below** the handoffs, not above them.

## The good shape

Put the handoffs first: hero → fast-access / jump-link to the catalogue → the handoff grid
(links to compatible gammes / products) → *then* editorial (guides, FAQ, trust). Confirm the target
page's role and its allowed/forbidden blocks in `.spec/00-canon/role-matrix.md` (surfaced by
CLAUDE.md's SEO R* invariants) before deciding the order.

> Before calling any real page an example of this anti-pattern, prove it with a measured signal
> (e.g. editorial byte/DOM share sitting above the first handoff). Skimming is not evidence — a
> page that renders its handoff grid above the editorial is conformant, not sprawl.
