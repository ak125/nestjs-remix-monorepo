> **Scope** — This exemplar is about UI STRUCTURE, states, and CTA placement only.
> It is NOT about SEO content, keywords, URLs, slugs, or meta — those are governed by
> the SEO batch pipeline, not by frontend-design.

# Good exemplar — R2 purchase surface (production-wired)

**Pointer, not a copy.** Read the real file; do not paste its code here — it evolves.

**Target** — `frontend/app/components/pieces/PiecesVehicleContent.tsx`
This is the component the **live R2 route actually renders**
(`frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx` → `PiecesVehicleContent`),
so it is production-proven, not a demo.

## Why it's a good reference (verify against the file, don't assume)

- **Role-correct (R2 = purchase).** It composes the transactional surface — a real add-to-cart
  CTA wired to the cart (`ShoppingCart` from `lucide-react`, `openCartSidebar`, `useRootCart`),
  matching `role-matrix.md` `### R2 — PRODUCT / LISTING TRANSACTIONNEL`. Confirm the page role in
  `.spec/00-canon/role-matrix.md` (surfaced by CLAUDE.md's SEO R* invariants) before reusing this shape.
- **Canon-compliant iconography.** The cart action uses a **lucide icon**, not an emoji —
  matching the skill's "No emoji as icons" checklist. (This is exactly where the earlier
  candidate `MobileOptimizedCard.tsx` fails: 8 emoji glyphs, and it is dead code — imported by
  no route. It is intentionally NOT used as the exemplar.)
- **Mobile-aware.** Uses responsive breakpoints and `dvh` (dynamic viewport height, the mobile-safe
  unit), consistent with the 375/768/1024/1440 discipline.
- **Deferred data with an error path.** Below-the-fold enrichment is streamed via `Await` with an
  `errorElement`, rather than blocking the purchase surface.

## What to extract (and what NOT to)

- **Extract**: role-correct composition, canon-compliant icon usage, responsive/`dvh` layout,
  CTA present and reachable, deferred non-critical content.
- **Do NOT copy blindly**: it is a page-level orchestrator (~600 lines) that delegates the actual
  product cards/grid to sibling components (`PiecesGridView`, `ProductCard`, etc.) — inspect those
  for card-level structure. Re-read the file for its **current** state handling; treat this note
  as a map, not a spec.
