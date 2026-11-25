# R2 - Product/Expert Page (Pack Confiance)

> Intent: Purchase | Flow: Trust-First + Compatibility

## Overview

R2 (Product) pages are the conversion engine. The user has already selected a product category; now they need confidence to purchase.

**Primary Goal:** Build trust through verified compatibility, OEM references, and social proof before the purchase CTA.

## Page Structure

### Above Fold (Critical)

1. **Compatibility Hero**
   - Badge: "Compatible" / "Non compatible" / "Vérifier"
   - Vehicle context displayed (if known)
   - Resolution CTA if unknown: "Vérifier en 10s"

2. **Trust Badges Row**
   - Verified seller badge
   - Return policy
   - Secure payment
   - Delivery estimate

3. **Sticky CTA Bar**
   - Price (prominent)
   - Add to cart button (orange primary action, P44)
   - Quantity selector

### Below Fold

4. **OEM References Section**
   - Original manufacturer numbers
   - Copy-to-clipboard functionality
   - Equivalence list

5. **Reviews Section**
   - Star rating
   - Review count
   - Recent reviews (3-5)

6. **Compatibility Sheet**
   - Full vehicle compatibility table
   - Filterable by brand/model

7. **Related Products**
   - "Souvent achetés ensemble"
   - Alternative products

## Design Tokens

### Colors

Colors come from `packages/design-tokens/src/tokens.json`, by role, never as raw values (P44 of `.claude/governance/journal-des-principes.md`). Navy and orange are the brand colors. Orange marks the one primary action per screen, with navy text; other actions are outlined. Red is for errors and destructive actions only.

### Typography

Outfit for headings, DM Sans for body text, Roboto Mono for codes the user copies, from the tokens (P46). Every weight used is loaded.

### Key Dimensions

Hero height follows the content. Sticky bar height comes from the tokens. Cards use the 12 px radius; badges use a radius role from the tokens: 8 px, 12 px, 16 px or the pill (P46).

## Components (V2)

| Component | File | Purpose |
|-----------|------|---------|
| ProductStickyCTAV2 | `expert/ProductStickyCTAV2.tsx` | Sticky add-to-cart bar |
| CompatibilityBadgeV2 | `expert/CompatibilityBadgeV2.tsx` | Compatibility status + resolver |
| CompatibilitySheetV2 | `expert/CompatibilitySheetV2.tsx` | Full compatibility table |
| TrustRowV2 | `expert/TrustRowV2.tsx` | Trust badges row |
| CompatibilityResolverModal | `expert/CompatibilityResolverModal.tsx` | 10s resolution modal |

## Required Elements

- [ ] Compatibility badge above fold
- [ ] Trust badges visible without scroll
- [ ] Price visible above fold
- [ ] CTA button in sticky bar
- [ ] OEM references with copy button
- [ ] At least 3 reviews displayed

## Forbidden Elements

- [ ] Heavy navigation menus
- [ ] Catalog grids (save for R1)
- [ ] Multiple competing CTAs
- [ ] Intrusive popups
- [ ] Marketing banners above product

## Effects

Every effect below stops when the user asks for reduced motion (`prefers-reduced-motion: reduce`, P45). Durations and shadows come from the tokens (P46).

### Verified Animation
```css
animation: verified-appear var(--transition-base) ease-out;
```

### Compatibility Check
```css
/* On verify button click */
animation: shake-verify var(--transition-fast) ease;
```

### Hover States
A shadow from the tokens, never a raw value.
```css
transition: box-shadow var(--transition-base) ease-out;
```

## Performance Targets

| Metric | Target | Priority |
|--------|--------|----------|
| LCP | ≤ 2500ms | Blocking |
| CLS | ≤ 0.05 | Blocking |
| INP | ≤ 200ms | Monitoring |

### Critical Path

1. Hero image (optimized, srcset)
2. Compatibility badge
3. Price + CTA
4. Trust badges

## Accessibility

- Contrast ratio: 4.5:1 minimum
- Touch targets: 44x44px minimum
- Focus states visible
- Screen reader: product name, price, availability

## Mobile Considerations

- Sticky CTA at bottom (thumb zone)
- Collapsible sections for specs
- Swipeable image gallery
- Sheet-based compatibility resolver

## Schema.org

```json
{
  "@type": "Product",
  "name": "...",
  "sku": "...",
  "offers": {
    "@type": "Offer",
    "price": "...",
    "availability": "InStock"
  }
}
```

## Example

```
/pieces/plaquette-de-frein-402/renault-140/megane-iii-140049/1-5-dci-100413.html
```

## Version

- **Version:** 2.0.0
- **Flow Pack:** confiance
- **Last Updated:** 2026-01-28
